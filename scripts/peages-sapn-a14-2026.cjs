'use strict';
// SAPN A14, arrêté du 28 janvier 2026, annexe TTC.
// https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053417647
// Entrée : heure LOCALE Europe/Paris, jour férié calculé par l'appelant.
// Aucun calcul implicite de fuseau ni de calendrier des jours fériés.
const EFFECTIVE_DATE = '2026-02-01';
const FARES = Object.freeze({
  montesson: Object.freeze({ standard: Object.freeze({ 1: 10.8, 2: 20.8 }), reduced: Object.freeze({ 1: 6.6, 2: 13.6 }) }),
  chambourcy: Object.freeze({ standard: Object.freeze({ 1: 2.6, 2: 5.2 }) }),
});
function priceA14({ gate, vehicleClass, localDate, localTime, isFrenchPublicHoliday }) {
  if (typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(localDate) ||
      typeof localTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime) ||
      typeof isFrenchPublicHoliday !== 'boolean') throw new TypeError('Date, heure locale et indicateur ferie requis');
  const d = new Date(localDate + 'T12:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== localDate) throw new RangeError('Date invalide');
  if (localDate < EFFECTIVE_DATE) return { price: null, reason: 'OUTSIDE_VALIDITY' };
  const gateTariffs = FARES[gate];
  if (!gateTariffs || ![1, 2].includes(vehicleClass)) return { price: null, reason: 'UNSUPPORTED_GATE_OR_CLASS' };
  const minutes = Number(localTime.slice(0, 2)) * 60 + Number(localTime.slice(3));
  const weekday = d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
  const reduced = gate === 'montesson' && weekday && !isFrenchPublicHoliday &&
    ((minutes >= 10 * 60 && minutes < 16 * 60) || minutes >= 21 * 60 || minutes < 6 * 60);
  return { price: gateTariffs[reduced ? 'reduced' : 'standard'][vehicleClass], tariff: reduced ? 'REDUCED' : 'STANDARD', effectiveDate: EFFECTIVE_DATE, source: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053417647' };
}
module.exports = { priceA14, FARES, EFFECTIVE_DATE };
