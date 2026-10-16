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
  async function renewToken(opts) {
    const stillValid = !opts.expiresAt || Date.now() < Number(opts.expiresAt) - 60000;
    if (stillValid || !opts.refreshToken || !opts.supabaseUrl) return opts.accessToken;
    const res = await fetch(String(opts.supabaseUrl).replace(/\/+$/, '') + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: opts.supabaseApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: opts.refreshToken })
    });
    if (!res.ok) throw new Error('Reconnecte-toi puis réessaie');
    const j = await res.json();
    const next = { access_token: j.access_token, refresh_token: j.refresh_token || opts.refreshToken, expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000, email: opts.email || '', user_id: opts.userId || '' };
    try { localStorage.setItem('cp_session', JSON.stringify(next)); } catch (_) {}
    return next.access_token;
  }
  async function estimate(opts) {
    if (!opts || !/^https:\/\//.test(opts.endpoint || '')) throw new Error('Service itinéraires non configuré');
    const mode = MODES[opts.mode] || opts.mode;
    if (!['DRIVE', 'TRANSIT'].includes(mode)) throw new Error('Mode non pris en charge');
    if (!opts.accessToken || !opts.supabaseApiKey) throw new Error('Reconnecte-toi pour calculer le trajet');
    const token = await renewToken(opts);
    const body = { origin: place(opts.origin), destination: place(opts.destination), mode };
    if (opts.departureTime) body.departureTime = opts.departureTime;
    const res = await fetch(opts.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Supabase-Api-Key': opts.supabaseApiKey }, body: JSON.stringify(body) });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      const code = typeof detail?.code === 'string' ? detail.code : '';
      const message = {
        missing_session: 'Session absente : reconnecte-toi.',
        missing_public_key: 'Configuration de connexion absente.',
        supabase_not_configured: 'Configuration Supabase à corriger.',
        supabase_session_rejected: 'Session Supabase refusée : déconnecte-toi puis reconnecte-toi.',
        supabase_timeout: 'Vérification Supabase trop lente : réessaie.',
        supabase_unreachable: 'Supabase est momentanément inaccessible.'
      }[code];
      throw new Error(message || (res.status === 401 ? 'Connexion à vérifier.' : 'Service itinéraires indisponible'));
    }
    return normalizeGoogle(await res.json(), mode);
  }
  root.CPRoutes = { estimate, normalizeGoogle, MODES };
})(globalThis);