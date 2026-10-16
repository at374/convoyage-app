// Convoyage Ultra — panneau des données Routes API dans les fiches et l’estimation.
(function () {
  'use strict';
  const endpoint = 'https://convoyage-routes-691310598055.europe-west1.run.app/api/routes/estimate';
  const euro = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const session = () => {
    try {
      const nativeSession = window.CPNatif?.session ? JSON.parse(window.CPNatif.session() || '{}') : null;
      if (nativeSession?.access_token) return nativeSession;
    } catch (_) {}
    try { return JSON.parse(localStorage.getItem('cp_session') || 'null'); } catch (_) { return null; }
  };
  const config = () => {
    try {
      if (window.CP_CONFIG?.anonKey) return window.CP_CONFIG;
      if (window.CP_CONFIG_ACTIVE?.anonKey) return window.CP_CONFIG_ACTIVE;
      const nativeConfig = window.CPNatif?.configuration ? JSON.parse(window.CPNatif.configuration() || '{}') : null;
      return nativeConfig?.anonKey ? nativeConfig : JSON.parse(localStorage.getItem('cp_config') || 'null');
    } catch (_) { return null; }
  };
  const missionActive = () => {
    const title = document.getElementById('feuilleTitre')?.textContent?.trim();
    return title && window.__cp?.etat?.missions?.find(m => (m.from_city + ' → ' + m.to_city) === title);
  };
  const point = (m, side) => {
    const p = window.CPGeo?.coordonnees(m, side);
    return p ? { lat: p.lat, lng: p.lng } : (side === 'origin' ? m.origin_address || m.from_city : m.destination_address || m.to_city);
  };
  const render = (target, r, mode) => {
    const prix = mode === 'DRIVE' ? r.toll : r.fare;
    const libelle = mode === 'DRIVE' ? 'Péage' : 'Transport';
    const p = prix.status === 'estimation' ? '≈ ' + euro(prix.amount) : prix.status === 'aucun_peage' ? 'aucun' : 'non disponible';
    target.innerHTML = '<p>🛣 <b>' + (r.distanceKm ?? '—') + ' km</b> · ⏱️ <b>' + (r.durationMinutes ?? '—') + ' min</b></p><p>💶 ' + libelle + ' : <b>' + p + '</b></p><p class="doux">Données Google Routes : estimation, à vérifier avant départ.</p>';
  };
  const addBox = (host, id, origin, destination, departureTime) => {
    if (!host || document.getElementById(id) || !origin || !destination) return;
    const box = document.createElement('div');
    box.id = id; box.className = 'carte';
    box.innerHTML = '<b>🧭 Trajet réel Google</b><p class="doux">Distance routière, durée et péage estimé.</p><button type="button" data-rmode="voiture">🚗 Voiture et péages</button> <button type="button" class="second" data-rmode="transport">🚌 Transports</button><div class="doux" data-routes-result style="margin-top:8px"></div>';
    host.appendChild(box);
    box.querySelectorAll('button[data-rmode]').forEach(b => b.onclick = async () => {
      const out = box.querySelector('[data-routes-result]'), mode = b.dataset.rmode;
      const s = session(), c = config(); out.textContent = 'Calcul Google en cours…';
      try {
        const r = await window.CPRoutes.estimate({ endpoint, accessToken: s?.access_token, refreshToken: s?.refresh_token, expiresAt: s?.expires_at, email: s?.email, userId: s?.user_id, supabaseUrl: c?.url, supabaseApiKey: c?.anonKey, origin, destination, mode, departureTime });
        render(out, r, mode === 'voiture' ? 'DRIVE' : 'TRANSIT');
      } catch (e) { out.textContent = String(e.message || e); }
    });
  };
  const addMissionPanel = () => {
    const host = document.getElementById('feuilleContenu'), m = missionActive();
    if (!host || !m) return;
    addBox(host, 'routesGoogleMission', point(m, 'origin'), point(m, 'destination'), m.pickup_start || undefined);
  };
  const addEstimatePanel = () => {
    const host = document.getElementById('popVol');
    if (!host || document.getElementById('routesGoogleEstimate')) return;
    const label = Array.from(host.querySelectorAll('p')).map(p => p.textContent || '').find(t => t.includes('🟢') && t.includes('🔴'));
    const match = label && label.match(/🟢\s*(.+?)\s*→\s*🔴\s*(.+?)(?:\.|$)/);
    if (!match) return;
    const contenu = host.querySelector('.popVolBoite') || host;
    addBox(contenu, 'routesGoogleEstimate', match[1].trim(), match[2].trim());
  };
  const refresh = () => { addMissionPanel(); addEstimatePanel(); };
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
