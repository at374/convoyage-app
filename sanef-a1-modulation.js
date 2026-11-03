'use strict';
// SANEF A1 2026: determine the applicable tariff band, never calculate prices by percentage.
// Sundays are recognized in Europe/Paris; holiday eligibility and direction require caller confirmation.
function eligibleA1Day(passageAt, eligibleDay) {
  if (typeof eligibleDay === 'boolean') return eligibleDay;
  const date = passageAt instanceof Date ? passageAt : new Date(passageAt);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid passageAt');
  // Weekday is determined locally, not in UTC (important near midnight).
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(date) === 'Sun';
}
function a1TariffBand({ passageAt, towardsParis, eligibleDay, exit } = {}) {
  const date = passageAt instanceof Date ? passageAt : new Date(passageAt);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid passageAt');
  if (towardsParis !== true || !eligibleA1Day(date, eligibleDay)) return 'normal';
  if (!['ARSY', 'CHEVRIERES', 'SENLIS', 'CHAMANT'].includes(String(exit || '').toUpperCase())) return 'normal';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const h = Number(parts.find(p => p.type === 'hour').value);
  const m = Number(parts.find(p => p.type === 'minute').value);
  const minute = h * 60 + m;
  if ((minute >= 14 * 60 + 30 && minute < 16 * 60 + 30) ||
      (minute >= 20 * 60 + 30 && minute < 23 * 60 + 30)) return 'vert';
  if (minute >= 16 * 60 + 30 && minute < 20 * 60 + 30) return 'rouge';
  return 'normal';
}
function a1OfficialFare({ reference, origin, destination, passageAt, towardsParis, eligibleDay, vehicleClass } = {}) {
  if (!reference || reference.status !== 'REFERENCE_ONLY_NOT_APPLIED') throw new TypeError('Expected verified reference');
  const date = passageAt instanceof Date ? passageAt : new Date(passageAt);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid passageAt');
  if (vehicleClass !== 1) return { status: 'unavailable', reason: 'class_not_documented' };
  if (towardsParis !== true || !eligibleA1Day(date, eligibleDay)) return { status: 'unavailable', reason: 'outside_modulation_scope' };
  const effective = new Date(reference.effective + 'T00:00:00+01:00');
  if (!Number.isFinite(effective.getTime())) throw new TypeError('Invalid reference effective date');
  if (date < effective) return { status: 'unavailable', reason: 'before_reference_effective_date' };
  const row = reference.relations.find(r => r.origin === origin && r.destination === destination);
  if (!row) return { status: 'unavailable', reason: 'relation_not_documented' };
  const band = a1TariffBand({ passageAt, towardsParis, eligibleDay, exit: destination });
  return { status: 'reference_only', band, amount: row[band], currency: 'EUR', effective: reference.effective };
}
module.exports = { eligibleA1Day, a1TariffBand, a1OfficialFare };
