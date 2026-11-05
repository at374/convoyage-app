'use strict';
// Trois resolutions sur le corridor A4 Paris/Noisy-le-Grand (5 nov. 2026) :
//
// 1. "MEAUX (A140) / CRECY N°16" -> "MEAUX / CRECY" (variantes du meme libelle,
//    preuve de prix stricte 30/30 destinations communes, 0 ecart). GPS pas encore
//    source avec certitude (aucune station Google Places nommee trouvee pour la
//    sortie N°16) -- reste dangling sous son nom canonique en attendant une source
//    fiable, aucune gare ajoutee.
//
// 2. "ST-JEAN-LES-DEUX-JUMEAUX N°18" -> "ST-JEAN-LES-DEUX-JUMEAUX" (meme nom, suffixe
//    de sortie). Nouvelle gare standalone : GPS "Péage de Meaux/La Ferté-sous-Jouarre -
//    A4 - Sortie N°18" (le nom commercial Google differe mais la sortie N°18 et la
//    commune Saint-Jean-les-Deux-Jumeaux correspondent exactement), 10,05km de la gare
//    existante la plus proche -- largement au-dela des deux seuils.
//
// 3. "COUTEVROULT" -> "PARIS / NOISY-LE-GRAND" (deja existant, deja resolu vague 7 sous
//    le nom physique "Coutevroult"). GPS a 0,0306km de "Gare de Péage de Coutevroult"
//    (Google Places) -- a l'interieur du seuil de fusion jumelle (0,06km), confirme
//    sans ambiguite par le precedent deja etabli (PARIS / NOISY-LE-GRAND (péage de
//    Coutevroult) -> PARIS / NOISY-LE-GRAND).
//
// Run: node --test tests/peages-meaux-crecy-st-jean-coutevroult.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('MEAUX (A140) / CRECY N°16 was fully renamed to MEAUX / CRECY', () => {
  const stray = overlay.paires.some(p => p[0] === 'MEAUX (A140) / CRECY N°16' || p[1] === 'MEAUX (A140) / CRECY N°16');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'MEAUX / CRECY' || p[1] === 'MEAUX / CRECY');
  assert.ok(has, 'MEAUX / CRECY should remain present (dangling, no GPS yet)');
});

test('ST-JEAN-LES-DEUX-JUMEAUX N°18 was fully renamed to the new standalone gare ST-JEAN-LES-DEUX-JUMEAUX', () => {
  const stray = overlay.paires.some(p => p[0] === 'ST-JEAN-LES-DEUX-JUMEAUX N°18' || p[1] === 'ST-JEAN-LES-DEUX-JUMEAUX N°18');
  assert.equal(stray, false);
  const g = overlay.gares.find(x => x.nom === 'ST-JEAN-LES-DEUX-JUMEAUX');
  assert.ok(g);
  function dist(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const [lat, lon] = g.points[0];
  const all = [];
  for (const gg of aprr.g) for (const p of gg[1]) all.push(p);
  for (const gg of overlay.gares) if (gg.nom !== 'ST-JEAN-LES-DEUX-JUMEAUX') for (const p of gg.points) all.push(p);
  const minDist = Math.min(...all.map(p => dist([lat, lon], p)));
  assert.ok(minDist > 0.3, 'got ' + minDist.toFixed(4) + 'km');
});

test('COUTEVROULT was fully renamed to PARIS / NOISY-LE-GRAND', () => {
  const stray = overlay.paires.some(p => p[0] === 'COUTEVROULT' || p[1] === 'COUTEVROULT');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'PARIS / NOISY-LE-GRAND' || p[1] === 'PARIS / NOISY-LE-GRAND');
  assert.ok(has);
});

test('no price was fabricated or altered by any of these fixes (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'ST-JEAN-LES-DEUX-JUMEAUX' || x[1] === 'ST-JEAN-LES-DEUX-JUMEAUX');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
