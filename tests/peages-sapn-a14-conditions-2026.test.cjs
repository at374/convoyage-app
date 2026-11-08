'use strict';
// Source : arrete du 28 janvier 2026, article 3 et annexe A14
// https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053417647
// Tarifs TTC au 01/02/2026. La reduction Montesson est conditionnelle.
const assert = require('node:assert/strict');
const { test } = require('node:test');

const a14 = Object.freeze({
  effective_date: '2026-02-01',
  source: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053417647',
  montesson: {
    normal: { class1: 10.8, class2: 20.8 },
    reduced: { class1: 6.6, class2: 13.6 },
    conditions: 'Lundi-vendredi 10h-16h et 21h-06h, hors jours feries',
  },
  chambourcy: { normal: { class1: 2.6, class2: 5.2 } },
});

test('A14 SAPN 2026 : classes 1 et 2, tarif normal et tarif reduit distincts', () => {
  assert.deepEqual(a14.montesson.normal, { class1: 10.8, class2: 20.8 });
  assert.deepEqual(a14.montesson.reduced, { class1: 6.6, class2: 13.6 });
  assert.deepEqual(a14.chambourcy.normal, { class1: 2.6, class2: 5.2 });
  assert.notDeepEqual(a14.montesson.normal, a14.montesson.reduced);
  assert.match(a14.montesson.conditions, /hors jours feries/);
});
