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

test('Sunday eligibility is automatic in France local time', () => {
  const base = { towardsParis: true, exit: 'ARSY' };
  assert.equal(a1TariffBand({ ...base, passageAt: '2026-11-08T17:00:00+01:00' }), 'rouge');
  assert.equal(a1TariffBand({ ...base, passageAt: '2026-11-09T17:00:00+01:00' }), 'normal');
  assert.equal(a1TariffBand({ ...base, passageAt: '2026-11-08T17:00:00+01:00', eligibleDay: false }), 'normal');
  assert.equal(a1TariffBand({ ...base, passageAt: '2026-11-09T17:00:00+01:00', eligibleDay: true }), 'rouge');
});

test('2026 SANEF reference is not used for historical journeys', () => {
  const opts = { reference, origin: 'GAUCHY', destination: 'ARSY', vehicleClass: 1, towardsParis: true, eligibleDay: true };
  assert.deepEqual(a1OfficialFare({ ...opts, passageAt: '2025-11-09T17:00:00+01:00' }), {
    status: 'unavailable', reason: 'before_reference_effective_date'
  });
  assert.equal(a1OfficialFare({ ...opts, passageAt: '2026-02-01T17:00:00+01:00' }).amount, 8.7);
  assert.throws(() => a1OfficialFare({ ...opts, passageAt: 'invalid' }), /Invalid passageAt/);
});

test('A1 uses Europe/Paris daylight-saving time, not UTC clock', () => {
  const base = { towardsParis: true, eligibleDay: true, exit: 'ARSY' };
  assert.equal(a1TariffBand({ ...base, passageAt: '2026-07-05T12:29:59Z' }), 'normal');
  assert.equal(a1TariffBand({ ...base, passageAt: '2026-07-05T12:30:00Z' }), 'vert');
  assert.equal(a1TariffBand({ ...base, passageAt: '2026-07-05T14:30:00Z' }), 'rouge');
  assert.equal(a1TariffBand({ ...base, passageAt: '2026-07-05T18:30:00Z' }), 'vert');
});
test('A1 refuses undocumented relations and classes', () => {
  const base = { reference, vehicleClass: 1, towardsParis: true, eligibleDay: true, passageAt: '2026-11-08T17:00:00+01:00' };
  assert.deepEqual(a1OfficialFare({ ...base, origin: 'UNKNOWN', destination: 'ARSY' }), {
    status: 'unavailable', reason: 'relation_not_documented'
  });
  assert.deepEqual(a1OfficialFare({ ...base, origin: 'GAUCHY', destination: 'ARSY', vehicleClass: 2 }), {
    status: 'unavailable', reason: 'class_not_documented'
  });
});

test('A1 tariff band rejects invalid dates even on non-eligible routes', () => {
  assert.throws(() => a1TariffBand({ passageAt: 'invalid', towardsParis: false, eligibleDay: false, exit: 'UNKNOWN' }), /Invalid passageAt/);
  assert.throws(() => a1TariffBand({ passageAt: 'invalid', towardsParis: true, eligibleDay: true, exit: 'ARSY' }), /Invalid passageAt/);
});

test('A1 never returns missing, negative or nonnumeric reference amounts', () => {
  const opts = { origin: 'GAUCHY', destination: 'ARSY', vehicleClass: 1, towardsParis: true,
    eligibleDay: true, passageAt: '2026-11-08T17:00:00+01:00' };
  for (const invalid of [undefined, -1, '8.70', Number.NaN, Number.POSITIVE_INFINITY]) {
    const badReference = { ...reference, relations: reference.relations.map(row =>
      row.origin === 'GAUCHY' && row.destination === 'ARSY' ? { ...row, rouge: invalid } : row) };
    assert.deepEqual(a1OfficialFare({ ...opts, reference: badReference }), {
      status: 'unavailable', reason: 'tariff_amount_not_verified'
    });
  }
});

test('A1 rejects malformed reference schema and duplicate tariff relations', () => {
  const opts = { reference, origin: 'GAUCHY', destination: 'ARSY', vehicleClass: 1,
    towardsParis: true, eligibleDay: true, passageAt: '2026-11-08T17:00:00+01:00' };
  assert.deepEqual(a1OfficialFare({ ...opts, reference: { ...reference, vehicleClass: 2 } }), {
    status: 'unavailable', reason: 'invalid_reference_schema'
  });
  assert.deepEqual(a1OfficialFare({ ...opts, reference: { ...reference, relations: null } }), {
    status: 'unavailable', reason: 'invalid_reference_schema'
  });
  assert.deepEqual(a1OfficialFare({ ...opts, reference: { ...reference, relations: [...reference.relations, reference.relations[0]] } }), {
    status: 'unavailable', reason: 'ambiguous_reference_relation'
  });
});
