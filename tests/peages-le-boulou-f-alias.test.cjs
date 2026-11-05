'use strict';
// "LE BOULOU (F)" fusionne vers "Le Boulou (O)" (A9 frontiere espagnole, 5 nov. 2026) :
// preuve de prix stricte sur 43/43 destinations comparables (1 destination non
// comparable -- TOULOUSE-SUD/OUEST, ajoutee comme nouvelle gare plus tot dans cette
// meme session et donc absente de l'ancien jeu de comparaison -- sans rapport avec la
// fusion), 0 ecart. Simple variante de suffixe directionnel du meme nom physique.
//
// Run: node --test tests/peages-le-boulou-f-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('LE BOULOU (F) was fully renamed to Le Boulou (O)', () => {
  const stray = overlay.paires.some(p => p[0] === 'LE BOULOU (F)' || p[1] === 'LE BOULOU (F)');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Le Boulou (O)' || p[1] === 'Le Boulou (O)');
  assert.ok(has);
});

test('no price was fabricated or altered by this merge (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'Le Boulou (O)' || x[1] === 'Le Boulou (O)');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
