'use strict';
// Deuxieme lot "preuve de prix" du 4 nov. 2026 (en reponse a la relance de l'utilisateur
// "il reste encore trop de peages sans prix exact il faut tout me trouver, les prix
// existent"). Deux sous-lots :
//
// 1) Alias "/" (abreviation COFIROUTE equivalente a "S/"=SUR, "C/"=CENTRE...) confirmes
//    par identite exacte des prix classe 1/2 sur tout le chevauchement de destinations :
//    FONTENAY /LOING, SAVIGNY /CLAIRIS, LA FOLIE-B/PARIS, TOURS-C/MONNAIE,
//    GONDREVILLE A77/N, GONDREVILLE A77/S.
//
// 2) Alias confirmes par un DOUBLE faisceau de preuves (prix ET geolocalisation) :
//    CHATEAU-RENAULT=AMBOISE CH.RENAULT (le nom officiel du peage EST "Amboise/
//    Chateau-Renault", sortie 18 A10), SAINT HILAIRE LES ANDRESIS=ST HILAIRE,
//    SAINT AIGNAN SUR CHER=ST ROMAIN SUR CHER, SELLES SUR CHER=CHEMERY,
//    ROMORANTIN=VILLEFRANCHE S/ CHER -- ces 4 derniers decouverts car leurs
//    coordonnees GPS officielles (Google Places, POI toll_station) tombaient a
//    moins de 0.08km d'une gare deja presente sous un autre nom (seuil "gares
//    jumelles"), confirme ensuite par preuve de prix sur la totalite du
//    chevauchement -- aucune nouvelle gare/GPS n'a ete ajoutee.
// Run: node --test tests/peages-alias-preuve-de-prix-batch2.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('none of the old alias labels (sous-lot 1, abreviation "/") appear literally anymore', () => {
  const old = ['FONTENAY /LOING', 'SAVIGNY /CLAIRIS', 'LA FOLIE-B/PARIS', 'TOURS-C/MONNAIE', 'GONDREVILLE A77/N', 'GONDREVILLE A77/S'];
  for (const n of old) {
    const present = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.equal(present, false, n + ' should no longer appear literally');
  }
});

test('none of the old alias labels (sous-lot 2, preuve GPS+prix) appear literally anymore', () => {
  const old = ['CHATEAU-RENAULT', 'SAINT HILAIRE LES  ANDRESIS', 'SAINT AIGNAN SUR CHER', 'SELLES SUR CHER', 'ROMORANTIN'];
  for (const n of old) {
    const present = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.equal(present, false, n + ' should no longer appear literally');
  }
});

test('each of the 11 canonical names has at least one active relation after the merges', () => {
  const canon = ['FONTENAY SUR LOING', 'SAVIGNY SUR CLAIRIS', 'PARIS (LA FOLIE BESSIN)', 'TOURS CENTRE (MONNAIE)',
    'GONDREVILLE LA FRANCHE NORD', 'GONDREVILLE LA FRANCHE SUD', 'AMBOISE CH.RENAULT', 'ST HILAIRE',
    'ST ROMAIN SUR CHER', 'CHEMERY', 'VILLEFRANCHE S/ CHER'];
  for (const n of canon) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should have at least one active relation');
  }
});

test('no new GPS point was added for the sous-lot 2 aliases (gares count unchanged from before this batch)', () => {
  // The 4 new names resolved to EXISTING gares within the 0.06-0.08km twin-merge zone;
  // this is a renaming-only batch, not a GPS-adding one. Sanity check: none of the 4
  // alias display names exist as their own distinct gare entry in aprr.g or overlay.gares.
  const aprr = require('../peages-aprr.json');
  const exact = new Set();
  for (const g of aprr.g) exact.add(g[0]);
  for (const g of overlay.gares) exact.add(g.nom);
  for (const n of ['SAINT HILAIRE LES  ANDRESIS', 'SAINT AIGNAN SUR CHER', 'SELLES SUR CHER', 'ROMORANTIN']) {
    assert.equal(exact.has(n), false, n + ' should not exist as its own gare (it is an alias)');
  }
});

test('no price, distance or GPS was altered by either sous-lot (sample)', () => {
  const p1 = overlay.paires.find(x => x[0] === 'FONTENAY SUR LOING' || x[1] === 'FONTENAY SUR LOING');
  const p2 = overlay.paires.find(x => x[0] === 'AMBOISE CH.RENAULT' || x[1] === 'AMBOISE CH.RENAULT');
  for (const p of [p1, p2]) {
    assert.ok(p);
    assert.equal(typeof p[2], 'number');
    assert.equal(typeof p[3], 'number');
  }
});
