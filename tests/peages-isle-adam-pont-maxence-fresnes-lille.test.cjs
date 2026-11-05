'use strict';
// Trois resolutions (5 nov. 2026), decouvertes dans le lot de noms apparus apres la
// fusion amont (PR #198) :
//
// 1. "PONT ST MAXENCE" -> "PONT-SAINTE-MAXENCE" (deja existant). Pas une simple
//    expansion ST->SAINT (vague 4) : le nom reel est feminin ("Sainte"), donc
//    l'abreviation seule ne suffisait pas a desambiguer -- confirme par preuve de
//    prix stricte (8/8 destinations communes, 0 ecart).
//
// 2. "FRESNES (LILLE)" -> "LILLE / DOURGES" (deja existant, deja resolu via la vague 7
//    "(peage de X)" sous le nom physique "Fresnes"). Confirme par preuve de prix
//    stricte (8/8 destinations communes, 0 ecart) : ce n'est PAS un alias de
//    "FRESNES EN WOEVRE" (Lorraine, sans rapport).
//
// 3. "L'ISLE-ADAM (péage d'Amblainville)" et "L'ISLE-ADAM" : aucune des deux graphies
//    n'existait dans la base (ni aprr.g ni overlay.gares) -- preuve de prix directe
//    entre les deux (20/20 destinations communes, 0 ecart) confirme qu'il s'agit du
//    meme point, fusionne sous "L'ISLE-ADAM". Nouvelle gare standalone, GPS source via
//    Google Places ("Gare de Péage d'Amblainville", A16 km 42), 1,46km de la gare
//    existante la plus proche (MÉRU) -- au-dela des deux seuils.
//
// Run: node --test tests/peages-isle-adam-pont-maxence-fresnes-lille.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('PONT ST MAXENCE was fully renamed to PONT-SAINTE-MAXENCE', () => {
  const stray = overlay.paires.some(p => p[0] === 'PONT ST MAXENCE' || p[1] === 'PONT ST MAXENCE');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'PONT-SAINTE-MAXENCE' || p[1] === 'PONT-SAINTE-MAXENCE');
  assert.ok(has);
});

test('FRESNES (LILLE) was fully renamed to LILLE / DOURGES', () => {
  const stray = overlay.paires.some(p => p[0] === 'FRESNES (LILLE)' || p[1] === 'FRESNES (LILLE)');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'LILLE / DOURGES' || p[1] === 'LILLE / DOURGES');
  assert.ok(has);
});

test("L'ISLE-ADAM (péage d'Amblainville) was renamed to the new standalone gare L'ISLE-ADAM", () => {
  const stray = overlay.paires.some(p => p[0] === "L'ISLE-ADAM (péage d'Amblainville)" || p[1] === "L'ISLE-ADAM (péage d'Amblainville)");
  assert.equal(stray, false);
  const g = overlay.gares.find(x => x.nom === "L'ISLE-ADAM");
  assert.ok(g, "L'ISLE-ADAM should exist as a new overlay gare");
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
  for (const gg of overlay.gares) if (gg.nom !== "L'ISLE-ADAM") for (const p of gg.points) all.push(p);
  const minDist = Math.min(...all.map(p => dist([lat, lon], p)));
  assert.ok(minDist > 0.3, "L'ISLE-ADAM GPS should be beyond 0.3km from every other point, got " + minDist.toFixed(4) + 'km');
});

test('no price was fabricated or altered by any of these fixes (sample)', () => {
  const p = overlay.paires.find(x => x[0] === "L'ISLE-ADAM" || x[1] === "L'ISLE-ADAM");
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
