'use strict';
// Correction methodologique du 6 nov. 2026, decouverte en cherchant des sources
// tarifaires officielles pour les 4 angles morts restants de l'audit data.gouv.fr
// (Audomarois B, St Michel amont, Frejus Est, Le Mans Ouest -- voir
// tests/peages-audit-officiel-data-gouv-gaps.test.cjs).
//
// Le referentiel officiel data/gares-peage-officiel.json porte un champ "type"
// (5e colonne, f: "nom,route,lat,lon,type,voies") qui ne contient que deux
// valeurs sur l'ensemble du fichier (1266 enregistrements) :
//   - "Bpv" (Barriere Pleine Voie) : 255 enregistrements -- une VRAIE barriere
//     de peage, avec un tarif fixe classe1/classe2 attache (ex. Buchelay BPV,
//     Dozule BPV Nord -- voir tests/peages-buchelay-dozule-flux-libre.test.cjs).
//   - "Ech" (Echangeur) : 1011 enregistrements -- un simple point d'entree/
//     sortie d'autoroute, SANS tarif propre : en systeme ouvert, le prix depend
//     du couple entree/sortie reel du trajet (meme mecanisme que "Tarare Est
//     Entree/Sortie O", "Dordives", ou "Vallee de la Hem" -- deja modelise
//     ailleurs dans le projet via overlay.paires, PAS via un tarif fixe).
//
// Verification faite ce jour : les 4 angles morts restants (Audomarois B,
// St Michel amont, Frejus Est, Le Mans Ouest) sont TOUS de type "Ech", jamais
// "Bpv". Chercher un "tarif de barriere classe1/classe2" pour eux via recherche
// web (ce qui a ete tente la veille, sans succes) etait donc la mauvaise
// question : un echangeur n'a jamais de tarif fixe intrinseque. S'il existe un
// prix reel pour un trajet passant par l'un de ces points, c'est une relation
// point-a-point avec la VRAIE origine/destination du trajet, a chercher dans la
// grille tarifaire COMPLETE de l'exploitant (matrice par paires, comme
// sanef_a26_axis132.json utilise precedemment dans ce projet) -- pas dans un
// simple PDF de tarifs agreges trouve par recherche web generique.
//
// Decision : aucun changement de donnees ce jour (aucun prix invente, aucune
// grille complete d'exploitant obtenue). Les 4 points restent dans UNK, qui
// reste la representation correcte (refus explicite plutot qu'omission
// silencieuse ou prix invente) en attendant une grille officielle complete.
//
// Run: node --test tests/peages-unk-type-ech-vs-bpv.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const OFFICIEL = require('../data/gares-peage-officiel.json');

const QUATRE_RESTANTS = [
  ['Audomarois B Sortie Sens 1', 50.72292, 2.16534],
  ['Audomarois B Entree Sens 2', 50.7231, 2.16714],
  ['St Michel amont', 45.21646, 6.46587],
  ['Fréjus Est', 43.47233, 6.74324],
  ['Le Mans Ouest', 47.98195, 0.05435],
];

const DEUX_EXPLIQUES_FLUX_LIBRE = [
  ['Buchelay BPV Sens 1', 48.98384, 1.68125],
  ['Dozule BPV Nord Sens 1', 49.23071, -0.07124],
];

test('le referentiel officiel ne contient que deux types de points : Bpv (barriere) et Ech (echangeur)', () => {
  const types = new Set(OFFICIEL.d.map(r => r[4]));
  assert.deepEqual([...types].sort(), ['Bpv', 'Ech']);
});

test('les 4 angles morts restants (hors Buchelay/Dozule) sont tous de type Ech, jamais Bpv', () => {
  for (const [nom, lat, lon] of QUATRE_RESTANTS) {
    const rec = OFFICIEL.d.find(r => r[2] === lat && r[3] === lon);
    assert.ok(rec, nom + ' doit exister dans le referentiel officiel a ' + lat + ',' + lon);
    assert.equal(rec[4], 'Ech', nom + ' devrait etre de type Ech (echangeur), pas Bpv (barriere)');
  }
});

test('Buchelay et Dozule sont bien de type Bpv (barriere physique, confirmant la piste flux-libre, pas systeme ouvert)', () => {
  for (const [nom, lat, lon] of DEUX_EXPLIQUES_FLUX_LIBRE) {
    const rec = OFFICIEL.d.find(r => r[2] === lat && r[3] === lon);
    assert.ok(rec, nom + ' doit exister dans le referentiel officiel');
    assert.equal(rec[4], 'Bpv', nom + ' devrait etre de type Bpv (barriere), pas Ech (echangeur)');
  }
});
