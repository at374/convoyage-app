'use strict';
// SANEF A1 2026: determine the applicable tariff band, never calculate prices by percentage.
// The caller must confirm holiday eligibility and travel direction from its routing data.
function a1TariffBand({ passageAt, towardsParis, eligibleDay, exit } = {}) {
  if (towardsParis !== true || eligibleDay !== true) return 'normal';
  if (!['ARSY', 'CHEVRIERES', 'SENLIS', 'CHAMANT'].includes(String(exit || '').toUpperCase())) return 'normal';
  const date = passageAt instanceof Date ? passageAt : new Date(passageAt);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid passageAt');
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
  if (vehicleClass !== 1) return { status: 'unavailable', reason: 'class_not_documented' };
  if (towardsParis !== true || eligibleDay !== true) return { status: 'unavailable', reason: 'outside_modulation_scope' };
  const row = reference.relations.find(r => r.origin === origin && r.destination === destination);
  if (!row) return { status: 'unavailable', reason: 'relation_not_documented' };
  const band = a1TariffBand({ passageAt, towardsParis, eligibleDay, exit: destination });
  return { status: 'reference_only', band, amount: row[band], currency: 'EUR', effective: reference.effective };
}
module.exports = { a1TariffBand, a1OfficialFare };
