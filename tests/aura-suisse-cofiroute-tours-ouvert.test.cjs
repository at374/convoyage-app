'use strict';
// Regression guard for the 8 open-system (systeme ouvert) barrieres added from
// official 2026 tariff PDFs: 3 AURA/frontiere suisse gaps (APRR Dordives,
// ADELAC Copponex, ADELAC Cruseilles A41 Nord) + 5 Cofiroute Tours-local
// relations (Chambray, Joue-les-Tours, Tours Nord, Monts-Sorigny,
// Neuille-Pont-Pierre), each confirmed PROUVE against a source PDF and
// precisely geolocated via Google Maps place resolution.
// Run: node --test tests/aura-suisse-cofiroute-tours-ouvert.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

const dist = (a, b, c, d) => {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const cases = [
  ['aprr-ouvert-dordives', 6, 9],
  ['adelac-ouvert-copponex', 2.9, 5.4],
  ['adelac-ouvert-cruseilles-a41n', 8, 14.9],
  ['cofiroute-ouvert-chambray', 0.9, 0.9],
  ['cofiroute-ouvert-joue-les-tours', 0.9, 0.9],
  ['cofiroute-ouvert-tours-nord', 0.9, 0.9],
  ['cofiroute-ouvert-monts-sorigny', 2.0, 2.7],
  ['cofiroute-ouvert-neuille-pont-pierre', 1.7, 3.1],
];

test('each new open-system barriere exists with valid GPS points', () => {
  for (const [id] of cases) {
    const b = overlay.barrieres.find(x => x.id === id);
    assert.ok(b, id + ' missing barriere');
    assert.ok(Array.isArray(b.points) && b.points.length >= 1, id + ' needs points');
    for (const p of b.points) {
      assert.ok(Number.isFinite(p[0]) && p[0] >= -90 && p[0] <= 90, id + ' lat');
      assert.ok(Number.isFinite(p[1]) && p[1] >= -180 && p[1] <= 180, id + ' lon');
    }
  }
});

test('each new barriere has proven class 1 and class 2 fares matching the official PDF', () => {
  for (const [id, c1, c2] of cases) {
    const f1 = overlay.tarifs.find(t => t.b === id && t.c === 1);
    const f2 = overlay.tarifs.find(t => t.b === id && t.c === 2);
    assert.ok(f1 && f2, id + ' missing class 1/2 fares');
    assert.equal(f1.a, c1, id + ' class 1 amount');
    assert.equal(f2.a, c2, id + ' class 2 amount');
    for (const f of [f1, f2]) {
      assert.equal(f.s, 'PROUVE', id + ' must be PROUVE, never approximated');
      assert.equal(f.f, '2026-02-01', id + ' effective date');
      assert.ok(Number.isInteger(f.u) && overlay.u[f.u], id + ' must cite a source index');
    }
  }
});

test('no new barriere falls within the 0.3km detection radius of another barriere', () => {
  for (const [id] of cases) {
    const nb = overlay.barrieres.find(x => x.id === id);
    for (const other of overlay.barrieres) {
      if (other.id === id) continue;
      for (const p of nb.points) for (const q of other.points) {
        assert.ok(dist(p[0], p[1], q[0], q[1]) > 0.3,
          id + ' too close to ' + other.id + ' (risk of false match)');
      }
    }
  }
});

test('the stale imprecise Copponex/Cruseilles A41 Nord point-to-point entries were removed', () => {
  // These used to exist as gare+paire entries tying a flat systeme-ouvert fee
  // to "ST MARTIN BELLEVUE A41 N" (not the official destination code 15400
  // "Systeme Ouvert"), at commune-centroid-level GPS never reached by real
  // routes. Superseded by the barriere mechanism above; kept out to avoid
  // double-charging or a spurious match if GPS is ever corrected.
  assert.ok(!overlay.gares.some(g => g.nom === 'Copponex'));
  assert.ok(!overlay.gares.some(g => g.nom === 'Cruseilles A41 Nord'));
  assert.ok(!overlay.paires.some(p => p.includes('Copponex')));
  assert.ok(!overlay.paires.some(p => p.includes('Cruseilles A41 Nord')));
});

test('Cruseilles A41 Nord (ADELAC) stays distinct from the existing Cruseilles A (AREA/A410) barriere', () => {
  const a = overlay.barrieres.find(x => x.id === 'adelac-ouvert-cruseilles-a41n').points[0];
  const b = overlay.barrieres.find(x => x.id === 'aprr-area-ouvert-cruseilles-a').points[0];
  const d = dist(a[0], a[1], b[0], b[1]);
  assert.ok(d > 0.3, 'must not collide with the AREA A410 barriere: ' + d.toFixed(3) + 'km');
});
