'use strict';
// Major systemic fix (4 nov. 2026): the point-to-point matching function
// ix() in routes-ui.js does an EXACT string comparison
// (PEAGES.g.findIndex(g => g[0] === nom)) against gare names. Several
// bulk imports from official ASF/Cofiroute/ESCOTA/APRR tariff .txt files
// (which are published entirely in UPPERCASE) wrote paires using that
// UPPERCASE spelling, while the corresponding gares already existed in
// peages-aprr.json/peages-overlay.json under a different (usually Title
// Case) spelling. Because ix() never matches case-insensitively, every one
// of those paires was silently dead: already PROUVE (officially sourced,
// cross-checked) class 1/2 fares that never fired for any real route.
// This batch renamed 5976 such name occurrences to the exact pre-existing
// canonical spelling (the one that already has verified GPS), changing no
// price, no distance, and no GPS coordinate — a pure string-casing
// correction. Names with zero case-insensitive match anywhere (genuine
// gaps, e.g. "A8: AIX-EN-PROVENCE") were left untouched. (NB: "A8: AIX-EN-PROVENCE"
// was later resolved on 5 nov. 2026, renamed to "AIX-EN-PROVENCE" and given its own
// new gare, GPS sourced to "Péage de La Barque" -- see
// tests/peages-aix-en-provence-puget-ville-nouvelles-gares.test.cjs.)
// Run: node --test tests/peages-casing-mismatch-fix.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function exactNameSet() {
  const s = new Set();
  for (const g of aprr.g) s.add(g[0]);
  for (const g of overlay.gares) s.add(g.nom);
  return s;
}

test('every paire name that has a case-insensitive match somewhere now matches it exactly (no more silently-dead case-mismatched paires)', () => {
  const exact = exactNameSet();
  const byLower = new Map();
  for (const n of exact) {
    const k = n.toLowerCase();
    if (!byLower.has(k)) byLower.set(k, new Set());
    byLower.get(k).add(n);
  }
  const stillMismatched = [];
  for (const p of overlay.paires) {
    for (let i = 0; i < 2; i++) {
      const nom = p[i];
      if (exact.has(nom)) continue;
      const k = nom.toLowerCase();
      if (byLower.has(k) && byLower.get(k).size === 1) {
        stillMismatched.push(nom + ' -> ' + Array.from(byLower.get(k))[0]);
      }
    }
  }
  assert.equal(stillMismatched.length, 0, 'still-mismatched names: ' + JSON.stringify(stillMismatched.slice(0, 10)));
});

test('spot-check: well-known ESCOTA/ASF/APRR relations fire with their canonical casing', () => {
  const checks = [
    ['Orange', 'Bollene'],
    ['Aubagne Est', 'Saint Maximin'],
    ["St-Jean D'Angely", 'Chantonnay'],
    ['Cabariot', 'Saintes'],
    ['St Gaudens', 'Lestelle'],
  ];
  for (const [a, b] of checks) {
    const p = overlay.paires.find(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    assert.ok(p, a + ' <-> ' + b + ' should be present with canonical casing');
  }
});

test('no price, distance or class amount was altered by the casing fix (sample: Orange<->Bollene keeps its original fare)', () => {
  const p = overlay.paires.find(x => (x[0] === 'Orange' && x[1] === 'Bollene') || (x[0] === 'Bollene' && x[1] === 'Orange'));
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});

test('the Coudoux -> AIX-EN-PROVENCE destination is present under its now-resolved canonical spelling', () => {
  const exact = exactNameSet();
  const p = overlay.paires.find(x => /coudoux/i.test(x[0]) || /coudoux/i.test(x[1]));
  assert.ok(p, 'Coudoux paire should still be present');
  const other = p[0].toLowerCase() === 'coudoux' ? p[1] : p[0];
  assert.equal(other, 'AIX-EN-PROVENCE');
  assert.ok(exact.has(other), 'AIX-EN-PROVENCE should now resolve to a real gare (new standalone gare added 5 nov. 2026)');
});
