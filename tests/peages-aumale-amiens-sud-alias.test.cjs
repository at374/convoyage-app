'use strict';
// Deux fusions sur le corridor A29/A16 Picardie (5 nov. 2026), toutes deux par preuve
// de prix stricte (0 ecart sur chaque destination commune, deja existantes dans
// overlay.paires sous le nom canonique) :
//
// 1. "AUMALE EST" -> "AUMALE" (deja existant) : 2/2 destinations communes
//    (POIX-DE-PICARDIE : 1,7/2,5 ; AMIENS SUD : 4,8/7,5), 0 ecart.
//
// 2. "AMIENS SUD DURY" -> "AMIENS SUD" (deja existant) : 3/3 destinations communes
//    (NEUFCHÂTEL-EN-BRAY : 6,8/10,3 ; POIX-DE-PICARDIE : 2,8/4,6 ; AUMALE : 4,8/7,5),
//    0 ecart.
//
// Run: node --test tests/peages-aumale-amiens-sud-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('AUMALE EST was fully renamed to AUMALE', () => {
  const stray = overlay.paires.some(p => p[0] === 'AUMALE EST' || p[1] === 'AUMALE EST');
  assert.equal(stray, false);
});

test('AMIENS SUD DURY was fully renamed to AMIENS SUD', () => {
  const stray = overlay.paires.some(p => p[0] === 'AMIENS SUD DURY' || p[1] === 'AMIENS SUD DURY');
  assert.equal(stray, false);
});

test('no price was fabricated or altered by either merge (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'AUMALE' && x[1] === 'AMIENS SUD') || (x[1] === 'AUMALE' && x[0] === 'AMIENS SUD'));
  assert.ok(p);
  assert.equal(p[2], 4.8);
  assert.equal(p[3], 7.5);
});
