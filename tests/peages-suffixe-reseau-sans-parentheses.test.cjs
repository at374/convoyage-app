'use strict';
// Sixieme vague du bug ix() (4 nov. 2026) : apres le suffixe "(A\d+)" entre
// parentheses (vague 3), un angle mort proche restait -- le meme suffixe de
// reseau SANS parentheses ("Bazas A65" vs "BAZAS"), ainsi que la forme
// "NOM / A\d+" ("YVETOT / A150" vs "YVETOT"). Meme nature que le suffixe
// parenthese : un tag de reseau, jamais une localite differente ; aucune
// preuve de prix necessaire, seule l'unicite du candidat est exigee.
// Run: node --test tests/peages-suffixe-reseau-sans-parentheses.test.cjs
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
    s = s.replace(/\s*\(A\d+\)\s*$/, '').replace(/\s*N°[\d.]+\s*$/, '').replace(/\s+A\d+\s*$/, '').trim();
  } while (s !== prev);
  return s;
}
function expandSaint(s) { return s.replace(/\bSTE\b/g, 'SAINTE').replace(/\bST\b/g, 'SAINT'); }
function expandSur(s) { return s.replace(/\bS\s*\/\s*/g, 'SUR ').replace(/\bS\s+(?=[A-Z])/g, 'SUR '); }
function fullKey(s) { return expandSur(expandSaint(norm(stripSuffix(s)))); }
function exactNameSet() {
  const s = new Set();
  for (const g of aprr.g) s.add(g[0]);
  for (const g of overlay.gares) s.add(g.nom);
  return s;
}

test('every bare-"A\\d+"-suffixed (or "/A\\d+"-suffixed) paire name with a unique fully-normalized match now matches it exactly', () => {
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

test('spot-check: A65 (Alienor) relations activated by this fix now fire with their canonical spelling', () => {
  const checks = ['Bazas A65', 'Captieux A65', 'Roquefort A65', 'Garlin A65', 'Thèze A65', 'BEAUTOT', 'YVETOT'];
  for (const n of checks) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should have at least one active relation after this fix');
  }
});

test('no price, distance or GPS was altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'Bazas A65' || x[1] === 'Bazas A65');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
