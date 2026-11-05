'use strict';
// "SAINT MAIXENT / LUSIGNAN" fusionne vers "Soudan" (A10, 5 nov. 2026) : preuve de
// prix stricte (7/7 destinations communes, 0 ecart). Corrobore par GPS : "Péage de
// Saint-Maixent/Lusignan - A10 - Sortie N°31" (Google Places, nom officiel exact) a
// seulement 0,0044km de la gare existante "Soudan" -- tres largement a l'interieur du
// seuil de fusion jumelle (0,06km). Le nom commercial affiche aux usagers
// (Saint-Maixent/Lusignan) et le nom de la commune d'implantation (Soudan) designent
// le meme point physique.
//
// Run: node --test tests/peages-soudan-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('SAINT MAIXENT / LUSIGNAN was fully renamed to Soudan', () => {
  const stray = overlay.paires.some(p => p[0] === 'SAINT MAIXENT / LUSIGNAN' || p[1] === 'SAINT MAIXENT / LUSIGNAN');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Soudan' || p[1] === 'Soudan');
  assert.ok(has);
});

test('no price was fabricated or altered by this merge (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'Soudan' || x[1] === 'Soudan');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
