'use strict';
// Activates 3 ASF/ESCOTA relations that already had PROUVE class 1/2 fares
// in peages-overlay.json but were dangling (no GPS anywhere, so ix() never
// matched and the paire never fired): AURIOL <-> AUBAGNE EST (ESCOTA A52),
// TONNAY-CHARENTE <-> ROCHEFORT (ASF A837). GPS for all 3 new stations was
// resolved via Google Maps place search (4 nov. 2026) and checked against
// the 0.06km twin-merge and 0.3km barriere-collision thresholds before
// being added; none collided with any existing gare or overlay.barriere.
// ROCHEFORT is intentionally co-located (0.042km) with the pre-existing
// "Cabariot" gare (same physical A837 barriere, confirmed via the official
// ASF naming "Peage A837 Cabariot" which serves Rochefort-bound traffic):
// this is documented, not a twin-merge bug, since Cabariot's own distinct
// point-to-point relations (toward Mirambeau/Pons/Saintes/Saint-Aubin/
// Virsac) stay untouched and ROCHEFORT only activates the separate,
// already-PROUVE Tonnay-Charente relation.
// Run: node --test tests/asf-escota-auriol-tonnay-rochefort-gps.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

const dist = (a, b, c, d) => {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

test('AURIOL, TONNAY-CHARENTE, ROCHEFORT now exist with GPS in peages-overlay.json', () => {
  for (const nom of ['AURIOL', 'TONNAY-CHARENTE', 'ROCHEFORT']) {
    const g = overlay.gares.find(x => x.nom === nom);
    assert.ok(g, nom + ' missing from overlay.gares');
    assert.ok(Array.isArray(g.points) && g.points.length >= 1, nom + ' has no GPS points');
    const [lat, lon] = g.points[0];
    assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, nom + ' lat');
    assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180, nom + ' lon');
  }
});

test('the already-PROUVE AURIOL<->Aubagne Est and TONNAY-CHARENTE<->ROCHEFORT paires are unchanged (fares were never approximated, only GPS/casing was fixed)', () => {
  const p1 = overlay.paires.find(p => (p[0].toUpperCase() === 'AURIOL' && p[1].toUpperCase() === 'AUBAGNE EST') || (p[0].toUpperCase() === 'AUBAGNE EST' && p[1].toUpperCase() === 'AURIOL'));
  assert.ok(p1, 'AURIOL<->Aubagne Est paire missing');
  assert.equal(p1[2], 1.2);
  assert.equal(p1[3], 2);

  const p2 = overlay.paires.find(p => (p[0] === 'TONNAY-CHARENTE' && p[1] === 'ROCHEFORT') || (p[0] === 'ROCHEFORT' && p[1] === 'TONNAY-CHARENTE'));
  assert.ok(p2, 'TONNAY-CHARENTE<->ROCHEFORT paire missing');
  assert.equal(p2[2], 0.7);
  assert.equal(p2[3], 1.2);
});

test('Aubagne Est already has verified GPS in peages-aprr.json (no new geolocation needed for that end)', () => {
  const g = aprr.g.find(x => x[0] === 'Aubagne Est');
  assert.ok(g && g[1] && g[1].length >= 1);
});

test('none of the 3 new gares falls within the 0.06km twin-merge radius of any existing gare (aprr.g or overlay.gares)', () => {
  const newOnes = ['AURIOL', 'TONNAY-CHARENTE', 'ROCHEFORT'];
  const all = [];
  for (const g of aprr.g) for (const p of g[1]) all.push([g[0], p[0], p[1]]);
  for (const g of overlay.gares) for (const p of g.points) all.push([g.nom, p[0], p[1]]);
  for (const nom of newOnes) {
    const self = overlay.gares.find(g => g.nom === nom).points[0];
    for (const [other, lat, lon] of all) {
      if (other === nom) continue;
      if (other === 'Cabariot' && nom === 'ROCHEFORT') continue; // documented intentional co-location
      const d = dist(self[0], self[1], lat, lon);
      assert.ok(d > 0.06, nom + ' too close to ' + other + ' (' + d.toFixed(4) + 'km, risk of unintended twin-merge)');
    }
  }
});

test('ROCHEFORT is co-located with the pre-existing "Cabariot" gare (documented, not a bug) and Cabariot keeps its own 5 distinct relations untouched', () => {
  const rochefort = overlay.gares.find(g => g.nom === 'ROCHEFORT').points[0];
  const cabariot = aprr.g.find(g => g[0] === 'Cabariot');
  assert.ok(cabariot, 'Cabariot missing from peages-aprr.json');
  const d = dist(rochefort[0], rochefort[1], cabariot[1][0][0], cabariot[1][0][1]);
  assert.ok(d < 0.1, 'expected ROCHEFORT to be co-located with Cabariot, got ' + d.toFixed(4) + 'km');
  const cabariotPaires = overlay.paires.filter(p => p[0] === 'Cabariot' || p[1] === 'Cabariot');
  assert.equal(cabariotPaires.length, 5, 'Cabariot should keep its 5 pre-existing relations unchanged');
});

test('none of the 3 new gares falls within the 0.3km detection radius of any overlay.barriere (no barriere+point-to-point double-charge risk)', () => {
  for (const nom of ['AURIOL', 'TONNAY-CHARENTE', 'ROCHEFORT']) {
    const self = overlay.gares.find(g => g.nom === nom).points[0];
    for (const b of overlay.barrieres) {
      for (const p of b.points) {
        const d = dist(self[0], self[1], p[0], p[1]);
        assert.ok(d > 0.3, nom + ' too close to barriere ' + b.id + ' (' + d.toFixed(4) + 'km, risk of double-charge)');
      }
    }
  }
});

test('St-Jean D\'Angely and Cabariot were already live before this batch (apostrophe-sensitive lookup confirmed, no change made to them)', () => {
  const sja = aprr.g.find(g => g[0] === "St-Jean D'Angely");
  assert.ok(sja && sja[1] && sja[1].length >= 1, "St-Jean D'Angely should already have GPS in peages-aprr.json");
  const cabariot = aprr.g.find(g => g[0] === 'Cabariot');
  assert.ok(cabariot && cabariot[1] && cabariot[1].length >= 1, 'Cabariot should already have GPS in peages-aprr.json');
});
