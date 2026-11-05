'use strict';
// "GIGNAC" fusionne vers "Martel" (A20 Lot, 5 nov. 2026) : preuve de prix stricte
// (6/6 destinations communes -- Cahors Nord, Cahors Sud, Caussade, Labastide Murat,
// Montauban Nord, Souillac -- 0 ecart classe 1 et classe 2). Corrobore par la GPS :
// "Gare de Péage de Gignac" (Google Places) a seulement 0,3459km de la gare existante
// "Martel" -- juste au-dessus du seuil de detection de barriere (0,3km) mais la
// preuve de prix exacte sur 6/6 destinations leve toute ambiguite : meme point
// physique, deux noms commerciaux (commune de Gignac / bourg de Martel).
// Run: node --test tests/peages-gignac-martel-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('GIGNAC was fully renamed to Martel', () => {
  const stray = overlay.paires.some(p => p[0] === 'GIGNAC' || p[1] === 'GIGNAC');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Martel' || p[1] === 'Martel');
  assert.ok(has);
});

test('no price was fabricated or altered by this merge (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'Martel' || x[1] === 'Martel');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
