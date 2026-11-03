'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const reference = require('../data/sanef-a1-modulation-2026-classe1.json');
const { a1TariffBand, a1OfficialFare } = require('../sanef-a1-modulation.js');
function band(localIso) {
  return a1TariffBand({ passageAt: localIso, towardsParis: true, eligibleDay: true, exit: 'ARSY' });
}
test('SANEF A1 boundary times use France timezone', () => {
  assert.equal(band('2026-11-08T14:29:59+01:00'), 'normal');
  assert.equal(band('2026-11-08T14:30:00+01:00'), 'vert');
  assert.equal(band('2026-11-08T16:29:59+01:00'), 'vert');
  assert.equal(band('2026-11-08T16:30:00+01:00'), 'rouge');
  assert.equal(band('2026-11-08T20:29:59+01:00'), 'rouge');
  assert.equal(band('2026-11-08T20:30:00+01:00'), 'vert');
  assert.equal(band('2026-11-08T23:29:59+01:00'), 'vert');
  assert.equal(band('2026-11-08T23:30:00+01:00'), 'normal');
});
test('SANEF A1 requires verified day and direction', () => {
  assert.equal(a1TariffBand({ passageAt: '2026-11-08T17:00:00+01:00', towardsParis: false, eligibleDay: true, exit: 'ARSY' }), 'normal');
  assert.equal(a1TariffBand({ passageAt: '2026-11-08T17:00:00+01:00', towardsParis: true, eligibleDay: false, exit: 'ARSY' }), 'normal');
});
test('SANEF A1 official amounts are looked up, never computed from percentage', () => {
  const options = { reference, origin: 'GAUCHY', destination: 'ARSY', vehicleClass: 1, towardsParis: true, eligibleDay: true };
  assert.deepEqual(a1OfficialFare({ ...options, passageAt: '2026-11-08T15:00:00+01:00' }), {
    status: 'reference_only', band: 'vert', amount: 6.3, currency: 'EUR', effective: '2026-02-01'
  });
  assert.equal(a1OfficialFare({ ...options, passageAt: '2026-11-08T17:00:00+01:00' }).amount, 8.7);
  assert.equal(a1OfficialFare({ ...options, vehicleClass: 2, passageAt: '2026-11-08T17:00:00+01:00' }).status, 'unavailable');
});
