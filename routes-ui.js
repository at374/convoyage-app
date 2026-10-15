// Convoyage Ultra — panneau des données Routes API dans la fiche mission.
(function () {
  'use strict';
  const endpoint = 'https://convoyage-routes-691310598055.europe-west1.run.app/api/routes/estimate';
  const euro = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const session = () => { try { return JSON.parse(localStorage.getItem('cp_session') || 'null'); } catch (_) { return null; } };
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
  const addPanel = () => {
    const host = document.getElementById('feuilleContenu');
    if (!host || document.getElementById('routesGoogle')) return;
    const m = missionActive(); if (!m) return;
    const origin = point(m, 'origin'), destination = point(m, 'destination');
    if (!origin || !destination) return;
    const box = document.createElement('div');
    box.id = 'routesGoogle'; box.className = 'carte';
    box.innerHTML = '<b>🧭 Trajet réel Google</b><p class="doux">Calcule distance routière, durée et estimation.</p><button type="button" data-rmode="voiture">🚗 Voiture et péages</button> <button type="button" class="second" data-rmode="transport">🚌 Transports</button><div id="routesResult" class="doux" style="margin-top:8px"></div>';
    host.insertBefore(box, host.querySelector('.renta') || null);
    box.querySelectorAll('button[data-rmode]').forEach(b => b.onclick = async () => {
      const out = box.querySelector('#routesResult'), mode = b.dataset.rmode;
      const s = session(); out.textContent = 'Calcul en cours…';
      try {
        const r = await window.CPRoutes.estimate({ endpoint, accessToken: s?.access_token, origin, destination, mode, departureTime: m.pickup_start || undefined });
        render(out, r, mode === 'voiture' ? 'DRIVE' : 'TRANSIT');
      } catch (e) { out.textContent = String(e.message || e); }
    });
  };
  new MutationObserver(addPanel).observe(document.documentElement, { childList: true, subtree: true });
})();