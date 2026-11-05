'use strict';
// "A9: ESPAGNE" (frontière espagnole, A9, 5 nov. 2026) : confirmé comme point de
// référence logique en système ouvert, SANS GPS propre -- même prudence que
// BRIVE (A20) / SCIENTRIER/GAILLARD/LE FAYET (A40) / MODANE (A43).
//
// Sa seule relation ("Le Boulou (O) <-> A9: ESPAGNE" : 1,1 / 1,5, tarif très court)
// relie une gare déjà géolocalisée (Le Boulou (O), 42.5232/2.8177 -- dernière barrière
// avant la frontière espagnole au Perthus) à un nom qui désigne simplement la
// direction "vers l'Espagne" à cette même barrière, pas une gare physique distincte
// au-delà de la frontière (aucune gare française n'existe en territoire espagnol).
//
// Run: node --test tests/peages-a9-espagne-open-system.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('"A9: ESPAGNE" was deliberately left without GPS (open-system endpoint of the Le Boulou border barrier)', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  assert.equal(gareNames.has('A9: ESPAGNE'), false);
  const stillDangling = overlay.paires.some(p => p[0] === 'A9: ESPAGNE' || p[1] === 'A9: ESPAGNE');
  assert.ok(stillDangling, 'A9: ESPAGNE should still be present, unmerged');
});

test('no price was fabricated or altered (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'Le Boulou (O)' && x[1] === 'A9: ESPAGNE') || (x[1] === 'Le Boulou (O)' && x[0] === 'A9: ESPAGNE'));
  assert.ok(p);
  assert.equal(p[2], 1.1);
  assert.equal(p[3], 1.5);
});
