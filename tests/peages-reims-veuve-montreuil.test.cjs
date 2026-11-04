'use strict';
// Suite directe de la fusion GPS-exceptionnelle CHARMONT-SOUS-BARBUISE (4 nov. 2026) :
// meme type de cas (grille SANEF A4/A26 self-contained, chevauchement de
// destinations structurellement nul) retrouve pour deux autres noms, avec un
// GPS officiel source tombant sous le seuil de fusion 0.06km :
// - ORMES -> REIMS NORD (ORMES) (0.013km, quasi le meme point)
// - CHÂLONS-EN-CHAMPAGNE / LA VEUVE[/N°24] -> CHALONS MOURMELON (0.035km)
// Une troisieme decouverte distincte : BARRIERE DE MONTREUIL AUX LIONS est
// un peage reel physiquement different de l'homonyme "MONTREUIL AUX LIONS"
// deja present (desaccord de prix total sur 31/31 destinations communes) et
// son GPS officiel (Google Places, POI toll_station "Toll Montreuil-aux-
// Lions", A4 km64) tombe a 0.775km du point existant le plus proche --
// aucun seuil de fusion ni de detection de barriere franchi. Ajoutee comme
// nouvelle gare standalone (pas une fusion).
// REIMS EST/OUEST et leurs variantes Taissy/Thillois restent volontairement
// non resolus : 0.09-0.23km des gares existantes homonymes, dans la zone de
// detection de barriere (et non la zone de fusion <0.06km) -- hors du
// perimetre de l'exception accordee par l'utilisateur, necessitent une
// verification separee.
// Run: node --test tests/peages-reims-veuve-montreuil.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('ORMES et CHÂLONS-EN-CHAMPAGNE / LA VEUVE (et sa variante N°24) n\'apparaissent plus littéralement', () => {
  const old = ['ORMES', 'CHÂLONS-EN-CHAMPAGNE / LA VEUVE', 'CHÂLONS-EN-CHAMPAGNE / LA VEUVE N°24'];
  for (const n of old) {
    const present = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.equal(present, false, n + ' should no longer appear literally');
  }
});

test('REIMS NORD (ORMES) et CHALONS MOURMELON portent désormais les relations reçues', () => {
  const r1 = overlay.paires.filter(p => p[0] === 'REIMS NORD (ORMES)' || p[1] === 'REIMS NORD (ORMES)');
  const r2 = overlay.paires.filter(p => p[0] === 'CHALONS MOURMELON' || p[1] === 'CHALONS MOURMELON');
  assert.ok(r1.length >= 31, 'REIMS NORD (ORMES): ' + r1.length);
  assert.ok(r2.length >= 65, 'CHALONS MOURMELON: ' + r2.length);
});

test('BARRIERE DE MONTREUIL AUX LIONS existe désormais comme gare distincte, avec son propre GPS', () => {
  const g = overlay.gares.find(x => x.nom === 'BARRIERE DE MONTREUIL AUX LIONS');
  assert.ok(g, 'la gare doit exister');
  assert.ok(Math.abs(g.points[0][0] - 49.009852) < 0.001);
  assert.ok(Math.abs(g.points[0][1] - 3.1455218) < 0.001);
});

test('BARRIERE DE MONTREUIL AUX LIONS porte désormais ses relations, distinctes de MONTREUIL AUX LIONS', () => {
  const has = overlay.paires.some(p => p[0] === 'BARRIERE DE MONTREUIL AUX LIONS' || p[1] === 'BARRIERE DE MONTREUIL AUX LIONS');
  assert.ok(has);
});

test('REIMS EST, REIMS OUEST et leurs variantes Taissy/Thillois restent volontairement non résolus', () => {
  const stillDangling = ['REIMS EST', 'REIMS OUEST', 'REIMS - TAISSY', 'REIMS - TINQUEUX'];
  const exact = new Set();
  for (const g of aprr.g) exact.add(g[0]);
  for (const g of overlay.gares) exact.add(g.nom);
  for (const n of stillDangling) {
    assert.equal(exact.has(n), false, n + ' should still be unresolved (barrière-detection zone, not merged)');
  }
});

test('aucun prix/distance altéré (échantillon)', () => {
  const p = overlay.paires.find(x => x[0] === 'REIMS NORD (ORMES)' || x[1] === 'REIMS NORD (ORMES)');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
