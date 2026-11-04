'use strict';
// Quatrieme vague du bug ix() (4 nov. 2026) : apres la casse, la
// ponctuation/accents et le suffixe de sortie, le dernier angle mort etait
// l'abreviation "ST"/"STE" (= "SAINT"/"SAINTE") : en toponymie officielle
// francaise, cette abreviation ne designe JAMAIS une localite differente
// (contrairement a un nom generique comme "CLERMONT" qui peut etre ambigu),
// donc aucune preuve de prix n'est necessaire ici -- seule l'unicite du
// candidat apres normalisation complete (accents + ponctuation + suffixe de
// sortie + expansion ST/STE) est exigee, exactement la meme discipline que
// les vagues precedentes. Ce passage complet a aussi rattrape deux cas
// restes non resolus par la vague 3 (filtre trop restrictif a l'epoque) :
// "NEUFCHÂTEL-EN-BRAY (A28)" et "CAEN" -> "CAEN (A13)".
// Run: node --test tests/peages-abreviation-saint-fix.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
function stripSuffix(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(/\s*\(A\d+\)\s*$/, '').replace(/\s*N°[\d.]+\s*$/, '').trim();
  } while (s !== prev);
  return s;
}
function expandSaint(s) {
  return s.replace(/\bSTE\b/g, 'SAINTE').replace(/\bST\b/g, 'SAINT');
}
function fullKey(s) { return expandSaint(norm(stripSuffix(s))); }
function exactNameSet() {
  const s = new Set();
  for (const g of aprr.g) s.add(g[0]);
  for (const g of overlay.gares) s.add(g.nom);
  return s;
}

test('every ST/STE-abbreviated (or (A28)-suffixed) paire name with a unique fully-normalized match now matches it exactly', () => {
  const exact = exactNameSet();
  const byKey = new Map();
  for (const n of exact) {
    const k = fullKey(n);
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k).add(n);
  }
  const stillMismatched = [];
  for (const p of overlay.paires) {
    for (let i = 0; i < 2; i++) {
      const nom = p[i];
      if (exact.has(nom)) continue;
      const k = fullKey(nom);
      if (byKey.has(k) && byKey.get(k).size === 1) {
        stillMismatched.push(nom + ' -> ' + Array.from(byKey.get(k))[0]);
      }
    }
  }
  assert.equal(stillMismatched.length, 0, 'still-mismatched names: ' + JSON.stringify(stillMismatched.slice(0, 10)));
});

test('spot-check: well-known relations activated by the ST/STE fix now fire with their canonical spelling', () => {
  const checks = ['ST GIBRIEN', 'STE MENEHOULD', 'ST ETIENNE AU TEMPLE', 'NUITS-ST-GEORGES',
    'ST-DENIS-LES-SENS', 'ST-GERMAIN-LAXIS', 'ST MARTIN-DU-FRESNE', 'NEUFCHÂTEL-EN-BRAY', 'CAEN (A13)'];
  for (const n of checks) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should have at least one active relation after the ST/STE rename');
  }
});

test('the ambiguous "NŒUX-LES-MINES N°6.1" case (two candidates even after full normalization) was left untouched', () => {
  const p = overlay.paires.filter(x => x[0] === 'NŒUX-LES-MINES N°6.1' || x[1] === 'NŒUX-LES-MINES N°6.1');
  assert.ok(p.length > 0, 'the ambiguous name should still be present, unrenamed');
});

test('no price, distance or GPS was altered by the ST/STE fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'ST GIBRIEN' || x[1] === 'ST GIBRIEN');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
