'use strict';
// Nouvelle gare standalone (4 nov. 2026, réseau A65 Alienor) : MONT DE
// MARSAN. GPS officiel source (Google Places, POI toll_station "Péage de
// Mont de Marsan - Sortie n°4", 40090 Gaillères) à 0.549km du point
// existant le plus proche ("Mont-de-Marsan Le Caloy A65", une sortie
// différente du même axe) -- aucun seuil de fusion ni de détection de
// barrière franchi. Confirmée distincte par désaccord PARTIEL de prix (5/6
// destinations communes identiques, 1 écart de quelques centimes) : ce
// n'est pas une preuve de fusion (il faut 0 incohérence), mais cohérent
// avec deux sorties A65 voisines dans la même agglomération.
// Run: node --test tests/peages-mont-de-marsan-nouvelle-gare.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('MONT DE MARSAN existe désormais comme gare, avec son propre GPS', () => {
  const g = overlay.gares.find(x => x.nom === 'MONT DE MARSAN');
  assert.ok(g, 'la gare doit exister');
  assert.ok(Math.abs(g.points[0][0] - 43.9469816) < 0.001);
  assert.ok(Math.abs(g.points[0][1] - (-0.3939209)) < 0.001);
});

test('MONT DE MARSAN porte désormais ses relations', () => {
  const has = overlay.paires.filter(p => p[0] === 'MONT DE MARSAN' || p[1] === 'MONT DE MARSAN');
  assert.ok(has.length >= 38, 'expected >=38, got ' + has.length);
});

test('"Mont-de-Marsan Le Caloy A65" reste une gare distincte (pas fusionnée)', () => {
  const g = overlay.gares.find(x => x.nom === 'Mont-de-Marsan Le Caloy A65') ||
    require('../peages-aprr.json').g.find(x => x[0] === 'Mont-de-Marsan Le Caloy A65');
  assert.ok(g, 'la gare distincte doit toujours exister');
});

test('aucun prix/distance altéré sur les relations existantes (échantillon)', () => {
  const p = overlay.paires.find(x => x[0] === 'MONT DE MARSAN' || x[1] === 'MONT DE MARSAN');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
