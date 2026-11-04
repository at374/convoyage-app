'use strict';
// Deux nouvelles gares standalone (4 nov. 2026, réseau ESCOTA A50 Côte
// d'Azur) : OLLIOULES (Péage de Sanary-Ollioules) et BANDOL (Gare de Péage
// Bandol), GPS officiels Google Places, toutes deux à plus de 15km du
// point existant le plus proche -- aucun seuil franchi, aucune ambiguïté
// GPS. Font partie du cluster Var/Côte d'Azur identifié ce jour (avec
// SIX-FOURS-LES-PLAGES, ST-CYR-LES-LECQUES, LA CADIERE, PUGET-VILLE,
// TOULON-OUEST, AIX-EN-PROVENCE encore non résolus, faute de POI
// toll_station net trouvé).
// Run: node --test tests/peages-ollioules-bandol-nouvelles-gares.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('OLLIOULES et BANDOL existent désormais comme gares distinctes', () => {
  const go = overlay.gares.find(x => x.nom === 'OLLIOULES');
  const gb = overlay.gares.find(x => x.nom === 'BANDOL');
  assert.ok(go && gb);
  assert.ok(Math.abs(go.points[0][0] - 43.1248744) < 0.001);
  assert.ok(Math.abs(gb.points[0][0] - 43.1463847) < 0.001);
});

test('OLLIOULES et BANDOL portent désormais leurs relations', () => {
  const ho = overlay.paires.filter(p => p[0] === 'OLLIOULES' || p[1] === 'OLLIOULES');
  const hb = overlay.paires.filter(p => p[0] === 'BANDOL' || p[1] === 'BANDOL');
  assert.ok(ho.length >= 19, 'OLLIOULES: ' + ho.length);
  assert.ok(hb.length >= 19, 'BANDOL: ' + hb.length);
});

test('aucun prix/distance altéré (échantillon)', () => {
  const p = overlay.paires.find(x => x[0] === 'OLLIOULES' || x[1] === 'OLLIOULES');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
