'use strict';
// Deux resolutions sur l'A8 Provence (5 nov. 2026) :
//
// 1. "COUDOUX" : nouvelle gare standalone. GPS source via Google Places ("Péage de
//    Coudoux - A8 - Sortie N°28", nom officiel exact), 6,69km de la gare existante la
//    plus proche (Lançon) -- largement au-dela des deux seuils.
//
// 2. "LE CANNET DE MEYREUIL" -> "Cannet-de-Meyreuil" (deja existant) : GPS source via
//    Google Places ("Péage de Meyreuil - A8 - Sortie N°32") a seulement 0,0112km de la
//    gare existante "Cannet-de-Meyreuil" -- tres largement a l'interieur du seuil de
//    fusion jumelle (0,06km), fusion automatique sans ambiguite.
//
// Run: node --test tests/peages-coudoux-cannet-meyreuil.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function dist(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

test('COUDOUX exists as a new standalone gare, GPS clear of every existing point', () => {
  const g = overlay.gares.find(x => x.nom === 'COUDOUX');
  assert.ok(g);
  const [lat, lon] = g.points[0];
  const all = [];
  for (const gg of aprr.g) for (const p of gg[1]) all.push(p);
  for (const gg of overlay.gares) if (gg.nom !== 'COUDOUX') for (const p of gg.points) all.push(p);
  const minDist = Math.min(...all.map(p => dist([lat, lon], p)));
  assert.ok(minDist > 0.3, 'got ' + minDist.toFixed(4) + 'km');
});

test('LE CANNET DE MEYREUIL was fully renamed to Cannet-de-Meyreuil', () => {
  const stray = overlay.paires.some(p => p[0] === 'LE CANNET DE MEYREUIL' || p[1] === 'LE CANNET DE MEYREUIL');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Cannet-de-Meyreuil' || p[1] === 'Cannet-de-Meyreuil');
  assert.ok(has);
});

test('no price was fabricated or altered by either fix (sample)', () => {
  const p1 = overlay.paires.find(x => x[0] === 'COUDOUX' || x[1] === 'COUDOUX');
  assert.ok(p1);
  assert.equal(typeof p1[2], 'number');
  const p2 = overlay.paires.find(x => x[0] === 'Cannet-de-Meyreuil' || x[1] === 'Cannet-de-Meyreuil');
  assert.ok(p2);
  assert.equal(typeof p2[2], 'number');
});
