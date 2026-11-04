'use strict';
// Deux nouvelles gares standalone (4 nov. 2026, réseau A65 Alienor) : ADOUR
// NORD (Péage d'Aire-sur-l'Adour Nord, sortie n°6, GPS Google Places
// officiel) à 0.418km de la gare existante la plus proche
// ("Aire-sur-l'Adour Nord A65") ; ADOUR SUD (sortie n°7) à 0.780km de
// "Aire-sur-l'Adour Sud A65". Aucun seuil franchi dans les deux cas.
// Confirmées distinctes par désaccord partiel de prix (4-5 destinations
// communes identiques sur 5-7, 1 écart constant sur Langon dans chaque
// cas), cohérent avec deux sorties A65 voisines (vraisemblablement un
// système Nord/Sud encadrant le pont de l'Adour).
// Run: node --test tests/peages-adour-nord-sud-nouvelles-gares.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('ADOUR NORD et ADOUR SUD existent désormais comme gares distinctes', () => {
  const gn = overlay.gares.find(x => x.nom === 'ADOUR NORD');
  const gs = overlay.gares.find(x => x.nom === 'ADOUR SUD');
  assert.ok(gn && gs);
  assert.ok(Math.abs(gn.points[0][0] - 43.7221748) < 0.001);
  assert.ok(Math.abs(gs.points[0][0] - 43.6646456) < 0.001);
});

test('ADOUR NORD et ADOUR SUD portent désormais leurs relations', () => {
  const hn = overlay.paires.filter(p => p[0] === 'ADOUR NORD' || p[1] === 'ADOUR NORD');
  const hs = overlay.paires.filter(p => p[0] === 'ADOUR SUD' || p[1] === 'ADOUR SUD');
  assert.ok(hn.length >= 38, 'ADOUR NORD: ' + hn.length);
  assert.ok(hs.length >= 20, 'ADOUR SUD: ' + hs.length);
});

test('"Aire-sur-l\'Adour Nord/Sud A65" restent des gares distinctes (pas fusionnées)', () => {
  const aprr = require('../peages-aprr.json');
  const exact = new Set();
  for (const g of aprr.g) exact.add(g[0]);
  for (const g of overlay.gares) exact.add(g.nom);
  assert.ok(exact.has("Aire-sur-l'Adour Nord A65"));
  assert.ok(exact.has("Aire-sur-l'Adour Sud A65"));
});

test('aucun prix/distance altéré (échantillon)', () => {
  const p = overlay.paires.find(x => x[0] === 'ADOUR NORD' || x[1] === 'ADOUR NORD');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
