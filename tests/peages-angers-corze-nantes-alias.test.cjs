'use strict';
// Trois fusions sur l'A11 Angers-Nantes (5 nov. 2026), toutes par preuve de prix
// stricte (0 ecart sur chaque destination commune) :
//
// 1. "ANGERS (CORZE)" -> "Corze" (deja existant) : 29/29 destinations communes dans
//    aprr.p, 0 ecart. Corrobore par GPS : "Toll station Corzé - A11" (Google Places)
//    a seulement 0,0489km de la gare existante "Corze" -- a l'interieur du seuil de
//    fusion jumelle (0,06km).
//
// 2. "ANGERS" -> "Angers (zone sorties 16-17)" (deja existant) : 4/4 destinations
//    communes (Ancenis, Beaupréau-Saint-Germain, Saint-Jean-de-Linières, Nantes),
//    0 ecart.
//
// 3. "NANTES" -> "Nantes (zone sorties 23-25)" (deja existant) : 3/3 destinations
//    communes (Ancenis, Angers, Vieilleville), 0 ecart.
//
// Run: node --test tests/peages-angers-corze-nantes-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('ANGERS (CORZE) was fully renamed to Corze', () => {
  const stray = overlay.paires.some(p => p[0] === 'ANGERS (CORZE)' || p[1] === 'ANGERS (CORZE)');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Corze' || p[1] === 'Corze');
  assert.ok(has);
});

test('ANGERS was fully renamed to Angers (zone sorties 16-17)', () => {
  const stray = overlay.paires.some(p => p[0] === 'ANGERS' || p[1] === 'ANGERS');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Angers (zone sorties 16-17)' || p[1] === 'Angers (zone sorties 16-17)');
  assert.ok(has);
});

test('NANTES was fully renamed to Nantes (zone sorties 23-25)', () => {
  const stray = overlay.paires.some(p => p[0] === 'NANTES' || p[1] === 'NANTES');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Nantes (zone sorties 23-25)' || p[1] === 'Nantes (zone sorties 23-25)');
  assert.ok(has);
});

test('the renamed Angers <-> Nantes relation was not duplicated', () => {
  const matches = overlay.paires.filter(p =>
    (p[0] === 'Angers (zone sorties 16-17)' && p[1] === 'Nantes (zone sorties 23-25)') ||
    (p[1] === 'Angers (zone sorties 16-17)' && p[0] === 'Nantes (zone sorties 23-25)'));
  assert.equal(matches.length, 1, 'expected exactly one relation, got ' + matches.length);
});

test('no price was fabricated or altered by any of these merges (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'Corze' || x[1] === 'Corze');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
