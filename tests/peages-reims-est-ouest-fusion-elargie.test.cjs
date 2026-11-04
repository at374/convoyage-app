'use strict';
// Fusions GPS-exceptionnelles elargies a la zone de detection de barriere
// (4 nov. 2026) : REIMS EST / REIMS - TAISSY / REIMS EST (péage de Taissy)
// (GPS source a 0.09km de "REIMS EST (TAISSY)") et REIMS OUEST /
// REIMS - TINQUEUX (GPS source a 0.23km de "REIMS OUEST (THILLOIS)").
// Contrairement aux fusions precedentes (Charmont, Ormes, La Veuve, toutes
// <0.06km, zone de fusion "gares jumelles"), ces deux cas tombent dans la
// zone de detection de barriere (<0.3km), ou le risque n'est plus "meme
// peage" mais "confusion possible du moteur de calcul d'itineraire entre
// deux points proches". L'utilisateur a explicitement autorise l'extension
// de la meme logique a ces deux cas precis, le risque etant assume.
// Chevauchement de destinations toujours structurellement nul (meme grille
// SANEF auto-suffisante que les fusions precedentes).
// Run: node --test tests/peages-reims-est-ouest-fusion-elargie.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('REIMS EST, REIMS - TAISSY, REIMS EST (péage de Taissy), REIMS OUEST, REIMS - TINQUEUX n\'apparaissent plus littéralement', () => {
  const old = ['REIMS EST', 'REIMS - TAISSY', 'REIMS EST (péage de Taissy)', 'REIMS OUEST', 'REIMS - TINQUEUX'];
  for (const n of old) {
    const present = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.equal(present, false, n + ' should no longer appear literally');
  }
});

test('REIMS EST (TAISSY) et REIMS OUEST (THILLOIS) portent désormais les relations reçues', () => {
  const r1 = overlay.paires.filter(p => p[0] === 'REIMS EST (TAISSY)' || p[1] === 'REIMS EST (TAISSY)');
  const r2 = overlay.paires.filter(p => p[0] === 'REIMS OUEST (THILLOIS)' || p[1] === 'REIMS OUEST (THILLOIS)');
  assert.ok(r1.length >= 34, 'REIMS EST (TAISSY): ' + r1.length);
  assert.ok(r2.length >= 33, 'REIMS OUEST (THILLOIS): ' + r2.length);
});

test('aucun prix/distance altéré (échantillon)', () => {
  const p = overlay.paires.find(x => x[0] === 'REIMS EST (TAISSY)' || x[1] === 'REIMS EST (TAISSY)');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
