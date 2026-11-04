'use strict';
// Cinquieme vague du bug ix() (4 nov. 2026) : apres la casse, la ponctuation/accents,
// le suffixe de sortie et l'abreviation ST/STE, un autre angle mort identique en nature
// etait l'abreviation "S/" (= "SUR", jamais une localite differente en toponymie
// officielle francaise -- "Belleville S/Saone" et "Belleville sur Saone" designent
// imperativement le meme lieu). Meme discipline que la vague 4 : aucune preuve de prix
// necessaire, seule l'unicite du candidat apres normalisation complete est exigee.
// Run: node --test tests/peages-abreviation-sur-fix.test.cjs
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
function expandSur(s) {
  return s.replace(/\bS\s*\/\s*/g, 'SUR ').replace(/\bS\s+(?=[A-Z])/g, 'SUR ');
}
function fullKey(s) { return expandSur(expandSaint(norm(stripSuffix(s)))); }
function exactNameSet() {
  const s = new Set();
  for (const g of aprr.g) s.add(g[0]);
  for (const g of overlay.gares) s.add(g.nom);
  return s;
}

test('every S/-abbreviated paire name with a unique fully-normalized match now matches it exactly', () => {
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

test('spot-check: relations activated by the S/ fix now fire with their canonical spelling', () => {
  const checks = ['BELLEVILLE S/SAONE', 'DIJON-ARC S/TILLE', 'L ISLE-S/LE-DOUBS'];
  for (const n of checks) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should have at least one active relation after the S/ rename');
  }
});

test('the ambiguous "NŒUX-LES-MINES N°6.1" case (two candidates even after full normalization) remains untouched', () => {
  const p = overlay.paires.filter(x => x[0] === 'NŒUX-LES-MINES N°6.1' || x[1] === 'NŒUX-LES-MINES N°6.1');
  assert.ok(p.length > 0, 'the ambiguous name should still be present, unrenamed');
});

test('no price, distance or GPS was altered by the S/ fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'BELLEVILLE S/SAONE' || x[1] === 'BELLEVILLE S/SAONE');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
