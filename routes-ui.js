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
  const liens = (o, d) => '<div class="bk bkC bkTr bkIt"><div class="bkt">OUVRIR CE TRAJET DANS</div><div class="liensTr"><a href="https://www.google.com/maps/dir/?api=1&origin=' + lieu(o) + '&destination=' + lieu(d) + '&travelmode=driving&dir_action=navigate" target="_blank" rel="noopener">🗺️ Google Maps</a><a href="https://waze.com/ul?' + (typeof d === 'string' ? 'q=' + encodeURIComponent(d) : 'll=' + d.lat + ',' + d.lng) + '&navigate=yes" target="_blank" rel="noopener">🚙 Waze</a><a href="https://www.viamichelin.fr/web/Itineraires?departure=' + lieu(o) + '&arrival=' + lieu(d) + '" target="_blank" rel="noopener">🧭 ViaMichelin</a><a href="https://fr.mappy.com/itineraire" target="_blank" rel="noopener">📍 Mappy</a><a class="rm" href="https://www.roole.fr/application-roole-map" target="_blank" rel="noopener">🛣️ Roole Map</a></div></div>';
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
  // V233 : péages « barrière » (sans gare d'entrée/sortie : ponts, tunnels, barrières pleine voie) — tarifs officiels versionnés, jamais d'estimation.
  let OVERLAY = null;
  const chargerOverlay = async () => {
    if (OVERLAY !== null) return OVERLAY;
    try {
      if (!window.CPPeage) await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'peage-engine.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
      const j = await fetch('peages-overlay.json').then(r => r.json());
      const versions = j.tarifs.map(t => ({ id: t.id, barrier_station_id: t.b || null, vehicle_class: t.c, amount_eur: t.a, status: t.s, effective_from: t.f, effective_to: t.t || null, tariff_context: t.k || null, source_url: t.u == null ? null : j.u[t.u] }));
      OVERLAY = { m: window.CPPeage.creerMoteur({ versions }), b: j.barrieres, v: j.v };
    } catch (_) { OVERLAY = false; }
    return OVERLAY;
  };
  // Barrières franchies le long du tracé ; une barrière vue sur des points voisins (deux sens) ne compte qu'une fois.
  const barrieresTraversees = (O, sh, i0, i1) => {
    const vus = []; let der = null, dernierK = -999;
    for (let k = i0; k <= i1; k++) {
      if (!sh[k]) continue;
      for (const b of O.b) {
        if (b.points.some(p => dist(sh[k][0], sh[k][1], p[0], p[1]) < 0.3)) { if (b.id !== der || k - dernierK > 50) vus.push({ id: b.id, k }); der = b.id; dernierK = k; break; }
      }
    }
    return vus;
  };
  const garesTraversees = (P, sh, i0, i1) => { let n = 0, der = -2; for (let k = i0; k <= i1; k++) { if (!sh[k]) continue; const g = gareProche(P, sh[k][0], sh[k][1], 0.4); if (g >= 0 && g !== der) { n++; der = g; } } return n; };
  const BK = (cls, titre, h) => '<div class="bk bkC ' + cls + '"><div class="bkt">' + titre + '</div>' + h + '</div>';
  const valRoute = async (body) => { let err = null; for (let n = 0; n < 4; n++) { try { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000); const rr = await fetch('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }); clearTimeout(to); if (rr.ok) return await rr.json(); err = new Error('http ' + rr.status); } catch (e) { err = e; } await new Promise(s => setTimeout(s, 1500 * (n + 1))); } throw err; };
  const estimerPeage = async (r, out) => {
    const zone = out.querySelector('[data-peage]');
    const put = (h, ok) => { if (!zone) return; zone.innerHTML = h; const b = zone.closest('.bk'); if (b) b.classList.add(ok ? 'bkRenOk' : 'bkRenKo'); };
    const KO = '💶 <b>Prix exact non disponible</b> pour ce trajet.<div class="rd sub"><span>Aucune estimation affichée : seuls les tarifs officiels exacts sont montrés.</span></div>';
    try {
      const A = decode(r.polyline);
      if (A.length < 2) { put(KO, false); return; }
      const a = A[0], b = A[A.length - 1];
      const j = await valRoute({ locations: [{ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] }], costing: 'auto', costing_options: { auto: { use_tolls: 1.0 } }, directions_options: { language: 'fr-FR', units: 'kilometers' } });
      const leg = j && j.trip && j.trip.legs && j.trip.legs[0];
      if (!leg) { put(KO, false); return; }
      const tms = (leg.maneuvers || []).filter(m => m.toll);
      let km = 0;
      for (const m of tms) km += Number(m.length) || 0;
      if (km < 1) { put('💶 <b>Aucun péage</b> sur ce trajet.', true); return; }
      try {
        const P = await chargerPeages();
        const sh = dec6(leg.shape);
        const x = prixExact(P, sh, tms, km);
        const O = await chargerOverlay();
        const i0 = tms[0].begin_shape_index, i1 = tms[tms.length - 1].end_shape_index;
        const bar = O ? barrieresTraversees(O, sh, i0, i1) : [];
        if (bar.length) {
          const auj = new Date().toISOString().slice(0, 10), pas = bar.map((v, n) => ({ type: 'barriere', station: v.id, group: v.id, passage: n }));
          const t1 = O.m.trajet(pas, 1, auj), t2 = O.m.trajet(pas, 2, auj);
          const noms = bar.map(v => joli(v.id.replace(/-/g, ' '))).join(', ');
          const legOk = !!(x && x.reste < 3);
          if (t1.complet && t2.complet && (legOk || garesTraversees(P, sh, i0, i1) === 0)) {
            const r2 = n => Math.round(n * 100) / 100;
            const c1 = r2((legOk ? x.c1 : 0) + t1.total), c2 = r2((legOk ? x.c2 : 0) + t2.total);
            const croise = t1.status !== 'PROUVE' || t2.status !== 'PROUVE';
            put('<div class="rd gros ok gras"><span>Classe 1</span><b>' + euro(c1) + '</b></div><div class="rd"><span>Classe 2</span><b>' + euro(c2) + '</b></div><div class="rd sub"><span>' + (legOk ? x.e + ' → ' + x.s + ' + ' : '') + 'barrière(s) : ' + noms + '</span></div><div class="rd sub"><span>Source : tarifs officiels 2026' + (croise ? ' (relecture en cours, à vérifier)' : '') + '</span></div>', true);
            return;
          }
          put('💶 <b>Prix exact non disponible</b> pour ce trajet.<div class="rd sub"><span>Barrière(s) détectée(s) : ' + noms + '. Un tarif officiel manque : aucun total n’est affiché.</span></div>', false);
          return;
        }
        if (x && x.reste < 3) {
          put('<div class="rd gros ok gras"><span>Classe 1</span><b>' + euro(x.c1) + '</b></div><div class="rd"><span>Classe 2</span><b>' + euro(x.c2) + '</b></div><div class="rd sub"><span>' + x.e + ' → ' + x.s + '</span></div><div class="rd sub"><span>Source (tarifs officiels, dates de mise à jour) : ' + P.v + '</span></div>', true);
          return;
        }

      } catch (_) { /* repli sur l’estimation */ }
      put(KO, false);
    } catch (_) { put('⚠️ <b>Calcul du péage impossible pour l’instant</b> : le serveur de tracé ne répond pas.<div class="rd sub"><span>Ce n’est pas un prix inconnu. Vérifie ta connexion (wifi/4G) puis appuie de nouveau sur « Voiture et péages ».</span></div>', false); }
  };
  const render = (target, r, mode) => {
    const prix = mode === 'DRIVE' ? r.toll : r.fare;
    const libelle = mode === 'DRIVE' ? 'Péage' : 'Transport';
    const p = prix.status === 'aucun_peage' ? 'aucun' : (mode === 'DRIVE' && (prix.status === 'prix_inconnu' || prix.status === 'estimation')) ? 'oui (prix exact ci-dessous si disponible)' : 'non disponible';
    const kmH = '🛣 <b>' + (r.distanceKm ?? '—') + ' km</b>' + '<br>⏱️ <b>' + hm(r.durationMinutes) + '</b>';
    const info = mode === 'DRIVE'
      ? BK('bkKm', 'TRAJET LE PLUS RAPIDE', kmH) + BK('bkRen', 'AVEC PÉAGE', '<div data-peage>' + (prix.status === 'aucun_peage' ? '💶 <b>Aucun péage</b> sur ce trajet.' : '💶 Calcul du prix exact…') + '</div>') + (r.sansPeage ? BK('bkVeh', 'SANS PÉAGE', '🛣 <b>' + (r.sansPeage.distanceKm ?? '—') + ' km</b><br>⏱️ <b>' + hm(r.sansPeage.durationMinutes) + '</b>') : '') + '<p class="doux" style="font-size:.8rem">Distance et durée : Google Routes, à vérifier avant départ.</p>'
      : '<p class="doux" style="font-size:.75rem;margin:6px 0 2px">Calculé par Google Routes en mode transports en commun.</p>' + BK('bkKm', 'TRANSPORTS EN COMMUN', kmH) + BK('bkRen', 'PRIX', '🎟️ Le prix sera détaillé quand le calcul des prix SNCF et des autres transports sera activé.') + '<p class="doux" style="font-size:.8rem">Horaires et prix à vérifier sur le site du transporteur (liens ci-dessous).</p>';
    target.innerHTML = info;   // V186 : la carte et les villes passent avant les lignes d’infos
    if (mode === 'DRIVE' && r.polyline) { try { target.innerHTML = carte(r) + (target.dataset.villes ? BK('bkLieu', 'ITINÉRAIRE', target.dataset.villes) : '') + info; } catch (_) { target.innerHTML = info; } estimerPeage(r, target); }
  };
  const addBox = (host, id, origin, destination, departureTime, villes, tr) => {
    if (!host || document.getElementById(id) || !origin || !destination) return;
    const box = document.createElement('div');
    box.id = id; box.className = 'carte';
    box.innerHTML = '<b>🧭 Trajet réel Google</b><p class="doux">Distance routière, durée et péage exact.</p><button type="button" data-rmode="voiture">🚗 Voiture et péages</button> <button type="button" class="second" data-rmode="transport">🚌 Transports</button><div class="doux" data-routes-result style="margin-top:8px"></div>' + liens(origin, destination) + '<div class="bk bkC bkTr bkTn" style="display:none"><div class="bkt">TRANSPORTS EN COMMUN · SITES</div><div class="tnZone"></div></div>';
    host.appendChild(box);
    if (villes) box.querySelector('[data-routes-result]').dataset.villes = villes;
    box.querySelectorAll('button[data-rmode]').forEach(b => b.onclick = async () => {
      const out = box.querySelector('[data-routes-result]'), mode = b.dataset.rmode;
      const s = session(), c = config(); out.textContent = 'Calcul Google en cours…'; const tn = mode === 'transport'; box.querySelectorAll('.bkIt').forEach(a => { a.style.display = tn ? 'none' : ''; }); box.querySelectorAll('.bkTn').forEach(a => { a.style.display = tn ? '' : 'none'; }); if (tn) { const z = box.querySelector('.tnZone'); try { z.innerHTML = window.CPLiensTr && tr ? window.CPLiensTr(tr[0], tr[1], tr[2], tr[3]) : ''; } catch (_) { z.innerHTML = ''; } if (!z.innerHTML) z.innerHTML = '<span class="doux">Sites de transport indisponibles pour ce trajet.</span>'; }
      try {
        const r = await window.CPRoutes.estimate({ endpoint, accessToken: s?.access_token, refreshToken: s?.refresh_token, expiresAt: s?.expires_at, email: s?.email, userId: s?.user_id, supabaseUrl: c?.url, supabaseApiKey: c?.anonKey, origin, destination, mode, departureTime });
        render(out, r, mode === 'voiture' ? 'DRIVE' : 'TRANSIT');
      } catch (e) { out.textContent = /failed to fetch|networkerror|load failed|aborted/i.test(String(e.message || e)) ? 'Connexion au serveur de trajets impossible. Vérifie ta connexion (wifi ou 4G), puis réessaie.' : String(e.message || e); }
    });
  };
  const addMissionPanel = () => {
    const host = document.getElementById('feuilleContenu'), m = missionActive();
    if (!host || !m) return;
    addBox(host, 'routesGoogleMission', point(m, 'origin'), point(m, 'destination'), m.pickup_start || undefined, undefined, [m.from_city, m.from_department, m.to_city, m.to_department]);
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
    addBox(contenu, 'routesGoogleEstimate', match[1].trim(), match[2].trim(), undefined, '🟢 ' + e2(match[1].trim()) + ' → 🔴 ' + e2(match[2].trim()), [match[1].trim(), '', match[2].trim(), '']);
    contenu.classList.add('soloGoogle');
  };
  const refresh = () => { addMissionPanel(); addEstimatePanel(); };
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
