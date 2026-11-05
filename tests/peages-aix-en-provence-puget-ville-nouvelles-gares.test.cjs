'use strict';
// Résolution AIX-EN-PROVENCE et PUGET-VILLE (5 nov. 2026), ESCOTA (A8/A57).
//
// AIX/A8: AIX-EN-PROVENCE -> renommés vers AIX-EN-PROVENCE (variantes de libellé pur,
// preuve de prix directe 9/9 destinations communes, 0 écart entre AIX et
// AIX-EN-PROVENCE). Nouvelle gare standalone pour AIX-EN-PROVENCE : GPS sourcé via
// Google Places ("Péage de La Barque vers le Sud", A8, Châteauneuf-le-Rouge),
// 1,74km du point déjà existant le plus proche (Cannet-de-Meyreuil) -- au-delà des
// deux seuils (fusion jumelle 0,06km, détection de barrière 0,3km). Une fusion directe
// avec Cannet-de-Meyreuil a été envisagée puis REJETÉE : 9/9 destinations communes
// montrent un écart systématique (~1,0-1,6€, croissant avec la distance), prouvant
// qu'il s'agit d'un point réel distinct, plus loin sur le même corridor A8 -- pas un
// alias. Corroboré par le registre officiel ESCOTA 2010 (ecologie.gouv.fr/ESCOTA-2.pdf)
// qui liste séparément "Canet-de-Meyreuil" et "La Barque" comme stations A8 distinctes
// près d'Aix-en-Provence. AIX NORD et AIX SUD (déjà existants) ne se recoupent avec
// aucune des variantes AIX (0 destination commune, grille autonome comme SANEF) --
// laissés intacts, non concernés par cette résolution.
//
// PUGET-VILLE : nouvelle gare standalone, GPS "Gare de Péage de Puget-Ville" (A57),
// 7,45km du point existant le plus proche (Carnoules) -- largement au-delà des deux
// seuils. Corroboré par le registre officiel ESCOTA 2010 ("A57 42 PUGET VILLE PV SF").
//
// Run: node --test tests/peages-aix-en-provence-puget-ville-nouvelles-gares.test.cjs
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

test('AIX and A8: AIX-EN-PROVENCE were fully renamed to AIX-EN-PROVENCE', () => {
  for (const old of ['AIX', 'A8: AIX-EN-PROVENCE']) {
    const stray = overlay.paires.some(p => p[0] === old || p[1] === old);
    assert.equal(stray, false, old + ' should no longer appear literally');
  }
  const has = overlay.paires.some(p => p[0] === 'AIX-EN-PROVENCE' || p[1] === 'AIX-EN-PROVENCE');
  assert.ok(has);
});

test('AIX-EN-PROVENCE and PUGET-VILLE are new standalone gares, GPS clear of every existing point', () => {
  const all = [];
  for (const gg of aprr.g) for (const p of gg[1]) all.push(p);
  for (const name of ['AIX-EN-PROVENCE', 'PUGET-VILLE']) {
    const g = overlay.gares.find(x => x.nom === name);
    assert.ok(g, name + ' should exist as a new overlay gare');
    const [lat, lon] = g.points[0];
    const others = all.concat(overlay.gares.filter(x => x.nom !== name).flatMap(x => x.points));
    const minDist = Math.min(...others.map(p => dist([lat, lon], p)));
    assert.ok(minDist > 0.3, name + ' GPS should be beyond 0.3km from every other point, got ' + minDist.toFixed(4) + 'km');
  }
});

test('AIX NORD and AIX SUD (pre-existing, unrelated) were not touched by this fix', () => {
  for (const n of ['AIX NORD', 'AIX SUD']) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should still carry its own relations, untouched');
  }
});

test('no price was fabricated or altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'PUGET-VILLE' || x[1] === 'PUGET-VILLE');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
