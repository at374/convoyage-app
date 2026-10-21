// Convoyage Ultra — choix des plateformes utilisées (V232).
// Le convoyeur coche ses plateformes (Hiflow, DriiveMe, Otoqi, Pop Valet) : l'appli n'affiche et ne lit que celles-là.
// Choix gardé sur ce téléphone ET sur le compte (colonne reglages.plateformes_choisies). Aucun mot de passe n'est manipulé.
(function () {
  'use strict';
  const ED = globalThis.CP_EDITION;
  if (!ED || ED.verrouillee) return;
  const TOUTES = [['Hiflow', 'Hiflow'], ['DriiveMe', 'DriiveMe'], ['Otoqi', 'Otoqi'], ['PopValet', 'Pop Valet']];
  const CLE = 'cp_plats_choisies';
  const CODES = TOUTES.map(t => t[0]);
  ED.toutes = (ED.toutes || ED.plateformes || CODES).slice();

  const lireLoc = () => { try { const v = JSON.parse(localStorage.getItem(CLE) || 'null'); if (!Array.isArray(v)) return null; const f = v.filter(x => CODES.indexOf(x) >= 0); return f.length ? f : null; } catch (_) { return null; } };
  const ecrireLoc = v => { try { localStorage.setItem(CLE, JSON.stringify(v)); } catch (_) {} };
  const memes = (a, b) => JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort());
  const natif = v => { try { if (window.CPNatif && typeof window.CPNatif.reglerPlateformes === 'function') window.CPNatif.reglerPlateformes(JSON.stringify(v || ED.toutes)); } catch (_) {} };
  // Met la liste à jour SUR PLACE : l'application garde la même référence.
  const appliquer = v => { const liste = v && v.length ? ED.toutes.filter(x => v.indexOf(x) >= 0) : ED.toutes.slice(); ED.plateformes.splice(0, ED.plateformes.length, ...liste); };

  appliquer(lireLoc());
  natif(lireLoc());

  const cfg = () => { try { if (window.CP_CONFIG && window.CP_CONFIG.anonKey) return window.CP_CONFIG; if (window.CP_CONFIG_ACTIVE && window.CP_CONFIG_ACTIVE.anonKey) return window.CP_CONFIG_ACTIVE; return JSON.parse(localStorage.getItem('cp_config') || 'null') || {}; } catch (_) { return {}; } };
  const session = () => { try { const n = window.CPNatif && window.CPNatif.session ? JSON.parse(window.CPNatif.session() || 'null') : null; if (n && n.access_token && (!n.expires_at || Date.now() < Number(n.expires_at) - 30000)) return n; } catch (_) {} try { return JSON.parse(localStorage.getItem('cp_session') || 'null'); } catch (_) { return null; } };
  async function jeton() {
    let s = session(); if (!s || !s.access_token) return null;
    if (s.expires_at && Date.now() > Number(s.expires_at) - 60000 && s.refresh_token) {
      try {
        const c = cfg();
        const r = await fetch(String(c.url).replace(/\/+$/, '') + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: c.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
        if (r.ok) { const j = await r.json(); s = { ...s, access_token: j.access_token, refresh_token: j.refresh_token || s.refresh_token, expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000 }; try { localStorage.setItem('cp_session', JSON.stringify(s)); } catch (_) {} }
      } catch (_) {}
    }
    return s.access_token;
  }
  async function http(chemin, opt) {
    const c = cfg(), t = await jeton();
    if (!c.url || !c.anonKey || !t) throw new Error('Non connecté');
    const r = await fetch(String(c.url).replace(/\/+$/, '') + chemin, { ...(opt || {}), headers: { apikey: c.anonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...((opt && opt.headers) || {}) } });
    if (!r.ok) throw new Error('Erreur ' + r.status);
    try { return await r.json(); } catch (_) { return null; }
  }
  const lireServeur = async () => { const rows = await http('/rest/v1/reglages?select=plateformes_choisies'); const v = rows && rows[0] ? rows[0].plateformes_choisies : null; return Array.isArray(v) && v.length ? v.filter(x => CODES.indexOf(x) >= 0) : null; };
  const ecrireServeur = async v => { const s = session(); if (!s || !s.user_id) return; await http('/rest/v1/reglages?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ user_id: s.user_id, plateformes_choisies: v }]) }); };

  async function enregistrer(v, msgEl) {
    ecrireLoc(v); appliquer(v); natif(v);
    let avert = '';
    try { await ecrireServeur(v); } catch (_) { avert = 'Choix gardé sur ce téléphone (pas encore enregistré en ligne).'; }
    if (msgEl && avert) { msgEl.textContent = avert; setTimeout(() => location.reload(), 1600); } else location.reload();
  }

  function css() {
    if (document.getElementById('cpPlatCss')) return;
    const s = document.createElement('style'); s.id = 'cpPlatCss';
    s.textContent = '#cpPlatModal{position:fixed;inset:0;z-index:9800;background:#14110c;color:#f3ead6;overflow:auto;font:16px/1.45 system-ui,sans-serif;padding:22px 18px 90px;display:flex;flex-direction:column;align-items:center}' +
      '#cpPlatModal .in{width:100%;max-width:460px}#cpPlatModal h2,.cpPlatCard h2{margin:6px 0 8px;font-size:21px;color:#e0b84c}' +
      '.cpPlatLigne{display:flex;align-items:center;gap:12px;background:#221c12;border:1px solid #3d321c;border-radius:12px;padding:13px 14px;margin:9px 0;font-size:17px;font-weight:700}' +
      '.cpPlatLigne input{width:24px;height:24px;accent-color:#b8860b;flex:none}' +
      '.cpPlatBtn{padding:12px 16px;border-radius:10px;border:0;background:#b8860b;color:#fff;font-weight:700;font-size:16px;margin-top:10px;width:100%}.cpPlatBtn[disabled]{opacity:.45}' +
      '.cpPlatMsg{margin-top:8px;font-size:14px;color:#cdbf9b}';
    document.head.appendChild(s);
  }
  const lignes = sel => TOUTES.map(t => '<label class="cpPlatLigne"><input type="checkbox" value="' + t[0] + '"' + (sel.indexOf(t[0]) >= 0 ? ' checked' : '') + '>' + t[1] + '</label>').join('');
  const cochees = racine => Array.prototype.slice.call(racine.querySelectorAll('input[type=checkbox]:checked')).map(x => x.value);

  function modalChoix() {
    if (document.getElementById('cpPlatModal')) return;
    css();
    const d = document.createElement('div'); d.id = 'cpPlatModal';
    d.innerHTML = '<div class="in"><h2>Bienvenue 👋</h2><p>Coche les plateformes <b>que tu utilises</b>. L\'appli ne lira et n\'affichera que celles-là. Tu pourras changer ce choix à tout moment dans <b>Réglages</b>.</p>' + lignes([]) + '<button class="cpPlatBtn" id="cpPlatOk" disabled>Valider</button><div class="cpPlatMsg" id="cpPlatMsg"></div></div>';
    document.body.appendChild(d);
    const ok = d.querySelector('#cpPlatOk');
    d.addEventListener('change', () => { ok.disabled = cochees(d).length === 0; });
    ok.onclick = () => { ok.disabled = true; ok.textContent = 'Enregistrement…'; enregistrer(cochees(d), d.querySelector('#cpPlatMsg')); };
  }

  // V243 : « Connecter mes plateformes » — ouvre la page de connexion du site dans l'application Android (le convoyeur tape lui-même ses identifiants, rien n'est gardé).
  function ouvrirConnexion(n) {
    let ok = false;
    try { if (window.CPNatif && typeof window.CPNatif.ouvrirConnexion === 'function') ok = window.CPNatif.ouvrirConnexion(n) === 'ok'; } catch (_) {}
    if (!ok) window.open(n === 'Hiflow' ? 'https://partenaire.expedicar.com/login' : 'https://www.driiveme.com/', '_blank');
  }
  function connexions(cur) {
    const b = [];
    if (cur.indexOf('Hiflow') >= 0) b.push('<button type="button" class="cpPlatBtn" data-conn="Hiflow">Me connecter à Hiflow</button>');
    if (cur.indexOf('DriiveMe') >= 0) b.push('<button type="button" class="cpPlatBtn" data-conn="DriiveMe">Me connecter à DriiveMe</button>');
    let h = '<h2 style="margin-top:22px">Connecter mes plateformes</h2><p class="doux">Appuyez sur le bouton : la page de connexion du site s\'ouvre et vous tapez vous-même votre identifiant et votre mot de passe. Convoyage Ultra ne les voit pas et ne les garde pas. Il lit ensuite vos missions sur votre téléphone.</p>' + b.join('');
    if (cur.indexOf('Otoqi') >= 0 || cur.indexOf('PopValet') >= 0) h += '<p class="doux">Pop Valet et Otoqi : ouvrez leur application et connectez-vous-y. Convoyage Ultra les lit ensuite depuis le téléphone, une fois la lecture autorisée avec la roue ⚙ (en haut à droite) de l\'application Android.</p>';
    if (!(window.CPNatif && window.CPNatif.ouvrirConnexion)) h += '<p class="doux">La lecture des plateformes se fait uniquement dans l\'application Android (roue ⚙ en haut à droite).</p>';
    return h;
  }
  function carteReglages() {
    const ec = document.getElementById('ecran');
    if (!ec || document.getElementById('cpPlatCard') || !ec.querySelector('#rOk')) return;
    css();
    const cur = lireLoc() || ED.toutes;
    const c = document.createElement('div'); c.id = 'cpPlatCard'; c.className = 'carte cpPlatCard';
    c.innerHTML = '<h2>Mes plateformes</h2><p class="doux">Coche celles que tu utilises : l\'appli ne lit et n\'affiche que celles-là.</p>' + lignes(cur) + '<button class="cpPlatBtn" id="cpPlatSave">Enregistrer mes plateformes</button><div class="cpPlatMsg" id="cpPlatMsg2"></div>' + connexions(cur);
    ec.insertBefore(c, ec.firstChild);
    c.addEventListener('click', e => { const b = e.target && e.target.closest && e.target.closest('[data-conn]'); if (b) ouvrirConnexion(b.getAttribute('data-conn')); });
    const b = c.querySelector('#cpPlatSave'), m = c.querySelector('#cpPlatMsg2');
    c.addEventListener('change', () => { b.disabled = cochees(c).length === 0; m.textContent = b.disabled ? 'Coche au moins une plateforme.' : ''; });
    b.onclick = () => { const v = cochees(c); if (!v.length) return; b.disabled = true; b.textContent = 'Enregistrement…'; enregistrer(v, m); };
  }

  let cle = '', enCours = false;
  async function suivreCompte() {
    const s = session(), k = s && s.access_token ? (s.user_id || s.email || 'x') : '';
    if (!k) { cle = ''; return; }
    if (k === cle || enCours) return;
    enCours = true;
    try {
      const serv = await lireServeur(), loc = lireLoc();
      cle = k;
      if (serv) {
        if (!memes(serv, loc)) { ecrireLoc(serv); appliquer(serv); natif(serv); try { if (!sessionStorage.getItem('cp_plat_rl')) { sessionStorage.setItem('cp_plat_rl', '1'); location.reload(); return; } } catch (_) {} }
      } else if (loc) { try { await ecrireServeur(loc); } catch (_) {} }
      else modalChoix();
    } catch (_) { /* hors ligne ou colonne absente : le choix local reste utilisé ; sans choix local on demande */ if (!lireLoc() && s && s.access_token) { cle = k; modalChoix(); } }
    finally { enCours = false; }
  }

  const surveiller = () => {
    const ec = document.getElementById('ecran');
    if (ec) new MutationObserver(carteReglages).observe(ec, { childList: true });
    carteReglages();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', surveiller); else surveiller();
  setTimeout(suivreCompte, 1200);
  setInterval(suivreCompte, 5000);
  window.CPPlateformes = { choisies: () => (lireLoc() || ED.toutes).slice(), ouvrir: modalChoix };
})();
