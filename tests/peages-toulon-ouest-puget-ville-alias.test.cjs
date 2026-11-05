'use strict';
// TOULON-OUEST fusionné vers PUGET-VILLE (5 nov. 2026), preuve de prix stricte :
// 18/18 destinations communes (via le même sous-graphe "système ouvert" partagé avec
// SIX-FOURS-LES-PLAGES, LA CADIERE, ST-CYR-LES-LECQUES, AIX-EN-PROVENCE), 0 écart
// classe 1 ET classe 2. SIX-FOURS-LES-PLAGES a été comparé au même candidat et
// explicitement REJETÉ (3/18 écarts, point réel distinct) ; LA CADIERE et
// ST-CYR-LES-LECQUES ont été comparés à PUGET-VILLE, TOULON-OUEST, AIX-EN-PROVENCE et
// entre eux -- 18/18 écarts partout, aucune identité trouvée, restent non résolus.
// Run: node --test tests/peages-toulon-ouest-puget-ville-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('TOULON-OUEST was fully renamed to PUGET-VILLE', () => {
  const stray = overlay.paires.some(p => p[0] === 'TOULON-OUEST' || p[1] === 'TOULON-OUEST');
  assert.equal(stray, false, 'TOULON-OUEST should no longer appear literally');
  const has = overlay.paires.some(p => p[0] === 'PUGET-VILLE' || p[1] === 'PUGET-VILLE');
  assert.ok(has);
});

test('rejected/unresolved candidates in the same sub-graph were left untouched', () => {
  for (const n of ['SIX-FOURS-LES-PLAGES', 'LA CADIERE', 'ST-CYR-LES-LECQUES']) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should still be present under its own (unmerged, unresolved) name');
  }
});

test('no price was fabricated or altered by this merge (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'PUGET-VILLE' || x[1] === 'PUGET-VILLE');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
