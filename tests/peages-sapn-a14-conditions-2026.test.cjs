'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { priceA14, FARES, EFFECTIVE_DATE } = require('../scripts/peages-sapn-a14-2026.cjs');

test('A14 tarifs officiels TTC classes 1/2', () => {
  assert.equal(EFFECTIVE_DATE, '2026-02-01');
  assert.deepEqual(FARES.montesson.standard, { 1: 10.8, 2: 20.8 });
  assert.deepEqual(FARES.montesson.reduced, { 1: 6.6, 2: 13.6 });
  assert.deepEqual(FARES.chambourcy.standard, { 1: 2.6, 2: 5.2 });
});
const fare = (gate, vehicleClass, localDate, localTime, isFrenchPublicHoliday = false) =>
  priceA14({ gate, vehicleClass, localDate, localTime, isFrenchPublicHoliday });

test('Montesson lundi : bornes horaires et deux classes', () => {
  assert.equal(fare('montesson', 1, '2026-11-09', '09:59').price, 10.8);
  assert.equal(fare('montesson', 1, '2026-11-09', '10:00').price, 6.6);
  assert.equal(fare('montesson', 2, '2026-11-09', '15:59').price, 13.6);
  assert.equal(fare('montesson', 2, '2026-11-09', '16:00').price, 20.8);
  assert.equal(fare('montesson', 1, '2026-11-09', '20:59').price, 10.8);
  assert.equal(fare('montesson', 1, '2026-11-09', '21:00').price, 6.6);
  assert.equal(fare('montesson', 1, '2026-11-09', '05:59').price, 6.6);
  assert.equal(fare('montesson', 1, '2026-11-09', '06:00').price, 10.8);
});
test('Week-end et jour ferie excluent reduction Montesson', () => {
  assert.equal(fare('montesson', 1, '2026-11-08', '12:00').price, 10.8);
  assert.equal(fare('montesson', 1, '2026-11-11', '12:00', true).price, 10.8);
  assert.equal(fare('chambourcy', 2, '2026-11-09', '12:00').price, 5.2);
});
test('Date hors validite et parametres invalides', () => {
  assert.equal(fare('montesson', 1, '2026-01-31', '12:00').price, null);
  assert.throws(() => fare('montesson', 1, '2026-02-30', '12:00'), RangeError);
  assert.throws(() => priceA14({ gate: 'montesson', vehicleClass: 1, localDate: '2026-11-09', localTime: '12:00' }), TypeError);
});
