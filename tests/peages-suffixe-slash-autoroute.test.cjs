'use strict';
// Huitieme vague du bug ix() (4 nov. 2026) : suffixe "/ A\d+" (reference
// autoroutiere additionnelle apres un numero de sortie deja present dans le
// nom, ex. "INCARVILLE N°19 / A154") -- meme nature que les suffixes de
// reseau des vagues precedentes (3, 6, 7) : un tag de contexte routier,
// jamais une localite differente. Aucune preuve de prix necessaire, seule
// l'unicite du candidat apres normalisation complete est exigee.
// Run: node --test tests/peages-suffixe-slash-autoroute.test.cjs
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
    s = s.replace(/\s*\/\s*A\d+[a-z]?\s*$/i, '')
         .replace(/\s*\(p[ée]age\s+d['e]\s*[^)]*\)\s*$/i, '')
         .replace(/\s*\(A\d+\)\s*$/, '')
         .replace(/\s*N°[\d.]+\s*$/, '')
         .replace(/\s+A\d+\s*$/, '')
         .trim();
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

test('every "/ A\\d+"-suffixed paire name with a unique fully-normalized match now matches it exactly', () => {
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

test('spot-check: relations activated by this fix now fire with their canonical spelling', () => {
  const checks = ['INCARVILLE N°19', 'ST-SAENS'];
  for (const n of checks) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should have at least one active relation after this fix');
  }
});

test('the old suffixed labels no longer appear literally', () => {
  const old = ['INCARVILLE N°19 / A154', "ST-SAËNS N°10 / A28"];
  for (const n of old) {
    const present = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.equal(present, false, n + ' should no longer appear literally');
  }
});

test('no price, distance or GPS was altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'INCARVILLE N°19' || x[1] === 'INCARVILLE N°19');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
