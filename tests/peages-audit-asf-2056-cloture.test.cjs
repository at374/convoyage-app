'use strict';
// Clôture de l'audit systématique de Tarifs_ASF.txt (7 nov. 2026, 2056 lignes,
// grille ASF officielle CSV ";"-séparée : autoroute_entree;nom_entree;
// autoroute_sortie;nom_sortie;classe1;classe2;classe3;classe4;classe5).
//
// Démarche : comparaison automatique de chaque nom "entrée"/"sortie" du fichier
// contre toutes les gares connues de la base (aprr.g + overlay.gares +
// overlay.barrieres + overlay.paires), avec normalisation (casse, espace vs
// trait d'union, apostrophe). Première passe (vérification sensible à la
// casse) : 169 noms signalés "manquants" -- presque tous des FAUX POSITIFS
// dus à des variantes de casse/typo (ex. "MARTEL" vs "Martel", "ST GERMAIN
// LES VERGN" vs "St Germain les Vergnes" tronqué par le CSV, "ONDRES" vs
// "Ondres", "BAYONNE MOUSSEROLLES" vs "Bayonne-Mousserolles").
//
// Après normalisation correcte : UNIQUEMENT 13 noms distincts restent
// signalés, dont :
//   - "nom_entree" / "nom_sortie" : artefacts d'en-tête CSV (lignes non
//     tarifaires), aucune relation réelle concernée.
//   - "PUYMORENS ENTREE" / "PUYMORENS SORTIE" : ligne marqueur de fin de
//     fichier, autoroute "PUY" et tous les champs de prix valant "#N/A" --
//     aucune relation tarifaire réelle, rien à ajouter.
//   - "A8: AIX-EN-PROVENCE" : marqueur structurel (comme "A9: ESPAGNE"),
//     jamais sa propre ligne de prix -- pas un péage physique.
//   - "BIARRITZ ECHANGEUR", "GIGNAC" : FAUX POSITIFS de normalisation
//     (accents/parenthèses pour le premier, résolu par preuve de prix comme
//     alias de "Martel" pour le second -- cf.
//     peages-gignac-alias-martel.test.cjs). Déjà couverts par des prix
//     corrects en base.
//   - "ST GERMAIN LES VERGN" : tronqué par le CSV, alias confirmé de
//     "St Germain les Vergnes" (session précédente).
//
// Il reste EXACTEMENT 5 noms physiques non résolus, bloquant 48 des 2056
// relations du fichier (2,3%) -- chacun documenté et laissé volontairement
// NON ajouté, conformément à la règle "zéro approximation" :
//   - PERIGUEUX / PERIGUEUX EST (A89) : lié à l'ambiguïté déjà identifiée
//     "La Bachellerie" / "Mansac Terrasson" (un même point en base pourrait
//     correspondre à plusieurs barrières officielles distinctes -- voir
//     tests/peages-unk-nettoyage-points-resolus.test.cjs). Un candidat GPS
//     "Péage de Thenon - A89 - Sortie N°17" tombe à 0,0012km de "La
//     Bachellerie" déjà en base, mais la source officielle (ASF_2014.pdf)
//     distingue EXPLICITEMENT 6 gares séparées au même PK157 (Thenon
//     barrière x2, Thenon échangeur x2, La Bachellerie x2) -- restructuration
//     trop risquée pour cette session.
//   - ST JEAN DE LUZ NORD (A63) : ASF_2014.pdf laisse deviner DEUX points
//     distincts portant potentiellement ce nom (PK198, proche de l'existant
//     "ST JEAN DE LUZ SUD" ; et PK183, proche de "Biarritz (échangeur)",
//     probablement = l'entrée déjà présente mais sans GPS "BAYONNE-S JEAN LUZ
//     N"). Aucune source (Google Places, Overpass -- indisponible/saturé ce
//     jour) ne permet de trancher avec certitude.
//   - THOUARCE (A87) : aucune coordonnée GPS trouvée.
//   - LE BOULOU (F) (A9) : confirmé comme un TROISIÈME point physique distinct
//     de "Le Boulou (O)" et "Le Perthus" (déjà en base) -- preuve par
//     désaccord de prix sur les mêmes destinations (ex. vers BRAM : 17,7€ vs
//     19,8€ pour Le Perthus). Aucune coordonnée GPS fiable trouvée.
//
// Run: node --test tests/peages-audit-asf-2056-cloture.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');

test('les 5 noms physiques non résolus de Tarifs_ASF.txt restent bien absents de la base (documentation, pas une fabrication)', () => {
  const aprr = require('../peages-aprr.json');
  const overlay = require('../peages-overlay.json');
  const names = new Set([
    ...aprr.g.map(g => g[0].toUpperCase()),
    ...overlay.gares.map(g => g.nom.toUpperCase()),
    ...overlay.barrieres.map(b => b.id.toUpperCase()),
  ]);
  for (const n of ['PERIGUEUX', 'PERIGUEUX EST', 'THOUARCE', 'ST JEAN DE LUZ NORD', 'LE BOULOU (F)']) {
    assert.equal(names.has(n), false, n + ' ne doit pas avoir été ajouté sans source GPS fiable');
  }
});

test('GIGNAC (alias Martel) et BIARRITZ ECHANGEUR (= Biarritz (échangeur)) restent correctement résolus', () => {
  const aprr = require('../peages-aprr.json');
  const overlay = require('../peages-overlay.json');
  assert.ok(aprr.g.some(g => g[0] === 'Martel'));
  assert.ok(aprr.g.some(g => g[0] === 'Biarritz (échangeur)'));
  const rel = overlay.paires.some(p =>
    (p[0] === 'Biarritz (échangeur)' && p[1] === 'BAYONNE-S JEAN LUZ N') ||
    (p[1] === 'Biarritz (échangeur)' && p[0] === 'BAYONNE-S JEAN LUZ N'));
  assert.ok(rel, 'la relation Biarritz (échangeur) <-> BAYONNE-S JEAN LUZ N doit exister');
});

// L'identification géographique ne vaut pas preuve de correspondance tarifaire.
test('THOUARCE A87 : candidats officiels documentés, sans ajout tarifaire prématuré', () => {
  const officiel = require('../data/gares-peage-officiel.json');
  const candidats = officiel.d.filter(r => r[1] === '49A908715CD');
  assert.deepEqual(new Set(candidats.map(r => r[0])), new Set(['Thouarce E', 'Thouarce S']));
  assert.ok(candidats.every(r => r[4] === 'Ech'));
});

// Plusieurs gares physiques proches portent des noms liés, mais ne doivent
// jamais être fusionnées uniquement par proximité ou par un nom partiel.
test('A89 et A9 : les installations officielles distinctes restent identifiables', () => {
  const d = require('../data/gares-peage-officiel.json').d;
  const code = id => d.filter(r => r[1] === id);
  assert.deepEqual(new Set(code('24A908935CD').map(r => r[0])),
    new Set(['Thenon Est E', 'Thenon Est S', 'La Bachellerie Entree', 'La Bachellerie Sortie']));
  assert.equal(code('A0089').filter(r => r[0] === 'Thenon vers Perigueux').length, 1);
  assert.equal(code('66A900915CD').filter(r => r[0] === 'Le Boulou').length, 4);
  assert.equal(code('A0009').filter(r => r[0] === 'Le Perthus').length, 2);
  assert.notEqual('66A900915CD', 'A0009');
});
