// Convoyage Ultra — panneau des données Routes API dans les fiches et l’estimation.
(function () {
  'use strict';
  // V254 : mesure des blocages sur le téléphone (affichée en bas de la fenêtre du trajet) : chaque arrêt de l'écran de plus de 0,3 s est noté avec l'étape en cours.
  const GAPS = []; let dernier = performance.now();
  window.CPPh = x => { window.__ph = x; };
  const TPS = []; window.CPT = (n, t0) => { TPS.push(n + ' ' + Math.round(performance.now() - t0) + ' ms'); if (TPS.length > 8) TPS.shift(); };
  const LAY = n => { const t0 = performance.now(); void document.body.offsetHeight; window.CPT('mise en page ' + n, t0); };   // V257 : coût d'un recalcul de mise en page sur ce téléphone
  const EST = new Map();   // V256 : un seul appel Google par trajet, même si la fenêtre est redessinée pendant l'attente
  setInterval(() => { const n = performance.now(), g = n - dernier - 250; dernier = n; if (g > 300) { GAPS.push(Math.round(g) + ' ms · ' + (window.__ph || '?')); if (GAPS.length > 12) GAPS.shift(); } }, 250);
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
  // V253 : le tracé est réduit à ≈500 points avant tout calcul de carte (un téléphone lent se figeait sur des dizaines de milliers de points).
  const mg = L => { const p = Math.ceil(L.length / 500); return p > 1 ? L.filter((_, i) => i % p === 0 || i === L.length - 1) : L; };
  const carte = r => {
    window.CPPh('carte');
    const W = 480, H = 540, A = mg(decode(r.polyline));
    if (A.length < 2) return '';
    const B = r.sansPeage && r.sansPeage.polyline && r.sansPeage.polyline !== r.polyline ? mg(decode(r.sansPeage.polyline)) : null;
    const C = r.mixte && r.mixte.pts && r.mixte.pts.length > 1 ? mg(r.mixte.pts) : null;
    const pts = A.concat(B || []).concat(C || []);
    const px = (q, z) => { const n = 256 * 2 ** z, s = Math.sin(q[1] * Math.PI / 180); return [(q[0] + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
    let z = 14;
    for (; z > 2; z--) { const P = pts.map(q => px(q, z)), xs = P.map(q => q[0]), ys = P.map(q => q[1]); if (Math.max(...xs) - Math.min(...xs) <= W * 0.88 && Math.max(...ys) - Math.min(...ys) <= H * 0.88) break; }
    const P = pts.map(q => px(q, z)), xs = P.map(q => q[0]), ys = P.map(q => q[1]);
    const ox = (Math.min(...xs) + Math.max(...xs)) / 2 - W / 2, oy = (Math.min(...ys) + Math.max(...ys)) / 2 - H / 2, N = 2 ** z;
    let tuiles = '';
    for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++) for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++) if (ty >= 0 && ty < N) tuiles += '<img alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer" src="https://tile.openstreetmap.org/' + z + '/' + (((tx % N) + N) % N) + '/' + ty + '.png" style="position:absolute;left:' + ((tx * 256 - ox) / W * 100) + '%;top:' + ((ty * 256 - oy) / H * 100) + '%;width:' + (256 / W * 100) + '%;height:' + (256 / H * 100) + '%">';
    const pos = q => { const p = px(q, z); return [p[0] - ox, p[1] - oy]; };
    const d = L => L.map(q => pos(q).map(v => v.toFixed(1)).join(',')).join(' ');
    const a = pos(A[0]), b = pos(A[A.length - 1]);
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%">' + (B ? '<polyline points="' + d(B) + '" fill="none" stroke="#1a9850" stroke-width="4" stroke-dasharray="9 6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' : '') + '<polyline points="' + d(A) + '" fill="none" stroke="#1e63d8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' + (C ? '<polyline points="' + d(C) + '" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' : '') + '<circle cx="' + a[0].toFixed(1) + '" cy="' + a[1].toFixed(1) + '" r="7" fill="#1a9850" stroke="#fff" stroke-width="2"/><circle cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="7" fill="#d93025" stroke="#fff" stroke-width="2"/></svg>';
    return '<div style="position:relative;width:100%;aspect-ratio:480/540;overflow:hidden;border-radius:8px;margin-top:8px;background:#ddd">' + tuiles + svg + '<span style="position:absolute;right:2px;bottom:2px;font-size:10px;background:rgba(255,255,255,.8);color:#333;padding:0 4px;border-radius:3px">© OpenStreetMap</span></div><p class="doux">' + (B ? 'Bleu : avec péages · Vert pointillé : sans péage.' : 'Bleu : trajet Google (identique avec ou sans péage).') + (C ? ' Orange : trajet mixte.' : '') + '</p>';
  };
  const dec6 = s => { const o = []; let i = 0, la = 0, lo = 0; while (i < s.length) { let b, sh = 0, rs = 0; do { b = s.charCodeAt(i++) - 63; rs |= (b & 31) << sh; sh += 5; } while (b >= 32); la += (rs & 1) ? ~(rs >> 1) : (rs >> 1); sh = 0; rs = 0; do { b = s.charCodeAt(i++) - 63; rs |= (b & 31) << sh; sh += 5; } while (b >= 32); lo += (rs & 1) ? ~(rs >> 1) : (rs >> 1); o.push([la / 1e6, lo / 1e6]); } return o; };
  const dist = (a, b, c, d) => { const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t, h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const joli = s => String(s).toLowerCase().replace(/(^|[\s\-\/'])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());
  let PEAGES = null;
  const chargerPeages = async () => {
    if (PEAGES) return PEAGES;
    const j = await fetch('peages-aprr.json').then(r => r.json());
    const prix = new Map();
    // V249 : lecture des 17 000 tarifs par petits paquets (le téléphone reste fluide, l'écran ne se fige plus).
    const lignes = j.p.split(';');
    for (let i = 0; i < lignes.length; i++) { const [a, b, c1, c2, d] = lignes[i].split(','); const x = parseInt(a, 36), y = parseInt(b, 36); prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10, Number(d)]); if (i % 3000 === 2999) await new Promise(ok => setTimeout(ok, 0)); }
    // V248 : position corrigée de la barrière « St Martin Bellevue A41 N » : la grille officielle (31 km depuis Annecy Centre) la place à la jonction A41/A40 de Saint-Julien, pas à Allonzier.
    const CORR = { 'ST MARTIN BELLEVUE A41 N': [[46.1293, 6.0978], [46.1318, 6.1]] };
    j.g.forEach(g => { if (CORR[g[0]]) g[1] = CORR[g[0]]; });
    PEAGES = { g: j.g, prix, v: j.v };
    // V233 : stations et liaisons ajoutées (grilles officielles relues) — on ajoute seulement, on ne modifie jamais les 16 918 tarifs d'origine.
    try {
      const o = await fetch('peages-overlay.json').then(r => r.json());
      for (const n of (o.gares || [])) { if (!PEAGES.g.some(g => g[0] === n.nom)) PEAGES.g.push([n.nom, n.points]); }
      const ix = nom => PEAGES.g.findIndex(g => g[0] === nom);
      for (const q of (o.paires || [])) { const x = ix(q[0]), y = ix(q[1]); const k = Math.min(x, y) * 1000 + Math.max(x, y); if (x >= 0 && y >= 0 && !prix.has(k)) prix.set(k, [q[2], q[3], q[4]]); }
    } catch (_) { /* sans ajouts : tarifs d'origine seuls */ }
    return PEAGES;
  };
  const gareProche = (P, lat, lon, max) => {
    if (!P.gi) { const gi = new Map(); P.g.forEach((g, i) => g[1].forEach(p => { const c = Math.floor(p[0] / 0.02) + ',' + Math.floor(p[1] / 0.02); let L = gi.get(c); if (!L) gi.set(c, L = []); L.push([i, p[0], p[1]]); })); P.gi = gi; }   // V255 : index par carreaux de 2 km (avant : toutes les gares testées pour chaque point du tracé = écran figé sur téléphone)
    let bi = -1, bd = max; const dl = max / 111, dn = max / (111 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    for (let a = Math.floor((lat - dl) / 0.02); a <= Math.floor((lat + dl) / 0.02); a++) for (let b = Math.floor((lon - dn) / 0.02); b <= Math.floor((lon + dn) / 0.02); b++) { const L = P.gi.get(a + ',' + b); if (!L) continue; for (const q of L) { if (Math.abs(q[1] - lat) > dl || Math.abs(q[2] - lon) > dn) continue; const d = dist(lat, lon, q[1], q[2]); if (d < bd || (d === bd && bi >= 0 && q[0] < bi)) { bd = d; bi = q[0]; } } }
    return bi;
  };
  const prixExact = (P, sh, tms, km) => {
    const f = tms[0], l = tms[tms.length - 1];
    const i0 = f.begin_shape_index, i1 = l.end_shape_index;
    if (!sh[i0] || !sh[i1]) return null;
    const hits = [];
    let der = -2;
    for (let k = i0; k <= i1; k++) { const g = gareProche(P, sh[k][0], sh[k][1], 0.4); if (g >= 0 && g !== der) { hits.push({ g, k }); der = g; } }
    // V259 : barrières « système ouvert » à tarif fixe (grilles officielles APRR/AREA, ligne « Système Ouvert ») : sans gare de couple, on ajoute simplement leur tarif.
    const OUV = { 'CROTTET': [0.8, 1.2], 'FONTAINE-LARIVIERE': [3.1, 4.9], 'GENAY': [1.7, 2.5], 'LUSSE': [6.8, 10.7], 'MIONNAY': [1, 1.5], 'MYENNES': [4.2, 6], 'QUINCIEUX': [3.6, 5.6], 'VICHY': [1.2, 1.9] };
    const ouv = [];
    for (let q = hits.length - 1; q >= 0; q--) { if (OUV[P.g[hits[q].g][0]]) { if (!ouv.some(o => o.g === hits[q].g)) ouv.unshift(hits[q]); hits.splice(q, 1); } }
    if (!hits.length && !ouv.length) return null;
    const cum = new Float64Array(sh.length); for (let k = 1; k < sh.length; k++) cum[k] = cum[k - 1] + dist(sh[k - 1][0], sh[k - 1][1], sh[k][0], sh[k][1]);
    const lon = (a, b) => cum[b] - cum[a];   // V247 : distances cumulées (le téléphone ne se fige plus)
    // V254 : A410 (AREA) : la barrière « St Martin Bellevue A410 » facture depuis la jonction A40 (tronçon gratuit jusqu'à La Roche-sur-Foron compris, 37 km au tarif) : la distance se mesure depuis le début/jusqu'à la fin du tronçon à péage ; la gare de Cruseilles, avant la barrière, n'est qu'une bretelle.
    const ENT = 'ST MARTIN BELLEVUE A410';
    const eN = hits.findIndex(q => P.g[q.g][0] === ENT);
    if (eN > 0 && hits.slice(0, eN).every(q => P.g[q.g][0] === 'CRUSEILLES A')) hits.splice(0, eN);
    hits.forEach(q => { if (P.g[q.g][0] === ENT) q.ent = true; });
    // V246 : gares « jumelles » (mêmes coordonnées, ex. Dourdan / La Folie-B) : on essaie la plus proche d'abord, puis ses jumelles.
    const jc = new Map();
    const jum = g => { if (jc.has(g)) return jc.get(g); const r = [g]; jc.set(g, r); P.g.forEach((o, i) => { if (i !== g && o[1].some(p => P.g[g][1].some(q => dist(p[0], p[1], q[0], q[1]) < 0.06))) r.push(i); }); return r; };
    // V245 : un trajet peut traverser plusieurs mailles tarifaires séparées (ex. A41 Annecy→Chambéry puis Chignin→Crolles) : on additionne les tronçons officiels.
    const paire = (x, y) => { const d = x.ent ? lon(i0, y.k) : y.ent ? lon(x.k, i1) : lon(x.k, y.k); for (const a of jum(x.g)) for (const b of jum(y.g)) { if (a === b) continue; const v = P.prix.get(Math.min(a, b) * 1000 + Math.max(a, b)); if (!v) continue; const q = v[2] / Math.max(1, d); if (q >= 0.7 && q <= 1.9) return { v, a, b }; } return null; };
    const segs = [];
    let i = 0;
    while (i < hits.length) {
      let ok = null;
      for (let h = hits.length - 1; h > i && !ok; h--) { const p = paire(hits[i], hits[h]); if (p) ok = { h, p }; }
      if (!ok) {
        // gare isolée sans tarif : tolérée uniquement après le dernier tronçon tarifé, jamais au milieu du trajet
        if (!segs.length) return null;
        for (let a = i; a < hits.length; a++) for (let c = a + 1; c < hits.length; c++) if (paire(hits[a], hits[c])) return null;
        break;
      }
      segs.push(ok); i = ok.h + 1;
    }
    if (!segs.length && !ouv.length) return null;
    const r2 = n => Math.round(n * 100) / 100;
    // V246 : Valhalla marque « péage » des tronçons gratuits (rocades, entrées de ville) : le reste après la dernière gare n'est plus refusé ; il contient forcément 0 gare.
    // Seules les gares dont la position est douteuse (voir audit) bloquent le prix.
    const SUSPECTES = ['CRUSEILLES A'];
    const dout = segs.some(q => SUSPECTES.includes(P.g[q.p.a][0]) || SUSPECTES.includes(P.g[q.p.b][0]));
    const nO = ouv.map(o => P.g[o.g][0]);
    const detS = segs.map(q => joli(P.g[q.p.a][0]) + ' → ' + joli(P.g[q.p.b][0])).concat(nO.map(n => 'barrière ' + joli(n)));
    return { e: segs.length ? joli(P.g[segs[0].p.a][0]) : joli(nO[0]), s: segs.length ? joli(P.g[segs[segs.length - 1].p.b][0]) : joli(nO[nO.length - 1]), c1: r2(segs.reduce((n, q) => n + q.p.v[0], 0) + nO.reduce((n, x) => n + OUV[x][0], 0)), c2: r2(segs.reduce((n, q) => n + q.p.v[1], 0) + nO.reduce((n, x) => n + OUV[x][1], 0)), det: detS.join(' + '), reste: dout ? 99 : 0 };
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
        if (b.points.some(p => Math.abs(sh[k][0] - p[0]) < 0.01 && Math.abs(sh[k][1] - p[1]) < 0.015 && dist(sh[k][0], sh[k][1], p[0], p[1]) < 0.3)) { if (b.id !== der || k - dernierK > 50) vus.push({ id: b.id, k }); der = b.id; dernierK = k; break; }
      }
    }
    return vus;
  };
  const garesTraversees = (P, sh, i0, i1) => { let n = 0, der = -2; for (let k = i0; k <= i1; k++) { if (!sh[k]) continue; const g = gareProche(P, sh[k][0], sh[k][1], 0.4); if (g >= 0 && g !== der) { n++; der = g; } } return n; };
  // V239 (demande de Laurent à l'époque) : estimation « ≈ » sur les gares officielles les plus proches quand le
  // prix exact manquait. V244 : retiré à la demande de Laurent — avec la grille nationale désormais vérifiée à
  // 100 % (18 826 + 16 918 relations, 0 gap), il ne doit plus jamais s'afficher de prix approché : exact ou rien.
  // V249 : Suisse = autoroutes gratuites AVEC vignette annuelle obligatoire (40 CHF) : message d'avertissement (jamais ajouté au total des péages).
  const CH = [[5.96,46.13],[6.05,46.25],[6.25,46.33],[6.55,46.45],[6.80,46.40],[6.85,46.15],[6.97,46.03],[7.05,45.92],[7.17,45.87],[7.45,45.92],[7.66,45.98],[7.87,45.94],[8.12,46.10],[8.45,46.25],[8.8,46.05],[8.85,45.97],[9.02,45.83],[9.15,45.9],[9.1,46.18],[9.28,46.5],[9.6,46.3],[10.05,46.2],[10.45,46.52],[10.45,46.87],[10.2,46.87],[9.88,47.0],[9.5,47.06],[9.53,47.27],[9.65,47.5],[9.4,47.65],[8.9,47.68],[8.55,47.8],[8.4,47.6],[7.9,47.57],[7.6,47.6],[7.5,47.5],[7.0,47.5],[6.9,47.3],[6.7,47.1],[6.4,46.8],[6.35,46.7],[6.15,46.45],[6.1,46.3]];
  const dansCH = (lat, lon) => { let in_ = false; for (let i = 0, j = CH.length - 1; i < CH.length; j = i++) { const [xi, yi] = CH[i], [xj, yj] = CH[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) in_ = !in_; } return in_; };
  const passeEnSuisse = sh => { let n = 0; for (let k = 0; k < sh.length; k += 4) { if (dansCH(sh[k][0], sh[k][1])) { if (++n >= 3) return true; } else n = 0; } return false; };
  const NOTE_CH = '<div class="rd sub"><span>🇨🇭 Ce trajet passe en Suisse : <b>vignette autoroutière suisse obligatoire</b> (40 CHF, valable un an, à avoir avant la frontière ; amende de 200 CHF sans vignette). Elle n’est pas comprise dans le total des péages.</span></div>';
  const BK = (cls, titre, h) => '<div class="bk bkC ' + cls + '"><div class="bkt">' + titre + '</div>' + h + '</div>';
  const valRoute = async (body) => { let err = null; for (let n = 0; n < 4; n++) { try { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000); const rr = await fetch('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }); clearTimeout(to); if (rr.ok) return await rr.json(); err = new Error('http ' + rr.status); } catch (e) { err = e; } await new Promise(s => setTimeout(s, 1500 * (n + 1))); } throw err; };
  // V250 : tout le calcul du péage se fait dans un « worker » (second fil du téléphone) : l'écran ne peut plus se figer, même sur un téléphone lent.
  let WK = null, WKID = 0; const WKATT = new Map();
  const CODE_WORKER = () => 'const dist=' + dist + ';const joli=' + joli + ';const gareProche=' + gareProche + ';const prixExact=' + prixExact + ';const garesTraversees=' + garesTraversees + ';' +
    'let P=null;const charger=async base=>{const j=await (await fetch(base+"peages-aprr.json")).json();const prix=new Map();for(const s of j.p.split(";")){const [a,b,c1,c2,d]=s.split(",");const x=parseInt(a,36),y=parseInt(b,36);prix.set(Math.min(x,y)*1000+Math.max(x,y),[c1/10,c2/10,Number(d)]);}' +
    'const CORR={"ST MARTIN BELLEVUE A41 N":[[46.1293,6.0978],[46.1318,6.1]]};j.g.forEach(g=>{if(CORR[g[0]])g[1]=CORR[g[0]];});const Q={g:j.g,prix,v:j.v};' +
    'try{const o=await (await fetch(base+"peages-overlay.json")).json();for(const n of (o.gares||[])){if(!Q.g.some(g=>g[0]===n.nom))Q.g.push([n.nom,n.points]);}const ix=nom=>Q.g.findIndex(g=>g[0]===nom);for(const q of (o.paires||[])){const x=ix(q[0]),y=ix(q[1]);const k=Math.min(x,y)*1000+Math.max(x,y);if(x>=0&&y>=0&&!prix.has(k))prix.set(k,[q[2],q[3],q[4]]);}}catch(_){}return Q;};' +
    'onmessage=async e=>{const m=e.data;try{if(!P)P=await charger(m.base);const x=prixExact(P,m.sh,m.tms,0);const n=garesTraversees(P,m.sh,m.i0,m.i1);const h=[];if(m.hits){let der=-2;for(let k=m.i0;k<=m.i1;k++){const g=gareProche(P,m.sh[k][0],m.sh[k][1],0.4);if(g>=0&&g!==der){h.push([m.sh[k][0],m.sh[k][1],P.g[g][0]]);der=g;}}}postMessage({id:m.id,x,n,v:P.v,h});}catch(err){postMessage({id:m.id,err:String(err)});}};';
  const calculPeage = async (sh, tms, km, hits) => {
    const i0 = tms[0].begin_shape_index, i1 = tms[tms.length - 1].end_shape_index;
    try {
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined') throw new Error('pas de worker');
      if (!WK) { WK = new Worker(URL.createObjectURL(new Blob([CODE_WORKER()], { type: 'text/javascript' }))); WK.onmessage = e => { const f = WKATT.get(e.data.id); if (f) { WKATT.delete(e.data.id); e.data.err ? f.ko(new Error(e.data.err)) : f.ok(e.data); } }; WK.onerror = () => { const l = [...WKATT.values()]; WKATT.clear(); WK = null; l.forEach(f => f.ko(new Error('worker'))); }; }
      return await new Promise((ok, ko) => { const id = ++WKID; WKATT.set(id, { ok, ko }); setTimeout(() => { if (WKATT.has(id)) { WKATT.delete(id); ko(new Error('délai')); } }, 40000); WK.postMessage({ id, hits: !!hits, base: new URL('.', location.href).href, sh, tms: [{ begin_shape_index: tms[0].begin_shape_index, end_shape_index: tms[0].end_shape_index }, { begin_shape_index: tms[tms.length - 1].begin_shape_index, end_shape_index: tms[tms.length - 1].end_shape_index }], i0, i1 }); });
    } catch (_) {
      const P = await chargerPeages();   // secours : calcul direct (ancienne méthode)
      return { x: prixExact(P, sh, tms, km), n: garesTraversees(P, sh, i0, i1), v: P.v };
    }
  };
  const estimerPeage = async (r, out) => {
    window.CPPh('péage');
    const zone = out.querySelector('[data-peage]');
    let suisse = false;
    const put = (h, ok) => { if (!zone) return; zone.innerHTML = h + (suisse ? NOTE_CH : ''); LAY('péage'); const b = zone.closest('.bk'); if (b) b.classList.add(ok ? 'bkRenOk' : 'bkRenKo'); };
    const KO = '💶 <b>Prix exact non disponible</b> pour ce trajet.<div class="rd sub"><span>Aucune estimation affichée : seuls les tarifs officiels exacts sont montrés.</span></div>';
    try {
      const A = r.pts || decode(r.polyline);
      if (A.length < 2) { put(KO, false); return; }
      const a = A[0], b = A[A.length - 1];
      const tV = performance.now();
      // V258 : le tracé « avec péages » déjà demandé par la fenêtre du trajet est réutilisé (au lieu d'un 2e appel de 4 à 9 s sur un téléphone en 4G).
      let j = null;
      const att = p => Promise.race([p, new Promise(ok => setTimeout(() => ok(null), 8000))]);   // V261 : le serveur de tracé gratuit peut mettre 20 s ou tomber : on n'attend plus que 8 s
      try { const ck = [a[1], a[0], b[1], b[0]].map(n => Number(n).toFixed(3)).join('|'), pp = window.CPValP && window.CPValP[ck]; if (pp) j = await att(pp); } catch (_) { j = null; }
      if (!(j && j.trip && j.trip.legs && j.trip.legs[0] && j.trip.legs[0].maneuvers)) j = await att(valRoute({ locations: [{ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] }], costing: 'auto', costing_options: { auto: { use_tolls: 1.0 } }, directions_options: { language: 'fr-FR', units: 'kilometers' } }));
      window.CPT('tracé péage', tV);
      const leg = j && j.trip && j.trip.legs && j.trip.legs[0];
      // V261 : si le serveur de tracé ne répond pas, le prix se calcule sur l'itinéraire Google déjà reçu (points rapprochés tous les 150 m).
      let sh, tms, km = 0, viaGoogle = false;
      if (leg && leg.maneuvers) {
        try { suisse = passeEnSuisse(dec6(leg.shape)); } catch (_) { suisse = false; }
        tms = leg.maneuvers.filter(m => m.toll);
        for (const m of tms) km += Number(m.length) || 0;
        if (km < 1) { put('💶 <b>Aucun péage</b> sur ce trajet.', true); return; }
        sh = dec6(leg.shape);
      } else {
        viaGoogle = true;
        sh = [A[0].length ? [A[0][1], A[0][0]] : A[0]];
        for (let q = 1; q < A.length; q++) { const p0 = sh[sh.length - 1], p1 = [A[q][1], A[q][0]], n = Math.ceil(dist(p0[0], p0[1], p1[0], p1[1]) / 0.15); for (let u = 1; u < n; u++) sh.push([p0[0] + (p1[0] - p0[0]) * u / n, p0[1] + (p1[1] - p0[1]) * u / n]); sh.push(p1); }
        try { suisse = passeEnSuisse(sh); } catch (_) { suisse = false; }
        tms = [{ begin_shape_index: 0, end_shape_index: sh.length - 1 }];
        km = Number(r.distanceKm) || 100;
      }
      try {
        const tC = performance.now();
        const R = await calculPeage(sh, tms, km), x = R.x;
        window.CPT('calcul péage' + (viaGoogle ? ' (Google)' : ''), tC);
        const O = await chargerOverlay();
        const i0 = tms[0].begin_shape_index, i1 = tms[tms.length - 1].end_shape_index;
        const bar = O ? barrieresTraversees(O, sh, i0, i1) : [];
        if (bar.length) {
          const auj = new Date().toISOString().slice(0, 10), pas = bar.map((v, n) => ({ type: 'barriere', station: v.id, group: v.id, passage: n }));
          const t1 = O.m.trajet(pas, 1, auj), t2 = O.m.trajet(pas, 2, auj);
          const noms = bar.map(v => joli(v.id.replace(/-/g, ' '))).join(', ');
          const legOk = !!(x && x.reste < 3);
          if (t1.complet && t2.complet && (legOk || R.n === 0)) {
            const r2 = n => Math.round(n * 100) / 100;
            const c1 = r2((legOk ? x.c1 : 0) + t1.total), c2 = r2((legOk ? x.c2 : 0) + t2.total);
            const croise = t1.status !== 'PROUVE' || t2.status !== 'PROUVE';
            put('<div class="rd gros ok gras"><span>Classe 1</span><b>' + euro(c1) + '</b></div><div class="rd"><span>Classe 2</span><b>' + euro(c2) + '</b></div><div class="rd sub"><span>' + (legOk ? x.det + ' + ' : '') + 'barrière(s) : ' + noms + '</span></div><div class="rd sub"><span>Source : tarifs officiels 2026' + (croise ? ' (relecture en cours, à vérifier)' : '') + '</span></div>', true);
            return;
          }
          put('💶 <b>Prix exact non disponible</b> pour ce trajet.<div class="rd sub"><span>Barrière(s) détectée(s) : ' + noms + '. Un tarif officiel manque : aucun total n’est affiché.</span></div>', false);
          return;
        }
        if (x && x.reste < 3) {
          put('<div class="rd gros ok gras"><span>Classe 1</span><b>' + euro(x.c1) + '</b></div><div class="rd"><span>Classe 2</span><b>' + euro(x.c2) + '</b></div><div class="rd sub"><span>' + x.det + '</span></div><div class="rd sub"><span>Source (tarifs officiels, dates de mise à jour) : ' + R.v + '</span></div>', true);
          return;
        }
      } catch (_) { /* pas de prix officiel exact trouvé : KO plus bas, jamais d'estimation */ }
      if (viaGoogle && r.toll && r.toll.status === 'aucun_peage') { put('💶 <b>Aucun péage</b> sur ce trajet.', true); return; }
      put(KO, false);
    } catch (_) { put('⚠️ <b>Calcul du péage impossible pour l’instant</b> : le serveur de tracé ne répond pas.<div class="rd sub"><span>Ce n’est pas un prix inconnu. Vérifie ta connexion (wifi/4G) puis appuie de nouveau sur « Voiture et péages ».</span></div>', false); }
  };
  // V263 : trajet mixte (une partie sans péage, une partie avec péage) : on coupe le trajet à une gare, on demande à Google les deux moitiés (rapide / sans péage) et on garde la combinaison la moins chère (prix exact officiel) avec peu de temps en plus.
  const dens = A => { const sh = [[A[0][1], A[0][0]]]; for (let q = 1; q < A.length; q++) { const p0 = sh[sh.length - 1], p1 = [A[q][1], A[q][0]], n = Math.ceil(dist(p0[0], p0[1], p1[0], p1[1]) / 0.15); for (let u = 1; u < n; u++) sh.push([p0[0] + (p1[0] - p0[0]) * u / n, p0[1] + (p1[1] - p0[1]) * u / n]); sh.push(p1); } return sh; };
  const prixTroncon = async poly => { try { if (!poly) return null; const sh = dens(decode(poly)); const R = await calculPeage(sh, [{ begin_shape_index: 0, end_shape_index: sh.length - 1 }], 100, true); const O = await chargerOverlay(); if (O && barrieresTraversees(O, sh, 0, sh.length - 1).length) return { x: null, h: R.h || [] }; return { x: R.x && R.x.reste < 3 ? R.x : null, h: R.h || [] }; } catch (_) { return null; } };
  const nomLieu = async (la, lo) => { try { const j = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=fr&lat=' + la + '&lon=' + lo).then(x => x.json()); const a = j.address || {}; return a.city || a.town || a.village || a.municipality || a.county || null; } catch (_) { return null; } };
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const chercherMixte = async (r, target) => {
    const zone = target.querySelector('[data-mixte]'); if (!zone) return;
    const ko = t => { zone.innerHTML = '<div class="doux">' + t + '</div>'; };
    const B = window.__cpMix;
    if (!B) { ko('Relance « Voiture et péages » puis réessaie.'); return; }
    zone.innerHTML = '<div class="doux">🟠 Recherche du meilleur trajet mixte…</div>';
    try {
      window.CPPh('mixte');
      const pf = await prixTroncon(r.polyline);
      if (!pf || !pf.x) { ko('Trajet mixte impossible : le prix exact du trajet rapide n’est pas disponible.'); return; }
      const H = pf.h.filter((g, i, T) => i === 0 || dist(g[0], g[1], T[i - 1][0], T[i - 1][1]) > 3);
      const inner = []; for (let i = 1; i < H.length - 1; i++) inner.push(i);
      if (!inner.length) { ko('Pas de trajet mixte utile : le péage ne se découpe pas sur ce trajet.'); return; }
      const pick = inner.length <= 4 ? inner : [0, 1, 2, 3].map(k => inner[Math.round(k * (inner.length - 1) / 3)]);
      const est = o => window.CPRoutes.estimate(Object.assign({}, B, { mode: 'voiture' }, o)).catch(() => null);
      const legs = await Promise.all([...new Set(pick)].map(async i => { const p = { lat: H[i][0], lng: H[i][1] }; const [a, b] = await Promise.all([est({ destination: p }), est({ origin: p })]); return { p, a, b }; }));
      const libre = L => L ? ((L.toll && L.toll.status === 'aucun_peage') ? { km: L.distanceKm, min: L.durationMinutes, poly: L.polyline } : (L.sansPeage ? { km: L.sansPeage.distanceKm, min: L.sansPeage.durationMinutes, poly: L.sansPeage.polyline || L.polyline } : null)) : null;
      const payant = L => (L && !(L.toll && L.toll.status === 'aucun_peage')) ? { km: L.distanceKm, min: L.durationMinutes, poly: L.polyline } : null;
      const cands = [];
      for (const L of legs) {
        const aF = libre(L.a), bF = libre(L.b), aT = payant(L.a), bT = payant(L.b);
        if (aF && bT) cands.push({ p: L.p, lib: aF, pay: bT, ordre: 'FT' });
        if (aT && bF) cands.push({ p: L.p, lib: bF, pay: aT, ordre: 'TF' });
      }
      for (const c of cands) { const q = await prixTroncon(c.pay.poly); c.x = q && q.x; }
      const fast = { km: r.distanceKm, min: r.durationMinutes, c1: pf.x.c1, c2: pf.x.c2 };
      const ok = cands.filter(c => c.x && c.lib.min != null && c.pay.min != null).map(c => Object.assign(c, { km: c.lib.km + c.pay.km, min: c.lib.min + c.pay.min, c1: c.x.c1, c2: c.x.c2 })).filter(c => fast.c1 - c.c1 >= 1);
      ok.forEach(c => { c.score = (fast.c1 - c.c1) - 0.2 * Math.max(0, c.min - fast.min); });
      ok.sort((a, b) => b.score - a.score);
      const best = ok[0];
      if (!best || best.score < 0.5) { ko('Aucun trajet mixte intéressant : le trajet rapide reste le meilleur compromis (ou le prix exact d’une partie n’est pas disponible).'); return; }
      const dep = typeof B.origin === 'string' ? B.origin : 'départ', arr = typeof B.destination === 'string' ? B.destination : 'arrivée';
      const piv = (await nomLieu(best.p.lat, best.p.lng)) || 'point intermédiaire';
      const pts = best.ordre === 'FT' ? decode(best.lib.poly).concat(decode(best.pay.poly)) : decode(best.pay.poly).concat(decode(best.lib.poly));
      r.mixte = { pts };
      const tmp = document.createElement('div'); tmp.innerHTML = carte(r);
      const m0 = target.children[0], m1 = target.children[1];
      if (m0 && m1 && m0.querySelector('svg') && tmp.children.length >= 2) { target.replaceChild(tmp.children[0], m0); target.replaceChild(tmp.children[0], m1); }
      const k1 = n => Math.round(n * 10) / 10;
      const ligL = (de, a) => '🟢 <b>Sans péage</b> ' + esc(de) + ' → ' + esc(a) + ' : ' + k1(best.lib.km) + ' km · ' + hm(best.lib.min);
      const ligP = (de, a) => '🔵 <b>Avec péage</b> ' + esc(de) + ' → ' + esc(a) + ' : ' + k1(best.pay.km) + ' km · ' + hm(best.pay.min) + ' · ' + euro(best.c1) + ' (cl. 1) / ' + euro(best.c2) + ' (cl. 2)';
      const dmin = best.min - fast.min, eco = Math.round((fast.c1 - best.c1) * 100) / 100;
      const corps = (best.ordre === 'FT' ? ligL(dep, piv) + '<br>' + ligP(piv, arr) : ligP(dep, piv) + '<br>' + ligL(piv, arr)) + '<br><b>Total</b> : ' + k1(best.km) + ' km · ' + hm(best.min) + ' (rapide : ' + k1(fast.km) + ' km · ' + hm(fast.min) + ')<br>Péage ' + euro(best.c1) + ' au lieu de ' + euro(fast.c1) + ' : <b>économie ' + euro(eco) + '</b>, ' + (dmin >= 0 ? '+' + dmin : '−' + Math.abs(dmin)) + ' min.<br><span class="doux">Prix : tarifs officiels. Distance et durée : Google Routes, à vérifier avant départ.</span>';
      zone.innerHTML = BK('bkMixte', 'TRAJET MIXTE (ORANGE SUR LA CARTE)', corps);
    } catch (e) { ko('Trajet mixte indisponible pour l’instant (' + esc(String(e && e.message || e).slice(0, 80)) + ').'); }
  };
  const render = (target, r, mode) => {
    const prix = mode === 'DRIVE' ? r.toll : r.fare;
    const libelle = mode === 'DRIVE' ? 'Péage' : 'Transport';
    const p = prix.status === 'aucun_peage' ? 'aucun' : (mode === 'DRIVE' && (prix.status === 'prix_inconnu' || prix.status === 'estimation')) ? 'oui (prix exact ci-dessous si disponible)' : 'non disponible';
    const kmH = '🛣 <b>' + (r.distanceKm ?? '—') + ' km</b>' + '<br>⏱️ <b>' + hm(r.durationMinutes) + '</b>';
    const info = mode === 'DRIVE'
      ? BK('bkKm', 'TRAJET LE PLUS RAPIDE', kmH) + BK('bkAvec', 'AVEC PÉAGE', '<div data-peage>' + (prix.status === 'aucun_peage' ? '💶 <b>Aucun péage</b> sur ce trajet.' : '💶 Calcul du prix exact…') + '</div>') + (r.sansPeage ? BK('bkSans', 'SANS PÉAGE', '🛣 <b>' + (r.sansPeage.distanceKm ?? '—') + ' km</b><br>⏱️ <b>' + hm(r.sansPeage.durationMinutes) + '</b>') : '') + (prix.status !== 'aucun_peage' && r.sansPeage ? '<div data-mixte><button type="button" class="sugBtn" data-mixte-go>🟠 Chercher un trajet mixte moins cher</button></div>' : '') + '<p class="doux" style="font-size:.8rem">Distance et durée : Google Routes, à vérifier avant départ.</p>'
      : '<p class="doux" style="font-size:.75rem;margin:6px 0 2px">Calculé par Google Routes en mode transports en commun.</p>' + BK('bkKm', 'TRANSPORTS EN COMMUN', kmH) + BK('bkRen', 'PRIX', '🎟️ Le prix sera détaillé quand le calcul des prix SNCF et des autres transports sera activé.') + '<p class="doux" style="font-size:.8rem">Horaires et prix à vérifier sur le site du transporteur (liens ci-dessous).</p>';
    target.innerHTML = info; LAY('résultat');   // V186 : la carte et les villes passent avant les lignes d’infos
    if (mode === 'DRIVE' && r.polyline) { try { target.innerHTML = carte(r) + (target.dataset.villes ? BK('bkLieu', 'ITINÉRAIRE', target.dataset.villes) : '') + info; } catch (_) { target.innerHTML = info; } estimerPeage(r, target); const mb = target.querySelector('[data-mixte-go]'); if (mb) mb.onclick = () => chercherMixte(r, target); }
  };
  const PEAGE_MEMO = new Map();
  const addBox = (host, id, origin, destination, departureTime, villes, tr, pts) => {
    if (!host || document.getElementById(id) || !origin || !destination) return;
    const box = document.createElement('div');
    box.id = id; box.className = 'carte';
    box.innerHTML = '<b>🧭 Trajet réel Google</b><p class="doux">Distance routière, durée et péage exact.</p><button type="button" data-rmode="voiture">🚗 Voiture et péages</button> <button type="button" class="second" data-rmode="transport">🚌 Transports</button><div class="doux" data-routes-result style="margin-top:8px"></div>' + liens(origin, destination) + '<div class="bk bkC bkTr bkTn" style="display:none"><div class="bkt">TRANSPORTS EN COMMUN · SITES</div><div class="tnZone"></div></div>';
    host.appendChild(box);
    // V252 : comme avant, la mini carte et le prix exact du péage s'affichent d'un seul coup (un seul calcul, pas de doublon) : « Voiture et péages » est déclenché tout seul, une fois, quand la fenêtre est prête.
    setTimeout(() => { try { if (!document.body.contains(box) || box.dataset.auto) return; box.dataset.auto = '1'; const b = box.querySelector('button[data-rmode="voiture"]'); if (b) b.click(); } catch (_) { } }, 300);
    if (villes) box.querySelector('[data-routes-result]').dataset.villes = villes;
    { const dg = document.createElement('div'); dg.className = 'doux'; dg.style.cssText = 'font-size:.68rem;margin-top:6px'; box.appendChild(dg); const iv = setInterval(() => { if (!document.body.contains(box)) { clearInterval(iv); return; } dg.textContent = '🩺 ' + (GAPS.length ? 'blocages mesurés : ' + GAPS.slice(-6).join(' | ') : 'aucun blocage mesuré') + (TPS.length ? ' · durées : ' + TPS.join(' | ') : ''); }, 1500); }
    box.querySelectorAll('button[data-rmode]').forEach(b => b.onclick = async () => {
      const out = box.querySelector('[data-routes-result]'), mode = b.dataset.rmode;
      const s = session(), c = config(); out.textContent = 'Calcul Google en cours…'; window.__cpMix = { endpoint, accessToken: s?.access_token, refreshToken: s?.refresh_token, expiresAt: s?.expires_at, email: s?.email, userId: s?.user_id, supabaseUrl: c?.url, supabaseApiKey: c?.anonKey, origin, destination, departureTime }; const tn = mode === 'transport'; box.querySelectorAll('.bkIt').forEach(a => { a.style.display = tn ? 'none' : ''; }); box.querySelectorAll('.bkTn').forEach(a => { a.style.display = tn ? '' : 'none'; }); if (tn) { const z = box.querySelector('.tnZone'); try { z.innerHTML = window.CPLiensTr && tr ? window.CPLiensTr(tr[0], tr[1], tr[2], tr[3]) : ''; } catch (_) { z.innerHTML = ''; } if (!z.innerHTML) z.innerHTML = '<span class="doux">Sites de transport indisponibles pour ce trajet.</span>'; }
      try {
        const kk = mode + '|' + lieu(origin) + '|' + lieu(destination) + '|' + (departureTime || ''); let pr = EST.get(kk); if (!pr) { const t0 = performance.now(); pr = window.CPRoutes.estimate({ endpoint, accessToken: s?.access_token, refreshToken: s?.refresh_token, expiresAt: s?.expires_at, email: s?.email, userId: s?.user_id, supabaseUrl: c?.url, supabaseApiKey: c?.anonKey, origin, destination, mode, departureTime }); EST.set(kk, pr); pr.then(() => window.CPT('Google', t0), () => EST.delete(kk)); setTimeout(() => EST.delete(kk), 120000); } const r = await pr;
        render(out, r, mode === 'voiture' ? 'DRIVE' : 'TRANSIT');
      } catch (e) { out.textContent = /failed to fetch|networkerror|load failed|aborted/i.test(String(e.message || e)) ? 'Connexion au serveur de trajets impossible. Vérifie ta connexion (wifi ou 4G), puis réessaie.' : String(e.message || e); }
    });
  };
  // V247 : le prix exact du péage s'affiche tout seul dans la fiche du trajet (agenda), sans appuyer sur « Voiture et péages » : seuls les deux points du trajet sont nécessaires.
  window.CPPeageAuto = () => { };   // V249 : remplacé par le bloc « Péage » ajouté dans addBox
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
    addBox(contenu, 'routesGoogleEstimate', match[1].trim(), match[2].trim(), undefined, '🟢 ' + e2(match[1].trim()) + ' → 🔴 ' + e2(match[2].trim()), [match[1].trim(), '', match[2].trim(), ''], (() => { const q = String((document.getElementById('popVol') || {}).dataset?.pts || '').split(',').map(Number); return q.length === 4 ? q : null; })());
    contenu.classList.add('soloGoogle');
  };
  let rafale = false;
  const refresh = () => { if (rafale) return; rafale = true; setTimeout(() => { rafale = false; try { addMissionPanel(); addEstimatePanel(); } catch (_) { } }, 150); };
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
