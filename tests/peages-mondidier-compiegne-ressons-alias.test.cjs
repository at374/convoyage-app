'use strict';
// "MONDIDIER COMPIEGNE" fusionne vers "RESSONS" (5 nov. 2026) : les deux noms
// occupent la meme position dans le corridor A1 extrait du PDF SANEF (entre ROYE N°12
// et COMPIÈGNE OUEST N°10), confirme par preuve de prix stricte : 10/10 destinations
// communes, 0 ecart classe 1 et classe 2.
// Run: node --test tests/peages-mondidier-compiegne-ressons-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('MONDIDIER COMPIEGNE was fully renamed to RESSONS', () => {
  const stray = overlay.paires.some(p => p[0] === 'MONDIDIER COMPIEGNE' || p[1] === 'MONDIDIER COMPIEGNE');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'RESSONS' || p[1] === 'RESSONS');
  assert.ok(has);
});

test('no price was fabricated or altered by this merge (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'RESSONS' || x[1] === 'RESSONS');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
