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
//   - LIÉVIN (A26, Pas-de-Calais, N°6.2) : seul nom réellement non résolu
//     identifié par cet audit. Aucune coordonnée GPS trouvée (recherche
//     Google Places infructueuse). Reste un chantier ouvert.
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

test('LIEVIN (A26) reste non résolu -- documentation, pas une fabrication', () => {
  const allNames = new Set([
    ...aprr.g.map(g => g[0].toUpperCase()),
    ...overlay.gares.map(g => g.nom.toUpperCase()),
  ]);
  assert.equal(allNames.has('LIEVIN'), false);
});

test('LIÉVIN A26 : les candidats GPS officiels existent sans prouver un alias tarifaire', () => {
  const candidats = officiel.d.filter(r => r[1] === '62A902635CD');
  assert.deepEqual(new Set(candidats.map(r => r[0])), new Set(['Le Lievinois Entree', 'Le Lievinois Sortie']));
  assert.ok(candidats.every(r => r[4] === 'Ech'));
  assert.equal(overlay.gares.some(g => g.nom === 'LIEVIN'), false);
});
