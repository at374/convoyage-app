// Convoyage Ultra — administrateur et abonnements (V230+).
// - Bouton « Admin » visible seulement pour un compte administrateur (table profils, rôle admin).
// - Écran « Abonnement terminé » pour un compte dont l'abonnement n'est plus valide.
// La vraie protection est côté Supabase (politiques) ; cet écran n'est que l'affichage.
(function () {
  'use strict';
  const FN = '/functions/v1/inviter-convoyeur';
  const cfg = () => { try { if (window.CP_CONFIG && window.CP_CONFIG.anonKey) return window.CP_CONFIG; if (window.CP_CONFIG_ACTIVE && window.CP_CONFIG_ACTIVE.anonKey) return window.CP_CONFIG_ACTIVE; return JSON.parse(localStorage.getItem('cp_config') || 'null') || {}; } catch (_) { return {}; } };
  const lire = () => { try { const n = window.CPNatif && window.CPNatif.session ? JSON.parse(window.CPNatif.session() || 'null') : null; if (n && n.access_token && (!n.expires_at || Date.now() < Number(n.expires_at) - 30000)) return n; } catch (_) {} try { return JSON.parse(localStorage.getItem('cp_session') || 'null'); } catch (_) { return null; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jour = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(d || new Date());
  const fr = s => { if (!s) return '—'; const m = String(s).slice(0, 10).split('-'); return m.length === 3 ? m[2] + '/' + m[1] + '/' + m[0] : s; };

  async function jeton() {
    let s = lire();
    if (!s || !s.access_token) return null;
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
    let j = null; try { j = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error((j && (j.erreur || j.message || j.msg || j.error_description)) || 'Erreur ' + r.status);
    return j;
  }
  const statut = () => http('/rest/v1/rpc/mon_statut', { method: 'POST', body: '{}' });
  const liste = () => http('/rest/v1/profils?select=*&order=cree_le.desc');
  const maj = (id, ch) => http('/rest/v1/profils?user_id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(ch) });
  const inviter = corps => http(FN, { method: 'POST', body: JSON.stringify(corps) });

  const valide = p => {
    if (!p.actif) return false;
    if (p.role === 'admin' || p.type_abonnement === 'illimite') return true;
    if (p.type_abonnement === 'essai') { if (!p.premiere_connexion) return true; return Date.now() <= Date.parse(p.premiere_connexion) + (Number(p.essai_jours) || 0) * 86400000; }
    const j = jour(); return !!(p.debut && p.fin && j >= p.debut && j <= p.fin);
  };
  const finTexte = p => {
    if (p.role === 'admin' || p.type_abonnement === 'illimite') return 'illimité';
    if (p.type_abonnement === 'essai') return p.premiere_connexion ? 'essai jusqu\'au ' + fr(new Date(Date.parse(p.premiere_connexion) + (Number(p.essai_jours) || 0) * 86400000).toISOString()) : 'essai ' + (p.essai_jours || 0) + ' j (pas encore connecté)';
    return 'du ' + fr(p.debut) + ' au ' + fr(p.fin);
  };
  const plusMois = (iso, n) => { const d = new Date((iso || jour()) + 'T12:00:00'); d.setMonth(d.getMonth() + n); return jour(d); };
  const plusJours = (iso, n) => { const d = new Date((iso || jour()) + 'T12:00:00'); d.setDate(d.getDate() + n); return jour(d); };

  function css() {
    if (document.getElementById('cpAdminCss')) return;
    const s = document.createElement('style'); s.id = 'cpAdminCss';
    s.textContent = '#cpAdminBtn{position:fixed;right:12px;bottom:84px;z-index:9000;background:#b8860b;color:#fff;border:0;border-radius:22px;padding:9px 14px;font:700 14px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)}' +
      '#cpApkBtn{position:fixed;right:12px;bottom:84px;z-index:9000;background:#2e6b3a;color:#fff;border:0;border-radius:22px;padding:9px 14px;font:700 14px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)}' +
      '#cpApk{position:fixed;inset:0;z-index:9500;background:#14110c;color:#f3ead6;overflow:auto;font:15px/1.4 system-ui,sans-serif;padding:14px 14px 90px}#cpApk h2{margin:6px 0 10px;font-size:20px;color:#e0b84c}#cpApk .bloc{background:#221c12;border:1px solid #3d321c;border-radius:12px;padding:12px;margin:10px 0}#cpApk button{padding:9px 12px;border-radius:9px;border:0;background:#4a4231;color:#fff;font-weight:700}' +
      '#cpAdmin,#cpAbo{position:fixed;inset:0;z-index:9500;background:#14110c;color:#f3ead6;overflow:auto;font:15px/1.4 system-ui,sans-serif;padding:14px 14px 90px}' +
      '#cpAdmin h2,#cpAbo h2{margin:6px 0 10px;font-size:20px;color:#e0b84c}' +
      '#cpAdmin .bloc{background:#221c12;border:1px solid #3d321c;border-radius:12px;padding:12px;margin:10px 0}' +
      '#cpAdmin label{display:block;margin:8px 0 3px;font-size:13px;color:#cdbf9b}' +
      '#cpAdmin input,#cpAdmin select{width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid #5a4a26;background:#0f0d09;color:#f3ead6;font-size:15px}' +
      '#cpAdmin button,#cpAbo button{padding:9px 12px;border-radius:9px;border:0;background:#b8860b;color:#fff;font-weight:700;font-size:14px;margin:4px 6px 0 0}' +
      '#cpAdmin button.gris,#cpAbo button.gris{background:#4a4231}' +
      '#cpAdmin .ligne{border-top:1px solid #3d321c;padding:10px 0}' +
      '#cpAdmin .ok{color:#6fd08c}#cpAdmin .ko{color:#ff8a7a}#cpAdmin .msg{margin-top:8px;font-size:14px}' +
      '#cpAbo{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:24px}';
    document.head.appendChild(s);
  }

  function ecranAbo(st) {
    css();
    if (document.getElementById('cpAbo')) return;
    const d = document.createElement('div'); d.id = 'cpAbo';
    const sans = st && st.existe === false;
    d.innerHTML = '<h2>' + (sans ? 'Compte pas encore activé' : 'Abonnement terminé') + '</h2><p>' + (sans ? 'Ton compte existe mais l\'administrateur ne l\'a pas encore activé.' : 'Ton accès à Convoyage Ultra est arrivé à son terme' + (st && st.fin ? ' (le ' + esc(fr(st.fin)) + ')' : '') + '. Tes données sont conservées.') + '</p><p>Contacte l\'administrateur pour renouveler ton accès.</p><button id="cpAboSortir" class="gris">Se déconnecter</button><button id="cpAboRetest">Vérifier à nouveau</button>';
    document.body.appendChild(d);
    document.getElementById('cpAboSortir').onclick = () => { try { localStorage.removeItem('cp_session'); } catch (_) {} location.reload(); };
    document.getElementById('cpAboRetest').onclick = () => { location.reload(); };
  }

  async function ouvrirAdmin() {
    css();
    let d = document.getElementById('cpAdmin');
    if (d) d.remove();
    d = document.createElement('div'); d.id = 'cpAdmin';
    d.innerHTML = '<button id="cpAdFermer" class="gris" style="float:right">Fermer</button><h2>🛡️ Administrateur</h2>' +
      '<div class="bloc"><b>Ajouter un convoyeur</b>' +
      '<label>E-mail</label><input id="cpAdMail" type="email" placeholder="prenom.nom@exemple.fr" autocapitalize="off">' +
      '<label>Type d\'abonnement</label><select id="cpAdType"><option value="dates">De date à date</option><option value="mensuel">Mensuel renouvelable</option><option value="essai">Jours d\'essai</option><option value="illimite">Illimité</option></select>' +
      '<div id="cpAdDates"><label>Date de début</label><input id="cpAdDeb" type="date"><label id="cpAdFinL">Date de fin</label><input id="cpAdFin" type="date"></div>' +
      '<div id="cpAdEssai" style="display:none"><label>Nombre de jours d\'essai (à partir de sa première connexion)</label><input id="cpAdJours" type="number" min="1" value="14"></div>' +
      '<label>Note (facultatif)</label><input id="cpAdNote" type="text" placeholder="ex. collègue de Lyon">' +
      '<button id="cpAdEnvoi">Envoyer l\'invitation</button><div class="msg" id="cpAdMsg"></div></div>' +
      '<div class="bloc"><b>Convoyeurs</b><div id="cpAdListe">Chargement…</div></div>' +
      '<div class="bloc"><b>Diagnostic (ce téléphone)</b><div id="cpAdErr" style="font-size:12px;white-space:pre-wrap;margin-top:6px"></div></div>';
    try { const er = JSON.parse(localStorage.getItem('cp_erreurs') || '[]'); d.querySelector('#cpAdErr').textContent = er.length ? er.slice().reverse().join('\n') : 'Aucune erreur ni gel enregistré.'; } catch (_) {}
    document.body.appendChild(d);
    const $ = id => document.getElementById(id);
    $('cpAdFermer').onclick = () => d.remove();
    $('cpAdDeb').value = jour();
    const typeChange = () => { const t = $('cpAdType').value; $('cpAdDates').style.display = (t === 'dates' || t === 'mensuel') ? '' : 'none'; $('cpAdFin').style.display = $('cpAdFinL').style.display = t === 'dates' ? '' : 'none'; $('cpAdEssai').style.display = t === 'essai' ? '' : 'none'; };
    $('cpAdType').onchange = typeChange; typeChange();
    $('cpAdEnvoi').onclick = async () => {
      const m = $('cpAdMsg'), t = $('cpAdType').value;
      const corps = { email: $('cpAdMail').value.trim(), type: t, note: $('cpAdNote').value.trim(), redirection: location.origin + location.pathname };
      if (t === 'dates' || t === 'mensuel') corps.debut = $('cpAdDeb').value;
      if (t === 'dates') corps.fin = $('cpAdFin').value;
      if (t === 'essai') corps.essai_jours = Number($('cpAdJours').value);
      m.className = 'msg'; m.textContent = 'Envoi en cours…';
      try { await inviter(corps); m.className = 'msg ok'; m.textContent = 'Invitation envoyée à ' + corps.email + '.'; $('cpAdMail').value = ''; rafraichir(); }
      catch (e) { m.className = 'msg ko'; m.textContent = 'Impossible : ' + e.message; }
    };
    async function rafraichir() {
      const L = $('cpAdListe');
      try {
        const rows = await liste();
        L.innerHTML = rows.length ? rows.map(p => {
          const ok = valide(p);
          return '<div class="ligne" data-id="' + esc(p.user_id) + '"><b>' + esc(p.email || '(sans e-mail)') + '</b>' + (p.role === 'admin' ? ' 🛡️' : '') + '<br>' +
            '<span class="' + (ok ? 'ok' : 'ko') + '">' + (p.actif ? (ok ? 'Actif' : 'Terminé') : 'Désactivé') + '</span> · ' + esc(finTexte(p)) + (p.note ? '<br><i>' + esc(p.note) + '</i>' : '') +
            (p.role === 'admin' ? '' : '<br><button data-a="modif">✏️ Modifier</button><button data-a="mois">+1 mois</button><button data-a="sem">+7 jours</button><button data-a="illim" class="gris">Illimité</button><button data-a="onoff" class="gris">' + (p.actif ? 'Désactiver' : 'Réactiver') + '</button>') + '</div>';
        }).join('') : 'Aucun convoyeur.';
        L.querySelectorAll('.ligne').forEach(l => { const id = l.dataset.id, p = rows.find(x => x.user_id === id); l.querySelectorAll('button').forEach(b => b.onclick = async () => {
          try {
            const a = b.dataset.a; let ch = {};
            if (a === 'modif') { formModif(l, p, rafraichir, (t, ok) => { $('cpAdMsg').className = 'msg ' + (ok ? 'ok' : 'ko'); $('cpAdMsg').textContent = t; }); return; }
            const base = p.type_abonnement === 'essai' || !p.fin || p.fin < jour() ? jour() : p.fin;
            if (a === 'mois') ch = { type_abonnement: p.type_abonnement === 'essai' ? 'mensuel' : (p.type_abonnement === 'illimite' ? 'mensuel' : p.type_abonnement), debut: p.debut && p.fin && p.fin >= jour() ? p.debut : jour(), fin: plusMois(base, 1), actif: true };
            else if (a === 'sem') ch = { type_abonnement: p.type_abonnement === 'essai' || p.type_abonnement === 'illimite' ? 'dates' : p.type_abonnement, debut: p.debut && p.fin && p.fin >= jour() ? p.debut : jour(), fin: plusJours(base, 7), actif: true };
            else if (a === 'illim') ch = { type_abonnement: 'illimite', actif: true };
            else ch = { actif: !p.actif };
            await maj(id, ch); rafraichir();
          } catch (e) { $('cpAdMsg').className = 'msg ko'; $('cpAdMsg').textContent = 'Impossible : ' + e.message; }
        }); });
      } catch (e) { L.textContent = 'Erreur : ' + e.message; }
    }
    rafraichir();
  }

  // --- APK Android : coffre privé Supabase (bucket « apk ») ---
  async function signer(nom) {
    const c = cfg(), t = await jeton();
    if (!c.url || !t) throw new Error('Non connecté');
    const base = String(c.url).replace(/\/+$/, '');
    const r = await fetch(base + '/storage/v1/object/sign/apk/' + nom, { method: 'POST', headers: { apikey: c.anonKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.signedURL ? base + '/storage/v1' + j.signedURL : null;
  }
  async function ouvrirApk() {
    css();
    let d = document.getElementById('cpApk'); if (d) d.remove();
    d = document.createElement('div'); d.id = 'cpApk';
    d.innerHTML = '<button id="cpApkF" class="gris" style="float:right">Fermer</button><h2>📲 Application Android</h2><div class="bloc" id="cpApkC">Chargement…</div>';
    document.body.appendChild(d);
    document.getElementById('cpApkF').onclick = () => d.remove();
    const C = document.getElementById('cpApkC');
    try {
      const [u, v] = await Promise.all([signer('convoyage-ultra.apk'), signer('version.json')]);
      let ver = '';
      if (v) { try { const j = await (await fetch(v)).json(); ver = j && j.version ? String(j.version) : ''; } catch (_) {} }
      if (!u) { C.innerHTML = 'L\'application Android n\'est pas encore disponible. Demande à l\'administrateur.'; return; }
      C.innerHTML = (ver ? '<p>Dernière version : <b>' + esc(ver) + '</b></p>' : '') +
        '<p><a href="' + esc(u) + '" style="display:inline-block;background:#b8860b;color:#fff;padding:12px 16px;border-radius:10px;font-weight:700;text-decoration:none">⬇️ Télécharger l\'APK</a></p>' +
        '<h3 style="color:#e0b84c;margin:14px 0 4px">Installer en 5 étapes</h3><ol style="padding-left:20px;line-height:1.7"><li>Appuie sur <b>« Télécharger l\'APK »</b> ci-dessus. Si Android prévient que ce type de fichier peut être dangereux, appuie sur <b>« Télécharger quand même »</b>.</li><li>Une fois le fichier téléchargé, ouvre-le (notification « Téléchargement terminé », ou application <b>Fichiers</b> puis dossier <b>Téléchargements</b>).</li><li>Android demande d\'<b>autoriser l\'installation des applications inconnues</b> : appuie sur <b>« Paramètres »</b>, active <b>« Autoriser depuis cette source »</b> (la source est ton navigateur, par exemple Chrome), puis reviens en arrière.</li><li>Appuie sur <b>« Installer »</b>. Si Play Protect affiche un avertissement, choisis <b>« Installer quand même »</b>.</li><li>Appuie sur <b>« Ouvrir »</b> et connecte-toi avec ton compte Convoyage Ultra. Autorise les <b>notifications</b> quand l\'appli le demande.</li></ol><p>Pour les mises à jour : reviens ici, télécharge la nouvelle version et installe-la par-dessus (tes données sont conservées).</p>' +
        '<p>Le lien est valable 1 heure. Ne le partage pas : l\'accès est réservé aux convoyeurs inscrits.</p>';
      try { if (ver) localStorage.setItem('cp_apk_vue', ver); } catch (_) {}
      const b = document.getElementById('cpApkBtn'); if (b) b.textContent = '📲 Android';
    } catch (e) { C.textContent = 'Erreur : ' + e.message; }
  }
  // --- iPhone / iPad : installation de la version web sur l'écran d'accueil (Safari) ---
  const estIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const dejaInstallee = () => window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  function ouvrirIos() {
    css();
    let d = document.getElementById('cpApk'); if (d) d.remove();
    d = document.createElement('div'); d.id = 'cpApk';
    const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
    d.innerHTML = '<button id="cpApkF" class="gris" style="float:right">Fermer</button><h2>📲 Installer sur iPhone</h2><div class="bloc">' +
      (safari ? '' : '<p><b>⚠️ Ouvre cette page dans Safari</b> (l\'icône boussole bleue). L\'ajout à l\'écran d\'accueil ne marche bien que depuis Safari.</p>') +
      '<ol style="padding-left:20px;line-height:1.7"><li>Ouvre <b>Convoyage Ultra</b> dans <b>Safari</b>.</li><li>Appuie sur le bouton <b>Partager</b> (le carré avec une flèche vers le haut, en bas de l\'écran).</li><li>Fais défiler le menu et appuie sur <b>« Sur l\'écran d\'accueil »</b>.</li><li>Appuie sur <b>« Ajouter »</b> en haut à droite.</li><li>Ouvre l\'appli depuis la nouvelle icône sur ton écran d\'accueil, et connecte-toi.</li></ol>' +
      '<p>Pour recevoir les notifications, ouvre l\'appli depuis l\'icône de l\'écran d\'accueil, puis autorise les notifications quand l\'appli le demande (iPhone avec iOS 16.4 ou plus récent).</p>' +
      '<p>Les mises à jour se font toutes seules : rien à télécharger.</p></div>';
    document.body.appendChild(d);
    document.getElementById('cpApkF').onclick = () => d.remove();
  }

  async function boutonApk(admin) {
    if (window.CPNatif) {
      // V233 : dans l'APK, prévenir si une version plus récente est disponible dans le coffre.
      try {
        const inst = typeof window.CPNatif.versionApp === 'function' ? String(window.CPNatif.versionApp() || '') : '';
        if (!inst || document.getElementById('cpApkAvis')) return;
        const u = await signer('version.json'); if (!u) return;
        const j = await (await fetch(u)).json(); if (!j || !j.version) return;
        const n = s => String(s).split('.').map(x => parseInt(x, 10) || 0), a = n(j.version), c = n(inst);
        let plus = false; for (let k = 0; k < 3; k++) { if ((a[k] || 0) > (c[k] || 0)) { plus = true; break; } if ((a[k] || 0) < (c[k] || 0)) break; }
        if (!plus || sessionStorage.getItem('cp_apk_avis_ferme') === String(j.version)) return;
        css();
        const d = document.createElement('div'); d.id = 'cpApkAvis';
        d.style.cssText = 'position:fixed;left:10px;right:10px;top:10px;z-index:9700;background:#221c12;color:#f3ead6;border:2px solid #b8860b;border-radius:12px;padding:12px 14px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 4px 18px #0008';
        d.innerHTML = '<b>📲 Nouvelle version ' + String(j.version).replace(/[^0-9.]/g, '') + ' disponible</b><br>Tu as la version ' + inst.replace(/[^0-9.]/g, '') + '. Installe la nouvelle pour avoir les dernières améliorations.<div style="display:flex;gap:8px;margin-top:10px"><button id="cpApkAvisOk" style="flex:1;padding:10px;border:0;border-radius:9px;background:#b8860b;color:#fff;font-weight:700">Télécharger</button><button id="cpApkAvisNon" style="padding:10px 14px;border:0;border-radius:9px;background:#3d321c;color:#f3ead6">Plus tard</button></div>';
        document.body.appendChild(d);
        document.getElementById('cpApkAvisOk').onclick = () => { d.remove(); ouvrirApk(); };
        document.getElementById('cpApkAvisNon').onclick = () => { try { sessionStorage.setItem('cp_apk_avis_ferme', String(j.version)); } catch (_) {} d.remove(); };
      } catch (_) {}
      return;
    }
    if (estIOS()) {
      if (dejaInstallee()) return;
      css();
      if (!document.getElementById('cpApkBtn')) { const bi = document.createElement('button'); bi.id = 'cpApkBtn'; bi.textContent = '📲 iPhone'; bi.onclick = ouvrirIos; bi.style.bottom = admin ? '130px' : '84px'; document.body.appendChild(bi); }
      return;
    }
    css();
    let b = document.getElementById('cpApkBtn');
    if (!b) { b = document.createElement('button'); b.id = 'cpApkBtn'; b.textContent = '📲 Android'; b.onclick = ouvrirApk; b.style.bottom = admin ? '130px' : '84px'; document.body.appendChild(b); }
    try {
      const v = await signer('version.json');
      if (v) { const j = await (await fetch(v)).json(); const vu = localStorage.getItem('cp_apk_vue'); if (j && j.version && vu && vu !== String(j.version)) b.textContent = '📲 Nouvelle version !'; }
    } catch (_) {}
  }

  function boutonAdmin() {
    css();
    if (document.getElementById('cpAdminBtn')) return;
    const b = document.createElement('button'); b.id = 'cpAdminBtn'; b.textContent = '🛡️ Admin'; b.onclick = ouvrirAdmin;
    document.body.appendChild(b);
  }

  // V240 : modifier un convoyeur (type, dates, essai, note, actif) directement depuis la liste.
  function formModif(ligne, p, fini, msg) {
    const ancien = ligne.querySelector('.cpModif'); if (ancien) { ancien.remove(); return; }
    const f = document.createElement('div'); f.className = 'cpModif'; f.style.cssText = 'margin-top:8px;padding:10px;border:1px solid #5a4a26;border-radius:10px;background:#1a150d';
    const tp = p.type_abonnement || 'dates';
    f.innerHTML = '<label>Type d\'abonnement</label><select data-f="type"><option value="dates">De date à date</option><option value="mensuel">Mensuel renouvelable</option><option value="essai">Jours d\'essai</option><option value="illimite">Illimité</option></select>' +
      '<div data-f="bdates"><label>Date de début</label><input data-f="debut" type="date" value="' + esc(p.debut || '') + '"><label>Date de fin</label><input data-f="fin" type="date" value="' + esc(p.fin || '') + '"></div>' +
      '<div data-f="bessai" style="display:none"><label>Jours d\'essai (à partir de la 1re connexion)</label><input data-f="jours" type="number" min="1" value="' + esc(p.essai_jours || 14) + '"></div>' +
      '<label>Note</label><input data-f="note" type="text" value="' + esc(p.note || '') + '">' +
      '<label style="display:flex;align-items:center;gap:8px"><input data-f="actif" type="checkbox" style="width:auto"' + (p.actif ? ' checked' : '') + '> Compte actif</label>' +
      '<button data-f="ok">Enregistrer</button><button data-f="non" class="gris">Annuler</button>';
    ligne.appendChild(f);
    const q = n => f.querySelector('[data-f="' + n + '"]');
    q('type').value = ['dates', 'mensuel', 'essai', 'illimite'].includes(tp) ? tp : 'dates';
    const aff = () => { const t = q('type').value; q('bdates').style.display = (t === 'dates' || t === 'mensuel') ? '' : 'none'; q('bessai').style.display = t === 'essai' ? '' : 'none'; };
    q('type').onchange = aff; aff();
    q('non').onclick = () => f.remove();
    q('ok').onclick = async () => {
      const t = q('type').value, ch = { type_abonnement: t, note: q('note').value.trim() || null, actif: q('actif').checked };
      if (t === 'dates' || t === 'mensuel') {
        ch.debut = q('debut').value || null; ch.fin = q('fin').value || null;
        if (!ch.debut || !ch.fin) { msg('Indique la date de début ET la date de fin.', false); return; }
        if (ch.fin < ch.debut) { msg('La date de fin est avant la date de début.', false); return; }
      } else if (t === 'essai') { ch.essai_jours = Math.max(1, Number(q('jours').value) || 14); }
      try { await maj(p.user_id, ch); msg('Modifié : ' + (p.email || ''), true); fini(); } catch (e) { msg('Impossible : ' + e.message, false); }
    };
  }
  // V240 : diagnostic — erreurs et gels de l'appli gardés sur ce téléphone (visibles dans Admin) + écran vide → bouton Recharger.
  const noterErreur = m => { try { const a = JSON.parse(localStorage.getItem('cp_erreurs') || '[]'); a.push(new Date().toISOString().slice(5, 19).replace('T', ' ') + ' ' + String(m).slice(0, 260)); localStorage.setItem('cp_erreurs', JSON.stringify(a.slice(-25))); } catch (_) {} };
  window.addEventListener('error', e => noterErreur('erreur: ' + (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', e => noterErreur('promesse: ' + ((e.reason && e.reason.message) || e.reason)));
  (function () {
    let t0 = Date.now(), debut = Date.now(), tv = 0;
    // V242 : une pause pendant que l'appli était en arrière-plan (téléphone verrouillé, autre appli) n'est PAS un blocage.
    ['visibilitychange', 'pageshow', 'pagehide', 'resume', 'freeze', 'focus', 'blur'].forEach(ev => { try { (ev === 'focus' || ev === 'blur' || ev === 'pageshow' || ev === 'pagehide' ? window : document).addEventListener(ev, () => { tv = Date.now(); }); } catch (_) {} });
    setInterval(() => {
      const n = Date.now(), ecart = n - t0, prec = t0; t0 = n;
      if (ecart > 5000 && !document.hidden && tv < prec) noterErreur('gel: l\'appli est restée bloquée ' + Math.round(ecart / 1000) + ' s');
      const e = document.getElementById('ecran');
      if (e && !document.hidden && n - debut > 10000 && !e.children.length && !(e.textContent || '').trim()) {
        if (!document.getElementById('cpBlanc')) { const b = document.createElement('button'); b.id = 'cpBlanc'; b.textContent = '↻ Écran vide : recharger'; b.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:9800;padding:14px 18px;border:0;border-radius:12px;background:#b8860b;color:#fff;font:700 16px system-ui'; b.onclick = () => location.reload(); document.body.appendChild(b); noterErreur('écran vide détecté'); }
      } else { const b = document.getElementById('cpBlanc'); if (b) b.remove(); }
    }, 1000);
  })();

  let dernier = '';
  async function verifier() {
    const s = lire();
    const cle = s && s.access_token ? (s.user_id || s.email || 'x') : '';
    if (!cle) { dernier = ''; const b = document.getElementById('cpAdminBtn'); if (b) b.remove(); const k = document.getElementById('cpApkBtn'); if (k) k.remove(); const a = document.getElementById('cpAbo'); if (a) a.remove(); return; }
    if (cle === dernier) return;
    try {
      const st = await statut();
      dernier = cle;
      if (st && st.role === 'admin') { boutonAdmin(); boutonApk(true); return; }
      if (st && st.existe === false) { ecranAbo(st); return; }
      if (st && st.valide === false) ecranAbo(st); else boutonApk(false);
    } catch (_) { /* hors ligne ou fonction absente : on ne bloque pas l'affichage */ }
  }
  window.CPAdmin = { ouvrir: ouvrirAdmin, verifier };
  setTimeout(verifier, 1500);
  setInterval(verifier, 20000);
})();
