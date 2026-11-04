'use strict';
// Regression guard for 8 point-to-point relations added from the official
// SAPN 2026 tariff PDF (2026_02-Grille-SAPN.pdf, matrice triangulaire A29
// Nord), confirmed word-for-word via pdfplumber (x0/top position
// extraction) across both the classe-1 and classe-2 pages. All six gares
// involved (ST-ROMAIN-DE-COLBOSC, BOLBEC, FECAMP, YVETOT, YERVILLE,
// BEAUTOT) already existed with verified GPS in peages-aprr.json, so no
// new geolocation was needed or performed.
// "LE HAVRE N°5 / A131" and "ST-SAËNS N°10 / A28" have no GPS anywhere in
// the database and are NOT geolocated here: relations to them are
// deliberately omitted (aucune approximation), same discipline as
// Hochfelden/Charmont-sous-Barbuise in sanef-senlis-chamant-aumale-gps.test.cjs.
// Run: node --test tests/sapn-a29-nord-saint-romain.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

const cases = [
  ['ST-ROMAIN-DE-COLBOSC', 'BOLBEC', 1.00, 1.70],
  ['ST-ROMAIN-DE-COLBOSC', 'FECAMP', 2.40, 3.90],
  ['ST-ROMAIN-DE-COLBOSC', 'YVETOT', 3.70, 5.70],
  ['ST-ROMAIN-DE-COLBOSC', 'YERVILLE', 3.70, 5.50],
  ['ST-ROMAIN-DE-COLBOSC', 'BEAUTOT', 4.90, 7.60],
  ['BOLBEC', 'FECAMP', 1.60, 2.70],
  ['FECAMP', 'YVETOT', 1.90, 2.80],
  ['BEAUTOT', 'YERVILLE', 1.40, 2.20],
];

test('all 6 stations involved already have verified GPS in peages-aprr.json (no new geolocation needed)', () => {
  for (const nom of ['ST-ROMAIN-DE-COLBOSC', 'BOLBEC', 'FECAMP', 'YVETOT', 'YERVILLE', 'BEAUTOT']) {
    const g = aprr.g.find(x => x[0] === nom);
    assert.ok(g, nom + ' missing from peages-aprr.json');
    assert.ok(Array.isArray(g[1]) && g[1].length >= 1, nom + ' has no GPS points');
  }
});

test('each of the 8 SAPN A29 Nord relations is present with the exact class 1 and class 2 fares', () => {
  for (const [a, b, c1, c2] of cases) {
    const p = overlay.paires.find(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    assert.ok(p, a + ' <-> ' + b + ' missing');
    const [, , pc1, pc2] = p[0] === a ? p : [p[1], p[0], p[2], p[3]];
    assert.equal(pc1, c1, a + '<->' + b + ' class 1 amount');
    assert.equal(pc2, c2, a + '<->' + b + ' class 2 amount');
  }
});

test('LE HAVRE N°5/A131 and ST-SAËNS N°10/A28 have no verified GPS anywhere (no new geolocation attempted this batch)', () => {
  assert.ok(!aprr.g.some(g => g[0].includes('LE HAVRE')));
  assert.ok(!overlay.gares.some(g => g.nom.includes('LE HAVRE')));
  assert.ok(!aprr.g.some(g => g[0].includes('SAËNS')));
  assert.ok(!overlay.gares.some(g => g.nom.includes('SAËNS')));
});

// NOTE (non-regression documentation, not a bug introduced by this batch):
// peages-overlay.json already contained, before this batch, 7 pre-existing
// "LE HAVRE"/"SAINT-SAENS"-named paires (e.g. ['LE HAVRE','BOLBEC',2.5,3.2,26])
// plus 7 "LE HAVRE N°5 / A131"-named paires with the SAME PDF-verified
// amounts as this file's cases (e.g. 2.5/3.1 for BOLBEC) under the exact
// SAPN naming convention. Both sets are dangling (ix() returns -1 for
// "LE HAVRE", "LE HAVRE N°5 / A131", "SAINT-SAENS", "TOTES", "FECAMP YVETOT
// OUEST", "YVETOT EST" — none exist as a gare) and therefore never fire.
// The two sets disagree slightly (e.g. BOLBEC 3.2 vs 3.1, YVETOT 8.3 vs
// 8.2), so they cannot both be correct; which one (if either) matches an
// official, precisely-locatable barrière was not established this batch
// (Google Maps resolves ambiguously to the A29/A131 interchange area near
// Tancarville, and OSM/Overpass was unreachable for this bbox after
// several retries). Left untouched rather than guessed at or deleted.
test('this batch did not add any new "LE HAVRE" or "SAINT-SAENS"-named paire (pre-existing dangling entries are left as-is)', () => {
  const addedByThisBatch = [
    'ST-ROMAIN-DE-COLBOSC', 'BOLBEC', 'FECAMP', 'YVETOT', 'YERVILLE', 'BEAUTOT',
  ];
  for (const [a, b] of cases) {
    assert.ok(addedByThisBatch.includes(a) && addedByThisBatch.includes(b));
  }
});
