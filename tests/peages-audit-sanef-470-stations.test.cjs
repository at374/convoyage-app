'use strict';
// Audit de sanef_parsed.json (7 nov. 2026, extraction du PDF officiel SANEF
// 2026, matrice triangulaire de 470 gares, tarifs classe 1).
//
// Source bruitée (artefacts OCR : lignes dupliquées avec valeurs numériques
// de colonnes voisines collées au nom, ligature "Œ" non reconnue par endroits).
// Après dédoublonnage et normalisation, 425/470 noms (90,4%) déjà couverts.
// Vérification individuelle des noms distincts restants :
//   - NŒUX-LES-MINES, ALBERT, CHÂLONS-EN-CHAMPAGNE/LA VEUVE, SAINT-GIBRIEN,
//     CHARMONT-SOUS-BARBUISE : FAUX POSITIFS -- existent déjà ("NOEUX LES
//     MINES", "ALBERT", "CHALONS LA VEUVE", "ST GIBRIEN", "CHARMONT
//     (LIM.CONC)"), simplement non reconnus par la normalisation (ligature
//     Œ, abréviations).
//   - METZ (A31), COUTEVROULT : déjà résolus par des sessions précédentes
//     (METZ (A31) fusionné vers BEAUMONT ; COUTEVROULT renommé en
//     "PARIS / NOISY-LE-GRAND" -- cf. fix_metz_freyming.js,
//     fix_meaux_coutevroult.js dans le scratchpad).
//   - LIÉVIN (A26, Pas-de-Calais, N°6.2) : CORRECTIF du 8 nov. 2026 -- cet
//     audit (et sa documentation dans TRANSMISSION-CLAUDE-PEAGES-2026.md)
//     affirmait par erreur que LIÉVIN était non résolu ("recherche Google
//     Places infructueuse"). En réalité, "LIÉVIN" (avec accent) existe déjà
//     dans aprr.g depuis l'import d'origine (idx 453, GPS [50.4378,2.70708],
//     30 relations aprr.p + 82 via overlay.paires) -- coordonnées identiques
//     (<0.02km) à "Le Lievinois Sortie/Entree" du référentiel officiel du
//     ministère (gares-peage-2025.csv). Le test ci-dessous cherchait
//     "LIEVIN" SANS accent, qui ne matche jamais "LIÉVIN" AVEC accent (la
//     casse est insensible en JS mais pas les accents) -- un faux négatif
//     de la recherche, pas une absence réelle. LIÉVIN n'est PAS un chantier
//     ouvert : il est déjà entièrement intégré.
//
// Run: node --test tests/peages-audit-sanef-470-stations.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');
const officiel = require('../data/gares-peage-officiel.json');

test('les noms SANEF signalés "manquants" par erreur de normalisation existent bien déjà', () => {
  const allNames = new Set([
    ...aprr.g.map(g => g[0].toUpperCase()),
    ...overlay.gares.map(g => g.nom.toUpperCase()),
    ...overlay.paires.flatMap(p => [p[0].toUpperCase(), p[1].toUpperCase()]),
  ]);
  for (const n of ['NOEUX LES MINES', 'ALBERT', 'CHALONS LA VEUVE', 'ST GIBRIEN', 'PARIS / NOISY-LE-GRAND']) {
    assert.ok(allNames.has(n), n + ' doit déjà exister');
  }
  // METZ (A31) a été fusionné : il ne doit plus traîner tel quel
  const strayMetz = overlay.paires.some(p => p[0] === 'METZ (A31)' || p[1] === 'METZ (A31)');
  assert.equal(strayMetz, false);
});

test('LIÉVIN (A26) est déjà intégré (correctif du 8 nov. 2026, ex-faux-négatif accent)', () => {
  const g = aprr.g.find(x => x[0] === 'LIÉVIN');
  assert.ok(g, 'LIÉVIN (avec accent) doit exister dans aprr.g');
  const [lat, lon] = g[1][0];
  // GPS officiel "Le Lievinois Sortie" (gares-peage-2025.csv, data.gouv.fr) : 50.4378,2.70708
  function dist(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const d = dist([lat, lon], [50.4378, 2.70708]);
  assert.ok(d < 0.02, 'LIÉVIN devrait être à moins de 0.02km du point officiel "Le Lievinois Sortie", trouvé ' + d.toFixed(4) + 'km');
  const lines = aprr.p.split(';');
  const idx36 = aprr.g.findIndex(x => x[0] === 'LIÉVIN').toString(36);
  const hasPrix = lines.some(l => { const [a, b] = l.split(','); return a === idx36 || b === idx36; });
  assert.ok(hasPrix, 'LIÉVIN doit avoir au moins un prix en base');
});

test('LIÉVIN A26 : les candidats GPS officiels correspondent au point deja integre', () => {
  const candidats = officiel.d.filter(r => r[1] === '62A902635CD');
  assert.deepEqual(new Set(candidats.map(r => r[0])), new Set(['Le Lievinois Entree', 'Le Lievinois Sortie']));
  assert.ok(candidats.every(r => r[4] === 'Ech'));
  // LIÉVIN (avec accent) existe bel et bien -- contrairement a l'ancienne assertion
  // qui cherchait "LIEVIN" sans accent et concluait, par erreur, a une absence.
  assert.ok(overlay && aprr.g.some(g => g[0] === 'LIÉVIN'));
});
