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
  const mg = L => { const p = Math.ceil(L.length / 6000); return p > 1 ? L.filter((_, i) => i % p === 0 || i === L.length - 1) : L; };
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
    // V281 : les trois tracés (sans péage, avec péage, mixte) restent TOUS visibles : décalés côte à côte (voies parallèles) quand ils se superposent.
    // Le tracé « sans péage » est toujours dessiné (identique ou non au tracé avec péage) ; le mixte seulement s'il existe.
    const lanes = [['#1a9850', 2.2, '6 4', B || A], ['#1e63d8', 2.2, '', A]].concat(C ? [['#8e24aa', 2.2, '', C]] : []);
    const pxL = L => L.map(pos);
    const decal = (P, o) => { if (!o || P.length < 2) return P; return P.map((p, i) => { const q = P[Math.max(0, i - 2)], r2 = P[Math.min(P.length - 1, i + 2)]; let tx = r2[0] - q[0], ty = r2[1] - q[1]; const n = Math.hypot(tx, ty) || 1; return [p[0] - ty / n * o, p[1] + tx / n * o]; }); };
    const pas = lanes.length === 3 ? 4.2 : 3.2;
    const traces = lanes.map((ln, i) => { const o = (i - (lanes.length - 1) / 2) * pas; const bs = pxL(ln[3]); (window.__cpLn = window.__cpLn || []).push(bs); return '<polyline data-w="' + ln[1] + '" data-i="' + (window.__cpLn.length - 1) + '" data-o="' + o + '" points="' + decal(bs, o).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="none" stroke="' + ln[0] + '" stroke-width="' + ln[1] + '"' + (ln[2] ? ' data-d="' + ln[2] + '" stroke-dasharray="' + ln[2] + '"' : '') + ' stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'; }).join('');
    const a = pos(A[0]), b = pos(A[A.length - 1]);
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%">' + traces + '<circle cx="' + a[0].toFixed(1) + '" cy="' + a[1].toFixed(1) + '" r="5" fill="#1a9850" stroke="#fff" stroke-width="1.5"/><circle cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="5" fill="#d93025" stroke="#fff" stroke-width="1.5"/></svg>';
    return '<div class="cpCarte" data-z="' + z + '" data-ox="' + ox + '" data-oy="' + oy + '" data-w="' + W + '" data-h="' + H + '" style="position:relative;width:100%;aspect-ratio:480/540;overflow:hidden;border-radius:8px;margin-top:8px;background:#ddd;touch-action:pan-y"><div class="cpIn" style="position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0">' + tuiles + '<div class="cpFin" style="position:absolute;left:0;top:0;width:100%;height:100%"></div>' + svg + '</div>' + '<span style="position:absolute;right:2px;bottom:2px;font-size:10px;background:rgba(255,255,255,.8);color:#333;padding:0 4px;border-radius:3px">© OpenStreetMap</span></div><p class="doux">Bleu : avec péages · Vert pointillé : sans péage' + (C ? ' · Violet : trajet mixte' : '') + '. Si les tracés sont les mêmes, ils sont dessinés côte à côte.</p>';
  };
  const zoomer = box => {
    box.dataset.zoom = '1';
    const inn = box.querySelector('.cpIn'), fin = box.querySelector('.cpFin');
    const Z0 = +box.dataset.z, OX = +box.dataset.ox, OY = +box.dataset.oy, W = +box.dataset.w, H = +box.dataset.h, N0 = 2 ** Z0;
    let s = 1, tx = 0, ty = 0, tm = 0;
    const decal2 = (P, o) => { if (!o || P.length < 2) return P; return P.map((p, i) => { const q = P[Math.max(0, i - 2)], r2 = P[Math.min(P.length - 1, i + 2)]; let dx = r2[0] - q[0], dy = r2[1] - q[1]; const n = Math.hypot(dx, dy) || 1; return [p[0] - dy / n * o, p[1] + dx / n * o]; }); };
    const marques = () => { inn.querySelectorAll('polyline[data-i]').forEach(pl => { pl.setAttribute('stroke-width', (+pl.dataset.w / s).toFixed(3)); if (pl.dataset.d) pl.setAttribute('stroke-dasharray', pl.dataset.d.split(' ').map(x => (x / s).toFixed(2)).join(' ')); }); inn.querySelectorAll('circle').forEach(c => { c.setAttribute('r', (5 / s).toFixed(2)); c.setAttribute('stroke-width', (1.5 / s).toFixed(2)); }); };
    const reoff = () => { inn.querySelectorAll('polyline[data-i]').forEach(pl => { const P = (window.__cpLn || [])[+pl.dataset.i], o = +pl.dataset.o; if (!P) return; pl.setAttribute('points', decal2(P, o / s).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')); }); };
    const lim = () => { const w = box.clientWidth, h = box.clientHeight; s = Math.max(1, Math.min(16, s)); tx = Math.min(0, Math.max(w * (1 - s), tx)); ty = Math.min(0, Math.max(h * (1 - s), ty)); };
    const fine = () => {
      const k = Math.min(Math.floor(Math.log2(s)), 18 - Z0);
      if (k < 1) { fin.innerHTML = ''; return; }
      const w = box.clientWidth, h = box.clientHeight, f = 2 ** k, t = 256 / f;
      const x0 = (-tx / s) / w * W, y0 = (-ty / s) / h * H, x1 = x0 + W / s, y1 = y0 + H / s;
      const ax = Math.floor((x0 + OX) / t), bx = Math.floor((x1 + OX) / t), ay = Math.floor((y0 + OY) / t), by = Math.floor((y1 + OY) / t);
      if ((bx - ax + 1) * (by - ay + 1) > 36) return;
      const N = N0 * f; let h2 = '';
      for (let a = ax; a <= bx; a++) for (let b = ay; b <= by; b++) if (b >= 0 && b < N) h2 += '<img alt="" referrerpolicy="no-referrer" src="https://tile.openstreetmap.org/' + (Z0 + k) + '/' + (((a % N) + N) % N) + '/' + b + '.png" style="position:absolute;left:' + ((a * t - OX) / W * 100) + '%;top:' + ((b * t - OY) / H * 100) + '%;width:' + (t / W * 100) + '%;height:' + (t / H * 100) + '%">';
      fin.innerHTML = h2;
    };
    const draw = () => { lim(); inn.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')'; box.style.touchAction = s > 1 ? 'none' : 'pan-y'; marques(); clearTimeout(tm); tm = setTimeout(() => { fine(); reoff(); }, 180); };
    const zoomAt = (cx, cy, ns) => { const o = s; s = Math.max(1, Math.min(16, ns)); tx = cx - (cx - tx) * (s / o); ty = cy - (cy - ty) * (s / o); draw(); };
    const bt = (txt, top, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.style.cssText = 'position:absolute;left:6px;top:' + top + 'px;width:36px;height:36px;border-radius:8px;border:0;background:rgba(255,255,255,.92);color:#222;font:700 20px/1 system-ui;z-index:3;padding:0'; b.onclick = e => { e.stopPropagation(); fn(); }; box.appendChild(b); };
    bt('+', 6, () => zoomAt(box.clientWidth / 2, box.clientHeight / 2, s * 2));
    bt('\u2212', 48, () => zoomAt(box.clientWidth / 2, box.clientHeight / 2, s / 2));
    bt('\u27f2', 90, () => { s = 1; tx = 0; ty = 0; draw(); });
    const P = new Map(); let d0 = 0, last = 0;
    box.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'BUTTON') return;
      P.set(e.pointerId, [e.clientX, e.clientY]);
      try { box.setPointerCapture(e.pointerId); } catch (_) { }
      if (P.size === 2) { const q = [...P.values()]; d0 = Math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]); }
      const n = Date.now();
      if (P.size === 1 && n - last < 300) { const r = box.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, s > 1.5 ? 1 : s * 3); }
      if (P.size === 1) last = n;
    });
    box.addEventListener('pointermove', e => {
      if (!P.has(e.pointerId)) return;
      const old = P.get(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]);
      const r = box.getBoundingClientRect();
      if (P.size === 2) { const q = [...P.values()], d = Math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]); if (d0 > 0) zoomAt((q[0][0] + q[1][0]) / 2 - r.left, (q[0][1] + q[1][1]) / 2 - r.top, s * d / d0); d0 = d; }
      else if (P.size === 1 && s > 1) { tx += e.clientX - old[0]; ty += e.clientY - old[1]; draw(); }
    });
    const fini = e => { P.delete(e.pointerId); d0 = 0; };
    box.addEventListener('pointerup', fini); box.addEventListener('pointercancel', fini);
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
      for (const n of (o.gares || [])) { { const e = PEAGES.g.find(g => g[0] === n.nom); if (!e) PEAGES.g.push([n.nom, n.points]); else if (n.ajout) e[1] = e[1].concat(n.ajout); } }   // V295 : champ « ajout » de l'overlay = points supplémentaires d'une gare déjà en base (ex. Aubagne Est)
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
    let unkHit = false;
    // V265 : si le tracé passe près d'une gare officielle dont nous n'avons aucun tarif, le prix exact est refusé (jamais de prix partiel).
    if (typeof UNK !== 'undefined') for (let k = i0; k <= i1; k++) { const w = sh[k]; if (!w) continue; for (let u = 0; u < UNK.length; u++) { const z = UNK[u]; if (Math.abs(w[0] - z[0]) < 0.006 && Math.abs(w[1] - z[1]) < 0.009 && dist(w[0], w[1], z[0], z[1]) < 0.5 && !hits.some(h => P.g[h.g][1].some(p => dist(z[0], z[1], p[0], p[1]) < 1.0))) unkHit = true; } }   // V294 : un point sans tarif situé à moins de 1 km d'une gare déjà reconnue sur le tracé (et tarifée) n'est plus bloquant : c'est la même barrière   // V289 : point sans tarif : on continue le calcul pour garder la partie vérifiée (le prix exact reste refusé)
    // V259 : barrières « système ouvert » à tarif fixe : leur tarif est ajouté par le moteur de barrières (overlay) ; ici elles sont seulement retirées de la recherche des couples de gares.
    // V280 (6 nov. 2026) : « CHIGNIN BRETELLE » et « TOURNEAU Système Ouvert » ajoutés après verification exhaustive
    // de la grille AREA/APRR complete (tests/peages-area-grille-complete-chignin-bretelle.test.cjs et
    // tests/peages-aprr-grille-complete-le-tourneau.test.cjs) : ces 2 gares, comme les 8 autres ci-dessous, n'ont
    // aucun tarif point-a-point propre (0 relation dans les 16918+21505 relations officielles) -- seul un tarif
    // fixe « systeme ouvert » existe, porte par le mecanisme des barrieres (overlay). Sans cette entree, une gare
    // isolee rencontree au milieu d'un trajet avec d'autres gares deja tarifees de part et d'autre aurait pu faire
    // refuser (ou dans certains cas silencieusement omettre) le prix du reste du trajet -- cf. le garde-fou ligne
    // ~284 qui verifie que chaque nom ici a bien une barriere correspondante.
    const OUV = { 'CROTTET': [0.8, 1.2], 'FONTAINE-LARIVIERE': [3.1, 4.9], 'GENAY': [1.7, 2.5], 'LUSSE': [6.8, 10.7], 'MIONNAY': [1, 1.5], 'MYENNES': [4.2, 6], 'QUINCIEUX': [3.6, 5.6], 'VICHY': [1.2, 1.9], 'CHIGNIN BRETELLE': [1.0, 1.6], 'TOURNEAU Système Ouvert': [3.8, 5.8], 'BOISSE Système Ouvert': [2.4, 3.9], 'CHESNES': [2.3, 3.6], 'LE CROZET': [4.5, 7.1], 'SAINT EXUPERY': [2.3, 3.6], 'SCIONZIER': [2.3, 4.3], 'BONNEVILLE OUEST': [1.3, 2.3], 'BONNEVILLE EST': [1.7, 3.1], 'CLUSES CENTRE': [2.5, 4.3] }; // V282 : barrières ATMB A40 (grille officielle 2026)
    const ouv = [];
    for (let q = hits.length - 1; q >= 0; q--) { if (OUV[P.g[hits[q].g][0]]) { if (!ouv.some(o => o.g === hits[q].g)) ouv.unshift(hits[q]); hits.splice(q, 1); } }
    if (!hits.length && !ouv.length) return null;
    const cum = new Float64Array(sh.length); for (let k = 1; k < sh.length; k++) cum[k] = cum[k - 1] + dist(sh[k - 1][0], sh[k - 1][1], sh[k][0], sh[k][1]);
    const lon = (a, b) => cum[b] - cum[a];   // V247 : distances cumulées (le téléphone ne se fige plus)
    // V254 : A410 (AREA) : la barrière « St Martin Bellevue A410 » facture depuis la jonction A40 (tronçon gratuit jusqu'à La Roche-sur-Foron compris, 37 km au tarif) : la distance se mesure depuis le début/jusqu'à la fin du tronçon à péage ; la gare de Cruseilles, avant la barrière, n'est qu'une bretelle.
    const ENT = 'ST MARTIN BELLEVUE A410';
    const eN = hits.findIndex(q => P.g[q.g][0] === ENT);
    if (eN > 0 && hits.slice(0, eN).every(q => P.g[q.g][0] === 'CRUSEILLES A')) hits.splice(0, eN);
    // V283 : « CRUSEILLES A » sur l'A41 est la jonction de la barrière Adelac (tarifée par le moteur de barrières) : sans passage par l'A410 (St Martin Bellevue), on l'ignore.
    if (eN < 0) for (let q = hits.length - 1; q >= 0; q--) if (P.g[hits[q].g][0] === 'CRUSEILLES A') hits.splice(q, 1);
    // V278 : « VOREPPE BARRIERE » (A48/A49, AREA) facture depuis le début du tronçon à péage (Grenoble → Voreppe compris) : tarif 35 km pour Voreppe → Rives alors que 18 km séparent la barrière de Rives. On accepte la distance mesurée sur le tracé OU depuis le début/jusqu'à la fin du tronçon.
    hits.forEach(q => { if (P.g[q.g][0] === ENT) q.ent = true; if (P.g[q.g][0] === 'VOREPPE BARRIERE') q.vo = true; });
    // V246 : gares « jumelles » (mêmes coordonnées, ex. Dourdan / La Folie-B) : on essaie la plus proche d'abord, puis ses jumelles.
    const jc = new Map();
    const jum = g => { if (jc.has(g)) return jc.get(g); const r = [g]; jc.set(g, r); P.g.forEach((o, i) => { if (i !== g && o[1].some(p => P.g[g][1].some(q => dist(p[0], p[1], q[0], q[1]) < 0.06))) r.push(i); }); return r; };
    // V245 : un trajet peut traverser plusieurs mailles tarifaires séparées (ex. A41 Annecy→Chambéry puis Chignin→Crolles) : on additionne les tronçons officiels.
    const paire = (x, y) => { const ds = x.ent ? [lon(i0, y.k)] : y.ent ? [lon(x.k, i1)] : [lon(x.k, y.k)]; if (x.vo) ds.push(lon(i0, y.k)); if (y.vo) ds.push(lon(x.k, i1)); for (const a of jum(x.g)) for (const b of jum(y.g)) { if (a === b) continue; const v = P.prix.get(Math.min(a, b) * 1000 + Math.max(a, b)); if (!v) continue; if (ds.some(d => { const q = v[2] / Math.max(1, d); return q >= 0.7 && q <= 1.9; })) return { v, a, b }; } return null; };
    const segs = [];
    P.partiel = null;
    let kmV = 0, gap = false;
    let i = 0;
    while (i < hits.length) {
      let ok = null;
      for (let h = hits.length - 1; h > i && !ok; h--) { const p = paire(hits[i], hits[h]); if (p) ok = { h, p }; }
      if (!ok) {
        // gare isolée sans tarif : tolérée uniquement après le dernier tronçon tarifé, jamais au milieu du trajet
        if (!segs.length) { if (i === 0 && P.g[hits[0].g][0] === 'ST MARTIN BELLEVUE A41 N' && sh.slice(i0, hits[0].k + 1).every(w => w[0] > 46.08)) { i++; continue; } gap = true; i++; continue; }   // V296 : gare isolée : on la saute et on continue pour garder tous les tronçons vérifiés (le prix exact reste refusé)
        // V283 : « ALLONZIER » reliée à l'A41 nord est la même jonction qu'Adelac Cruseilles : sortie là = Adelac seul (barrières), aucun tarif AREA.
        if (hits.slice(i).every(q => P.g[q.g][0] === 'ALLONZIER' || (P.g[q.g][0] === 'ST MARTIN BELLEVUE A41 N' && sh.slice(q.k).every(w => w[0] > 46.08)))) break;
        let lat = false; for (let a = i; a < hits.length; a++) for (let c = a + 1; c < hits.length; c++) if (paire(hits[a], hits[c])) lat = true; if (lat) { gap = true; i++; continue; }
        { const fin = segs[segs.length - 1].h; if (hits.slice(i).some(q => lon(hits[fin].k, q.k) > 1.5)) { gap = true; break; } }   // V265 : une gare sans tarif après le dernier tronçon = prix partiel : refusé
        break;
      }
      segs.push(ok); kmV += lon(hits[i].k, hits[ok.h].k); i = ok.h + 1;
      P.partiel = { c1: Math.round(segs.reduce((n, q) => n + q.p.v[0], 0) * 100) / 100, c2: Math.round(segs.reduce((n, q) => n + q.p.v[1], 0) * 100) / 100, km: kmV, det: segs.map(q => joli(P.g[q.p.a][0]) + ' → ' + joli(P.g[q.p.b][0])).join(' + ') };
    }
    if (!segs.length && !ouv.length) return null;
    const r2 = n => Math.round(n * 100) / 100;
    // V246 : Valhalla marque « péage » des tronçons gratuits (rocades, entrées de ville) : le reste après la dernière gare n'est plus refusé ; il contient forcément 0 gare.
    // Seules les gares dont la position est douteuse (voir audit) bloquent le prix.
    const SUSPECTES = ['CRUSEILLES A'];
    const dout = segs.some(q => SUSPECTES.includes(P.g[q.p.a][0]) || SUSPECTES.includes(P.g[q.p.b][0]));
    const nO = ouv.map(o => P.g[o.g][0]);
    const detS = segs.map(q => joli(P.g[q.p.a][0]) + ' → ' + joli(P.g[q.p.b][0]));
    if (unkHit || gap) return null;
    return { e: segs.length ? joli(P.g[segs[0].p.a][0]) : joli(nO[0]), s: segs.length ? joli(P.g[segs[segs.length - 1].p.b][0]) : joli(nO[nO.length - 1]), c1: r2(segs.reduce((n, q) => n + q.p.v[0], 0)), c2: r2(segs.reduce((n, q) => n + q.p.v[1], 0)), det: detS.length ? detS.join(' + ') : 'Péages à tarif fixe', reste: dout ? 99 : 0, ouv: nO.map(n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-')) };
  };
  // V233 : péages « barrière » (sans gare d'entrée/sortie : ponts, tunnels, barrières pleine voie) — tarifs officiels versionnés, jamais d'estimation.
  let OVERLAY = null;
  const chargerOverlay = async () => {
    if (OVERLAY !== null) return OVERLAY;
    try {
      if (!window.CPPeage) await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'peage-engine.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
      const j = await fetch('peages-overlay.json').then(r => r.json());
      const versions = j.tarifs.map(t => ({ id: t.id, barrier_station_id: t.b || null, vehicle_class: t.c, amount_eur: t.a, status: t.s, effective_from: t.f, effective_to: t.t || null, tariff_context: t.k || null, source_url: t.u == null ? null : j.u[t.u] }));
      const moteur = window.CPPeage.creerMoteur({ versions });
      OVERLAY = { m: window.CPSanefGpsProtection ? window.CPSanefGpsProtection.protectEngine(moteur) : moteur, b: j.barrieres, v: j.v };
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
  const NOTE_CH = '<div style="display:block;margin:6px 0;padding:5px 9px;border-radius:8px;background:#fff;color:#b00020;border:2px solid #d52b1e;font-weight:800;font-size:.95em;line-height:1.25">🇨🇭 Vignette suisse : 40 CHF <span style="font-weight:600;font-size:.85em">(à acheter avant la frontière, 1 an · hors total péages)</span></div>';
  // V283 (12 nov. 2026, demande de Laurent) : quand le tarif officiel exact manque, estimation « ≈ » = km à péage × tarif moyen local (médiane des tarifs officiels par case de 1° ; Classe 2 = 1,85 × Classe 1), arrondie à 0,10 €. Jamais ajoutée aux prix exacts.
  const TAUX_KM = {"47,3":0.126,"48,2":0.195,"47,2":0.146,"47,4":0.099,"48,3":0.112,"46,3":0.122,"46,5":0.098,"46,4":0.115,"47,5":0.097,"45,4":0.115,"45,3":0.116,"46,2":0.121,"48,1":0.183,"47,1":0.156,"46,1":0.146,"47,6":0.096,"48,4":0.099,"45,5":0.111,"48,5":0.099,"46,6":0.103,"48,6":0.099,"45,2":0.105,"43,3":0.104,"44,4":0.104,"43,4":0.101,"46,-2":0.103,"46,-1":0.108,"44,0":0.1,"43,0":0.098,"43,-1":0.095,"43,2":0.105,"44,3":0.132,"42,2":0.185,"45,-1":0.105,"48,0":0.182,"47,0":0.149,"47,-1":0.14,"48,-1":0.193,"46,0":0.111,"50,1":0.103,"49,1":0.1,"49,2":0.093,"50,2":0.095,"49,3":0.099,"49,5":0.099,"49,6":0.097,"49,0":0.101};
  // V300 (13 nov. 2026, demande de Laurent) : tarif au km des gares officielles les PLUS PROCHES du tronçon manquant (médiane des tarifs officiels c1/km des paires dont le milieu est dans la case de 0,25° ou ses 8 voisines, ≥ 6 paires) ; repli : médiane par case de 1° (TAUX_KM), puis 0,105.
  const TAUX_FIN = {"188,14":0.125,"189,14":0.125,"192,10":0.168,"191,11":0.157,"188,13":0.128,"191,16":0.099,"190,13":0.129,"190,14":0.125,"191,15":0.102,"190,15":0.11,"191,12":0.138,"192,15":0.099,"189,13":0.129,"193,15":0.102,"193,9":0.174,"192,13":0.13,"188,10":0.129,"188,9":0.123,"192,9":0.171,"191,14":0.123,"193,8":0.175,"189,8":0.126,"192,14":0.118,"192,12":0.145,"189,9":0.134,"191,17":0.098,"192,11":0.159,"193,10":0.17,"191,13":0.129,"189,10":0.135,"189,15":0.11,"194,15":0.104,"194,9":0.169,"193,12":0.154,"190,8":0.151,"193,11":0.165,"193,13":0.132,"187,12":0.127,"185,21":0.1,"187,17":0.098,"188,15":0.118,"186,18":0.096,"183,20":0.11,"186,23":0.098,"186,20":0.094,"185,20":0.097,"184,21":0.108,"186,22":0.097,"186,19":0.093,"186,12":0.125,"187,13":0.126,"184,20":0.101,"186,15":0.122,"188,22":0.092,"190,17":0.097,"189,16":0.098,"188,20":0.093,"186,13":0.124,"186,21":0.094,"190,20":0.095,"183,16":0.118,"189,22":0.093,"188,16":0.099,"182,14":0.118,"184,22":0.127,"184,15":0.118,"190,21":0.094,"184,16":0.118,"187,14":0.125,"187,21":0.093,"188,19":0.094,"187,18":0.096,"188,18":0.096,"186,14":0.123,"185,15":0.12,"190,19":0.095,"182,13":0.118,"183,15":0.118,"188,17":0.097,"182,15":0.117,"190,9":0.155,"189,11":0.135,"188,12":0.13,"187,11":0.127,"186,11":0.124,"188,11":0.132,"192,7":0.151,"189,12":0.133,"186,8":0.127,"187,8":0.117,"191,8":0.161,"191,7":0.15,"188,7":0.114,"190,12":0.136,"191,10":0.166,"187,7":0.125,"188,6":0.116,"191,9":0.169,"189,18":0.096,"188,23":0.091,"187,20":0.093,"187,22":0.094,"187,15":0.121,"190,22":0.094,"190,16":0.098,"189,21":0.093,"191,21":0.095,"185,17":0.118,"189,17":0.097,"188,21":0.092,"185,22":0.104,"186,16":0.12,"191,22":0.095,"188,24":0.094,"189,19":0.095,"191,19":0.096,"184,14":0.119,"190,18":0.097,"189,20":0.094,"185,23":0.109,"185,16":0.12,"187,10":0.126,"192,8":0.166,"187,16":0.109,"192,18":0.097,"190,10":0.153,"193,17":0.098,"193,18":0.097,"190,11":0.144,"191,18":0.097,"186,10":0.122,"187,19":0.093,"193,14":0.107,"192,19":0.097,"193,16":0.1,"192,16":0.096,"186,17":0.118,"185,12":0.122,"193,19":0.097,"185,11":0.119,"185,19":0.095,"185,14":0.122,"183,21":0.126,"184,19":0.098,"183,22":0.132,"187,23":0.094,"189,25":0.091,"189,24":0.093,"191,24":0.092,"192,22":0.096,"189,23":0.092,"186,24":0.099,"193,24":0.097,"192,24":0.093,"190,23":0.092,"189,26":0.096,"192,21":0.096,"187,24":0.097,"191,20":0.096,"184,13":0.12,"192,20":0.096,"184,12":0.118,"183,14":0.118,"183,13":0.118,"183,19":0.1,"182,12":0.118,"184,18":0.117,"191,23":0.094,"192,23":0.094,"192,17":0.096,"185,13":0.122,"186,9":0.122,"188,8":0.114,"187,9":0.119,"185,10":0.112,"194,18":0.098,"193,23":0.096,"194,21":0.097,"194,22":0.097,"191,25":0.09,"194,20":0.097,"195,12":0.125,"194,16":0.1,"195,18":0.104,"194,12":0.147,"195,11":0.184,"194,13":0.12,"194,17":0.098,"193,20":0.096,"194,14":0.104,"194,11":0.166,"195,15":0.112,"195,16":0.109,"194,10":0.167,"195,14":0.107,"193,21":0.096,"195,22":0.097,"195,21":0.098,"194,19":0.098,"183,12":0.117,"182,10":0.114,"183,18":0.118,"186,7":0.132,"184,11":0.101,"184,17":0.118,"182,9":0.113,"183,11":0.107,"183,17":0.118,"182,11":0.113,"195,23":0.097,"194,23":0.097,"193,22":0.096,"195,20":0.101,"183,10":0.112,"190,7":0.146,"183,9":0.112,"184,8":0.13,"186,25":0.108,"184,23":0.136,"191,6":0.145,"187,6":0.131,"183,8":0.114,"184,10":0.105,"184,9":0.112,"195,17":0.106,"192,25":0.092,"190,24":0.092,"187,25":0.101,"182,23":0.13,"183,23":0.133,"182,22":0.129,"181,21":0.127,"181,22":0.126,"182,21":0.127,"182,24":0.136,"181,24":0.14,"181,25":0.148,"182,25":0.143,"183,24":0.131,"181,23":0.127,"181,20":0.125,"182,20":0.125,"180,20":0.11,"180,21":0.125,"180,24":0.148,"180,22":0.125,"195,13":0.109,"195,19":0.103,"193,25":0.096,"192,6":0.14,"174,15":0.104,"177,16":0.112,"175,16":0.107,"176,16":0.111,"173,14":0.107,"174,16":0.101,"176,3":0.102,"175,3":0.106,"175,4":0.096,"176,2":0.106,"187,-6":0.109,"187,-5":0.112,"184,-5":0.114,"186,-4":0.115,"186,-5":0.111,"185,-5":0.112,"184,-4":0.113,"176,1":0.14,"178,18":0.106,"175,18":0.102,"174,17":0.09,"176,18":0.104,"175,17":0.099,"177,18":0.107,"172,-1":0.09,"173,-3":0.124,"173,-4":0.124,"173,-1":0.11,"178,19":0.104,"176,19":0.105,"177,19":0.105,"175,19":0.104,"178,17":0.109,"177,17":0.109,"176,17":0.106,"188,-5":0.113,"187,-4":0.117,"187,-3":0.122,"188,-4":0.117,"185,-3":0.115,"187,-2":0.128,"186,-3":0.118,"184,-3":0.111,"173,13":0.109,"174,14":0.108,"173,15":0.101,"175,15":0.111,"188,-6":0.114,"179,19":0.103,"173,11":0.11,"177,13":0.127,"173,10":0.11,"175,13":0.113,"172,9":0.113,"172,8":0.112,"173,12":0.11,"174,13":0.109,"171,9":0.123,"172,10":0.112,"174,12":0.111,"176,13":0.124,"182,-3":0.109,"183,-3":0.111,"183,-4":0.113,"181,-3":0.114,"177,6":0.106,"177,5":0.106,"176,6":0.099,"176,5":0.099,"173,-2":0.112,"177,14":0.12,"171,10":0.115,"175,14":0.115,"176,14":0.119,"173,8":0.108,"175,5":0.09,"181,19":0.102,"185,-4":0.115,"189,-3":0.119,"188,-3":0.123,"186,-2":0.12,"190,-2":0.128,"191,-1":0.129,"179,-1":0.117,"190,-1":0.133,"181,7":0.107,"185,-2":0.112,"179,6":0.126,"178,6":0.109,"178,5":0.109,"174,20":0.107,"177,1":0.103,"177,0":0.125,"177,2":0.102,"186,-6":0.107,"175,20":0.104,"177,20":0.105,"176,20":0.105,"178,20":0.104,"178,-1":0.111,"177,-1":0.14,"172,0":0.089,"172,1":0.092,"171,12":0.111,"172,14":0.108,"172,13":0.108,"170,11":0.117,"171,11":0.112,"176,15":0.115,"173,0":0.104,"172,2":0.093,"172,3":0.111,"172,12":0.11,"172,11":0.111,"177,15":0.115,"179,-2":0.107,"180,19":0.101,"177,12":0.128,"173,9":0.111,"175,12":0.113,"172,7":0.105,"173,7":0.101,"171,8":0.123,"173,6":0.1,"174,11":0.111,"183,-2":0.107,"182,16":0.118,"176,12":0.125,"174,10":0.11,"179,0":0.107,"180,0":0.111,"180,1":0.109,"179,1":0.109,"185,-1":0.107,"184,-2":0.106,"182,-2":0.105,"172,6":0.1,"178,-2":0.136,"174,19":0.104,"174,5":0.1,"174,-5":0.118,"181,8":0.117,"181,9":0.116,"174,6":0.1,"178,12":0.128,"181,6":0.1,"182,17":0.118,"180,-3":0.125,"180,-2":0.12,"181,-2":0.114,"182,8":0.113,"173,22":0.102,"173,23":0.104,"173,24":0.114,"173,25":0.121,"173,26":0.123,"174,22":0.106,"175,22":0.107,"176,23":0.111,"175,23":0.106,"177,24":0.114,"177,23":0.114,"193,3":0.131,"192,2":0.131,"194,4":0.142,"193,4":0.13,"191,3":0.128,"193,5":0.132,"193,6":0.131,"192,4":0.131,"192,3":0.13,"193,2":0.149,"193,1":0.153,"195,4":0.132,"194,7":0.159,"191,4":0.143,"188,-2":0.136,"192,0":0.129,"195,1":0.188,"191,0":0.13,"192,-1":0.129,"194,0":0.179,"193,-2":0.135,"193,0":0.153,"194,1":0.179,"192,1":0.131,"192,-2":0.131,"193,7":0.16,"191,5":0.15,"189,-1":0.157,"191,1":0.13,"191,2":0.128,"190,0":0.132,"191,-3":0.132,"194,3":0.178,"190,5":0.149,"190,6":0.145,"186,6":0.14,"194,2":0.18,"190,1":0.138,"191,-2":0.127,"189,0":0.172,"188,-1":0.149,"187,-1":0.133,"194,-1":0.181,"185,6":0.145,"189,3":0.128,"189,5":0.15,"190,4":0.148,"189,4":0.146,"189,6":0.147,"185,5":0.166,"185,7":0.138,"189,7":0.134,"184,7":0.14,"185,9":0.118,"190,2":0.135,"192,5":0.136,"190,3":0.137,"187,2":0.108,"186,-1":0.118,"187,1":0.108,"186,0":0.11,"184,-1":0.104,"186,1":0.108,"188,2":0.109,"183,0":0.107,"185,8":0.132,"185,4":0.182,"183,-1":0.106,"193,-1":0.139,"195,3":0.19,"192,-4":0.207,"190,-3":0.132,"184,0":0.106,"185,0":0.107,"187,0":0.12,"194,-2":0.184,"202,6":0.109,"201,6":0.11,"201,7":0.11,"200,7":0.11,"200,8":0.111,"199,8":0.11,"199,7":0.11,"198,8":0.113,"198,7":0.111,"197,8":0.103,"200,6":0.113,"197,7":0.103,"202,9":0.102,"202,10":0.095,"201,10":0.095,"201,11":0.088,"200,11":0.089,"200,12":0.086,"199,12":0.09,"199,13":0.094,"198,13":0.095,"198,14":0.095,"199,14":0.091,"198,15":0.095,"197,15":0.121,"201,9":0.102,"200,9":0.105,"200,10":0.09,"199,11":0.095,"198,12":0.095,"199,9":0.106,"199,10":0.1,"201,12":0.086,"200,13":0.095,"198,11":0.105,"197,13":0.113,"198,10":0.111,"197,10":0.12,"197,12":0.113,"196,13":0.12,"196,17":0.12,"196,18":0.12,"196,19":0.12,"196,20":0.109,"196,21":0.1,"196,22":0.098,"196,23":0.097,"196,24":0.097,"196,25":0.096,"196,26":0.101,"196,27":0.112,"195,24":0.097,"195,28":0.115,"195,25":0.096,"195,26":0.101,"195,27":0.112,"195,29":0.12,"198,1":0.11,"198,2":0.105,"198,3":0.1,"198,4":0.1,"196,-1":0.116,"197,0":0.112,"197,-1":0.113,"197,1":0.108,"197,2":0.103,"196,1":0.11,"197,3":0.101,"196,2":0.106,"197,4":0.099,"196,4":0.102,"196,3":0.103,"196,5":0.101,"196,6":0.113,"195,7":0.119,"174,25":0.119,"174,26":0.121,"173,27":0.13,"174,28":0.131,"174,29":0.13,"175,29":0.13,"189,-4":0.122,"189,-6":0.133,"189,-5":0.123,"195,2":0.179,"192,-3":0.146,"190,-4":0.132,"189,-2":0.129,"191,-4":0.187,"190,-5":0.184,"191,-5":0.238,"174,-6":0.122,"195,-1":0.188,"195,0":0.184,"174,23":0.106,"172,23":0.109,"172,22":0.098,"175,24":0.11,"174,24":0.113,"175,25":0.118,"174,27":0.124,"176,26":0.118,"175,26":0.12,"176,27":0.118,"180,3":0.106,"180,2":0.104,"178,16":0.111,"178,13":0.126,"180,4":0.12,"180,5":0.137,"182,19":0.11,"179,18":0.105,"176,4":0.099,"175,-2":0.14,"176,-2":0.14,"175,-1":0.14,"174,-2":0.14,"177,-2":0.14,"196,8":0.119,"199,6":0.115,"202,8":0.117,"196,10":0.12,"196,14":0.119,"196,15":0.12,"196,16":0.12,"174,21":0.107,"173,-6":0.122,"173,5":0.1,"195,10":0.195,"175,-3":0.14,"175,0":0.14,"175,1":0.14,"175,2":0.14,"176,0":0.14,"174,-1":0.14,"174,0":0.14,"174,1":0.14,"176,-1":0.14,"175,-4":0.14,"174,-4":0.14,"174,-3":0.14,"174,2":0.14,"173,1":0.14,"196,12":0.105,"172,24":0.121,"203,8":0.118};
  const approx = (sh, tms, km, V, B) => { try { let s = 0, n = 0; for (const m of tms) { const a = m.begin_shape_index, b = m.end_shape_index, pas = Math.max(1, Math.floor((b - a) / 25)); for (let k = a; k <= b; k += pas) { const w = sh[k]; if (!w) continue; const r = TAUX_FIN[Math.floor(w[0] * 4) + ',' + Math.floor(w[1] * 4)] ?? TAUX_KM[Math.floor(w[0]) + ',' + Math.floor(w[1])]; s += r !== undefined ? r : 0.105; n++; } } if (!n || !(km >= 1)) return ''; let mt = false; for (const m of tms) for (let k = m.begin_shape_index; k <= m.end_shape_index && !mt; k++) { const w = sh[k]; if (w && (dist(w[0], w[1], UNK[7][0], UNK[7][1]) < 0.4 || dist(w[0], w[1], UNK[8][0], UNK[8][1]) < 0.4)) mt = true; }   // V298 : Montesson (A14, flux libre) compté en estimation ≈
    const tx = s / n, vk = V && V.km > 0 ? Math.min(V.km, km) : 0, mk = Math.max(0, km - vk), m1 = Math.round(mk * tx * 10) / 10, m2 = Math.round(m1 * 1.85 * 10) / 10, v1 = (V ? V.c1 : 0) + (B ? B.c1 : 0), v2 = (V ? V.c2 : 0) + (B ? B.c2 : 0), c1 = Math.round((v1 + m1 + (mt ? 10.8 : 0)) * 10) / 10, c2 = Math.round((v2 + m2 + (mt ? 20 : 0)) * 10) / 10; return '<div class="rd gros c1"><span>Classe 1 (trajet complet, estimation)</span><b>≈ ' + euro(c1) + '</b></div><div class="rd gros c2"><span>Classe 2 (trajet complet, estimation)</span><b>≈ ' + euro(c2) + '</b></div>' + ((V && V.c1 > 0) || B ? '<div class="rd sub"><span>✅ Partie vérifiée (tarif officiel) : ' + ((V && V.c1 > 0) ? V.det : '') + (B ? ((V && V.c1 > 0) ? ' + ' : '') + 'barrière(s) : ' + B.noms : '') + ' = ' + euro(v1) + ' (Classe 1) · ' + euro(v2) + ' (Classe 2)</span></div>' : '<div class="rd sub"><span>✅ Partie vérifiée : aucune (aucun tronçon de ce trajet n’a un tarif officiel exact).</span></div>') + '<div class="rd sub"><span>⚠️ Partie manquante (estimée) : ' + Math.round(mk) + ' km à péage × tarif moyen local = ≈ ' + euro(m1) + ' (Classe 1) · ≈ ' + euro(m2) + ' (Classe 2), à 10-15 % près. Le tarif officiel exact de ce tronçon manque.</span></div>' + (mt ? '<div class="rd sub"><span>⚠️ Dont péage de Montesson (A14) : ≈ 10,80 € en classe 1 · ≈ 20 € en classe 2, déjà compté dans le total (flux libre ; gratuit en semaine à partir du 16 nov. 2026 pendant la fermeture de l’A13 : le prix réel peut donc être plus bas).</span></div>' : ''); } catch (_) { return ''; } };
  // V286 (12 nov. 2026, demande de Laurent) : péages ITALIENS estimés (aucune grille italienne en base) : km à péage situés en Italie × 0,08 €/km (moyenne nationale : Milan-Rome 563 km = 44,40 €, soit 0,079 €/km), Classe 2 = 1,15 × Classe 1. Toujours affiché « ≈ », jamais comme prix exact.
  const IT_POLY = [[7.53,43.78],[7.02,44.25],[6.63,44.9],[6.7,45.15],[6.9,45.85],[7.17,45.87],[7.45,45.92],[7.87,45.94],[8.45,46.25],[8.8,46.0],[9.05,45.83],[9.1,46.18],[9.3,46.5],[10.45,46.52],[10.45,46.87],[11.2,46.97],[12.2,47.08],[13.7,46.52],[13.6,45.65],[14.5,45.0],[19.0,40.5],[16.5,37.9],[15.6,37.9],[12.0,40.0],[9.5,43.5]];
  const dansIT = (lat, lon) => { let in_ = false; for (let i = 0, j = IT_POLY.length - 1; i < IT_POLY.length; j = i++) { const [xi, yi] = IT_POLY[i], [xj, yj] = IT_POLY[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) in_ = !in_; } return in_; };
  const italie = (sh, tms) => { try { let km = 0, eur = 0; const taux = (la, lo) => (la > 45.45 && la < 45.95 && lo > 6.9 && lo < 8.0) ? 0.145 : (la > 44.95 && la < 45.25 && lo > 6.65 && lo < 7.45) ? 0.23 : 0.08; for (const m of tms) { const a = m.begin_shape_index, b = m.end_shape_index; if (!(b > a)) continue; const pas = Math.max(1, Math.floor((b - a) / 40)); let n = 0, d = 0, s = 0; for (let k = a; k <= b; k += pas) { const w = sh[k]; if (!w) continue; n++; if (dansIT(w[0], w[1])) { d++; s += taux(w[0], w[1]); } } if (n) { const L = Number(m.length) || 0; km += L * d / n; eur += L * s / n; } } if (km < 1) return null; const c1 = Math.round(eur * 10) / 10; return { km, c1, c2: Math.round(c1 * 1.15 * 10) / 10 }; } catch (_) { return null; } };
  const itNote = (IT, v1, v2) => IT ? '<div class="rd sub"><span>✅ Partie française vérifiée (tarif officiel) : ' + euro(v1) + ' (Classe 1) · ' + euro(v2) + ' (Classe 2)</span></div><div class="rd sub"><span>⚠️ Partie italienne manquante (estimée) : ' + Math.round(IT.km) + ' km × ' + (IT.c1 / IT.km).toFixed(3).replace('.', ',') + ' €/km (plaine 0,08 ; Val d’Aoste 0,145 ; Val de Suse 0,23) = ≈ ' + euro(IT.c1) + ' (Classe 1) · ≈ ' + euro(IT.c2) + ' (Classe 2), à ± 20 % près.</span></div>' : '';
  const BK = (cls, titre, h) => '<div class="bk bkC ' + cls + '"><div class="bkt">' + titre + '</div>' + h + '</div>';
  const valRoute = async (body) => { let err = null; for (let n = 0; n < 4; n++) { try { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000); const rr = await fetch('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }); clearTimeout(to); if (rr.ok) return await rr.json(); err = new Error('http ' + rr.status); } catch (e) { err = e; } await new Promise(s => setTimeout(s, 1500 * (n + 1))); } throw err; };
  // V250 : tout le calcul du péage se fait dans un « worker » (second fil du téléphone) : l'écran ne peut plus se figer, même sur un téléphone lent.
  // V265 : gares de péage officielles (liste du ministère) dont nous n'avons aucun tarif : un trajet qui passe à moins de 500 m n'a pas de prix exact.
  // V279 (5 nov. 2026, audit complet contre data/gares-peage-officiel.json — data.gouv.fr, MTE 2025, 1266 points)
  // corrigé le même jour : l'audit initial comparait ces points au GPS connu (peages-aprr.json + peages-overlay.json
  // + UNK) mais avait OUBLIÉ de vérifier aussi contre overlay.barrieres (mécanisme séparé, cf. barrieresTraversees())
  // — ce qui avait fait ajouter ici, à tort, 11 points déjà correctement tarifés par ce mécanisme (Cluses Aval,
  // Dordives Est, Saint Witz, Nangy, BPV Nord Saugnacq-et-Muret, BPV Sud Castets, Gares de Saint Germain, Bouville,
  // Péage Pont Tancarville, Péage Pont Normandie, Puymorens A-PO) : les y laisser aurait BLOQUÉ à tort des trajets
  // déjà correctement calculés. Seuls 6 points restent de véritables angles morts (aucun tarif nulle part) : Audomarois
  // B (secteur Saint-Omer/A26, à 0,6-0,7 km de la gare tarifée « CALAIS » — au-delà du seuil de détection de barrière
  // 0,3 km, donc traité comme un point distinct), St Michel amont (A43), Fréjus Est (A8), Le Mans Ouest (A11),
  // Buchelay BPV et Dozulé BPV Nord (A13). Voir tests/peages-audit-officiel-data-gouv-gaps.test.cjs.
  // Recherche du 5 nov. 2026 (sources officielles SANEF, cf. tests/peages-buchelay-dozule-flux-libre.test.cjs) :
  // Buchelay et Dozulé ne sont PAS de simples angles morts temporaires -- les deux gares ont été démontées
  // (dépose de l'auvent/portique de péage classique) et remplacées par le péage « flux libre » (sans arrêt, sans
  // barrière physique, facturation par portique de détection sur la base du trajet complet). Ce mécanisme est
  // structurellement incompatible avec notre modèle (un montant fixe classe1/classe2 par point physique unique) :
  // aucun « prix barrière » classe1/classe2 n'existe plus à proprement parler à ces deux points. Le blocage par
  // UNK ("prix exact non disponible") n'est donc pas une lacune provisoire à combler mais la représentation
  // correcte et définitive pour ces deux points, tant que l'app ne modélise pas la tarification multi-portique.
  // Correction supplémentaire du 6 nov. 2026 (cf. tests/peages-unk-type-ech-vs-bpv.test.cjs) : le référentiel
  // officiel distingue deux types de points, champ « type » dans data/gares-peage-officiel.json — « Bpv »
  // (Barrière Pleine Voie, une vraie barrière de péage à tarif fixe, comme Buchelay/Dozulé ci-dessus) et « Ech »
  // (Échangeur, un simple point d'entrée/sortie SANS tarif propre — le prix dépend du couple entrée/sortie réel du
  // trajet, cf. le mécanisme « système ouvert » déjà en place pour Tarare Est/Dordives/Vallée de la Hem). Les 4
  // angles morts restants (Audomarois B, St Michel amont, Fréjus Est, Le Mans Ouest) sont TOUS de type « Ech », pas
  // « Bpv » : chercher un « tarif de barrière » pour eux était donc la mauvaise question. S'ils ont un prix, c'est
  // une relation point-à-point avec leur vraie destination/origine de trajet, à retrouver dans la grille officielle
  // complète de l'exploitant concerné (SFTRF pour St Michel/A43, ESCOTA pour Fréjus/A8, COFIROUTE pour Le Mans/A11,
  // SANEF pour Audomarois/A26) -- pas dans un simple tableau de tarifs agrégés trouvé par recherche web. En
  // attendant cette grille complète, UNK reste la représentation correcte (aucun prix inventé, aucune omission
  // silencieuse).
  // Résolu le 6 nov. 2026 (cf. tests/peages-frejus-est-escota.test.cjs) : « Fréjus Est » (A8) retiré de UNK.
  // Laurent a fourni localement la grille complète ESCOTA 2026 (A8/A52/A57/A50/A51) ; validée contre 123 relations
  // déjà PROUVE sans aucune divergence, elle donne FREJUS EST -> MANDELIEU = 3,0/4,7 € (relation PROUVE, à 17,6-
  // 18,0 km de Mandelieu et 1,16-1,23 km de « Frejus Ouest » -- au-delà des deux seuils de prudence, point distinct
  // confirmé). Ajouté à overlay.gares/overlay.paires. Les 3 autres angles morts (Audomarois B, St Michel amont, Le
  // Mans Ouest) restent dans UNK : la grille locale AREA confirme qu'aucun tarif séparé n'existe pour « St Michel
  // amont » (seules ST MICHEL MAURIENNE BAR/ECH, déjà connues, y figurent), et la grille locale SANEF confirme la
  // même absence pour « Audomarois B ». La grille locale COFIROUTE (réseau A11/A28/A85 complet, 722 Ko) confirme la
  // même absence pour « Le Mans Ouest » (seules LE MANS ZI NORD/SUD, CENTRE UNIVERSITÉ et SUD, toutes déjà connues,
  // y figurent). Les 3 restants ne sont donc pas des lacunes de recherche mais une absence CONFIRMÉE de tarif
  // publié à ces points (cohérent avec leur type « Ech ») : rien à chercher de plus, UNK reste définitivement
  // correct pour eux, à moins qu'une future grille officielle ne liste explicitement un tarif.
  // Ajouté le 7 nov. 2026 : « Ronai BPV » (A0088/A88, barrière pleine voie en système ouvert, sortie 12 à côté de
  // Nécy). Découvert en intégrant le réseau ALICORNE (voir tests/peages-alicorne-a88-falaise-sees.test.cjs) : la
  // grille tarifaire officielle ALICORNE 2026 reçue ne mentionne pas Rônai (seulement les 7 gares d'échangeur
  // Falaise Ouest/Falaise sud/Nécy/Argentan ouest/Argentan sud/Mortrée/Sées), donc aucun tarif n'est inventé pour
  // cette barrière distincte (à 0,9-1,3 km de Nécy, donc pas un doublon).
  // Nettoyage du 7 nov. 2026 (cf. tests/peages-unk-nettoyage-points-resolus.test.cjs) : 34 des 62 coordonnées
  // UNK ci-dessous correspondaient en réalité à des gares DEJA résolues (GPS + tarif(s) officiels ajoutés lors de
  // sessions antérieures ou de cette session même — Antibes, Cagnes-est, Cagnes-ouest, Nice St-Isidore, Cassis,
  // La Ciotat, Cannet-de-Meyreuil, COUDOUX, AIX-EN-PROVENCE, PUGET-VILLE, Carnoules, BANDOL, TOULOUSE-SUD/OUEST,
  // TONNAY-CHARENTE, CAPBRETON, BAYONNE NORD, BENESSE, BIRIATOU, Mansac Terrasson, Thenon Est, La Bachellerie,
  // ST-JEAN-LES-DEUX-JUMEAUX, Les Adrets, AURIOL, et les 5 barrières "système ouvert" Cofiroute Tours-Chambray-
  // Joué-lès-Tours-Monts-Sorigny-Neuillé-Pont-Pierre, sapn-chambourcy) : la source d'origine de ces 62 points
  // (audit data.gouv.fr du 5 nov. 2026, cf. commentaire ci-dessus) avait figé une photo à un instant T, mais le
  // tableau n'avait jamais été remis à jour au fur et à mesure que ces gares étaient résolues par la suite — un
  // bug silencieux : UNK bloque INCONDITIONNELLEMENT tout calcul de prix (V265, prixExact()) dès qu'un trajet
  // passe à moins de 0,5 km de l'une de ces coordonnées, même quand un tarif officiel existe désormais pour ce
  // point précis. Chaque coordonnée retirée a été vérifiée à moins de 0,15 km (très en dessous du seuil de
  // fusion jumelle 0,06 km pour la plupart, le reste restant largement en dessous du seuil barrière 0,3 km) du
  // point résolu correspondant, ET ce point possède au moins 1 relation tarifaire officielle déjà en base (1 à
  // 49 selon les cas) — jamais une estimation : seules des coordonnées réellement identiques au point déjà
  // prouvé ont été retirées. Les 28 coordonnées restantes n'ont aucune correspondance à moins de 0,2 km (plus
  // proche résidu : 0,207 km, un point clairement distinct) et restent donc des angles morts réels.
  // V291 : point UNK n°12 (échangeur A26 Châlons-Mourmelon, sur la voie principale) retiré : la gare CHALONS MOURMELON a 97 tarifs officiels en base ; système fermé, passer devant la sortie ne coûte rien.
  // V292 : point UNK (plaza de Saint-Arnoult, A10, entre La Folie-Bessin et Dourdan) retiré : son tarif (1,70 € / 4,10 €, 1er février 2026) est déjà la paire LA FOLIE-B/PARIS ↔ Dourdan en base ; les paires qui partent de La Folie (ex. Ablis 3,70 / 5,70) l'incluent.
  // V293 : les 2 points UNK de la barrière d'Antibes (A8) retirés : ils sont maintenant des points de la gare « Antibes » (overlay), qui a 32 paires officielles (Antibes ↔ Mandelieu 1,70 / 2,60, Cagnes-ouest 1,70 / 2,50, etc.).
  const UNK = [[43.64504,1.49789],[43.63298,-1.39072],[43.46097,-1.50276],[43.37197,-1.67746],[43.51232,-1.22256],[48.94757,3.04036],[43.14434,5.76838],[48.91342,2.16271],[48.91354,2.15809],[49.32195,0.30849],[43.20492,5.59053],[43.32435,5.59803],[43.64715,1.50769],[48.78189,2.15976],[48.8301,2.1485],[48.8714,2.15683],[50.72292,2.16534],[50.7231,2.16714],[45.21646,6.46587],[47.98195,0.05435],[48.98384,1.68125],[49.23071,-0.07124],[48.8162,-0.12907],[48.81622,-0.12936]];
  let WK = null, WKID = 0; const WKATT = new Map();
  const CODE_WORKER = () => 'const UNK=' + JSON.stringify(UNK) + ';const dist=' + dist + ';const joli=' + joli + ';const gareProche=' + gareProche + ';const prixExact=' + prixExact + ';const garesTraversees=' + garesTraversees + ';' +
    'let P=null;const charger=async base=>{const j=await (await fetch(base+"peages-aprr.json")).json();const prix=new Map();for(const s of j.p.split(";")){const [a,b,c1,c2,d]=s.split(",");const x=parseInt(a,36),y=parseInt(b,36);prix.set(Math.min(x,y)*1000+Math.max(x,y),[c1/10,c2/10,Number(d)]);}' +
    'const CORR={"ST MARTIN BELLEVUE A41 N":[[46.1293,6.0978],[46.1318,6.1]]};j.g.forEach(g=>{if(CORR[g[0]])g[1]=CORR[g[0]];});const Q={g:j.g,prix,v:j.v};' +
    'try{const o=await (await fetch(base+"peages-overlay.json")).json();for(const n of (o.gares||[])){{const e=Q.g.find(g=>g[0]===n.nom);if(!e)Q.g.push([n.nom,n.points]);else if(n.ajout)e[1]=e[1].concat(n.ajout);}}const ix=nom=>Q.g.findIndex(g=>g[0]===nom);for(const q of (o.paires||[])){const x=ix(q[0]),y=ix(q[1]);const k=Math.min(x,y)*1000+Math.max(x,y);if(x>=0&&y>=0&&!prix.has(k))prix.set(k,[q[2],q[3],q[4]]);}}catch(_){}return Q;};' +
    'onmessage=async e=>{const m=e.data;try{if(!P)P=await charger(m.base);const x=prixExact(P,m.sh,m.tms,0);const n=garesTraversees(P,m.sh,m.i0,m.i1);const h=[];if(m.hits){let der=-2;for(let k=m.i0;k<=m.i1;k++){const g=gareProche(P,m.sh[k][0],m.sh[k][1],0.4);if(g>=0&&g!==der){h.push([m.sh[k][0],m.sh[k][1],P.g[g][0]]);der=g;}}}postMessage({id:m.id,x,n,v:P.v,h,part:P.partiel});}catch(err){postMessage({id:m.id,err:String(err)});}};';
  const calculPeage = async (sh, tms, km, hits) => {
    const i0 = tms[0].begin_shape_index, i1 = tms[tms.length - 1].end_shape_index;
    try {
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined') throw new Error('pas de worker');
      if (!WK) { WK = new Worker(URL.createObjectURL(new Blob([CODE_WORKER()], { type: 'text/javascript' }))); WK.onmessage = e => { const f = WKATT.get(e.data.id); if (f) { WKATT.delete(e.data.id); e.data.err ? f.ko(new Error(e.data.err)) : f.ok(e.data); } }; WK.onerror = () => { const l = [...WKATT.values()]; WKATT.clear(); WK = null; l.forEach(f => f.ko(new Error('worker'))); }; }
      return await new Promise((ok, ko) => { const id = ++WKID; WKATT.set(id, { ok, ko }); setTimeout(() => { if (WKATT.has(id)) { WKATT.delete(id); ko(new Error('délai')); } }, 40000); WK.postMessage({ id, hits: !!hits, base: new URL('.', location.href).href, sh, tms: [{ begin_shape_index: tms[0].begin_shape_index, end_shape_index: tms[0].end_shape_index }, { begin_shape_index: tms[tms.length - 1].begin_shape_index, end_shape_index: tms[tms.length - 1].end_shape_index }], i0, i1 }); });
    } catch (_) {
      const P = await chargerPeages();   // secours : calcul direct (ancienne méthode)
      const xx = prixExact(P, sh, tms, km); return { x: xx, n: garesTraversees(P, sh, i0, i1), v: P.v, part: P.partiel };
    }
  };
  const estimerPeage = async (r, out) => {
    window.CPPh('péage');
    const zone = out.querySelector('[data-peage]');
    let suisse = false;
    const put = (h, ok) => { if (!zone) return; let hh = h; if (suisse) { const h2 = h.replace(/(<div class="rd gros c2">[\s\S]*?<\/div>)/, '$1' + NOTE_CH); hh = h2 !== h ? h2 : h + NOTE_CH; } zone.innerHTML = hh; LAY('péage'); };   // V290 : liseret vert/rouge à gauche de « Avec péage » supprimé
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
      let sh, tms, km = 0, viaGoogle = false, PARTV = null;
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
        const IT = viaGoogle ? null : italie(sh, tms);
        PARTV = R.part || null;
        window.CPT('calcul péage' + (viaGoogle ? ' (Google)' : ''), tC);
        const O = await chargerOverlay();
        const i0 = tms[0].begin_shape_index, i1 = tms[tms.length - 1].end_shape_index;
        const bar = O ? barrieresTraversees(O, sh, i0, i1) : [];
        if (x && x.ouv && x.ouv.length && !x.ouv.every(n => bar.some(v => v.id === 'aprr-area-ouvert-' + n))) { const ap = viaGoogle ? '' : approx(sh, tms, km, PARTV); put(ap || KO, false); return; }   // V265 : barrière à tarif fixe vue par les gares mais pas par le moteur de barrières : on ne devine pas
        if (bar.length) {
          const auj = new Date().toISOString().slice(0, 10), pas = bar.map((v, n) => ({ type: 'barriere', station: v.id, group: v.id, passage: n }));
          const t1 = O.m.trajet(pas, 1, auj), t2 = O.m.trajet(pas, 2, auj);
          const noms = bar.map(v => joli(v.id.replace(/-/g, ' '))).join(', ');
          const legOk = !!(x && x.reste < 3);
          if (t1.complet && t2.complet && (legOk || R.n === 0)) {
            const r2 = n => Math.round(n * 100) / 100;
            const c1 = r2((legOk ? x.c1 : 0) + t1.total + (IT ? IT.c1 : 0)), c2 = r2((legOk ? x.c2 : 0) + t2.total + (IT ? IT.c2 : 0));
            const croise = t1.status !== 'PROUVE' || t2.status !== 'PROUVE';
            put('<div class="rd gros c1"><span>Classe 1</span><b>' + (IT ? '≈ ' : '') + euro(c1) + '</b></div><div class="rd gros c2"><span>Classe 2</span><b>' + (IT ? '≈ ' : '') + euro(c2) + '</b></div>' + itNote(IT, r2(c1 - (IT ? IT.c1 : 0)), r2(c2 - (IT ? IT.c2 : 0))) + '<div class="rd sub"><span>' + (legOk ? x.det + ' + ' : '') + 'barrière(s) : ' + noms + '</span></div><div class="rd sub"><span>Source : tarifs officiels 2026' + (croise ? ' (relecture en cours, à vérifier)' : '') + '</span></div>', !IT);
            return;
          }
          { const ap = viaGoogle ? '' : approx(sh, tms, km, PARTV, (t1.complet && t2.complet) ? { c1: t1.total, c2: t2.total, noms } : null); if (ap) { put(ap, false); return; } } put('💶 <b>Prix exact non disponible</b> pour ce trajet.<div class="rd sub"><span>Barrière(s) détectée(s) : ' + noms + '. Un tarif officiel manque : aucun total n’est affiché.</span></div>', false);
          return;
        }
        if (x && x.reste < 3) {
          put('<div class="rd gros c1"><span>Classe 1</span><b>' + (IT ? '≈ ' + euro(Math.round((x.c1 + IT.c1) * 10) / 10) : euro(x.c1)) + '</b></div><div class="rd gros c2"><span>Classe 2</span><b>' + (IT ? '≈ ' + euro(Math.round((x.c2 + IT.c2) * 10) / 10) : euro(x.c2)) + '</b></div>' + itNote(IT, x.c1, x.c2) + '<div class="rd sub"><span>' + x.det + '</span></div><div class="rd sub"><span>Source (tarifs officiels, dates de mise à jour) : ' + R.v + '</span></div>', !IT);
          return;
        }
      } catch (_) { /* pas de prix officiel exact trouvé : KO plus bas, jamais d'estimation */ }
      if (viaGoogle && r.toll && r.toll.status === 'aucun_peage') { put('💶 <b>Aucun péage</b> sur ce trajet : le trajet le plus rapide est déjà sans péage.', true); const sp = out.querySelector('.bkSans'); if (sp) sp.remove(); return; }
      put(viaGoogle ? KO : (approx(sh, tms, km, PARTV) || KO), false);
    } catch (_) { put('⚠️ <b>Calcul du péage impossible pour l’instant</b> : le serveur de tracé ne répond pas.<div class="rd sub"><span>Ce n’est pas un prix inconnu. Vérifie ta connexion (wifi/4G) puis appuie de nouveau sur « Voiture et péages ».</span></div>', false); }
  };
  // V263 : trajet mixte (une partie sans péage, une partie avec péage) : on coupe le trajet à une gare, on demande à Google les deux moitiés (rapide / sans péage) et on garde la combinaison la moins chère (prix exact officiel) avec peu de temps en plus.
  const dens = A => { const sh = [[A[0][1], A[0][0]]]; for (let q = 1; q < A.length; q++) { const p0 = sh[sh.length - 1], p1 = [A[q][1], A[q][0]], n = Math.ceil(dist(p0[0], p0[1], p1[0], p1[1]) / 0.15); for (let u = 1; u < n; u++) sh.push([p0[0] + (p1[0] - p0[0]) * u / n, p0[1] + (p1[1] - p0[1]) * u / n]); sh.push(p1); } return sh; };
  const prixTroncon = async poly => { try { if (!poly) return null; const sh = dens(decode(poly)); const R = await calculPeage(sh, [{ begin_shape_index: 0, end_shape_index: sh.length - 1 }], 100, true); const O = await chargerOverlay(); if (O) { const bar = barrieresTraversees(O, sh, 0, sh.length - 1); if (bar.length) { const auj = new Date().toISOString().slice(0, 10), pas = bar.map((q, k) => ({ type: 'barriere', station: q.id, group: q.id, passage: k })); const t1 = O.m.trajet(pas, 1, auj), t2 = O.m.trajet(pas, 2, auj); const legOk = !!(R.x && R.x.reste < 3); if (t1.complet && t2.complet && (legOk || R.n === 0)) { const r2 = z => Math.round(z * 100) / 100; return { x: { c1: r2((legOk ? R.x.c1 : 0) + t1.total), c2: r2((legOk ? R.x.c2 : 0) + t2.total) }, h: R.h || [] }; } return { x: null, h: R.h || [] }; } } if (R.x && R.x.reste < 3) return { x: R.x, h: R.h || [] }; const V = R.part; let kk = 0, s = 0, n = 0; for (let k = 1; k < sh.length; k++) kk += dist(sh[k - 1][0], sh[k - 1][1], sh[k][0], sh[k][1]); const pas = Math.max(1, Math.floor(sh.length / 25)); for (let k = 0; k < sh.length; k += pas) { const r = TAUX_KM[Math.floor(sh[k][0]) + ',' + Math.floor(sh[k][1])]; s += r !== undefined ? r : 0.105; n++; } if (!n || kk < 1) return { x: null, h: R.h || [] }; const vk = V && V.km > 0 ? Math.min(V.km, kk) : 0, m1 = (kk - vk) * s / n; return { x: { c1: Math.round(((V ? V.c1 : 0) + m1) * 10) / 10, c2: Math.round(((V ? V.c2 : 0) + m1 * 1.85) * 10) / 10, approx: true }, h: R.h || [] }; } catch (_) { return null; } };   // V297 : le trajet mixte accepte une estimation ≈ quand le prix exact manque
  const nomLieu = async (la, lo) => { try { const j = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=fr&lat=' + la + '&lon=' + lo).then(x => x.json()); const a = j.address || {}; return a.city || a.town || a.village || a.municipality || a.county || null; } catch (_) { return null; } };
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const chercherMixte = async (r, target) => {
    const zone = target.querySelector('[data-mixte]'); if (!zone) return;
    const ko = t => { zone.innerHTML = '<div class="doux">' + t + '</div>'; };
    const B = window.__cpMix;
    if (!B) { ko('Relance « Voiture et péages » puis réessaie.'); return; }
    zone.innerHTML = '<div class="doux">🟣 Recherche du meilleur trajet mixte…</div>';
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
      const ok = cands.filter(c => c.x && c.lib.min != null && c.pay.min != null).map(c => Object.assign(c, { km: c.lib.km + c.pay.km, min: c.lib.min + c.pay.min, c1: c.x.c1, c2: c.x.c2 })).filter(c => fast.c1 - c.c1 >= ((pf.x.approx || c.x.approx) ? 6 : 1));   // V297 : estimation = marge plus grande
      ok.forEach(c => { c.score = (fast.c1 - c.c1) - 0.2 * Math.max(0, c.min - fast.min); });
      ok.sort((a, b) => b.score - a.score);
      const best = ok[0];
if (best && Math.abs(best.km - fast.km) <= Math.max(1, fast.km * 0.01) && Math.abs(best.min - fast.min) <= 2) { ko('Pas de trajet mixte distinct : le trajet rapide de Google passe déjà par la route gratuite sur ce tronçon (même distance, même durée, mêmes tracés). Le prix « avec péage » vient du calcul des gares : il peut être plus élevé que ce que ce trajet coûte vraiment.'); return; } // V300 : un trajet mixte identique au trajet rapide n’est pas un vrai trajet mixte
      if (!best || best.score < 0.5) { ko('Aucun trajet mixte intéressant : le trajet rapide reste le meilleur compromis (ou le prix exact d’une partie n’est pas disponible).'); return; }
      const dep = typeof B.origin === 'string' ? B.origin : 'départ', arr = typeof B.destination === 'string' ? B.destination : 'arrivée';
      const piv = (await nomLieu(best.p.lat, best.p.lng)) || 'point intermédiaire';
      const pts = best.ordre === 'FT' ? decode(best.lib.poly).concat(decode(best.pay.poly)) : decode(best.pay.poly).concat(decode(best.lib.poly));
      r.mixte = { pts };
      const tmp = document.createElement('div'); tmp.innerHTML = carte(r);
      const m0 = target.children[0], m1 = target.children[1];
      if (m0 && m1 && m0.querySelector('svg') && tmp.children.length >= 2) { target.replaceChild(tmp.children[0], m0); target.replaceChild(tmp.children[0], m1); }
      const k1 = n => Math.round(n * 10) / 10;
      const AP = (pf.x.approx || best.x.approx) ? '≈ ' : '';
      const P12 = (x1, x2) => '<span class="pc1">Cl. 1 : ' + AP + euro(x1) + '</span> · <span class="pc2">Cl. 2 : ' + AP + euro(x2) + '</span>';
      const ligL = (de, a) => '🟢 <b>SANS PÉAGE</b> ' + esc(de) + ' → ' + esc(a) + '<br>' + k1(best.lib.km) + ' km · ' + hm(best.lib.min);
      const ligP = (de, a) => '🔵 <b>AVEC PÉAGE</b> ' + esc(de) + ' → ' + esc(a) + '<br>' + k1(best.pay.km) + ' km · ' + hm(best.pay.min) + '<br>' + P12(best.c1, best.c2);
      const dmin = best.min - fast.min, eco1 = Math.round((fast.c1 - best.c1) * 100) / 100, eco2 = Math.round((fast.c2 - best.c2) * 100) / 100;
      const sg = v => (v >= 0 ? '−' : '+') + euro(Math.abs(v));
      const gros = '<div class="mixGros"><span class="mixPlus">⏱️ ' + (dmin >= 0 ? '+' : '−') + (Math.abs(dmin) >= 60 ? Math.floor(Math.abs(dmin) / 60) + (Math.abs(dmin) >= 120 ? ' heures' : ' heure') + (Math.abs(dmin) % 60 ? ' ' + (Math.abs(dmin) % 60) : '') : Math.abs(dmin) + ' min') + ' par rapport au trajet avec péage</span><span class="mixEco">💰 ' + sg(eco1) + ' (cl. 1) · ' + sg(eco2) + ' (cl. 2) par rapport au trajet avec péage</span></div>';
      const chOf = p => { try { return !!p && passeEnSuisse(dens(decode(p))); } catch (_) { return false; } }; const noteMix = (chOf(best.lib.poly) || chOf(best.pay.poly)) ? NOTE_CH : '';
      const corps = (best.ordre === 'FT' ? ligL(dep, piv) + '<br><br>' + ligP(piv, arr) : ligP(dep, piv) + '<br><br>' + ligL(piv, arr)) + '<br><br><b>TOTAL MIXTE</b> : ' + k1(best.km) + ' km · ' + hm(best.min) + '<br>' + P12(best.c1, best.c2) + noteMix + etqs(etqConso(best.km, best.min)) + gros + '<span class="doux">Prix : tarifs officiels. Distance et durée : Google Routes, à vérifier avant départ.</span>';
      zone.innerHTML = BK('bkMixte', 'TRAJET MIXTE', corps);
    } catch (e) { ko('Trajet mixte indisponible pour l’instant (' + esc(String(e && e.message || e).slice(0, 80)) + ').'); }
  };
  // V267 : consommation moyenne, écarts du trajet sans péage, liens véhicule électrique
  const CONSO_DEF = { petite: 5.0, moyenne: 5.6, routiere: 6.2, sport: 8.0, utilitaire: 7.5 };
  // V276 : modèle voisin ADEME quand le modèle exact n'est pas dans la base (ex. 5008 → 3008)
  const VOISIN = { '5008': '3008', 'partner': 'rifter', 'berlingo': 'rifter', 'expert': 'traveller', '5008 ii': '3008', 'c5 aircross': '3008' };
  const PRIX_DEF = { gazole: 2.36, essence: 2.14 };
  // V275 : plus de réglages carburant / consommation : consommation = ADEME ; prix = moyenne nationale officielle (data.economie.gouv.fr, flux instantané des stations), actualisée toutes les 6 h
  const lireConso = () => { let p = Object.assign({}, PRIX_DEF); try { const j = JSON.parse(localStorage.getItem('cp_prix_carb') || 'null'); if (j && j.gazole > 0 && j.essence > 0) p = { gazole: j.gazole, essence: j.essence }; } catch (_) {} return { c: Object.assign({}, CONSO_DEF), p }; };
  const PRIX_URL = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?select=' + encodeURIComponent('avg(gazole_prix) as gazole, avg(e10_prix) as e10, count(*) as n') + '&limit=1';
  let prixEnCours = false;
  const prixMaj = async () => { try { const j = JSON.parse(localStorage.getItem('cp_prix_carb') || 'null'); if (j && Date.now() - j.t < 6 * 3600000) return; } catch (_) {} if (prixEnCours) return; prixEnCours = true; try { const r = await fetch(PRIX_URL); if (!r.ok) throw new Error('prix'); const x = ((await r.json()).results || [])[0]; if (x && x.gazole > 1 && x.gazole < 4 && x.e10 > 1 && x.e10 < 4 && x.n > 1000) { localStorage.setItem('cp_prix_carb', JSON.stringify({ gazole: Math.round(x.gazole * 1000) / 1000, essence: Math.round(x.e10 * 1000) / 1000, t: Date.now() })); majConso(); } } catch (_) { /* hors ligne : on garde le dernier prix connu */ } finally { prixEnCours = false; } };
  const sansAcc = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const CAT = [
    ['utilitaire', /master|transit|trafic|boxer|jumper|ducato|sprinter|vito|kangoo|partner|berlingo|expert|jumpy|movano|crafter|daily|fourgon|utilitaire|camion|doblo|combo|caddy|talento|vivaro|proace|nv ?200|nv ?300/],
    ['sport', /bmw|mercedes|audi|porsche|jaguar|maserati|alpine|lexus|\bamg\b|cupra|ferrari|lamborghini|\bgti\b/],
    ['routiere', /5008|espace|3008|\b508\b|\bc5\b|talisman|passat|superb|kodiaq|tiguan|touran|sharan|galaxy|koleos|austral|kuga|ds ?7|rav4|sportage|tucson|santa ?fe|scenic xmod|grand scenic|grand c4|zafira|vel satis|safrane/],
    ['petite', /twingo|yaris|\b10[78]\b|\bc1\b|aygo|\bup\b|fiat 500|\b500\b|panda|picanto|\bi10\b|sandero|spark|\bmii\b|citigo|\bka\b|smart|mini one/],
    ['moyenne', /clio|scenic|golf|\b208\b|\b308\b|megane|polo|focus|corsa|astra|\bc3\b|\bc4\b|leon|ibiza|fiesta|captur|2008|kadjar|juke|qashqai|duster|\bi20\b|\bi30\b|ceed|\brio\b|fabia|octavia|arkana|taigo|t-?roc|puma|kamiq|yaris cross|c-?hr|megane|cooper|swift|vitara|tipo|bipper|punto/]
  ];
  const vehDom = () => { try { const b = [...document.querySelectorAll('.bkVeh')].pop(); if (!b) return null; const ds = b.querySelectorAll('div'); const ty = (ds[1] ? ds[1].textContent : '').replace('🚗', '').trim(); const en = (b.querySelector('.ve') ? b.querySelector('.ve').textContent : '').replace(/^[^:]*:\s*/, '').trim(); if (!ty || /^inconnu$/i.test(ty)) return null; const p = ty.split(/\s·\s/); return p.length > 1 ? { category: p[0], model: p[1], energy: en } : { model: p[0], energy: en }; } catch (_) { return null; } };
  const vehiculeConso = () => { try { let v = vehDom(); if (!v) { const m = missionActive(); if (!m || !m.vehicle) return null; v = m.vehicle; } if (typeof v === 'string' && v.trim().charAt(0) === '{') { try { v = JSON.parse(v); } catch (_) {} } const txt = sansAcc(typeof v === 'object' ? [v.category, v.type, v.model, v.brand, v.make, v.name, v.label].filter(Boolean).join(' ') : v); const en = sansAcc(typeof v === 'object' ? v.energy : ''); let cat = null; for (const [k, re] of CAT) if (re.test(txt)) { cat = k; break; } if (!cat) for (const [k, re] of [['petite', /citadine|mini|city/], ['moyenne', /berline|compacte|break|polyvalente/], ['routiere', /suv|monospace|routiere|crossover|4x4/]]) if (re.test(txt)) { cat = k; break; } const mdl = sansAcc(typeof v === 'object' ? v.model : String(v)).toUpperCase().replace(/[^A-Z0-9+ -]/g, ' ').replace(/\s+/g, ' ').trim(); const tk = mdl.split(' ').filter(Boolean); const mod = tk.filter(w => !/^(NOUVEAU|NOUVELLE|NEW|II|III)$/.test(w))[0] || ''; const mod2 = tk.length > 1 && /^[A-Z]/.test(tk[1]) && !/HYBRID|HDI|TCE|DCI|TDI|TSI|PURETECH|BLUE|ESSENCE|DIESEL/.test(tk[1]) ? mod + ' ' + tk[1] : ''; const chm = (' ' + mdl + ' ').match(/ (\d{2,3}) /g) || []; const ch = chm.map(x => Number(x)).filter(n => n >= 50 && n <= 450 && String(n) !== mod)[0] || 0; const nrj = /hybrid/.test(en) ? (/non|hnr/.test(en) ? 'HNR' : 'HR') : /diesel|gazole|gasoil/.test(en) ? 'GAZOLE' : /essence|ther|gasoline|petrol/.test(en) ? 'ESSENCE' : ''; return { cat, en, mod, mod2, ch, nrj, ev: /electri|\bev\b|\bbev\b/.test(en) && !/hybrid/.test(en) }; } catch (_) { return null; } };
  const sgn = (v, u) => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 10) / 10).toLocaleString('fr-FR') + ' ' + u;
  const sgnMin = v => (v >= 0 ? '+' : '−') + (Math.abs(v) >= 60 ? hm(Math.abs(v)) : Math.abs(v) + ' min');
  const ADK = 'cp_ademe3', ADU = 'https://data.ademe.fr/data-fair/api/v1/datasets/ademe-car-labelling/lines?size=200&select=Energie,Conso_vitesse_mixte_Min,Conso_vitesse_mixte_Max,Conso_basse_vitesse_Min,Conso_basse_vitesse_Max,Conso_moyenne_vitesse_Min,Conso_moyenne_vitesse_Max,Conso_haute_vitesse_Min,Conso_haute_vitesse_Max,Conso_T-haute_vitesse_Min,Conso_T-haute_vitesse_Max,Puissance_maximale&qs=';
  const ademeLire = () => { try { return JSON.parse(localStorage.getItem(ADK) || '{}') || {}; } catch (_) { return {}; } };
  const ademeCle = V => [V.mod, V.mod2, V.nrj, V.ch].join('|');
  const ademeEnCours = {};
  const txtConso = (km, mn) => {
    const V = window.__cpMix && window.__cpMix.veh; if (!V || V.ev || !Number.isFinite(km)) return '';
    const C = lireConso(); const A = ademeLire()[ademeCle(V)]; let l100 = 0, gaz = /diesel|gazole|gasoil/.test(V.en), moy = false;
    if (A && A.l > 0) {
      l100 = A.l; gaz = A.e === 'gazole'; moy = A.e === 'moy';
      // V274 : la consommation dépend de la vitesse moyenne du trajet (autoroute = plus de carburant que la route de montagne)
      const pts = [[19, A.b], [39.5, A.m], [56.5, A.h], [92, A.t]].filter(p => p[1] > 0);
      if (mn > 0 && pts.length >= 2) { const v = km / (mn / 60); if (v <= pts[0][0]) l100 = pts[0][1]; else if (v >= pts[pts.length - 1][0]) l100 = pts[pts.length - 1][1]; else for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; l100 = a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); break; } }
      l100 *= 1.1; // V276 : +10 % entre le cycle WLTP de laboratoire et la conduite réelle
    } else { if (!V.cat) return ''; l100 = Number(C.c[V.cat]); if (/hybrid/.test(V.en)) l100 *= 0.8;
      if (mn > 0) { const pts = [[19, 1.28], [39.5, 0.975], [56.5, 0.865], [92, 1.03]], v = km / (mn / 60); let f = pts[pts.length - 1][1]; if (v <= pts[0][0]) f = pts[0][1]; else if (v < pts[pts.length - 1][0]) for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; f = a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); break; } l100 *= f; } moy = !gaz && !/essence|gasoline|petrol|hybrid|ther/.test(V.en); }
    if (!(l100 > 0)) return ''; const prix = moy ? (Number(C.p.gazole) + Number(C.p.essence)) / 2 : (gaz ? Number(C.p.gazole) : Number(C.p.essence)); if (!(prix > 0)) return '';
    const L = km * l100 / 100; return (moy ? '⛽ ≈ ' : '⛽ ') + (Math.round(L * 10) / 10).toLocaleString('fr-FR') + ' L · ' + euro(L * prix);
  };
  const majConso = () => { document.querySelectorAll('.etqC[data-ckm]').forEach(s => { const x = txtConso(Number(s.dataset.ckm), Number(s.dataset.cmin)); s.textContent = x; s.style.display = x ? '' : 'none'; }); };
  const ademeCharger = async V => {
    const k = ademeCle(V); if (!V.mod || ademeEnCours[k] || ademeLire()[k] !== undefined) return; ademeEnCours[k] = 1;
    try {
      let rows = [];
      for (const m of [V.mod2, V.mod, VOISIN[String(V.mod || '').toLowerCase()]].filter(Boolean)) { const r = await fetch(ADU + encodeURIComponent('Modèle:"' + m + '"')); if (!r.ok) throw new Error('ademe'); rows = (await r.json()).results || []; if (rows.length) break; }
      rows = rows.filter(x => !/^ELECTRIC/.test(x.Energie || '') && Number.isFinite(x.Conso_vitesse_mixte_Min));
      const f = { HNR: /HNR/, HR: /HR/, GAZOLE: /^GAZOLE$/, ESSENCE: /^ESSENCE$/ }[V.nrj]; let fk = 1; if (f) { const tous = rows; rows = rows.filter(x => f.test(x.Energie || '')); if (!rows.length && (V.nrj === 'HNR' || V.nrj === 'HR')) { rows = tous.filter(x => /^ESSENCE$/.test(x.Energie || '')); fk = 0.9; } }
      if (V.ch && rows.length > 1) { const kw = V.ch * 0.7355, p = rows.filter(x => Math.abs((x.Puissance_maximale || 0) - kw) <= kw * 0.15); if (p.length) rows = p; }
      const c = ademeLire();
      if (rows.length) {
        // V274 : consommation ADEME par phase (urbain / route / autoroute) : valeur choisie ensuite selon la vitesse moyenne du trajet ; énergie inconnue = moyenne essence + gazole
        const moy = (rs, nom) => { const v = rs.map(x => { const a = x['Conso_' + nom + '_Min'], b = x['Conso_' + nom + '_Max']; return Number.isFinite(a) ? (Number.isFinite(b) ? (a + b) / 2 : a) : null; }).filter(n => n !== null); return v.length ? v.reduce((s, n) => s + n, 0) / v.length : null; };
        const ph = rs => ({ mix: moy(rs, 'vitesse_mixte'), b: moy(rs, 'basse_vitesse'), m: moy(rs, 'moyenne_vitesse'), h: moy(rs, 'haute_vitesse'), t: moy(rs, 'T-haute_vitesse') });
        const gz = rows.filter(x => /GAZOLE/.test(x.Energie || '')), es = rows.filter(x => !/GAZOLE/.test(x.Energie || ''));
        let P, en;
        if (gz.length && es.length) { const a = ph(gz), b = ph(es); P = {}; for (const q of Object.keys(a)) P[q] = (a[q] !== null && b[q] !== null) ? (a[q] + b[q]) / 2 : (a[q] !== null ? a[q] : b[q]); en = 'moy'; } else { P = ph(rows); en = gz.length ? 'gazole' : 'essence'; }
        if (P.mix > 0) { const o = { l: Math.round(P.mix * 1.15 * fk * 100) / 100, e: en }; for (const q of ['b', 'm', 'h', 't']) if (P[q] > 0) o[q] = Math.round(P[q] * 1.15 * fk * 100) / 100; c[k] = o; } else c[k] = { l: 0 };
      } else c[k] = { l: 0 };
      try { localStorage.setItem(ADK, JSON.stringify(c)); } catch (_) {}
      majConso();
    } catch (_) { /* hors ligne : on garde la valeur par défaut */ } finally { delete ademeEnCours[k]; }
  };
  const etqConso = (km, mn) => { const V = window.__cpMix && window.__cpMix.veh; if (!V || V.ev || !Number.isFinite(km)) return ''; ademeCharger(V); prixMaj(); const x = txtConso(km, mn); return '<span class="etq etqC" data-ckm="' + km + '" data-cmin="' + (Number.isFinite(mn) ? mn : '') + '"' + (x ? '' : ' style="display:none"') + '>' + x + '</span>'; };
  const evLiens = () => { const V = window.__cpMix && window.__cpMix.veh; if (!V || !V.ev) return ''; return '<a class="etq etqE" href="https://abetterrouteplanner.com/" target="_blank" rel="noopener">⚡ ABRP</a><a class="etq etqE" href="https://fr.chargemap.com/" target="_blank" rel="noopener">🗺️ Chargemap</a><a class="etq etqE" href="https://www.miio.pt/fr" target="_blank" rel="noopener">🔌 Miio</a>'; };
  const etqs = h => h ? '<div class="etqs">' + h + '</div>' : '';
  const tagsRapide = r => etqs(etqConso(r.distanceKm, r.durationMinutes) + evLiens());
  const tagsSans = r => { const sp = r.sansPeage; if (!sp || !Number.isFinite(sp.distanceKm) || !Number.isFinite(r.distanceKm)) return ''; return etqs('<span class="etq etqK">' + sgn(sp.distanceKm - r.distanceKm, 'km') + '</span><span class="etq etqT">' + sgnMin(sp.durationMinutes - r.durationMinutes) + '</span>' + etqConso(sp.distanceKm, sp.durationMinutes)); };
  const addConsoReglages = () => {
    const ec = document.getElementById('ecran'); if (!ec || ec.dataset.vue !== 'reglages' || document.getElementById('consoReg')) return;
    const C = lireConso(), d = document.createElement('div'); d.id = 'consoReg'; d.className = 'carte';
    const L = [['petite', 'Petite voiture (Twingo, Yaris…)'], ['moyenne', 'Voiture de taille moyenne (Clio, Scénic, Golf…)'], ['routiere', 'Véhicule routier (5008, Espace…)'], ['sport', 'Véhicule sport (BMW, Mercedes, Audi Sport…)'], ['utilitaire', 'Utilitaire fourgon (Master, Transit…)']];
    d.innerHTML = '<b>⛽ Consommation moyenne aux 100 km</b><p class="doux">Valeurs de départ : moyennes constatées en conduite réelle (autoroute et route), à ajuster. Elles servent à estimer litres et coût sur chaque trajet quand le modèle du véhicule est reconnu.</p>' + L.map(([k, t]) => '<label>' + t + '</label><input type="number" step="0.1" min="2" max="30" inputmode="decimal" data-conso="' + k + '" value="' + C.c[k] + '"> <span class="doux">L/100 km</span>').join('') + '<label>Prix du gazole (€/L)</label><input type="number" step="0.01" min="0.5" max="5" inputmode="decimal" data-prix="gazole" value="' + C.p.gazole + '"><label>Prix de l’essence SP95-E10 (€/L)</label><input type="number" step="0.01" min="0.5" max="5" inputmode="decimal" data-prix="essence" value="' + C.p.essence + '"><p class="doux">Prix moyens nationaux au 3 octobre 2026 : gazole 2,363 €, SP95-E10 2,144 € (prix-carburant.eu).</p><button type="button" data-conso-reset>Remettre les valeurs de départ</button>';
    ec.appendChild(d);
    const sauver = () => { const j = { c: {}, p: {} }; d.querySelectorAll('[data-conso]').forEach(i => { const v = Number(String(i.value).replace(',', '.')); if (v > 0) j.c[i.dataset.conso] = v; }); d.querySelectorAll('[data-prix]').forEach(i => { const v = Number(String(i.value).replace(',', '.')); if (v > 0) j.p[i.dataset.prix] = v; }); try { localStorage.setItem('cp_conso', JSON.stringify(j)); } catch (_) { } };
    d.addEventListener('change', sauver);
    d.querySelector('[data-conso-reset]').onclick = () => { try { localStorage.removeItem('cp_conso'); } catch (_) { } d.remove(); addConsoReglages(); };
  };
  const render = (target, r, mode) => {
    const prix = mode === 'DRIVE' ? r.toll : r.fare;
    const libelle = mode === 'DRIVE' ? 'Péage' : 'Transport';
    const p = prix.status === 'aucun_peage' ? 'aucun' : (mode === 'DRIVE' && (prix.status === 'prix_inconnu' || prix.status === 'estimation')) ? 'oui (prix exact ci-dessous si disponible)' : 'non disponible';
    const kmH = '🛣 <b>' + (r.distanceKm ?? '—') + ' km</b>' + '<br>⏱️ <b>' + hm(r.durationMinutes) + '</b>';
    const info = mode === 'DRIVE'
      ? BK('bkKm', 'TRAJET LE PLUS RAPIDE', kmH + tagsRapide(r)) + BK('bkAvec', 'AVEC PÉAGE', '<div data-peage>' + (prix.status === 'aucun_peage' ? '💶 <b>Aucun péage</b> sur ce trajet.' : '💶 Calcul du prix exact…') + '</div>') + (r.sansPeage && prix.status !== 'aucun_peage' ? BK('bkSans', 'SANS PÉAGE', '🛣 <b>' + (r.sansPeage.distanceKm ?? '—') + ' km</b><br>⏱️ <b>' + hm(r.sansPeage.durationMinutes) + '</b>' + tagsSans(r)) : '') + (prix.status !== 'aucun_peage' && r.sansPeage ? '<div data-mixte><div class="doux">🟣 Recherche du trajet mixte moins cher…</div></div>' : '') + '<p class="doux" style="font-size:.8rem">Distance et durée : Google Routes, à vérifier avant départ.</p>'
      : '<p class="doux" style="font-size:.75rem;margin:6px 0 2px">Calculé par Google Routes en mode transports en commun.</p>' + BK('bkKm', 'TRANSPORTS EN COMMUN', kmH) + BK('bkRen', 'PRIX', '🎟️ Le prix sera détaillé quand le calcul des prix SNCF et des autres transports sera activé.') + '<p class="doux" style="font-size:.8rem">Horaires et prix à vérifier sur le site du transporteur (liens ci-dessous).</p>';
    target.innerHTML = info; LAY('résultat');   // V186 : la carte et les villes passent avant les lignes d’infos
    if (mode === 'DRIVE' && r.polyline) { try { target.innerHTML = carte(r) + (target.dataset.villes ? BK('bkLieu', 'ITINÉRAIRE', target.dataset.villes) : '') + info; } catch (_) { target.innerHTML = info; } estimerPeage(r, target).then(() => setTimeout(() => chercherMixte(r, target), 300), () => { }); }
  };
  const PEAGE_MEMO = new Map();
  const addBox = (host, id, origin, destination, departureTime, villes, tr, pts) => {
    if (!host || document.getElementById(id) || !origin || !destination) return;
    const box = document.createElement('div');
    box.id = id; box.className = 'carte';
    box.innerHTML = '<b>🧭 Trajet réel Google</b><p class="doux">Distance routière, durée et péage exact.</p><button type="button" data-rmode="voiture">🚗 Voiture et péages</button><div class="doux" data-routes-result style="margin-top:8px"></div>' + liens(origin, destination) + '<div class="bk bkC bkTr bkTn" style="display:none"><div class="bkt">TRANSPORTS EN COMMUN · SITES</div><div class="tnZone"></div></div>';
    host.appendChild(box);
    // V252 : comme avant, la mini carte et le prix exact du péage s'affichent d'un seul coup (un seul calcul, pas de doublon) : « Voiture et péages » est déclenché tout seul, une fois, quand la fenêtre est prête.
    setTimeout(() => { try { if (!document.body.contains(box) || box.dataset.auto) return; box.dataset.auto = '1'; const b = box.querySelector('button[data-rmode="voiture"]'); if (b) b.click(); } catch (_) { } }, 300);
    if (villes) box.querySelector('[data-routes-result]').dataset.villes = villes;
    { const dg = document.createElement('div'); dg.className = 'doux'; dg.style.cssText = 'font-size:.68rem;margin-top:6px'; box.appendChild(dg); const iv = setInterval(() => { if (!document.body.contains(box)) { clearInterval(iv); return; } dg.textContent = '🩺 ' + (GAPS.length ? 'blocages mesurés : ' + GAPS.slice(-6).join(' | ') : 'aucun blocage mesuré') + (TPS.length ? ' · durées : ' + TPS.join(' | ') : ''); }, 1500); }
    box.querySelectorAll('button[data-rmode]').forEach(b => b.onclick = async () => {
      const out = box.querySelector('[data-routes-result]'), mode = b.dataset.rmode;
      const s = session(), c = config(); out.textContent = 'Calcul Google en cours…'; window.__cpMix = { endpoint, accessToken: s?.access_token, refreshToken: s?.refresh_token, expiresAt: s?.expires_at, email: s?.email, userId: s?.user_id, supabaseUrl: c?.url, supabaseApiKey: c?.anonKey, origin, destination, departureTime, veh: vehiculeConso() }; const tn = mode === 'transport'; box.querySelectorAll('.bkIt').forEach(a => { a.style.display = tn ? 'none' : ''; }); box.querySelectorAll('.bkTn').forEach(a => { a.style.display = tn ? '' : 'none'; }); if (tn) { const z = box.querySelector('.tnZone'); try { z.innerHTML = window.CPLiensTr && tr ? window.CPLiensTr(tr[0], tr[1], tr[2], tr[3]) : ''; } catch (_) { z.innerHTML = ''; } if (!z.innerHTML) z.innerHTML = '<span class="doux">Sites de transport indisponibles pour ce trajet.</span>';
        const googleTransit = 'https://www.google.com/maps/dir/?api=1&origin=' +
          lieu(origin) + '&destination=' + lieu(destination) + '&travelmode=transit';
        const link = document.createElement('a');
        link.href = googleTransit;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '🚌 Consulter les transports et horaires dans Google Maps';
        z.appendChild(document.createElement('div'));
        z.appendChild(link);
        const note = document.createElement('p');
        note.className = 'doux';
        note.textContent = 'Recherche entre les deux points de cette carte. Horaires et correspondances non confirmés par Convoyage Ultra.';
        z.appendChild(note);
      }
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
  const refresh = () => { if (rafale) return; rafale = true; setTimeout(() => { rafale = false; try { addMissionPanel(); addEstimatePanel(); } catch (_) { } try { document.querySelectorAll('.cpCarte:not([data-zoom])').forEach(zoomer); } catch (_) { } }, 150); };
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
