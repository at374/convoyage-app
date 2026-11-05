'use strict';
// "CRIQUEBEUF N°20 à MAISON-BRÛLEE N°24 / ROUEN LES ESSARTS (A139)" renomme vers
// "CRIQUEBEUF N°20 À MAISON-BRÛLÉE N°24" (5 nov. 2026) : meme etiquette d'intervalle
// de sorties, seule la casse de l'accent ("à"/"À", "BRÛLEE"/"BRÛLÉE") et un suffixe
// descriptif supplementaire ("/ ROUEN LES ESSARTS (A139)") differaient -- aucune autre
// interpretation toponymique possible (meme discipline que le renommage de casse en
// masse et les suffixes "(peage de X)"). Aucune preuve de prix possible : le nom cible
// n'avait lui-meme aucune relation active (0), donc ce n'est pas une fusion de deux
// points concurrents mais la reactivation d'un nom par ailleurs mort.
// Run: node --test tests/peages-criquebeuf-casing-suffix-fix.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('the old suffixed/mis-cased label no longer appears literally', () => {
  const OLD = 'CRIQUEBEUF N°20 à MAISON-BRÛLEE N°24 / ROUEN LES ESSARTS (A139)';
  const stray = overlay.paires.some(p => p[0] === OLD || p[1] === OLD);
  assert.equal(stray, false);
});

test('the canonical pre-existing spelling now carries the relations', () => {
  const NEW = 'CRIQUEBEUF N°20 À MAISON-BRÛLÉE N°24';
  const has = overlay.paires.some(p => p[0] === NEW || p[1] === NEW);
  assert.ok(has);
});

test('no price was fabricated or altered by this fix (sample)', () => {
  const NEW = 'CRIQUEBEUF N°20 À MAISON-BRÛLÉE N°24';
  const p = overlay.paires.find(x => x[0] === NEW || x[1] === NEW);
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
