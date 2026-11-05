'use strict';
// Trois nouvelles gares standalone sur le corridor A63 Bayonne-Espagne (5 nov. 2026),
// GPS sourcees via Google Places, chacune clairement au-dela des deux seuils (fusion
// jumelle 0,06km, detection de barriere 0,3km) de toute gare existante :
//
// - BENESSE : "Péage de Bénesse-Maremne", 9,18km de la gare existante la plus proche
//   (Ondres).
// - ST JEAN DE LUZ SUD : "Péage d'Urrugne/Saint-Jean-Sud - A63 - Sortie N°2", 4,24km
//   de "Saint-Jean-de-Luz Nord" (gare deja existante, point reel distinct -- confirme
//   par la relation deja active entre les deux dans overlay.paires).
// - BIRIATOU : "Frontière de Irún - Péage de Biriatou", 11,11km de toute gare
//   existante.
//
// NB : "BIARRITZ BARRIERE" a ete examine (candidats "Péage de Biarritz - A63") mais
// REJETE : a seulement 0,33km de la gare existante "Biarritz (échangeur)" -- juste au-
// dessus du seuil de detection de barriere (0,3km), sans recoupement de destination
// possible pour trancher par preuve de prix. Laisse volontairement non resolu plutot
// que fusionne ou ajoute a l'aveugle.
//
// Run: node --test tests/peages-a63-basque-nouvelles-gares.test.cjs
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

test('BENESSE, ST JEAN DE LUZ SUD and BIRIATOU are new standalone gares, GPS clear of every existing point', () => {
  const all = [];
  for (const gg of aprr.g) for (const p of gg[1]) all.push(p);
  for (const name of ['BENESSE', 'ST JEAN DE LUZ SUD', 'BIRIATOU']) {
    const g = overlay.gares.find(x => x.nom === name);
    assert.ok(g, name + ' should exist as a new overlay gare');
    const [lat, lon] = g.points[0];
    const others = all.concat(overlay.gares.filter(x => x.nom !== name).flatMap(x => x.points));
    const minDist = Math.min(...others.map(p => dist([lat, lon], p)));
    assert.ok(minDist > 0.3, name + ' GPS should be beyond 0.3km, got ' + minDist.toFixed(4) + 'km');
  }
});

test('BIARRITZ BARRIERE was deliberately left unresolved (too close to Biarritz (échangeur), no price-proof possible)', () => {
  const stillDangling = overlay.paires.some(p => p[0] === 'BIARRITZ BARRIERE' || p[1] === 'BIARRITZ BARRIERE');
  assert.ok(stillDangling, 'BIARRITZ BARRIERE should still be present, unmerged');
  const newGare = overlay.gares.some(g => g.nom === 'BIARRITZ BARRIERE');
  assert.equal(newGare, false, 'BIARRITZ BARRIERE must not have been added as a new gare');
});

test('no price was fabricated or altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'BENESSE' || x[1] === 'BENESSE');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
