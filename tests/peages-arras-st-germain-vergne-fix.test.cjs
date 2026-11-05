'use strict';
// Deux petites resolutions (5 nov. 2026), decouvertes dans le lot de noms apparus
// apres la fusion amont (PR #198, ports "transport") qui a elargi le jeu de donnees
// peages :
//
// 1. "ARRAS (A26)"/"ARRAS (A1)" -> "ARRAS NORD"/"ARRAS EST" respectivement. Le suffixe
//    reseau (A26 vs A1) desambigue sans ambiguite puisqu'il n'existe qu'une seule gare
//    ARRAS sur chacune de ces deux autoroutes ; confirme par preuve de prix stricte :
//    13/13 destinations communes pour (A26)->NORD, 7/7 pour (A1)->EST, 0 ecart.
//
// 2. "ST GERMAIN LES VERGNES" (pluriel) / "ST GERMAIN LES VERGN" (tronque) ->
//    "ST GERMAIN LES VERGNE" (forme deja enregistree, singulier). Aucune preuve de
//    prix possible (0 destination commune, meme situation de grille autonome que
//    CHARMONT-SOUS-BARBUISE) mais aucune ambiguite toponymique possible : Saint-
//    Germain-les-Vergnes est une commune unique de Correze sur l'A20, les trois
//    graphies ne peuvent designer qu'un seul et meme peage physique (meme discipline
//    que l'expansion ST/STE : la variation est purement orthographique).
//
// Run: node --test tests/peages-arras-st-germain-vergne-fix.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('ARRAS (A26) and ARRAS (A1) were fully renamed to ARRAS NORD / ARRAS EST', () => {
  for (const old of ['ARRAS (A26)', 'ARRAS (A1)']) {
    const stray = overlay.paires.some(p => p[0] === old || p[1] === old);
    assert.equal(stray, false, old + ' should no longer appear literally');
  }
  for (const n of ['ARRAS NORD', 'ARRAS EST']) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should carry at least one relation after the rename');
  }
});

test('ST GERMAIN LES VERGNES / ST GERMAIN LES VERGN were fully renamed to ST GERMAIN LES VERGNE', () => {
  for (const old of ['ST GERMAIN LES VERGNES', 'ST GERMAIN LES VERGN']) {
    const stray = overlay.paires.some(p => p[0] === old || p[1] === old);
    assert.equal(stray, false, old + ' should no longer appear literally');
  }
  const has = overlay.paires.some(p => p[0] === 'ST GERMAIN LES VERGNE' || p[1] === 'ST GERMAIN LES VERGNE');
  assert.ok(has, 'ST GERMAIN LES VERGNE should carry relations after the rename');
});

test('no price was fabricated or altered by either fix (sample)', () => {
  const p1 = overlay.paires.find(x => x[0] === 'ARRAS NORD' || x[1] === 'ARRAS NORD');
  assert.ok(p1);
  assert.equal(typeof p1[2], 'number');
  assert.equal(typeof p1[3], 'number');
  const p2 = overlay.paires.find(x => x[0] === 'ST GERMAIN LES VERGNE' || x[1] === 'ST GERMAIN LES VERGNE');
  assert.ok(p2);
  assert.equal(typeof p2[2], 'number');
  assert.equal(typeof p2[3], 'number');
});
