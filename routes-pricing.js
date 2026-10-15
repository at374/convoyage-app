// Convoyage Ultra — client du proxy Google Routes.
// La clé Google reste exclusivement côté Cloud Run.
(function (root) {
  'use strict';
  const MODES = Object.freeze({ voiture: 'DRIVE', transport: 'TRANSIT' });
  const place = p => {
    if (typeof p === 'string' && p.trim()) return { address: p.trim() };
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) return { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
    throw new Error('Adresse ou coordonnées invalides');
  };
  const money = m => {
    if (!m || typeof m !== 'object') return null;
    const n = Number(m.units || 0) + Number(m.nanos || 0) / 1e9;
    return Number.isFinite(n) ? { amount: Math.round(n * 100) / 100, currency: m.currencyCode || 'EUR' } : null;
  };
  const normalizeGoogle = (response, mode) => {
    const r = response?.routes?.[0]; if (!r) throw new Error('Aucun itinéraire trouvé');
    const toll = r.travelAdvisory?.tollInfo, fare = r.travelAdvisory?.transitFare;
    const tollPrice = toll?.estimatedPrice?.length ? money(toll.estimatedPrice[0]) : null;
    return {
      distanceKm: Number.isFinite(r.distanceMeters) ? Math.round(r.distanceMeters / 100) / 10 : null,
      durationMinutes: r.duration ? Math.ceil(parseFloat(r.duration) / 60) : null,
      toll: mode === 'DRIVE' ? (!toll ? { status: 'aucun_peage' } : tollPrice ? { status: 'estimation', ...tollPrice } : { status: 'prix_inconnu' }) : { status: 'non_applicable' },
      fare: mode === 'TRANSIT' ? (money(fare) ? { status: 'estimation', ...money(fare) } : { status: 'prix_inconnu' }) : { status: 'non_applicable' },
      source: 'Google Routes API', priceIsGuaranteed: false
    };
  };
  async function estimate(opts) {
    if (!opts || !/^https:\/\//.test(opts.endpoint || '')) throw new Error('Service itinéraires non configuré');
    const mode = MODES[opts.mode] || opts.mode;
    if (!['DRIVE', 'TRANSIT'].includes(mode)) throw new Error('Mode non pris en charge');
    if (!opts.accessToken) throw new Error('Reconnecte-toi pour calculer le trajet');
    const body = { origin: place(opts.origin), destination: place(opts.destination), mode };
    if (opts.departureTime) body.departureTime = opts.departureTime;
    const res = await fetch(opts.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + opts.accessToken }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(res.status === 401 ? 'Reconnecte-toi puis réessaie' : 'Service itinéraires indisponible');
    return normalizeGoogle(await res.json(), mode);
  }
  root.CPRoutes = { estimate, normalizeGoogle, MODES };
})(globalThis);