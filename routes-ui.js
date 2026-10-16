// Convoyage Ultra — panneau des données Routes API dans les fiches et l’estimation.
(function () {
  'use strict';
  const endpoint = 'https://convoyage-routes-691310598055.europe-west1.run.app/api/routes/estimate';
  const euro = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const lireNatif = () => { try { return window.CPNatif && window.CPNatif.session ? JSON.parse(window.CPNatif.session() || '{}') : null; } catch (_) { return null; } };
  const lireLocal = () => { try { return JSON.parse(localStorage.getItem('cp_session') || 'null'); } catch (_) { return null; } };
  const valide = s => { if (!s || !s.access_token) return false; let e = Number(s.expires_at) || 0; if (e && e < 1e12) e *= 1000; return !e || e > Date.now() + 30000; };
  // V174 : on prend la session encore valable (celle de l'application Android si elle marche, sinon celle de la page).
  const session = () => {
    const n = lireNatif(), l = lireLocal();
    if (valide(n)) return n;
    if (valide(l)) return l;
    return (n && n.access_token) ? n : l;
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
  const hm = m => { if (!Number.isFinite(m)) return '—'; const h = Math.floor(m / 60), mm = m % 60; return h ? h + 'h' + String(mm).padStart(2, '0') : mm + ' min'; };
  const lieu = p => typeof p === 'string' ? encodeURIComponent(p) : p.lat + ',' + p.lng;
  const liens = (o, d) => '<p class="doux" style="margin-top:8px">Ouvrir dans : <a href="https://www.google.com/maps/dir/?api=1&origin=' + lieu(o) + '&destination=' + lieu(d) + '&travelmode=driving&dir_action=navigate" target="_blank" rel="noopener">Google Maps</a> · <a href="https://waze.com/ul?' + (typeof d === 'string' ? 'q=' + encodeURIComponent(d) : 'll=' + d.lat + ',' + d.lng) + '&navigate=yes" target="_blank" rel="noopener">Waze</a></p>';
  const decode = s => { const out = []; let i = 0, lat = 0, lng = 0; while (i < s.length) { let b, sh = 0, res = 0; do { b = s.charCodeAt(i++) - 63; res |= (b & 31) << sh; sh += 5; } while (b >= 32); lat += (res & 1) ? ~(res >> 1) : (res >> 1); sh = 0; res = 0; do { b = s.charCodeAt(i++) - 63; res |= (b & 31) << sh; sh += 5; } while (b >= 32); lng += (res & 1) ? ~(res >> 1) : (res >> 1); out.push([lng / 1e5, lat / 1e5]); } return out; };
  const carte = r => {
    const W = 480, H = 540, A = decode(r.polyline);
    if (A.length < 2) return '';
    const B = r.sansPeage && r.sansPeage.polyline && r.sansPeage.polyline !== r.polyline ? decode(r.sansPeage.polyline) : null;
    const pts = A.concat(B || []);
    const px = (q, z) => { const n = 256 * 2 ** z, s = Math.sin(q[1] * Math.PI / 180); return [(q[0] + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
    let z = 14;
    for (; z > 2; z--) { const P = pts.map(q => px(q, z)), xs = P.map(q => q[0]), ys = P.map(q => q[1]); if (Math.max(...xs) - Math.min(...xs) <= W * 0.88 && Math.max(...ys) - Math.min(...ys) <= H * 0.88) break; }
    const P = pts.map(q => px(q, z)), xs = P.map(q => q[0]), ys = P.map(q => q[1]);
    const ox = (Math.min(...xs) + Math.max(...xs)) / 2 - W / 2, oy = (Math.min(...ys) + Math.max(...ys)) / 2 - H / 2, N = 2 ** z;
    let tuiles = '';
    for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++) for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++) if (ty >= 0 && ty < N) tuiles += '<img alt="" referrerpolicy="no-referrer" src="https://tile.openstreetmap.org/' + z + '/' + (((tx % N) + N) % N) + '/' + ty + '.png" style="position:absolute;left:' + ((tx * 256 - ox) / W * 100) + '%;top:' + ((ty * 256 - oy) / H * 100) + '%;width:' + (256 / W * 100) + '%;height:' + (256 / H * 100) + '%">';
    const pos = q => { const p = px(q, z); return [p[0] - ox, p[1] - oy]; };
    const d = L => L.map(q => pos(q).map(v => v.toFixed(1)).join(',')).join(' ');
    const a = pos(A[0]), b = pos(A[A.length - 1]);
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%">' + (B ? '<polyline points="' + d(B) + '" fill="none" stroke="#1a9850" stroke-width="4" stroke-dasharray="9 6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' : '') + '<polyline points="' + d(A) + '" fill="none" stroke="#1e63d8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="' + a[0].toFixed(1) + '" cy="' + a[1].toFixed(1) + '" r="7" fill="#1a9850" stroke="#fff" stroke-width="2"/><circle cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="7" fill="#d93025" stroke="#fff" stroke-width="2"/></svg>';
    return '<div style="position:relative;width:100%;aspect-ratio:480/540;overflow:hidden;border-radius:8px;margin-top:8px;background:#ddd">' + tuiles + svg + '<span style="position:absolute;right:2px;bottom:2px;font-size:10px;background:rgba(255,255,255,.8);color:#333;padding:0 4px;border-radius:3px">© OpenStreetMap</span></div><p class="doux">' + (B ? 'Bleu : avec péages · Vert pointillé : sans péage.' : 'Bleu : trajet Google (identique avec ou sans péage).') + '</p>';
  };
  const dec6 = s => { const o = []; let i = 0, la = 0, lo = 0; while (i < s.length) { let b, sh = 0, rs = 0; do { b = s.charCodeAt(i++) - 63; rs |= (b & 31) << sh; sh += 5; } while (b >= 32); la += (rs & 1) ? ~(rs >> 1) : (rs >> 1); sh = 0; rs = 0; do { b = s.charCodeAt(i++) - 63; rs |= (b & 31) << sh; sh += 5; } while (b >= 32); lo += (rs & 1) ? ~(rs >> 1) : (rs >> 1); o.push([la / 1e6, lo / 1e6]); } return o; };
  const dist = (a, b, c, d) => { const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t, h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const joli = s => String(s).toLowerCase().replace(/(^|[\s\-\/'])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());
  let PEAGES = null;
  const chargerPeages = async () => {
    if (PEAGES) return PEAGES;
    const j = await fetch('peages-aprr.json').then(r => r.json());
    const prix = new Map();
    for (const s of j.p.split(';')) { const [a, b, c1, c2, d] = s.split(','); const x = parseInt(a, 36), y = parseInt(b, 36); prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10, Number(d)]); }
    PEAGES = { g: j.g, prix, v: j.v };
    return PEAGES;
  };
  const gareProche = (P, lat, lon, max) => { let bi = -1, bd = max; P.g.forEach((g, i) => g[1].forEach(p => { const d = dist(lat, lon, p[0], p[1]); if (d < bd) { bd = d; bi = i; } })); return bi; };
  const prixExact = (P, sh, tms, km) => {
    const f = tms[0], l = tms[tms.length - 1];
    const i0 = f.begin_shape_index, i1 = l.end_shape_index;
    if (!sh[i0] || !sh[i1]) return null;
    const hits = [];
    let der = -2;
    for (let k = i0; k <= i1; k++) { const g = gareProche(P, sh[k][0], sh[k][1], 0.4); if (g >= 0 && g !== der) { hits.push({ g, k }); der = g; } }
    if (!hits.length) return null;
    const e = hits[0];
    const lon = (a, b) => { let t = 0; for (let k = a; k < b; k++) t += dist(sh[k][0], sh[k][1], sh[k + 1][0], sh[k + 1][1]); return t; };
    for (let h = hits.length - 1; h >= 1; h--) {
      const s = hits[h];
      if (s.g === e.g) continue;
      const v = P.prix.get(Math.min(e.g, s.g) * 1000 + Math.max(e.g, s.g));
      if (!v) continue;
      const q = v[2] / Math.max(1, lon(e.k, s.k));
      if (q < 0.7 || q > 1.9) continue;
      return { e: joli(P.g[e.g][0]), s: joli(P.g[s.g][0]), c1: v[0], c2: v[1], reste: h < hits.length - 1 ? 0 : lon(s.k, i1) };
    }
    return null;
  };
  const estimerPeage = async (r, out) => {
    try {
      const A = decode(r.polyline);
      if (A.length < 2) return;
      const a = A[0], b = A[A.length - 1];
      const res = await fetch('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locations: [{ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] }], costing: 'auto', costing_options: { auto: { use_tolls: 1.0 } }, directions_options: { language: 'fr-FR', units: 'kilometers' } }) });
      const j = await res.json();
      const leg = j && j.trip && j.trip.legs && j.trip.legs[0];
      if (!leg) return;
      const tms = (leg.maneuvers || []).filter(m => m.toll);
      let km = 0;
      for (const m of tms) km += Number(m.length) || 0;
      if (km < 1) return;
      try {
        const P = await chargerPeages();
        const x = prixExact(P, dec6(leg.shape), tms, km);
        if (x && x.reste < 3) {
          out.insertAdjacentHTML('beforeend', '<p>💶 Péage exact : <b>classe 1 : ' + euro(x.c1) + '</b> · <b>classe 2 : ' + euro(x.c2) + '</b></p><p class="doux">' + x.e + ' → ' + x.s + ' · tarifs officiels ' + P.v + '.</p>');
          return;
        }
        if (x) {
          const r1 = x.reste * 0.105;
          out.insertAdjacentHTML('beforeend', '<p>💶 Péage ≈ <b>classe 1 : ' + euro(x.c1 + r1) + '</b> · <b>classe 2 : ' + euro(x.c2 + r1 * 1.55) + '</b></p><p class="doux">Exact jusqu’à ' + x.s + ' (' + euro(x.c1) + ' / ' + euro(x.c2) + ', tarifs officiels ' + P.v + '), plus environ ' + Math.round(x.reste) + ' km de péage d’un autre réseau estimés.</p>');
          return;
        }
      } catch (_) { /* repli sur l’estimation */ }
      const c1 = km * 0.105, c2 = c1 * 1.55;
      out.insertAdjacentHTML('beforeend', '<p>💶 Péage estimé (≈ ' + Math.round(km) + ' km à péage) : <b>classe 1 ≈ ' + euro(c1) + '</b> · <b>classe 2 ≈ ' + euro(c2) + '</b></p><p class="doux">Estimation d’après les grilles officielles 2026 (marge environ 15 %). Le prix exact dépend des gares d’entrée et de sortie.</p>');
    } catch (_) { /* estimation facultative */ }
  };
  const render = (target, r, mode) => {
    const prix = mode === 'DRIVE' ? r.toll : r.fare;
    const libelle = mode === 'DRIVE' ? 'Péage' : 'Transport';
    const p = prix.status === 'estimation' ? '≈ ' + euro(prix.amount) : prix.status === 'aucun_peage' ? 'aucun' : (prix.status === 'prix_inconnu' && mode === 'DRIVE') ? 'oui' : 'non disponible';
    target.innerHTML = '<p>🛣 <b>' + (r.distanceKm ?? '—') + ' km</b> · ⏱️ <b>' + hm(r.durationMinutes) + '</b></p><p>💶 ' + libelle + ' : <b>' + p + '</b></p>' + (r.sansPeage ? '<p>🛣 Sans péage : <b>' + (r.sansPeage.distanceKm ?? '—') + ' km</b> · ⏱️ <b>' + hm(r.sansPeage.durationMinutes) + '</b></p>' : '') + '<p class="doux">Données Google Routes : estimation, à vérifier avant départ.</p>';
    if (mode === 'DRIVE' && r.polyline) { try { target.insertAdjacentHTML('beforeend', carte(r) + (target.dataset.villes ? '<p class="doux" style="margin:6px 0">' + target.dataset.villes + '</p>' : '')); } catch (_) { /* carte facultative */ } estimerPeage(r, target); }
  };
  const addBox = (host, id, origin, destination, departureTime, villes) => {
    if (!host || document.getElementById(id) || !origin || !destination) return;
    const box = document.createElement('div');
    box.id = id; box.className = 'carte';
    box.innerHTML = '<b>🧭 Trajet réel Google</b><p class="doux">Distance routière, durée et péage estimé.</p><button type="button" data-rmode="voiture">🚗 Voiture et péages</button> <button type="button" class="second" data-rmode="transport">🚌 Transports</button><div class="doux" data-routes-result style="margin-top:8px"></div>' + liens(origin, destination);
    host.appendChild(box);
    if (villes) box.querySelector('[data-routes-result]').dataset.villes = villes;
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
    // V177 : dans la fenêtre du trajet, on ne garde que l’encart Google ; sous la carte : point vert (départ) et point rouge (arrivée).
    if (!document.getElementById('routesGoogleStyle')) { const st = document.createElement('style'); st.id = 'routesGoogleStyle'; st.textContent = '.popVolBoite.soloGoogle>*:not(#popVolX):not(#routesGoogleEstimate){display:none!important}'; document.head.appendChild(st); }
    const e2 = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    addBox(contenu, 'routesGoogleEstimate', match[1].trim(), match[2].trim(), undefined, '🟢 ' + e2(match[1].trim()) + ' → 🔴 ' + e2(match[2].trim()));
    contenu.classList.add('soloGoogle');
  };
  const refresh = () => { addMissionPanel(); addEstimatePanel(); };
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
