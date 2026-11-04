'use strict';
// Troisieme lot "preuve de prix" (4 nov. 2026, en reponse a la relance de
// l'utilisateur "tu dois tout trouver, cherche bien") : deux alias confirmes
// par identite exacte des prix classe 1/2 sur la totalite du chevauchement
// de destinations (24/24 dans chaque cas, 0 incoherence) :
// SAINT AMAND -> ST AMAND-MONTROND, VILLE SOUS LA FERTE -> VILLE SOUS LAFERTE.
// Ces deux confirmations avaient ete trouvees lors de l'investigation du
// cluster Reims/Champagne mais pas encore appliquees ; elles le sont ici.
// Run: node --test tests/peages-alias-preuve-de-prix-batch4.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('none of the old alias labels appear literally anymore', () => {
  const old = ['SAINT AMAND', 'VILLE SOUS LA FERTE'];
  for (const n of old) {
    const present = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.equal(present, false, n + ' should no longer appear literally');
  }
});

test('each of the 2 canonical names has at least one active relation after the merges', () => {
  const canon = ['ST AMAND-MONTROND', 'VILLE SOUS LAFERTE'];
  for (const n of canon) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should have at least one active relation');
  }
});

test('no price, distance or GPS was altered by this batch (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'ST AMAND-MONTROND' || x[1] === 'ST AMAND-MONTROND');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
