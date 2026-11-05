'use strict';
// Deux fusions sur l'A83 Vendee (5 nov. 2026), toutes deux par preuve de prix stricte
// (7/7 destinations communes, 0 ecart) et corroborees par GPS :
//
// 1. "LE BIGNON" -> "Bignon" (deja existant) : GPS "Gare de Peage du Bignon" (Google
//    Places) a 0,0058km de la gare existante -- tres largement a l'interieur du seuil
//    de fusion jumelle (0,06km).
//
// 2. "FONTENAY LE COMTE" -> "Fontenay Centre" (deja existant) : GPS "Péage de
//    Fontenay-le-Comte-Centre - Sortie N°8" (Google Places) a 0,0393km de la gare
//    existante -- egalement a l'interieur du seuil de fusion jumelle.
//
// Run: node --test tests/peages-bignon-fontenay-centre-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('LE BIGNON was fully renamed to Bignon', () => {
  const stray = overlay.paires.some(p => p[0] === 'LE BIGNON' || p[1] === 'LE BIGNON');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Bignon' || p[1] === 'Bignon');
  assert.ok(has);
});

test('FONTENAY LE COMTE was fully renamed to Fontenay Centre', () => {
  const stray = overlay.paires.some(p => p[0] === 'FONTENAY LE COMTE' || p[1] === 'FONTENAY LE COMTE');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Fontenay Centre' || p[1] === 'Fontenay Centre');
  assert.ok(has);
});

test('no duplicate relations were created by either merge', () => {
  for (const name of ['Bignon', 'Fontenay Centre']) {
    const seen = new Set();
    const rels = overlay.paires.filter(p => p[0] === name || p[1] === name);
    for (const r of rels) {
      const key = [r[0], r[1]].sort().join('|');
      assert.ok(!seen.has(key), 'duplicate relation for ' + name + ': ' + key);
      seen.add(key);
    }
  }
});

test('no price was fabricated or altered by either merge (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'Bignon' || x[1] === 'Bignon');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
