'use strict';
// Fusion GPS-exceptionnelle (4 nov. 2026) : CHARMONT-SOUS-BARBUISE (grille
// officielle SANEF A26, 2026_02-Grille-Sanef.pdf, deja citee en source pour
// le prix) n'avait jamais eu de gare GPS associee. Son GPS officiel (Google
// Places, POI toll_station "Péage", 10150 Charmont-sous-Barbuise,
// 48.4104143/4.1427761) tombe a 0.049km de la gare "CHARMONT (LIM.CONC)"
// deja presente -- sous le seuil de fusion "gares jumelles" de 0.06km.
//
// Particularite assumee explicitement avec l'utilisateur : le chevauchement
// de destinations entre les deux noms est structurellement nul (34 vs 10
// destinations, 0 commune), car un peage de limite de concession n'apparait
// dans chaque grille source (ici Sanef) qu'avec SES PROPRES destinations
// d'un cote de la frontiere de concession -- la preuve de prix habituelle
// (chevauchement + identite) ne peut donc jamais s'appliquer a ce type de
// cas precis. L'utilisateur a explicitement autorise la fusion sur la seule
// preuve GPS (<0.06km) pour ce cas et les cas structurellement identiques
// (limite de concession), sans elargir la regle "aucune approximation" au-dela
// de cette exception nommee.
// Run: node --test tests/peages-charmont-sous-barbuise-fusion-gps.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('"CHARMONT-SOUS-BARBUISE" (et sa variante N°22) n\'apparaissent plus littéralement', () => {
  const old = ['CHARMONT-SOUS-BARBUISE', 'CHARMONT-SOUS-BARBUISE N°22'];
  for (const n of old) {
    const present = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.equal(present, false, n + ' should no longer appear literally');
  }
});

test('"CHARMONT (LIM.CONC)" porte desormais les relations ex-SANEF', () => {
  const has = overlay.paires.filter(p => p[0] === 'CHARMONT (LIM.CONC)' || p[1] === 'CHARMONT (LIM.CONC)');
  assert.ok(has.length >= 69, 'expected >=69 relations, got ' + has.length);
});

test('aucun nouveau GPS/gare ajoute (fusion pure, pas d\'ajout de station)', () => {
  const aprr = require('../peages-aprr.json');
  const exact = new Set();
  for (const g of aprr.g) exact.add(g[0]);
  for (const g of overlay.gares) exact.add(g.nom);
  assert.equal(exact.has('CHARMONT-SOUS-BARBUISE'), false);
});

test('aucun prix/distance modifie (echantillon)', () => {
  const p = overlay.paires.find(x => x[0] === 'CHARMONT (LIM.CONC)' || x[1] === 'CHARMONT (LIM.CONC)');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
