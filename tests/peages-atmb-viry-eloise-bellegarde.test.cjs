'use strict';
// Ajout ATMB (Autoroutes et Tunnel du Mont Blanc, A40 "Autoroute Blanche"),
// 6 nov. 2026, suite a "Continue" apres decouverte de 2 fichiers officiels
// jamais exploites dans les dossiers deja fournis par Laurent :
// ATMB-tarifs-2026.pdf (communique de presse officiel ATMB, 15 janvier 2026)
// et ATMB-flyer-tarifs.png (meme grille, format flyer). Grille applicable au
// 1er fevrier 2026, confirmee identique sur les 2 documents.
//
// ATMB etait un reseau ENTIEREMENT absent de la base (aucune relation de
// prix), alors qu'il couvre un axe tres pertinent pour Laurent (Annemasse -
// vallee de l'Arve - Le Fayet, acces au Tunnel du Mont Blanc, en plein cœur
// de Haute-Savoie).
//
// La grille officielle couvre 2 groupes de relations (classes 1 et 2
// uniquement, perimetre du projet) :
//   - "ANNEMASSE-CHATILLON EN MICHAILLE" (3 relations) : Viry<->Eloise,
//     Viry<->Bellegarde, Bellegarde<->Eloise.
//   - "LE FAYET-GAILLARD" (7 relations, toutes via un point de reference
//     "Scientrier") : Le Fayet<->Cluses, Le Fayet<->Scientrier, Cluses
//     Centre<->Scientrier, Scionzier<->Scientrier, Bonneville Ouest/Est
//     <->Scientrier, Scientrier<->Gaillard.
//
// SEUL le premier groupe (3 relations) est ajoute ici : VIRY, ELOISE et
// BELLEGARDE existaient DEJA comme gares dans peages-aprr.json (coordonnees
// GPS quasi identiques au referentiel officiel data/gares-peage-officiel.json,
// a moins de 30m) mais SANS AUCUNE relation de prix entre elles -- aucune
// gare ajoutee, seulement 3 tarifs. Verification anti-collision GPS
// (recherche du point existant le plus proche) effectuee avant ajout : les 3
// points matchent leur propre entree existante a moins de 30m, aucune autre
// collision.
//
// Le second groupe ("Le Fayet-Gaillard", 7 relations) N'EST PAS ajoute :
// "Scientrier" et "Le Fayet" n'ont pas de coordonnees GPS trouvees dans le
// referentiel officiel (data/gares-peage-officiel.json), ni dans la base OSM
// locale (data/osm-peages-france.json, qui a pourtant confirme 24 points
// ATMB par ailleurs : Viry, Eloise, Bellegarde, Cluses Amont/Aval/Centre,
// Scionzier, Bonneville Est/Ouest, Nangy, Tunnel du Mont Blanc), ni via
// recherche web suffisamment precise. Sans GPS fiable pour ces 2 points de
// reference, impossible d'ajouter les 7 relations sans approximation --
// chantier ATMB distinct, a reprendre si une source plus precise est trouvee
// (ex. "Gaillard" pourrait utiliser le point OSM "Péage de Nangy" deja
// confirme, mais toutes les 7 relations impliquent aussi Scientrier ou Le
// Fayet, donc aucune n'est ajoutable isolement).
//
// Prix ajoutes (classes 1/2, source : grille officielle ATMB 1er fev. 2026) :
//   VIRY<->ELOISE       : 4,40 / 7,50 EUR
//   VIRY<->BELLEGARDE   : 5,80 / 10,00 EUR
//   BELLEGARDE<->ELOISE : 1,40 / 2,50 EUR
//
// Run: node --test tests/peages-atmb-viry-eloise-bellegarde.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const officiel = require('../data/gares-peage-officiel.json');

function decoderPrix() {
  const lignes = aprr.p.split(';');
  const prix = new Map();
  for (const l of lignes) {
    const [a, b, c1, c2] = l.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10]);
  }
  return prix;
}
function idx(nom) { return aprr.g.findIndex(g => g[0] === nom); }
function dist(lat1, lon1, lat2, lon2) { return 111 * Math.sqrt((lat1 - lat2) ** 2 + ((lon1 - lon2) * Math.cos(lat1 * Math.PI / 180)) ** 2); }

test('VIRY, ELOISE et BELLEGARDE existaient deja comme gares avec un GPS conforme au referentiel officiel (moins de 50m)', () => {
  const cas = [
    { aprrNom: 'VIRY', officiel: 'Viry' },
    { aprrNom: 'ELOISE', officiel: 'Eloise' },
    { aprrNom: 'BELLEGARDE', officiel: 'Bellegarde Sortie' },
  ];
  for (const { aprrNom, officiel: nomOff } of cas) {
    const g = aprr.g.find(x => x[0] === aprrNom);
    const o = officiel.d.find(x => x[0] === nomOff);
    assert.ok(g && o, aprrNom + '/' + nomOff + ' doivent exister');
    const [lat1, lon1] = g[1][0];
    const [, , lat2, lon2] = o;
    assert.ok(dist(lat1, lon1, lat2, lon2) < 0.05, aprrNom + ' devrait etre a moins de 50m du referentiel officiel');
  }
});

test('3 relations ATMB Viry/Eloise/Bellegarde ajoutees, prix exacts (classes 1 et 2)', () => {
  const prix = decoderPrix();
  const get = (a, b) => { const i = idx(a), j = idx(b); return prix.get(Math.min(i, j) * 1000 + Math.max(i, j)); };
  assert.deepEqual(get('VIRY', 'ELOISE'), [4.4, 7.5]);
  assert.deepEqual(get('VIRY', 'BELLEGARDE'), [5.8, 10]);
  assert.deepEqual(get('BELLEGARDE', 'ELOISE'), [1.4, 2.5]);
});

test('les 3 nouvelles relations Viry/Eloise/Bellegarde n\'existent chacune qu\'une seule fois (pas de doublon introduit)', () => {
  // VIRY, ELOISE, BELLEGARDE sont des noms deja utilises par d'autres reseaux
  // (AREA notamment, meme region) et avaient donc deja de nombreuses AUTRES
  // relations avant cet ajout -- seul le NOMBRE D'OCCURRENCES DE CHAQUE PAIRE
  // SPECIFIQUE est verifie ici, pas le total des relations impliquant ces
  // gares.
  const lignes = aprr.p.split(';');
  const viry = idx('VIRY'), eloise = idx('ELOISE'), bellegarde = idx('BELLEGARDE');
  const compte = (x, y) => lignes.filter(l => {
    const [a, b] = l.split(',');
    const pa = parseInt(a, 36), pb = parseInt(b, 36);
    return (pa === x && pb === y) || (pa === y && pb === x);
  }).length;
  assert.equal(compte(viry, eloise), 1);
  assert.equal(compte(viry, bellegarde), 1);
  assert.equal(compte(eloise, bellegarde), 1);
});

test('chantier ATMB restant documente : le groupe "Le Fayet-Gaillard" (7 relations) necessite un GPS fiable pour Scientrier et Le Fayet, introuvable cette session', () => {
  assert.equal(idx('SCIENTRIER'), -1);
  assert.equal(idx('LE FAYET'), -1);
  assert.equal(idx('GAILLARD'), -1);
});
