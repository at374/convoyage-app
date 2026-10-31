// Convoyage Ultra — application téléphone (Android, iPhone, ordinateur). Lecture seule des missions
// synchronisées par l'extension ; aucune action n'est faite sur les plateformes.
(() => {
  'use strict';
  const regionalFetch = (...args) => window.fetch(...args);
  // Planning data stays in this page session and never updates synchronized missions.
  const transportReturnPlans = new Map();
  let gtfsAgendaSession = null;
  function stopGTFSTransports() { gtfsAgendaSession?.dispose(); gtfsAgendaSession = null; }
  function transportParisDate(value) {
    if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const format = date => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', {
        timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23'
      }).formatToParts(date).map(part => [part.type,part.value]));
      return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
    };
    const matches = ['+01:00','+02:00'].map(offset => new Date(value+':00'+offset))
      .filter(date => Number.isFinite(date.getTime()) && format(date) === value);
    return matches.length === 1 ? matches[0].toISOString() : null;
  }

  const transportAddressPoint = point => !!point &&
    ['gps', 'adresse'].includes(point.precision) &&
    point.lat != null && point.lng != null && point.lat !== '' && point.lng !== '' &&
    Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)) &&
    Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180 &&
    !(Number(point.lat) === 0 && Number(point.lng) === 0);

  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euros = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const PLATS = { Hiflow: 'Hiflow', DriiveMe: 'DriiveMe', Otoqi: 'Otoqi', PopValet: 'Pop Valet' };
  const clsPlat = p => ' plat-' + String(p || '').replace(/[^A-Za-z]/g, '');   // V122 : couleur de fond et de police propres à chaque plateforme
  // V83 : édition (une par plateforme, ou personnelle) : seules ses plateformes sont affichées.
  const EDITION = window.CP_EDITION || { code: 'personnelle', nom: 'Convoyage Ultra', plateformes: Object.keys(PLATS) };
  // V139 : missions que TOI as retirées de l'Agenda (« pas acceptée ») : mémorisées sur ce téléphone, jamais effacées du serveur.
  const masquees = () => new Set(lireLocal('cp_masquees', []) || []);
  // V276 : une mission DriiveMe « disponible » qui n'a plus été vue depuis plus de 90 min alors que l'APK a lu DriiveMe depuis (autres missions plus récentes) n'est plus sur le site : on la retire.
  const deLEdition = l => { const mq = masquees(); return (l || []).filter(m => EDITION.plateformes.includes(m.platform) && !(m.kind === 'acceptee' && mq.has(m.platform + '|' + m.external_id))); };
  // V90 : lien direct vers la page de devis Hiflow d'une mission disponible (le devis se fait et s'envoie sur Hiflow, par toi).
  const lienDevis = m => m && m.platform === 'Hiflow' && m.kind !== 'acceptee' && /^\d{6,9}$/.test(String(m.external_id || '')) ? (/^https:\/\/partenaire\.expedicar\.com\/transfer\/\d+\/quotation/.test(m.detail_url || '') ? m.detail_url : 'https://partenaire.expedicar.com/transfer/' + m.external_id + '/quotation') : null;
  // V93 : sur le téléphone, les devis Hiflow se font dans l'APPLICATION « Hiflow Partner » (pas sur le site) :
  // Android → ouverture de l'application (com.expedicar.conveyor.app, sinon sa page Google Play) ; iPhone → sa page App Store
  // (bouton « Ouvrir »). Le n° de la mission est copié pour la retrouver dans l'application.
  const HIFLOW_APPLI = { android: 'com.expedicar.conveyor.app', play: 'https://play.google.com/store/apps/details?id=com.expedicar.conveyor.app', ios: 'https://apps.apple.com/fr/app/hiflow-partner/id1267308976' };
  function lienAppliHiflow(ua) {
    ua = ua == null ? (navigator.userAgent || '') : ua;
    if (/Android/i.test(ua)) return 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=' + HIFLOW_APPLI.android + ';S.browser_fallback_url=' + encodeURIComponent(HIFLOW_APPLI.play) + ';end';
    if (/iPhone|iPad|iPod/i.test(ua)) return HIFLOW_APPLI.ios;
    return null;
  }
  window.__cpLienAppliHiflow = lienAppliHiflow;
  // V146 : DriiveMe / Pop Valet / Otoqi → ouvre leur APPLICATION via « Convoyage Tel » (application Android de ce projet : elle retrouve l'appli installée) ; sans elle, le site s'ouvre.
  function lienAppliAutre(plat, site, ua) {
    ua = ua == null ? (navigator.userAgent || '') : ua;
    if (!/Android/i.test(ua) || !/^(DriiveMe|PopValet|Otoqi)$/.test(plat)) return null;
    return 'intent://ouvrir/' + plat.toLowerCase() + '#Intent;scheme=convoyagetel;package=fr.convoyagepro.tel;S.browser_fallback_url=' + encodeURIComponent(site) + ';end';
  }
  const VERSION_APP = 'V277 (2.0.127)';
  const versionApk = () => { try { const n = window.CPNatif && typeof window.CPNatif.versionApp === 'function' ? String(window.CPNatif.versionApp() || '').replace(/[^0-9.]/g, '') : ''; return n ? ' · APK ' + n : ''; } catch (_) { return ''; } };   // V242 : version de l'APK installé (dans l'application Android)   // affichée dans l'en-tête et les Réglages
  // V154 : taille du texte de toute l'application (A− / A+), mémorisée.
  (function () {
    const lire = () => { try { return Math.min(150, Math.max(80, Number(localStorage.getItem('cp_zoom')) || 100)); } catch (_) { return 100; } };
    const poser = p => { try { localStorage.setItem('cp_zoom', String(p)); } catch (_) {} document.body.style.zoom = ''; for (const sel of ['#ecran', 'header.barre']) { const el = document.querySelector(sel); if (el) el.style.zoom = p / 100; } };   // le zoom ne touche pas la barre du bas (sinon elle sort de l'écran)
    const monter = () => { const ref = document.getElementById('policeBtn'); if (!ref || document.getElementById('zoomMoins')) return; const mk = (id, txt, delta, titre) => { const b = document.createElement('button'); b.id = id; b.className = 'icone'; b.textContent = txt; b.title = titre; b.setAttribute('aria-label', titre); b.onclick = () => poser(Math.min(150, Math.max(80, lire() + delta))); return b; }; ref.parentNode.insertBefore(mk('zoomMoins', 'A−', -10, 'Réduire le texte'), ref); ref.parentNode.insertBefore(mk('zoomPlus', 'A+', 10, 'Agrandir le texte'), ref); };
    const demarrer = () => { poser(lire()); monter(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  })();
  // V154 : bandeau (application Android seulement) si les notifications ou la batterie « sans restriction » ne sont pas autorisées.
  (function () {
    const maj = () => {
      try {
        const N = window.CPNatif; if (!N || !N.autorisations) return;
        const a = JSON.parse(N.autorisations()); let b = document.getElementById('bandeauAut');
        if (a.batterie && a.notifs && a.accessibilite !== false) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('div'); b.id = 'bandeauAut'; b.className = 'bandeauAut'; document.body.prepend(b); }
        b.innerHTML = '⚠ Pour les pop-ups de nouvelles missions et la lecture écran éteint : ' + (a.notifs ? '' : '<button id="autN">Autoriser les notifications</button> ') + (a.batterie ? '' : '<button id="autB">Batterie : sans restriction</button> ') + (a.accessibilite === false ? '<br>⚠ La lecture Otoqi / Pop Valet est coupée par Android : <button id="autA">Réactiver la lecture</button>' : '');
        const n = document.getElementById('autN'); if (n) n.onclick = () => N.autoriserNotifications();
        const bb = document.getElementById('autB'); if (bb) bb.onclick = () => N.autoriserBatterie();
        const ba = document.getElementById('autA'); if (ba) ba.onclick = () => N.ouvrirAccessibilite();
      } catch (_) {}
    };
    setTimeout(maj, 2500); setInterval(maj, 20000);
  })();
  const LIENS = { Hiflow: 'https://partenaire.expedicar.com/', DriiveMe: 'https://www.driiveme.com/', Otoqi: 'https://drivers.otoqi.com/', PopValet: 'https://www.popvalet.com/' };
  const FRAIS = { hebergement: 'hébergement', exceptionnels: 'frais exceptionnels', peages: 'péages', train: 'train', taxi: 'taxi', toll: 'péage', peage: 'péage', fuel: 'carburant', carburant: 'carburant', gas: 'carburant', parking: 'parking', wash: 'lavage', lavage: 'lavage', bus: 'bus', ticket: 'billet', transport: 'transport' };
  document.addEventListener('change', e => { const c = e.target && e.target.closest && e.target.closest('input[data-verif]'); if (!c) return; const t = lireLocal('cp_verif', {}) || {}; if (c.checked) t[c.dataset.verif] = new Date().toISOString(); else delete t[c.dataset.verif]; ecrireLocal('cp_verif', t); const l = c.closest('label'); if (l) { l.classList.toggle('ok', c.checked); l.lastChild.textContent = c.checked ? ' ✓ Vérifié par toi le ' + new Date().toLocaleDateString('fr-FR') + ' (horaires et prix valables le jour de la mission)' : ' Je coche quand j’ai vérifié que ce transport circule et son prix le jour de la mission'; } });
  const lireLocal = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (_) { return d; } };
  const ecrireLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  window.CP_BUS_ACTIF = lireLocal('cp_bus_actif', false) === true;   // V131 : bus locaux comptés dans les liaisons seulement si tu le demandes (réglage sur cet appareil)

  // ---------- Configuration du serveur ----------
  const cfgFichier = window.CP_CONFIG || {};
  let cfg = cfgFichier.url && cfgFichier.anonKey ? cfgFichier : lireLocal('cp_config', null);
  let api = cfg ? new window.CPApi(cfg.url, cfg.anonKey) : null;

  // V138 : l'onglet Alertes ne montre que les NOUVELLES missions (ni missions acceptées, ni hausses de prix, ni modifications ou annulations).
  const seulesNouvelles = l => (l || []).filter(a => !['mission_acceptee', 'hausse_prix', 'mission_modifiee', 'mission_annulee'].includes(a.type) && (!a.platform || !window.CP_EDITION || !window.CP_EDITION.plateformes || window.CP_EDITION.plateformes.includes(a.platform)));   // V232 : seulement les plateformes choisies
  const etat = { onglet: 'missions', missions: [], alertes: [], reglages: null, filtre: 'toutes', recherche: '', tri: 'recent', zones: [], cote: 'tous', rayon: 0, chargeLe: null, erreur: '', plus: {}, factures: [], facturesServeur: true, sources: undefined };
  const G = window.CPGeo, RT = window.CPRetours, CALC = window.CPCalc;
  { const mq = document.getElementById('marque'); if (mq && !document.getElementById('versionApp')) { const v = document.createElement('span'); v.id = 'versionApp'; v.className = 'version'; v.textContent = VERSION_APP + versionApk(); mq.appendChild(v); } }
  Object.assign(etat, lireLocal('cp_preferences', {}));
  window.CP_TRANSPORT_CHOISI = lireLocal('cp_transport', 'moyenne');   // V137 : transport choisi pour l'aller et le retour (gardé sur ce téléphone)
  etat.pos = lireLocal('cp_position', null); etat.posMax = Number(etat.posMax) || 0;   // V137 : position du téléphone, prise seulement sur demande, gardée sur ce téléphone
  if (!lireLocal('cp_tri_v144', null)) { etat.tri = 'date'; ecrireLocal('cp_tri_v144', 1); }   // V146 : tri par date de départ (la plus proche en haut), plateformes mélangées — par défaut une seule fois, ton choix est gardé ensuite
  // Données gardées sur l'appareil : consultables hors connexion.
  const cache = lireLocal('cp_cache', null); if (cache) { etat.factures = cache.factures || []; etat.missions = window.CPFiltres.francais(deLEdition(cache.missions)); etat.alertes = seulesNouvelles(cache.alertes); etat.reglages = cache.reglages || null; etat.chargeLe = cache.chargeLe; }

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500); }
  const fmtDate = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const heure = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const jourCourt = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' }); };
  // V122 : période de plusieurs jours (DriiveMe) → « du ven. 09/10 au lun. 12/10 » ; même jour → heures comme avant.
  // V139 : dates et heures de mission en GROS et en couleur : rouge < 24 h, orange < 3 jours, vert au-delà, gris si dépassée.
  // V139 : villes de départ (vert) et d'arrivée (rouge) en gros ; adresses, km, durée et loueur lisibles.
  const trajetHtml = m => { const t = String(trajet(m)), i = t.indexOf(' → '); return i < 0 ? esc(t) : `<span class="vD"><span class="fg fgD">⚑</span>${esc(t.slice(0, i))}</span> <span class="fl">→</span> <span class="vA"><span class="fg">🏁</span>${esc(t.slice(i + 3))}</span>`; };
  // L'icône 🗺️ d'une carte de mission ouvre la visualisation du trajet SANS ouvrir la fiche.
  document.addEventListener('click', ev => { const ic = ev.target && ev.target.closest && ev.target.closest('[data-carte]'); if (!ic) return; ev.preventDefault(); ev.stopPropagation(); const m = etat.missions.find(x => x.platform + '|' + x.external_id === ic.dataset.carte); if (m) popupVol(m); }, true);
  const classeQuand = m => { const t = Date.parse(m.pickup_start || ''); if (!Number.isFinite(t)) return 'q-inconnu'; const f = Date.parse(m.pickup_end || m.delivery_end || '') || t; if (f < Date.now()) return 'q-passee'; const h = (t - Date.now()) / 3600000; return h < 24 ? 'q-urgent' : h < 72 ? 'q-proche' : 'q-ok'; };
  const quandHtml = (m, ico) => `<span class="quand ${classeQuand(m)}">${ico || '📅'} ${esc(quand(m))}</span>`;
  // V154 : créneau exact (heure de Paris). Jamais 00:00–23:59 : si l'heure n'est pas précisée, on l'écrit.
  const heureP = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); };
  const quand = m => {
    if (!m.pickup_start) return m.pickup_text || 'Date non fournie';
    const hd = heureP(m.pickup_start), hf = m.pickup_end ? heureP(m.pickup_end) : '';
    const j0 = jourCourt(m.pickup_start), j1 = m.pickup_end ? jourCourt(m.pickup_end) : '';
    const journee = hd === '00:00' && (!m.pickup_end || hf === '23:59' || hf === '00:00');
    if (journee) return (j1 && j1 !== j0 ? 'du ' + j0 + ' au ' + j1 : j0) + ' · heure non précisée';
    if (j1 && j1 !== j0) return j0 + ' ' + hd + ' → ' + j1 + ' ' + hf;
    if (!hf || Date.parse(m.pickup_end) <= Date.parse(m.pickup_start)) return j0 + ' · ' + hd;
    return j0 + ' · ' + hd + '–' + hf;
  };

  // V157 : arrivée affichée avec le départ (créneau d'arrivée de la plateforme, sinon départ + durée estimée si l'heure de départ est connue).
  const arriveeTxt = m => {
    const a = m.delivery_start, b = m.delivery_end;
    if (a || b) return quand({ pickup_start: a || b, pickup_end: a && b ? b : null, pickup_text: '' });
    const h = Number(m.duree_h);
    if (m.pickup_start && Number.isFinite(h) && h > 0 && heureP(m.pickup_start) !== '00:00') return '≈ ' + quand({ pickup_start: new Date(Date.parse(m.pickup_start) + h * 3600000).toISOString() }) + ' (estimée)';
    return '';
  };
  const arriveeHtml = m => { const t = arriveeTxt(m); return t ? '<span class="quand q-ok">🏁 Arrivée : ' + esc(t) + '</span>' : ''; };

  // ---------- Écrans d'accès ----------
  function ecranConfiguration() {
    $('onglets').hidden = true; $('actualiser').hidden = true; $('pastille').hidden = true; $('sousTitre').textContent = 'Première configuration';
    $('ecran').innerHTML = `<div class="carte"><h2>Relier l’application à ton compte</h2>
      <p class="doux">Renseigne l’adresse de ton serveur Convoyage Ultra et sa clé publique (Supabase → Project Settings → API). Ces informations sont les mêmes que dans l’extension.</p>
      <label for="cUrl">Adresse du serveur</label><input id="cUrl" type="url" placeholder="https://xxxx.supabase.co" autocomplete="off">
      <label for="cCle">Clé publique (anon)</label><input id="cCle" autocomplete="off" placeholder="eyJ…">
      <div class="erreur" id="cErr" hidden></div><button id="cOk" style="width:100%;margin-top:14px">Continuer</button></div>`;
    $('cOk').onclick = () => {
      const url = normaliserServeur($('cUrl').value), cle = $('cCle').value.trim();
      if (!/^https:\/\/[a-z0-9-]{3,63}\.supabase\.co$/i.test(url) || cle.length < 20) { $('cErr').textContent = 'Adresse (https://xxxx.supabase.co) ou clé invalide.'; $('cErr').hidden = false; return; }
      cfg = { url, anonKey: cle }; ecrireLocal('cp_config', cfg); api = new window.CPApi(url, cle); demarrer();
    };
  }
  function ecranConnexion(msg) {
    transportReturnPlans.clear();
    $('onglets').hidden = true; $('actualiser').hidden = true; $('pastille').hidden = true; $('sousTitre').textContent = 'Connexion';
    $('ecran').innerHTML = `<div class="carte"><h2>Connexion à Convoyage Ultra</h2>
      <p class="doux">Utilise le même compte que dans l’extension de ton ordinateur. Ce n’est pas ton compte Hiflow, DriiveMe, Otoqi ou Pop Valet.</p>
      <label for="lEmail">E-mail</label><input id="lEmail" type="email" autocomplete="username" inputmode="email">
      <label for="lMdp">Mot de passe</label><input id="lMdp" type="password" autocomplete="current-password">
      <div class="erreur" id="lErr" ${msg ? '' : 'hidden'}>${esc(msg || '')}</div>
      <button id="lOk" style="width:100%;margin-top:14px">Se connecter</button>
      <button id="lCree" class="second" style="width:100%;margin-top:8px">Créer un compte</button>
      <button id="lOubli" class="second" style="width:100%;margin-top:8px">Mot de passe oublié ?</button>
      ${cfgFichier.url ? '' : '<p class="doux" style="margin-top:14px"><a href="#" id="lServeur">Changer de serveur</a></p>'}</div>`;
    const go = async creer => {
      const e = $('lEmail').value.trim(), p = $('lMdp').value; const err = $('lErr');
      if (!e.includes('@') || p.length < 8) { err.textContent = 'E-mail valide et mot de passe de 8 caractères minimum.'; err.hidden = false; return; }
      $('lOk').disabled = $('lCree').disabled = true;
      try {
        if (creer) { const r = await api.creerCompte(e, p); if (r === 'confirmation') { $('lMdp').value = ''; err.textContent = 'Compte créé : confirme ton e-mail avec le lien reçu, puis connecte-toi.'; err.hidden = false; return; } }
        else await api.connexion(e, p);
        $('lMdp').value = ''; demarrer();
      } catch (x) { err.textContent = String(x.message || x); err.hidden = false; }
      finally { const a = $('lOk'), b = $('lCree'); if (a) a.disabled = false; if (b) b.disabled = false; }
    };
    $('lOk').onclick = () => go(false); $('lCree').onclick = () => go(true);
    // V242 : mot de passe oublié → mail de réinitialisation (le lien ramène ici sur l'écran « Choisissez votre mot de passe »).
    $('lOubli').onclick = async () => {
      const e = $('lEmail').value.trim(), err = $('lErr');
      if (!e.includes('@')) { err.textContent = 'Écrivez d’abord votre e-mail dans la case ci-dessus.'; err.hidden = false; return; }
      $('lOubli').disabled = true;
      try {
        const r = await fetch(api.url + '/auth/v1/recover', { method: 'POST', headers: { apikey: api.cle, 'content-type': 'application/json' }, body: JSON.stringify({ email: e }) });
        if (!r.ok) { let j = null; try { j = await r.json(); } catch (_) {} throw new Error((j && (j.msg || j.message || j.error_description)) || ('Erreur ' + r.status)); }
        err.textContent = 'Si ce compte existe, un e-mail vient d’être envoyé (pensez à regarder les indésirables). Appuyez sur le lien qu’il contient.'; err.hidden = false;
      } catch (x) { err.textContent = String(x.message || x); err.hidden = false; }
      finally { const b = $('lOubli'); if (b) b.disabled = false; }
    };
    const s = $('lServeur'); if (s) s.onclick = ev => { ev.preventDefault(); localStorage.removeItem('cp_config'); cfg = null; api = null; ecranConfiguration(); };
  }

  // V88 : « https://xxxx.supabase.co/rest/v1/ » ou adresse sans « https:// » → https://xxxx.supabase.co
  function normaliserServeur(u) {
    const t = String(u || '').trim(); if (!t) return '';
    try { const x = new URL(/^[a-z]+:\/\//i.test(t) ? t : 'https://' + t); if (/^[a-z0-9-]{3,63}\.supabase\.co$/i.test(x.hostname)) return 'https://' + x.hostname.toLowerCase(); } catch (_) {}
    return t.replace(/\/+$/, '');
  }
  window.__cpNormaliserServeur = normaliserServeur;
  // ---------- Données ----------
  // ---------- V146 : heures de désactivation (nuit) : le convoyeur choisit, rien n'est imposé ----------
  const minutesDe = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : 0; };
  const lirePause = () => { const p = lireLocal('cp_pause', null) || {}; return { choix: p.choix === 'oui' || p.choix === 'non' ? p.choix : null, debut: p.debut || '19:00', fin: p.fin || '07:00' }; };
  function pauseActive(date) {
    const p = lirePause(); if (p.choix !== 'oui') return false;
    const h = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris' }).format(date || new Date());
    const now = minutesDe(h.replace('h', ':').replace(/^24/, '00')), d = minutesDe(p.debut), f = minutesDe(p.fin);
    if (d === f) return false; return d < f ? now >= d && now < f : now >= d || now < f;
  }
  function enregistrerPause(choix, debut, fin) {
    const p = { choix, debut: /^\d{1,2}:\d{2}$/.test(debut) ? debut : '19:00', fin: /^\d{1,2}:\d{2}$/.test(fin) ? fin : '07:00' }; ecrireLocal('cp_pause', p);
    try { if (window.CPNatif && window.CPNatif.reglerPause) window.CPNatif.reglerPause(JSON.stringify(p)); } catch (_) {}   // l'application Android arrête/reprend sa lecture
    return p;
  }
  // V149 : à chaque ouverture, le choix « heures de désactivation » enregistré est renvoyé à l'application Android (sinon elle garde 07h–20h par défaut et Hiflow ne se lit pas la nuit).
  setTimeout(() => { try { const p = lirePause(); if (p.choix) enregistrerPause(p.choix, p.debut, p.fin); } catch (_) {} }, 3000);
  function questionPause() {
    if (lirePause().choix || !$('feuille') || !api?.connecte) return;
    $('feuilleContenu').innerHTML = `<h3 style="margin:0 0 6px">Heures de désactivation la nuit ?</h3>
      <p class="doux">Pendant ces heures, la lecture des plateformes, la mise à jour des missions et l’envoi des alertes sont arrêtés. Tu pourras changer ce choix à tout moment dans Réglages.</p>
      <label for="pDeb">Arrêt à</label><input id="pDeb" type="time" value="19:00"><label for="pFin">Reprise à</label><input id="pFin" type="time" value="07:00">
      <div class="boutons" style="margin-top:12px"><button id="pOui">Oui, désactiver la nuit</button><button id="pNon" class="second">Non, toujours actif</button></div>`;
    $('feuille').hidden = false;
    $('pOui').onclick = () => { enregistrerPause('oui', $('pDeb').value, $('pFin').value); $('feuille').hidden = true; toast('Désactivation la nuit : activée'); };
    $('pNon').onclick = () => { enregistrerPause('non', '19:00', '07:00'); $('feuille').hidden = true; toast('Toujours actif'); };
  }

  async function charger(silencieux) {
    if (!api?.connecte) return;
    if (silencieux && pauseActive()) return;   // V146 : heures de désactivation
    try {
      const [missions, alertes, reglages, factures] = await Promise.all([api.missions(), api.alertes(), api.reglages(), api.factures()]);
      etat.facturesServeur = factures !== null; if (factures) etat.factures = factures;   // V96
      try { etat.sources = await api.sourcesEtat(); } catch (_) { etat.sources = null; }   // V114
      const alertesNouv = seulesNouvelles(alertes);
      const avant = new Set(etat.alertes.map(a => a.id));
      const nouvelles = alertesNouv.filter(a => !a.lue && !avant.has(a.id));
      Object.assign(etat, { missions: window.CPFiltres.francais(deLEdition(missions)), alertes: alertesNouv, reglages, chargeLe: new Date().toISOString(), erreur: '' });
      ecrireLocal('cp_cache', { missions: etat.missions, alertes: etat.alertes, reglages: etat.reglages, chargeLe: etat.chargeLe, factures: etat.factures });
      if (etat.chargeLeDejaVu && nouvelles.length && !pauseActive()) notifier(nouvelles);
      // V233 : à chaque ouverture / retour au premier plan, on réexamine les alertes non lues de moins de 6 h (une alerte arrivée écran éteint n'était montrée qu'en petite notification)
      if (!pauseActive()) alerteRetour(alertesNouv.filter(a => { if (a.lue) return false; const d = Date.parse(a.created_at || a.cree_le || a.date || ''); return !Number.isFinite(d) || Date.now() - d < 6 * 3600000; }));
      etat.chargeLeDejaVu = true;
      if (!silencieux) toast('Missions à jour');
    } catch (e) {
      etat.erreur = String(e.message || e); majPastille();
      if (!api.connecte) return ecranConnexion(etat.erreur);
      if (!silencieux) toast('Hors connexion : dernières données affichées');
    }
    afficher(); ouvrirMissionDemandee();
  }
  // Notification tant que l'application est ouverte ou en arrière-plan récent. Les notifications
  // application fermée demandent l'envoi « push » (étape suivante, côté serveur).
  // V160 : réglages « notifications » et « son » de cet appareil (aussi transmis à l'application Android et au service de notifications).
  function prefNotif() { const l = lireLocal('cp_notif', null) || {}; return { on: l.on !== false, son: l.son !== false }; }
  function appliquerPrefsNotif(p) {
    ecrireLocal('cp_notif', p);
    try { if (window.CPNatif && window.CPNatif.reglerNotifs) window.CPNatif.reglerNotifs(JSON.stringify(p)); } catch (_) {}
    try { if ('caches' in window) caches.open('cp-prefs').then(c => c.put(new URL('prefs-notif', document.baseURI).href, new Response(JSON.stringify(p)))).catch(() => {}); } catch (_) {}
  }
  function brancherPrefsNotif() {
    const a = $('nPrefOn'), s = $('nPrefSon'); if (!a || !s) return; const p = prefNotif(); a.checked = p.on; s.checked = p.son; s.disabled = !p.on; appliquerPrefsNotif(p);
    a.onchange = async () => {
      const q = { on: a.checked, son: s.checked }; appliquerPrefsNotif(q); s.disabled = !q.on;
      if (!q.on) { try { const reg = await navigator.serviceWorker?.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) { await api.desabonnerPush(sub.endpoint); await sub.unsubscribe(); } } catch (_) {} toast('Notifications coupées sur cet appareil'); etatNotifications(); }
      else { toast('Notifications activées'); try { await activerNotifications(); } catch (_) {} }
    };
    s.onchange = () => { appliquerPrefsNotif({ on: a.checked, son: s.checked }); toast(s.checked ? 'Son et vibration activés' : 'Notifications sans son ni vibration'); };
  }
  // V229 : GROSSE ALERTE quand une nouvelle mission te ramène vers ton domicile pendant une mission commencée (règles de l'onglet Retours).
  const missionEnCours = () => { const now = Date.now(); return etat.missions.find(m => { if (m.kind !== 'acceptee') return false; const p = Date.parse(m.pickup_start || ''), f = Date.parse(m.delivery_end || m.delivery_start || ''); return Number.isFinite(p) && Number.isFinite(f) && p <= now && now <= f + 3600000; }) || null; };
  const retourVus = new Set(lireLocal('cp_retour_vus', []));   // V233 : mémorisé, pour ne jamais perdre ni répéter une alerte de retour
  const memoRetourVus = () => ecrireLocal('cp_retour_vus', [...retourVus].slice(-200));
  function alerteRetour(nouvelles) {
    try {
      const src = missionEnCours(); if (!src || !RT.domicile(etat.reglages)) return;
      const acceptees = etat.missions.filter(x => x.kind === 'acceptee'), jP = ms => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date(ms));
      const trouves = [];
      for (const al of nouvelles) {
        const c = missionDeAlerte(al); if (!c || c.kind === 'acceptee' || retourVus.has(RT.cle(c))) continue;
        const res = RT.retours(src, [c], etat.reglages, { acceptees });
        const z = res.compatibles.find(x => RT.cle(x.mission) === RT.cle(c) && Number.isFinite(x.rapprocheKm) && x.rapprocheKm > 0 && !(res.finSource && x.arrivee != null && jP(x.arrivee) !== jP(res.finSource.t)));
        if (z) trouves.push({ c, z });
      }
      if (!trouves.length) return;
      trouves.sort((a, b) => b.z.rapprocheKm - a.z.rapprocheKm);
      for (const x of trouves) retourVus.add(RT.cle(x.c));
      memoRetourVus();
      grosseAlerteRetour(trouves);
    } catch (_) {}
  }
  function grosseAlerteRetour(liste) {
    const ancien = document.getElementById('cpRetourAlerte'); if (ancien) ancien.remove();
    const d = document.createElement('div'); d.id = 'cpRetourAlerte'; d.setAttribute('role', 'alertdialog');
    const carte = (e, k) => { const c = e.c, z = e.z, nom = PLATS[c.platform] || c.platform;
      const lien = c.detail_url && /^https:\/\//.test(c.detail_url) ? c.detail_url : LIENS[c.platform];
      const href = lienAppliAutre(c.platform, lien) || lien || '#';
      const net = z.rentabilite && Number.isFinite(Number(z.rentabilite.net)) ? 'net ≈ ' + euros(z.rentabilite.net) : '';
      return '<div class="rcCarte" style="' + (k ? 'border-top:3px dashed #16a34a;margin-top:14px;padding-top:12px' : '') + '"><div class="rcPlat">' + esc(nom) + '</div><div class="rcTrajet">' + esc(c.from_city || '?') + ' → ' + esc(c.to_city || '?') + '</div><div class="rcPrix">' + (c.fee !== null && c.fee !== undefined ? esc(euros(c.fee)) : '—') + (net ? ' · ' + esc(net) : '') + '</div><div class="rcInfo">Te rapproche de ' + Math.round(z.rapprocheKm) + ' km · il resterait ' + Math.round(z.retourDomicileKm || 0) + ' km jusqu’à chez toi</div><button class="rcVoir" data-k="' + k + '">👁️ Voir la mission</button><a class="rcLien" href="' + esc(href) + '" target="_blank" rel="noopener"><button class="rcPf">➡️ Aller sur ' + esc(nom) + '</button></a></div>'; };
    d.innerHTML = '<div class="rcBoite" style="max-height:94vh;overflow-y:auto"><div class="rcTitre">🏠 RETOUR VERS TON DOMICILE</div><div class="rcSous">' + (liste.length > 1 ? liste.length + ' nouvelles missions' : 'Nouvelle mission') + ' pendant ta mission en cours</div>' + liste.map(carte).join('') + '<button class="rcFermer" id="rcFermer">Ignorer</button></div>';
    document.body.appendChild(d);
    const fermer = () => { try { d.remove(); } catch (_) {} };
    for (const b of d.querySelectorAll('.rcVoir')) b.onclick = () => { fermer(); try { detail(liste[Number(b.dataset.k)].c); } catch (_) {} };
    document.getElementById('rcFermer').onclick = fermer;
    try { if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 900]); } catch (_) {}
    try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.35, 0.7].forEach(s => { const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 880; g.gain.value = 0.2; o.start(ac.currentTime + s); o.stop(ac.currentTime + s + 0.2); }); } catch (_) {}
    try { if (prefNotif().on && 'Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.showNotification('🏠 Retour vers ton domicile', { body: liste.map(e => (e.c.from_city || '?') + ' → ' + (e.c.to_city || '?')).join(' | '), icon: 'icones/icone-192.png', tag: 'retour-domicile', requireInteraction: true, vibrate: [500, 200, 500, 200, 900] }); }); } catch (_) {}
  }
  async function notifier(liste) {
    toast(liste[0].message);
    try {
      if (!prefNotif().on || !('Notification' in window) || Notification.permission !== 'granted') return;
      const reg = await navigator.serviceWorker?.getRegistration();
      for (const a of liste.slice(0, 3)) {
        const titre = ({ hausse_prix: 'Hausse de prix', mission_acceptee: 'Mission acceptée', mission_modifiee: 'Mission modifiée', mission_annulee: 'Mission annulée ?' })[a.type] || 'Nouvelle mission';
        if (reg) reg.showNotification(titre, { body: a.message, icon: 'icones/icone-192.png', tag: 'cp-' + a.id, silent: !prefNotif().son }); else new Notification(titre, { body: a.message, silent: !prefNotif().son });
      }
    } catch (_) {}
  }

  // ---------- V114 : pastille verte / orange / rouge en haut ----------
  function etatPlateformes() {
    if (pauseActive()) return { couleur: 'gris', resume: 'En pause : heures de désactivation (reprise à ' + lirePause().fin.replace(':', 'h') + ')', details: [] };   // V146 : la nuit choisie, pas une panne
    return window.CPEtat.etat(etat.sources, Date.now(), { horsConnexion: !!etat.erreur });
  }
  // V152 : fenêtre d'alerte bien visible quand il faut se reconnecter à DriiveMe ou Hiflow
  function alerteConnexion() {
    try {
      const lignes = (etat.sources || []).filter(s => /driiveme|conduisez|hiflow|pop ?valet|otoqi/i.test(String(s.platform)) && s.ok === false && /connect|identifi|session|login/i.test(String(s.message || '')) && !/internet|réseau|reseau|serveur/i.test(String(s.message || '')));
      const ancienne = document.getElementById('alerteCo');
      if (!lignes.length || pauseActive()) { if (ancienne) ancienne.remove(); return; }
      if (ancienne || (window.__coSnooze && Date.now() < window.__coSnooze)) return;
      const noms = [...new Set(lignes.map(s => (/hiflow/i.test(String(s.platform)) ? 'Hiflow' : /otoqi/i.test(String(s.platform)) ? 'Otoqi' : /pop ?valet/i.test(String(s.platform)) ? 'Pop Valet' : 'DriiveMe')))];
      const d = document.createElement('div'); d.id = 'alerteCo';
      d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:16px';
      d.innerHTML = '<div style="background:#fff;color:#111;border:4px solid #d32f2f;border-radius:16px;padding:20px;max-width:420px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.5)">' +
        '<div style="font-size:26px;font-weight:800;color:#d32f2f;margin-bottom:8px">⚠ Reconnexion nécessaire</div>' +
        '<p style="font-size:17px;line-height:1.4;margin:0 0 14px">' + noms.map(n => '<b>' + n + '</b>').join(' et ') + (noms.length > 1 ? ' ne sont plus connectés' : ' n’est plus connecté') + ' : <b>aucune mission n’est lue</b> tant que tu ne te reconnectes pas.</p>' +
        noms.map(n => (n === 'Otoqi' || n === 'Pop Valet') ? '<p style="font-size:16px;margin:0 0 10px;padding:12px;border-radius:12px;background:#fdecea">Ouvre l’application <b>' + n + '</b> sur le téléphone et reconnecte-toi.</p>' : '<button type="button" data-co="' + n + '" style="display:block;width:100%;margin:0 0 10px;padding:16px;font-size:18px;font-weight:700;border:0;border-radius:12px;background:#d32f2f;color:#fff">Me reconnecter à ' + n + '</button>').join('') +
        '<button type="button" id="coPlusTard" style="display:block;width:100%;padding:12px;font-size:15px;border:1px solid #999;border-radius:12px;background:#fff;color:#333">Plus tard (rappel dans 10 min)</button></div>';
      document.body.appendChild(d);
      try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (_) {}
      d.querySelectorAll('[data-co]').forEach(b => b.addEventListener('click', () => {
        const n = b.getAttribute('data-co'); let ok = false;
        try { if (window.CPNatif && window.CPNatif.ouvrirConnexion) ok = window.CPNatif.ouvrirConnexion(n) === 'ok'; } catch (_) {}
        if (!ok) window.open(n === 'Hiflow' ? 'https://www.hiflow.com' : 'https://www.driiveme.com', '_blank');
        window.__coSnooze = Date.now() + 3 * 60000; d.remove();
      }));
      d.querySelector('#coPlusTard').addEventListener('click', () => { window.__coSnooze = Date.now() + 10 * 60000; d.remove(); });
    } catch (_) {}
  }
  setInterval(() => { try { alerteConnexion(); } catch (_) {} }, 60000);
  function majPastille() {
    const b = $('pastille'); if (!b) return; const e = etatPlateformes();
    b.hidden = false; b.className = 'pastille ' + e.couleur; b.setAttribute('aria-label', 'État des plateformes : ' + e.resume); b.title = e.resume; alerteConnexion();
  }
  function feuilleEtat() {
    const e = etatPlateformes();
    $('feuilleContenu').innerHTML = `<h3 style="margin:0 0 6px">État des plateformes</h3><div class="ligneEtat" style="border:0"><span class="pt ${e.couleur}"></span><div><b>${esc(e.resume)}</b></div></div>` +
      e.details.map(d => `<div class="ligneEtat"><span class="pt ${d.couleur}"></span><div><b>${esc(PLATS[d.platform] || d.platform)}</b><div class="doux">${esc(d.texte)}</div></div></div>`).join('') +
      `<p class="doux" style="margin-top:10px">Vert : lecture récente. Orange : lecture ralentie ou en pause. Rouge : pas de lecture depuis longtemps ou extension éteinte. Gris : état inconnu.</p>`;
    $('feuille').hidden = false; $('feuille').querySelector('.feuilleBoite').scrollTop = 0;
  }
  // ---------- Affichage ----------
  function afficher() {
    $('onglets').hidden = false; $('actualiser').hidden = false; majPastille();
    const nonLues = etat.alertes.filter(a => !a.lue).length; const b = $('badge'); b.hidden = !nonLues; b.textContent = nonLues > 99 ? '99+' : nonLues;
    for (const x of document.querySelectorAll('#onglets button')) x.classList.toggle('actif', x.dataset.onglet === etat.onglet);
    const titres = { missions: 'Missions disponibles', agenda: 'Agenda — missions acceptées', planning: 'Multi Jours', factures: 'Factures validées et bénéfice', alertes: 'Alertes', reglages: 'Réglages' };
    $('sousTitre').textContent = titres[etat.onglet] + (etat.chargeLe ? ' · mis à jour ' + heure(etat.chargeLe) : '');
    $('ecran').dataset.vue = etat.onglet;   // V122 : habillage propre à chaque écran (couleurs de fond, polices)
    ({ missions: vueMissions, agenda: vueAgenda, planning: vuePlanning, factures: vueFactures, alertes: vueAlertes, reglages: vueReglages })[etat.onglet]();
  }
  // V89 : la ville est TOUJOURS suivie de son département : « Valence (26) » (département de la plateforme, sinon code postal, sinon ville connue).
  function lieu(m, cote) {
    const v = cote === 'origin' ? m.from_city : m.to_city; if (!v) return '?';
    const d = G.departementMission(m, cote); return d && !new RegExp('\\(' + d + '\\)\\s*$').test(v) ? v + ' (' + d + ')' : v;
  }
  const trajet = m => lieu(m, 'origin') + ' → ' + lieu(m, 'destination');
  // V75 : mode confidentiel Hiflow → l'adresse exacte est volontairement restée sur l'ordinateur.
  const LOCAL = 'Adresse exacte sur ton ordinateur (mode confidentiel Hiflow)';
  // V138 : cherche (une seule fois par adresse) le point GPS des adresses connues ; échec → on réessaie dans 1 jour ; sans point exact, la ville (puis le département) sert de repère, marqué « approximatif ».
  const gpsMem = lireLocal('cp_gps', {}) || {}; Object.assign(G.POINTS, gpsMem.pts || {}); gpsMem.pts = gpsMem.pts || {}; gpsMem.rate = gpsMem.rate || {};
  let gpsOccupe = false, gpsTimer = null;
  function planifierGps() { if (gpsTimer || gpsOccupe) return; gpsTimer = setTimeout(async () => { gpsTimer = null; gpsOccupe = true; let n = 0, nb = 0;
    try { for (const m of etat.missions.slice(0, 400)) for (const cote of ['origin', 'destination']) { if (nb >= 25) break; const cle = G.cleAdresse(m, cote); if (!cle || G.POINTS[cle] || (gpsMem.rate[cle] && Date.now() - gpsMem.rate[cle] < 864e5)) continue; const c0 = m[cote]; if (c0 && Number.isFinite(Number(c0.lat)) && Number(c0.lat) !== 0) continue; nb++;
      try { const r = await G.chercherPoint(m, cote, u => fetch(u)); if (r && r.trouve) { G.POINTS[cle] = r.point; gpsMem.pts[cle] = r.point; n++; } else gpsMem.rate[cle] = Date.now(); } catch (_) { gpsMem.rate[cle] = Date.now(); } }
    } finally { gpsOccupe = false; ecrireLocal('cp_gps', gpsMem); if (n) listeMissions(); } }, 1500); }
  const mentionGps = (m, cote) => { const c = G.coordonnees(m, cote); const t = !c ? ['⚠️', 'aucun point GPS (lieu inconnu)'] : c.precision === 'gps' ? ['📍', 'point GPS exact (donné par la plateforme)'] : c.precision === 'adresse' ? ['📍', 'point GPS de l’adresse (vérifié)'] : c.precision === 'rue' ? ['📍', 'point GPS de la rue (vérifié)'] : c.precision === 'ville' ? ['📌', 'approximatif : centre de la ville'] : ['📌', 'approximatif : centre du département']; return `<span class="doux gpsInfo">${t[0]} ${esc(t[1])}</span>`; };
  // V138 : fenêtre « trajet à vol d'oiseau » : schéma départ → arrivée (sans fond de carte, rien n'est téléchargé), distance à vol d'oiseau et route estimée.
  function popupVol(m) {
    const tP = performance.now();
    const ancien = document.getElementById('popVol'); if (ancien) ancien.remove();
    const d = document.createElement('div'); d.id = 'popVol'; d.className = 'popVol'; d.setAttribute('role', 'dialog');
    document.body.appendChild(d); d.onclick = ev => { if (ev.target === d || ev.target.id === 'popVolX') d.remove(); };
    const W = 320, H = 260, px = (p, z) => { const n = 256 * 2 ** z, r = p.lat * Math.PI / 180; return [(p.lng + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n]; };
    const ap = p => p.precision === 'gps' || p.precision === 'adresse' || p.precision === 'rue' ? 'point précis' : p.precision === 'ville' ? 'centre de la commune (approximatif)' : 'centre du département (approximatif)';
    // Carte OpenStreetMap (gratuite) : vignettes 256 px calculées ici, sans bibliothèque ; le zoom est choisi pour que tout le tracé tienne.
    const dessiner = (a, b, routes) => {
      if (window.CPPh) window.CPPh('dessin de la carte');
      const maigre = c => { const n = c.length, p = Math.ceil(n / 400); return p > 1 ? c.filter((_, i) => i % p === 0 || i === n - 1) : c; };
      const lignes = routes.filter(r => r.coords && r.coords.length > 1).map(r => Object.assign({}, r, { coords: maigre(r.coords) })), pts = lignes.length ? [].concat(...lignes.map(r => r.coords)) : [[a.lng, a.lat], [b.lng, b.lat]];
      let z = 14; for (; z > 2; z--) { const P = pts.map(q => px({ lng: q[0], lat: q[1] }, z)), xs = P.map(q => q[0]), ys = P.map(q => q[1]); if (Math.max(...xs) - Math.min(...xs) <= W * 0.8 && Math.max(...ys) - Math.min(...ys) <= H * 0.8) break; }
      const P = pts.map(q => px({ lng: q[0], lat: q[1] }, z)), xs = P.map(q => q[0]), ys = P.map(q => q[1]), ox = (Math.min(...xs) + Math.max(...xs)) / 2 - W / 2, oy = (Math.min(...ys) + Math.max(...ys)) / 2 - H / 2, N = 2 ** z;
      let tuiles = ''; for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++) for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++) if (ty >= 0 && ty < N) tuiles += `<img alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer" src="https://tile.openstreetmap.org/${z}/${((tx % N) + N) % N}/${ty}.png" style="position:absolute;left:${Math.round(tx * 256 - ox)}px;top:${Math.round(ty * 256 - oy)}px;width:256px;height:256px">`;
      const A = px(a, z), B = px(b, z), pl = (co, coul, dash, ep) => `<polyline points="${co.map(q => { const t = px({ lng: q[0], lat: q[1] }, z); return (t[0] - ox).toFixed(1) + ',' + (t[1] - oy).toFixed(1); }).join(' ')}" fill="none" stroke="${coul}" stroke-width="${ep}" stroke-linejoin="round" stroke-linecap="round"${dash ? ' stroke-dasharray="9 6"' : ''}/>`;
      const traces = lignes.length ? lignes.map(r => pl(r.coords, r.couleur, r.pointille, r.ep)).join('') : pl([[a.lng, a.lat], [b.lng, b.lat]], '#1d4ed8', true, 4);
      return `<div class="carteVol" style="position:relative;width:${W}px;max-width:100%;height:${H}px;overflow:hidden;border-radius:10px;background:var(--accentDoux);margin:0 auto">${tuiles}<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;left:0;top:0" role="img" aria-label="Trajet">${traces}<circle cx="${A[0] - ox}" cy="${A[1] - oy}" r="8" fill="#16a34a" stroke="#fff" stroke-width="2"/><circle cx="${B[0] - ox}" cy="${B[1] - oy}" r="8" fill="#dc2626" stroke="#fff" stroke-width="2"/></svg><span style="position:absolute;right:3px;bottom:2px;font-size:10px;background:rgba(255,255,255,.8);color:#333;padding:0 4px;border-radius:3px">© OpenStreetMap</span></div>`;
    };
    // Itinéraires gratuits (OpenStreetMap) : Valhalla (FOSSGIS) sait éviter les péages (use_tolls 0) ou les accepter (1) ; OSRM sert de secours pour le trajet « avec péages ».
    const decoder = (enc, prec) => { const out = []; let i = 0, lat = 0, lng = 0; while (i < enc.length) { for (const k of [0, 1]) { let r = 0, sh = 0, c; do { c = enc.charCodeAt(i++) - 63; r |= (c & 31) << sh; sh += 5; } while (c >= 32); const v = (r & 1) ? ~(r >> 1) : (r >> 1); if (k === 0) lat += v; else lng += v; } out.push([lng / 10 ** prec, lat / 10 ** prec]); } return out; };
    const fetchT = (u, o) => { const c = new AbortController(), t = setTimeout(() => c.abort(), 20000); return fetch(u, Object.assign({}, o, { signal: c.signal })).finally(() => clearTimeout(t)); };
    const valhalla = async (a, b, peages) => { let fin = null; if (peages) { const ck = [a.lat, a.lng, b.lat, b.lng].map(n => Number(n).toFixed(3)).join('|'); (window.CPValP = window.CPValP || {})[ck] = new Promise(o => { fin = o; }); setTimeout(() => { if (fin) fin(null); }, 30000); } try { const r = await fetchT('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locations: [{ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng }], costing: 'auto', costing_options: { auto: { use_tolls: peages ? 1 : 0 } }, directions_options: { units: 'kilometers' } }) }); const j = r.ok ? await r.json() : null, t = j && j.trip; if (fin) fin(j); return t && t.legs && t.legs[0] && t.legs[0].shape ? { coords: decoder(t.legs[0].shape, 6), km: t.summary.length, h: t.summary.time / 3600, peageKm: Array.isArray(t.legs[0].maneuvers) ? t.legs[0].maneuvers.reduce((s, x) => s + (x && x.toll ? Number(x.length) || 0 : 0), 0) : null } : null; } catch (_) { if (fin) fin(null); return null; } };
    const osrm = async (a, b) => { try { const r = await fetchT('https://router.project-osrm.org/route/v1/driving/' + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=simplified&geometries=geojson'); const j = r.ok ? await r.json() : null, rt = j && j.code === 'Ok' && j.routes && j.routes[0]; return rt && rt.geometry && rt.geometry.coordinates.length > 1 ? { coords: rt.geometry.coordinates, km: rt.distance / 1000, h: rt.duration / 3600 } : null; } catch (_) { return null; } };
    const itineraire = async (a, b, sansPeage) => sansPeage ? valhalla(a, b, false) : ((await valhalla(a, b, true)) || (await osrm(a, b)));
    const rendre = async () => {
      if (window.CPT) window.CPT('points GPS', tP);
      const a = G.coordonnees(m, 'origin'), b = G.coordonnees(m, 'destination');
      const cadre = (carte, bas) => `<div class="popVolBoite"><button class="icone" id="popVolX" aria-label="Fermer">✕</button><h3>🗺️ Visualisation trajet estimé</h3>${carte}<p class="doux">🟢 ${esc(m.from_city || 'Départ')} → 🔴 ${esc(m.to_city || 'Arrivée')}</p>${bas}</div>`;
      if (!a || !b) { d.innerHTML = '<div class="popVolBoite"><button class="icone" id="popVolX" aria-label="Fermer">✕</button><h3>🗺️ Visualisation trajet estimé</h3><p>Départ ou arrivée non localisable : pas de carte possible.</p></div>'; return; }
      d.dataset.pts = [a.lat, a.lng, b.lat, b.lng].join(',');   // V249 : points du trajet pour le calcul automatique du péage
      const pts = `<p class="doux">🟢 Départ : ${esc(ap(a))} · 🔴 Arrivée : ${esc(ap(b))}.</p>`;
      d.innerHTML = cadre(dessiner(a, b, []), '<p>Calcul des deux trajets en cours…</p>' + pts);
      if (window.CPPh) window.CPPh('attente des itinéraires');
      const tI = performance.now();
      const [avec, sans] = await Promise.all([itineraire(a, b, false), itineraire(a, b, true)]);
      if (window.CPT) window.CPT('itinéraires', tI);
      if (window.CPPh) window.CPPh('affichage des résultats');
      if (!document.getElementById('popVol')) return;
      const meme = avec && sans && Math.abs(avec.km - sans.km) < 1;
      const ligne = (ico, nom, r) => r ? `<p>${ico} <b>${nom} : ≈ ${esc(Math.round(r.km))} km</b> · ≈ ${esc(duree(r.h))} en voiture, sans pause</p>` : `<p>${ico} ${nom} : indisponible : le service gratuit de calcul n’a pas répondu depuis ce téléphone</p>`;
      let bas;
      if (meme) bas = ligne('🛣️', 'Trajet (aucun péage sur le parcours le plus rapide)', avec);
      else bas = ligne('🛣️', 'Avec péages (autoroutes autorisées)', avec) + ligne('🟢', 'Sans péage', sans);
      // V142 : péage estimé, par catégorie de véhicule (kilomètres à péage lus dans l'itinéraire « avec péages »).
      const kmP = avec && !meme ? avec.peageKm : (meme ? 0 : null);
      const calcP = typeof CALC !== 'undefined' ? CALC : (typeof window !== 'undefined' ? window.CPCalc : null), tarifs = kmP != null && calcP && calcP.estimerPeage ? calcP.estimerPeage(kmP < 1 ? 0 : kmP) : null;
      if (tarifs) bas += kmP < 1 ? '<p>💶 <b>Péage : aucun</b> sur ce trajet.</p>' : '<p>💶 <b>Péage : oui</b> · le prix exact (tarifs officiels) s’affiche dans le bloc « Péage » ci-dessous.</p>';
      else bas += '<p class="doux">💶 Péage : prix exact non disponible pour ce trajet.</p>';
      bas += (m.distance_km ? `<p class="doux">Distance donnée par la plateforme : ${esc(m.distance_km)} km.</p>` : '') + '<p class="doux" id="popCommunes">Communes sur le trajet : recherche…</p>' + pts + '<p class="doux">Les durées sont des estimations de conduite normale. <a href="https://fr.mappy.com/itineraire" target="_blank" rel="noopener">Comparer sur Mappy</a></p>';
      d.innerHTML = cadre(dessiner(a, b, meme ? [{ coords: avec.coords, couleur: '#1d4ed8', ep: 4 }] : [sans && { coords: sans.coords, couleur: '#16a34a', ep: 4, pointille: true }, avec && { coords: avec.coords, couleur: '#1d4ed8', ep: 4 }].filter(Boolean)), bas + (meme || !(avec && sans) ? '' : '<p class="doux">Bleu : avec péages · Vert pointillé : sans péage.</p>'));
      const base = avec || sans; if (!base) { const el0 = document.getElementById('popCommunes'); if (el0) el0.textContent = ''; return; }
      const route = base.coords, communes = [], idx = [0.2, 0.4, 0.6, 0.8].map(f => route[Math.min(route.length - 1, Math.round(f * (route.length - 1)))]);
      for (const q of idx) { try { const r = await fetch('https://api-adresse.data.gouv.fr/reverse/?limit=1&lon=' + q[0] + '&lat=' + q[1]); const j = r.ok ? await r.json() : null, f = j && j.features && j.features[0]; if (f && f.properties && f.properties.city && !communes.includes(f.properties.city)) communes.push(f.properties.city); } catch (_) {} }
      const el = document.getElementById('popCommunes'); if (el) el.textContent = communes.length ? 'Communes sur le trajet (repères) : ' + [m.from_city].concat(communes, [m.to_city]).filter(Boolean).join(' → ') : '';
    };
    pointsMission(m).catch(() => { }).finally(() => rendre().catch(() => { const x = document.getElementById('popVol'); const p = x && Array.from(x.querySelectorAll('p')).find(q => /Calcul des deux/.test(q.textContent)); if (p) p.textContent = 'Le calcul du trajet a échoué sur ce téléphone. Referme et réessaie.'; }));
  }
  // Cherche tout de suite (sans attendre la liste) les points GPS des deux bouts d'UNE mission ; renvoie vrai si un nouveau point a été trouvé.
  const transportPointRequests = new Map();
  async function pointsMission(m, onPoint) {
    let n = 0;
    await Promise.all(['origin', 'destination'].map(async cote => {
      const cle = G.cleAdresse(m, cote);
      if (!cle || G.POINTS[cle]) return;
      try {
        if (!transportPointRequests.has(cle)) {
          const request = Promise.resolve().then(() => G.chercherPoint(m, cote, u => fetch(u)))
            .finally(() => transportPointRequests.delete(cle));
          transportPointRequests.set(cle, request);
        }
        const r = await transportPointRequests.get(cle);
        if (r && r.trouve) {
          G.POINTS[cle] = r.point; gpsMem.pts[cle] = r.point; n++;
          ecrireLocal('cp_gps', gpsMem);
          if (onPoint) onPoint(cote);
        }
      } catch (_) { /* One missing address cannot block the other endpoint. */ }
    }));
    return n > 0;
  }
  function adresse(m, cote) {
    const a = m[cote + '_address'] || (m.mail_info && m.mail_info[cote === 'origin' ? 'depart' : 'arrivee'] && m.mail_info[cote === 'origin' ? 'depart' : 'arrivee'].adresse); if (a) return a;
    if (m.adresses_locales) return (cote === 'origin' ? m.from_city : m.to_city) ? (cote === 'origin' ? m.from_city : m.to_city) + (m[(cote === 'origin' ? 'from' : 'to') + '_department'] ? ' (' + m[(cote === 'origin' ? 'from' : 'to') + '_department'] + ')' : '') + ' — ' + LOCAL : LOCAL;
    // V88 : ville connue → affichée ; l'adresse exacte d'une mission acceptée arrive quand « Mes trajets » Hiflow est ouvert sur l'ordinateur.
    const ville = cote === 'origin' ? m.from_city : m.to_city, dep = m[(cote === 'origin' ? 'from' : 'to') + '_department'];
    if (ville) return ville + (dep ? ' (' + dep + ')' : '') + (m.kind === 'acceptee' && m.platform === 'Hiflow' ? ' — adresse exacte : ouvre « Mes trajets » Hiflow sur l’ordinateur' : '');
    return cote === 'origin' ? 'Adresse de départ non encore connue' : 'Adresse d’arrivée non encore connue';
  }
  // V78 : rentabilité complète — approche depuis le domicile et retour au domicile (ville), estimés.
  function renta(m, depuis) {
    const dom = RT.domicile(etat.reglages), o = G.coordonnees(m, 'origin'), d = G.coordonnees(m, 'destination');
    return CALC.rentabiliteComplete(m, etat.reglages, { approcheKm: depuis ? G.routeKm(depuis, o) : (dom && o ? G.routeKm(dom, o) : null), retourKm: dom && d ? G.routeKm(d, dom) : null });
  }
  // V150 : mission Hiflow ACCEPTÉE → dates et heures exactes du devis (prise en charge / livraison), comme « Mes devis » sur le site.
  // V151 : e-mail de confirmation Hiflow (lu par le script Google) : adresses exactes, heures, contacts, consignes.
  const dMail = m => { const i = m.mail_info; return i && i.pickup && i.delivery ? { pk: i.pickup, liv: i.delivery } : null; };
  const hfDates = m => m.kind === 'acceptee' && m.platform === 'Hiflow' && !!(dMail(m) || (m.pickup_start && m.delivery_end));
  const hfPk = m => (dMail(m) || { pk: m.pickup_start }).pk, hfLiv = m => (dMail(m) || { liv: m.delivery_end }).liv;
  function missionTiming(m) {
    const original = m._cpTimingOriginal || m;
    const pickup = hfDates(original) ? hfPk(original) : original.pickup_start;
    const deadline = original.delivery_end || null;
    const key = JSON.stringify([original.platform, original.external_id]);
    const local = original.platform && original.external_id != null ? transportReturnPlans.get(key) : null;
    const confirmation = original.kind === 'acceptee' && original.platform === 'Hiflow' ? dMail(original)?.liv : null;
    const candidate = local || (confirmation && Date.parse(confirmation) !== Date.parse(deadline || '') ? confirmation : null);
    const planned = candidate && Number.isFinite(Date.parse(candidate)) &&
      Number.isFinite(Date.parse(pickup || '')) && Date.parse(candidate) >= Date.parse(pickup) &&
      (!deadline || !Number.isFinite(Date.parse(deadline)) || Date.parse(candidate) <= Date.parse(deadline)) ? candidate : null;
    return {original,pickup,deadline,planned,key};
  }
  function missionForPlanning(m) {
    if (m.kind !== 'acceptee') return m;
    const timing = missionTiming(m);
    const copy = {...timing.original, pickup_start:timing.pickup, delivery_end:timing.planned,
      delivery_start:null};
    Object.defineProperty(copy,'_cpTimingOriginal',{value:timing.original});
    return copy;
  }
  const planningMissions = () => deLEdition(etat.missions).map(missionForPlanning);
  function agendaDateBlocks(m, plannedEnd, plannedStart) {
    const timing = missionTiming(m);
    const finish = plannedEnd || RT.fin(missionForPlanning(m));
    const delivery = plannedEnd ? new Date(plannedEnd.t).toISOString() :
      timing.planned || (finish && new Date(finish.t).toISOString());
    return bk('bkD1','PRISE EN CHARGE',esc(fmtDate(plannedStart == null ? timing.pickup : new Date(plannedStart).toISOString()))) +
      bk('bkD2','LIVRAISON PRÉVUE',delivery ? esc(fmtDate(delivery)) +
        (!timing.planned || finish?.estimee ? ' (estimée, à confirmer)' : '') : 'À renseigner') +
      (timing.deadline ? bk('bkD2','DATE LIMITE DE LIVRAISON',esc(fmtDate(timing.deadline))) : '');
  }
  function mailBloc(m) {
    const i = m.mail_info; if (!i) return '';
    const c = (t, x) => x && (x.contact || x.telephone || x.horaires) ? `<p class="doux"><b>${t}</b> ${esc([x.contact, x.telephone].filter(Boolean).join(' · '))}${x.horaires ? '<br>Horaires : ' + esc(x.horaires) : ''}</p>` : '';
    const cons = (i.consignes || []).length ? `<div class="carte"><b>📋 Consignes</b>${i.consignes.map(s => `<p>${esc(s)}</p>`).join('')}</div>` : '';
    return `<div class="carte"><b>📞 Contacts et horaires (e-mail Hiflow)</b>${c('Départ', i.depart)}${c('Arrivée', i.arrivee)}</div>${cons}`;
  }
  // V154 : « Disponible (vérifié le JJ/MM à HH:MM) » = dernière lecture de la plateforme ; véhicule et énergie avec symboles.
  const cleP = x => String(x || '').toLowerCase().replace(/[^a-z]/g, '');
  const verifLe = m => { if (m.platform === 'DriiveMe') { const t0 = Date.parse(m.last_seen_at || ''); if (Number.isFinite(t0)) return 'Disponible (vérifié le ' + new Date(t0).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' }) + ' à ' + heureP(t0) + ')'; } const s = (etat.sources || []).find(x => cleP(x.platform) === cleP(m.platform)); const t = s ? Date.parse(s.lu_le || '') : NaN; if (!Number.isFinite(t)) return 'Disponible'; const d = new Date(t); return 'Disponible (vérifié le ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' }) + ' à ' + heureP(t) + ')'; };
  // V273 : pastille « Disponible (vérifié le … à …) » sur TOUTES les fiches et cartes ; mission acceptée (agenda) : « Mission acceptée vérifiée le … à … » (une annulation reste possible)
  const verifPast = m => { const s = verifLe(m); const dev = typeof devisAccepte === 'function' && devisAccepte(m); if (m.kind !== 'acceptee' && !dev) return s; const r = /\(vérifié le (.*)\)$/.exec(s); return dev ? (r ? 'Devis accepté vérifié le ' + r[1] : 'Devis accepté') : (r ? 'Mission acceptée vérifiée le ' + r[1] : 'Mission acceptée'); };
  // V272 : date et heure de la dernière vérification de CETTE mission (DriiveMe : dernière fois vue dans la liste) dans la fiche
  const verifFiche = m => { let t = m.platform === 'DriiveMe' ? Date.parse(m.last_seen_at || '') : NaN; if (!Number.isFinite(t)) { const s = (etat.sources || []).find(x => cleP(x.platform) === cleP(m.platform)); t = s ? Date.parse(s.lu_le || '') : NaN; } if (!Number.isFinite(t)) t = Date.parse(m.last_seen_at || ''); if (!Number.isFinite(t)) return ''; const age = Math.max(0, Math.round((Date.now() - t) / 60000)); const ago = age < 60 ? 'il y a ' + age + ' min' : 'il y a ' + Math.floor(age / 60) + ' h' + (age % 60 ? ' ' + String(age % 60).padStart(2, '0') : ''); return 'dernière vérification le ' + new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' }) + ' à ' + heureP(t) + ' (' + ago + ')' + (m.platform === 'DriiveMe' && age > 90 ? ' ⚠️ ancienne : vérifie sur le site' : ''); };
  const vehObj = m => { let v = m.vehicle; if (typeof v === 'string' && v.trim().charAt(0) === '{') { try { v = JSON.parse(v); } catch (_) {} } return v; };
  const vehInfo = m => { const v = vehObj(m); if (v && typeof v === 'object') return { type: [v.category || v.type, v.model, v.gearbox].filter(Boolean).map(x => String(x).trim()).join(' · '), en: String(v.energy || '').trim() }; return { type: typeof v === 'string' ? v.trim() : '', en: '' }; };
  // V206 : suites possibles lues sur la fiche DriiveMe, affichées juste sous l'étiquette de la mission (stockées dans vehicle.suites)
  // V212 : rubriques en blocs colorés, titre en étiquette (modèle C)
  const bk = (cls, titre, h) => '<div class="bk bkC ' + cls + '"><div class="bkt">' + titre + '</div>' + h + '</div>';
  const adrHtml = m => ((m.platform === 'DriiveMe' || m.platform === 'Hiflow') && (m.origin_address || m.destination_address)) ? bk('bkLieu', 'LIEUX', (m.origin_address ? '<div>📍 <b>Départ</b> : ' + esc(m.origin_address) + '</div>' : '') + (m.destination_address ? '<div>🏁 <b>Arrivée</b> : ' + esc(m.destination_address) + '</div>' : '')) : '';
  const sugTexte = z => { const p = String(z.t || '').split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean); if (p.length >= 3) { const dm = p[0].match(/^(.+?\(\s*\d+\s*km\s*\))\s*(.+)$/); const tete = dm ? 'Départ : <b>' + esc(dm[1]) + '</b><br>Arrivée : <b>' + esc(dm[2]) + '</b>' : '<b>' + esc(p[0]) + '</b>'; return tete + '<br>' + esc(p.slice(1, -1).join(' · ')) + ' · <b>' + esc(p[p.length - 1].replace(/\s+,/, ',')) + '</b>'; } return esc(p.join(' · ')); };
  // V227 : plaque W (garage) — dessin de la nouvelle plaque rose quand la fiche de la plateforme l'exige.
  const RE_PLAQUE_W = /plaques?[^a-z0-9]{0,3}(?:de\s+|type\s+|d['’]immatriculation\s+)?WW?\b|\bW[\s-]*garage|\bWW\b|immatriculation\s+(?:de\s+)?WW?\b|plaques?\s+(?:garage|professionnelle)/i;
  const compHtml = m => { try { const v = vehObj(m); const c = v && typeof v === 'object' && Array.isArray(v.competences) ? v.competences.filter(Boolean) : []; return c.length ? '<div class="carte"><b>🧩 Compétences requises</b>' + c.map(s => '<p>' + esc(s) + '</p>').join('') + '</div>' : ''; } catch (_) { return ''; } };   // V235 : bloc « Compétences requises » lu dans la fiche Hiflow (APK 2.12)
  const plaqueW = m => { try { if (!RE_PLAQUE_W.test(JSON.stringify({ ...m, suites: null }))) return ''; return '<div class="plaqueW" title="Plaque W (garage) exigée"><svg viewBox="0 0 520 110" width="150" height="32" role="img" aria-label="Plaque W garage"><rect x="2" y="2" width="516" height="106" rx="14" fill="#f0559f" stroke="#a8326f" stroke-width="3"/><path d="M16 2H62V108H16A14 14 0 0 1 2 94V16A14 14 0 0 1 16 2Z" fill="#1b3fbf"/><text x="32" y="88" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">F</text><text x="292" y="82" font-family="Arial,sans-serif" font-size="72" font-weight="800" fill="#111" text-anchor="middle">W-123-AA</text></svg></div>'; } catch (_) { return ''; } };
  const prixKm = (m, r) => { const km = Number(m.distance_km), f = Number(m.fee); if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(f) || m.fee === null) return ''; const ok = r && r.connu && r.net > 0; return '<div class="prixKm ' + (ok ? 'prixKmOk' : 'prixKmKo') + '">' + (f / km).toFixed(2).replace('.', ',') + ' € /km</div>'; };
  const sugListe = m => Array.isArray(m.suites) && m.suites.length ? m.suites : (vehObj(m) && typeof vehObj(m) === 'object' && Array.isArray(vehObj(m).suites) ? vehObj(m).suites : []);
  // V227 : on ne garde que les suites possibles LE MÊME JOUR, après la mission (celles des jours d'après sont dans « Multi Jours »).
  const sugFiltrees = m => { const L = sugListe(m); const fin = Date.parse(m.delivery_end || m.delivery_start || ''); if (!L.length || !Number.isFinite(fin)) return L;
    const jourP = t => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date(t)), jf = jourP(fin);
    const dureeMs = (z, x) => { const hx = Number(x && x.duree_h); if (Number.isFinite(hx) && hx > 0) return hx * 3600000; const s = String(z.t || '').split('|').map(q => q.trim()).find(q => /\d\s*(h|min)/i.test(q) && !/km/i.test(q)) || ''; const h = s.match(/(\d+)\s*h/i), mi = s.match(/(\d+)\s*min/i), h2 = s.match(/\bh\s*(\d+)/i); if (!h && !mi) return -1; return ((h ? +h[1] : 0) * 60 + (mi ? +mi[1] : (h2 ? +h2[1] : 0))) * 60000; };
    return L.filter(z => { const x = etat.missions.find(y => y.platform === m.platform && String(y.external_id) === String(z.id)); if (!x) return false;
      const a = Date.parse(x.pickup_start || ''), b = Date.parse(x.pickup_end || x.pickup_start || ''); if (!Number.isFinite(a)) return false;
      if (jourP(a) > jf || (Number.isFinite(b) && jourP(b) < jf)) return false;
      const d = dureeMs(z, x), debut = Math.max(fin, a); if (d < 0) return jourP(a) === jf && jourP(debut) === jf; return jourP(debut + d) === jf; }); };
  const sugHtml = m => { const L = sugFiltrees(m); if (!L.length) return ''; return bk('bkSuite', '↪ SUITES POSSIBLES (' + L.length + ')', L.slice(0, 4).map(z => '<div class="bkL">' + sugTexte(z) + '</div>').join('') + (L.length > 4 ? '<div class="bkL">+ ' + (L.length - 4) + ' autre(s) dans la fiche</div>' : '')); };
  const sugDetail = m => { const L = sugFiltrees(m); if (!L.length) return ''; return bk('bkSuite', '↪ SUITES POSSIBLES (' + L.length + ')', L.map(z => { const ok = etat.missions.some(x => x.platform === m.platform && String(x.external_id) === String(z.id)); return '<button type="button" class="sugBtn" data-suite="' + esc(String(z.id)) + '">' + sugTexte(z) + (ok ? ' <b>▸</b>' : '<div class="petit">(fiche pas encore lue)</div>') + '</button>'; }).join('')); };
  const bkDates = (m, lv) => { const pk = hfDates(m) ? fmtDate(hfPk(m)) : quand(m); return (pk ? bk('bkD1', 'PRISE EN CHARGE', '🚩 ' + esc(pk)) : '') + (lv ? bk('bkD2', 'LIVRAISON', '🏁 ' + esc(lv)) : ''); };
  const blocKm = (m, avecVol) => { const p = []; if (m.distance_km) p.push('🛣 <b>' + esc(m.distance_km) + ' km</b>' + (m.duree_h ? ' · <b>' + esc(duree(m.duree_h)) + '</b>' : '')); if (m.client) p.push('🏢 <b>' + esc(m.client) + '</b>'); const vol = avecVol && kmVolOiseau(m) != null && etat.posMax > 0 ? '<div>✈️ ≈ ' + esc(kmVolOiseau(m)) + ' km à vol d’oiseau de ' + (sourceRecherche() === 'domicile' ? 'ton domicile' : 'ta position') + ' jusqu’au départ</div>' : ''; if (!p.length && !vol) return ''; return bk('bkKm', 'TRAJET · PRESTATAIRE', (p.length ? '<div>' + p.join(' · ') + '</div>' : '') + vol); };
  // V270 : « Livraison & Reprise » DriiveMe = 2 étapes (A→B puis B→C) et 2 véhicules ; la 2e étape est lue sur la fiche (vehicle.reprise)
  const repriseHtml = m => { try { const v = vehObj(m); const r = v && typeof v === 'object' && v.reprise; if (!r) return ''; const vv = r.vehicle || {}; const t = [vv.category, vv.model, vv.gearbox].filter(Boolean).join(' · '); return bk('bkLieu', 'ÉTAPE 2 · REPRISE', (r.origin_address ? '<div>📍 <b>Départ</b> : ' + esc(r.origin_address) + '</div>' : '') + (r.destination_address ? '<div>🏁 <b>Arrivée</b> : ' + esc(r.destination_address) + '</div>' : '') + (t ? '<div>🚗 Véhicule repris : ' + esc(t) + '</div>' : '') + (r.total_km ? '<div>🛣 Total de la mission : <b>' + esc(r.total_km) + ' km</b>' + (r.total_duree ? ' · ' + esc(r.total_duree) : '') + '</div>' : '')); } catch (_) { return ''; } };
  const titreVeh = m => { try { const v = vehObj(m); return v && typeof v === 'object' && v.reprise ? 'VÉHICULE À LIVRER' : 'VÉHICULE'; } catch (_) { return 'VÉHICULE'; } };
  const vehHtml = m => {
    const { type, en } = vehInfo(m); const n = en.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); let ic = '⛽', cl = 'inc';
    if (/hybrid/.test(n)) { ic = '🔌'; cl = 'hyb'; } else if (/elec/.test(n)) { ic = '🔋'; cl = 'ele'; } else if (/ther|essence|diesel|gazole|gasoil|gasoline|petrol|fuel/.test(n)) { ic = '⛽'; cl = 'the'; }
    return bk('bkVeh', titreVeh(m), '<div>🚗 ' + esc(type || 'inconnu') + '</div><div class="ve ' + cl + '">' + ic + ' Énergie : ' + esc(en || 'inconnue') + '</div>');
  };
  // Prix : on mémorise le dernier prix vu de chaque mission ; s'il change, flèche et ancien prix.
  const prixVar = m => {
    try {
      if (m.fee == null || m.kind === 'acceptee') return '';
      const k = m.platform + '|' + m.external_id; let mem = {}; try { mem = JSON.parse(localStorage.getItem('cp_prix') || '{}'); } catch (_) {}
      const e = mem[k]; const fee = Number(m.fee); let x = e;
      if (!e) x = { fee }; else if (e.fee !== fee) x = { fee, avant: e.fee, at: Date.now() };
      if (JSON.stringify(x) !== JSON.stringify(e)) { mem[k] = x; const cles = Object.keys(mem); if (cles.length > 3000) for (const c of cles.slice(0, cles.length - 3000)) delete mem[c]; try { localStorage.setItem('cp_prix', JSON.stringify(mem)); } catch (_) {} }
      if (x.avant == null) return '';
      return '<div class="pvar ' + (fee > x.avant ? 'up' : 'down') + '">' + (fee > x.avant ? '↑' : '↓') + ' avant ' + esc(euros(x.avant)) + '</div>';
    } catch (_) { return ''; }
  };
  function carteMission(m, i, extra, datesHtml) {
    const r = renta(m), reste = m.kind === 'acceptee' ? null : heuresRestantes(m);
    return `<button class="mission${clsPlat(m.platform)}${estPassee(m) ? ' passe' : ''}${reste != null && reste > 0 && reste < SEUIL_URGENT_H && !estPassee(m) ? ' urgent' : ''}" data-i="${i}">
      <div class="haut"><span>${plaqueW(m)}<span class="etiq">${esc(PLATS[m.platform] || m.platform)}</span>${' <span class="verif">' + esc(verifPast(m)) + '</span>'}</span>
      <span><div class="prix">${m.fee != null ? esc(euros(m.fee)) : '—'}</div>${prixVar(m)}${prixKm(m, r)}${r.connu ? `<div class="net">net ≈ ${esc(euros(r.net))}${r.parHeure ? ' · ' + esc(euros(r.parHeure)) + '/h' : ''}</div>` : ''}</span></div>
      ${reste != null && reste > 0 && reste < SEUIL_URGENT_H && !estPassee(m) ? `<div class="urgence">⏳ Plus que ${esc(reste < 1 ? Math.max(1, Math.round(reste * 60)) + ' min' : Math.round(reste) + ' h')} pour la faire</div>` : ''}<div class="trajet">${trajetHtml(m)}</div>${adrHtml(m)}
      <div class="meta">${datesHtml || bkDates(m, hfDates(m) ? fmtDate(hfLiv(m)) : arriveeTxt(m))}
      ${devisAccepte(m) ? '<div style="background:#c9f2cf;color:#173;border-radius:8px;padding:4px 8px;margin:4px 0;font-weight:600">✅ Devis accepté</div>' : ''}${m.fees && m.fees.devis_numero && m.kind !== 'acceptee' && m.fees.devis_accepte !== 1 ? '<div style="background:#ffe8a3;color:#222;border-radius:8px;padding:4px 8px;margin:4px 0;font-weight:600">📝 Devis proposé</div>' : ''}${vehHtml(m)}${blocKm(m, true)}${sugHtml(m)}</div>${extra || ''}</button>`;
  }
  // V137 : mission dont il reste peu de temps (moins de 24 h avant la fin de la période ou l'heure de livraison) → cadre rouge qui clignote.
  const SEUIL_URGENT_H = 24;
  function heuresRestantes(m) {
    const t = [m.delivery_end, m.delivery_start, m.pickup_end, m.pickup_start].map(x => Date.parse(x || '')).find(Number.isFinite);
    return t == null ? null : (t - Date.now()) / 3600000;
  }
  let listeAffichee = [];
  const COTES = { tous: 'Départ ou arrivée', depart: 'Départ', arrivee: 'Arrivée' };
  // V211 : plus de plaques d'immatriculation dans les villes proposées ; les communes sont cherchées sur internet (API officielle geo.api.gouv.fr) dès 3 lettres.
  const NET = [], netVu = new Set(), netReq = new Set();
  const plaqueRE = /^[A-Z]{1,2}-?\d{2,4}-?[A-Z]{1,2}\s+/i;
  const villesConnues = () => G.villesDesMissions(etat.missions).map(v => { const nom = String(v.nom).replace(plaqueRE, '').trim(); return Object.assign({}, v, { nom, n: G.norm(nom) }); }).filter(v => v.nom && !/\d/.test(v.nom)).concat(NET);
  function chargerVillesNet(texte, apres) {
    const k = G.norm(texte); if (k.length < 3 || netReq.has(k)) return; netReq.add(k);
    try { fetch('https://geo.api.gouv.fr/communes?nom=' + encodeURIComponent(String(texte).trim()) + '&fields=nom,codeDepartement,centre&boost=population&limit=10').then(r => r.ok ? r.json() : []).then(L => { let n = 0; for (const c of L || []) { if (!c || !c.nom || !c.centre || !c.centre.coordinates) continue; const key = G.norm(c.nom) + '|' + c.codeDepartement; if (netVu.has(key)) continue; netVu.add(key); NET.push({ nom: c.nom, dep: c.codeDepartement, lat: c.centre.coordinates[1], lng: c.centre.coordinates[0], n: G.norm(c.nom), source: 'internet' }); n++; } if (n && apres) apres(); }).catch(() => {}); } catch (_) {}
  }
  // V96 : filtres par client (société), véhicule, distance et durée.
  const FI = window.CPFiltres;
  function blocPlusFiltres(dispo) {
    const o = FI.options(dispo), f = etat.plus || {}, nb = FI.actifs({ ...f, dateDeb: '', dateFin: '' });
    const liste = (id, lib, l, v) => `<label>${lib}<select id="${id}"><option value="">Tous</option>${l.map(x => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
    const nombre = (id, lib, v, pas) => `<label>${lib}<input id="${id}" type="number" min="0" step="${pas}" inputmode="decimal" value="${esc(v == null ? '' : v)}"></label>`;
    return `<details class="plusFiltres" id="plusFiltres"${nb || etat.plusOuvert ? ' open' : ''}><summary>Plus de filtres : client, véhicule, distance, durée${nb ? ' · <b>' + nb + ' actif' + (nb > 1 ? 's' : '') + '</b>' : ''}</summary>
      <div class="grilleFiltres">${liste('fClient', 'Client', o.clients, f.client)}${liste('fType', 'Type de véhicule', o.types, f.type)}${liste('fEnergie', 'Motorisation', o.energies, f.energie)}${liste('fMarque', 'Marque', o.marques, f.marque)}
      ${nombre('fKmMin', 'Longueur mission min (km)', f.kmMin, 10)}${nombre('fKmMax', 'Longueur mission max (km)', f.kmMax, 10)}${nombre('fDuree', 'Durée max (h)', f.dureeMax, 0.5)}</div>
      ${o.clients.length ? '' : '<p class="doux">Clients : aucun nom de société reçu pour l’instant. Il faut l’extension V96 ou plus sur l’ordinateur, le fichier supabase/maj_V96.sql exécuté dans Supabase, puis une relecture de Hiflow.</p>'}
      ${nb ? '<button id="fEffacer" class="second">Effacer ces filtres</button>' : ''}</details>`;
  }
  function brancherPlusFiltres() {
    const d = $('plusFiltres'); if (!d) return;
    d.ontoggle = () => { etat.plusOuvert = d.open; };
    const lire = () => { etat.plus = { ...etat.plus, client: $('fClient').value, type: $('fType').value, energie: $('fEnergie').value, marque: $('fMarque').value, kmMin: $('fKmMin').value, kmMax: $('fKmMax').value, dureeMax: $('fDuree').value }; etat.plusOuvert = true; memoriser(); };
    for (const id of ['fClient', 'fType', 'fEnergie', 'fMarque']) $(id).onchange = () => { lire(); afficher(); };
    for (const id of ['fKmMin', 'fKmMax', 'fDuree']) $(id).onchange = () => { lire(); listeMissions(); };
    const e = $('fEffacer'); if (e) e.onclick = () => { etat.plus = {}; memoriser(); afficher(); };
  }
  // V96 : factures VALIDÉES par la plateforme (dont payées) : totaux par mois et bénéfice ; date de paiement indiquée.
  function vueFactures() {
    const taux = (etat.reglages && etat.reglages.taux_cotisations) ?? 21.2;
    const mois = FI.parMois(etat.factures, taux), annees = FI.parAnnee(mois);
    if (!etat.facturesServeur) { $('ecran').innerHTML = '<div class="vide">Factures indisponibles : le serveur n’a pas encore été mis à jour. Dans Supabase → SQL Editor, exécute le fichier <b>supabase/maj_V96.sql</b>, puis ouvre « Mes factures » sur Hiflow (ordinateur).</div>'; return; }
    const nomMois = k => { if (k === 'inconnu') return 'Date inconnue'; const d = new Date(k + '-15T12:00:00Z'); const t = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }); return t.charAt(0).toUpperCase() + t.slice(1); };
    const jour = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }) : '?';
    // V141 : chaque rubrique de facturation a sa couleur (classe fr-…)
    const ligne = (a, b) => { const t = String(a); const c = /non pay/i.test(t) ? 'att' : /^Pay/i.test(t) ? 'pay' : /B[ée]n[ée]fice/i.test(t) ? 'ben' : /^Total/i.test(t) ? 'tot' : /Cotisations|^−/.test(t) ? 'neg' : /Frais/i.test(t) ? 'fra' : /Prestation|effectu/i.test(t) ? 'pre' : /annul/i.test(t) ? 'ann' : 'aut'; return `<tr class="fr-${c}"><td>${a}</td><td>${b}</td></tr>`; };
    const nbM = x => (x || 0) + ' mission' + (x > 1 ? 's' : '');
    // V97 : missions effectuées ou annulées pas encore reprises dans une facture validée (annulation tardive = payée).
    const attente = FI.aFacturer(etat.missions.filter(m => m.platform === 'Hiflow'));
    const lieu = (v, d) => esc(v || '?') + (d ? ' (' + esc(String(d).toUpperCase()) + ')' : '');
    const blocAttente = attente.length ? `<div class="carte" id="aFacturer"><h2>À facturer — pas encore dans une facture validée</h2>` + attente.map(g => `<h3>${esc(nomMois(g.mois))}</h3><table class="tableau">
        ${ligne('Missions effectuées — prestations', esc(euros(g.prestation)))}${g.frais ? ligne('Frais à rembourser', esc(euros(g.frais))) : ''}${g.annulees ? ligne(g.annulees + ' mission' + (g.annulees > 1 ? 's' : '') + ' annulée' + (g.annulees > 1 ? 's' : '') + ' — montant prévu', esc(euros(g.prestationAnnulees))) : ''}</table>
        ${g.lignes.map(x => `<div class="factureLigne" data-afacturer="${esc(x.mission.external_id)}"><span><b>${lieu(x.mission.from_city, x.mission.from_department)} → ${lieu(x.mission.to_city, x.mission.to_department)}</b> · ${x.date != null ? esc(jour(new Date(x.date).toISOString())) : 'date ?'}</span><span>${esc(euros(x.prestation))} <span class="etiq ${x.annulee ? 'ko' : 'nv'}">${x.annulee ? (x.confirme ? 'annulée — payée' : 'annulée — payée si annulation tardive') : 'effectuée'}</span>${x.etat === 1 ? ' <span class="etiq nv">à valider sur Hiflow</span>' : x.etat === 2 ? ' <span class="etiq ok">facture en préparation</span>' : ''}</span></div>`).join('')}`).join('') +
      '<p class="doux">Ces montants ne sont pas comptés dans les totaux ni dans le bénéfice tant que Hiflow n’a pas validé la facture. « annulée — payée » : montant réellement dû, lu dans « Mes factures » de Hiflow (il compte dans les prestations ci-dessus). « payée si annulation tardive » : montant prévu, pas encore confirmé par Hiflow.</p></div>' : '';
    if (!mois.length) { $('ecran').innerHTML = blocAttente + '<div class="vide">Aucune facture reçue. Ouvre « Mes factures » sur Hiflow (ordinateur), onglets « Factures en cours de paiement » et « Factures payées » : elles arrivent ici automatiquement.</div>'; return; }
    $('ecran').innerHTML = blocAttente + annees.map(a => `<div class="carte" data-annee="${esc(a.annee)}"><h2>Année ${esc(a.annee)} — ${a.nb} facture${a.nb > 1 ? 's' : ''} validée${a.nb > 1 ? 's' : ''}</h2><table class="tableau">
        ${ligne('Prestations facturées (HT)', esc(euros(a.prestation)))}${ligne('Frais remboursés', esc(euros(a.frais)))}${ligne('Total facturé', '<b>' + esc(euros(a.total)) + '</b>')}
        ${ligne('Payées — ' + esc(nbM(a.trajetsPayes)), esc(euros(a.paye)))}${ligne('Facturées, non payées — ' + esc(nbM(a.trajetsEnAttente)), esc(euros(a.enAttente)))}
        ${ligne('− Cotisations estimées (' + String(taux).replace('.', ',') + ' %)', '− ' + esc(euros(a.cotisations)))}${ligne('= Bénéfice estimé', '<b>' + esc(euros(a.benefice)) + '</b>')}</table></div>`).join('') +
      mois.map(g => `<div class="carte mois" data-mois="${esc(g.mois)}"><h2>${esc(nomMois(g.mois))}</h2><table class="tableau">
        ${ligne('Prestations (HT)', esc(euros(g.prestation)))}${ligne('Frais remboursés', esc(euros(g.frais)))}${ligne('Total facturé', '<b>' + esc(euros(g.total)) + '</b>')}
        ${ligne('Missions facturées', esc(nbM(g.trajets)))}${ligne('Payées — ' + esc(nbM(g.trajetsPayes)), '<b>' + esc(euros(g.paye)) + '</b>')}${ligne('Facturées, non payées — ' + esc(nbM(g.trajetsEnAttente)), '<b>' + esc(euros(g.enAttente)) + '</b>')}${ligne('= Bénéfice estimé', '<b>' + esc(euros(g.benefice)) + '</b>')}</table>
        ${g.factures.map(f => `<div class="factureLigne" data-fact="${esc(f.external_id)}"><span><b>Facture n° ${esc(f.numero || f.external_id)}</b> · ${esc(jour(f.emise_le))} · ${esc(f.nb_trajets || 0)} trajet${f.nb_trajets > 1 ? 's' : ''}</span><span>${esc(euros(f.total))} <span class="etiq ${f.statut === 'payee' ? 'ok' : 'nv'}">${f.statut === 'payee' ? 'payée' + (f.payee_le ? ' le ' + esc(jour(f.payee_le)) : '') : 'validée, en attente'}</span></span></div>`).join('')}</div>`).join('') +
      '<p class="doux">Seules les factures validées par Hiflow sont comptées. Bénéfice estimé = prestations − cotisations (taux des Réglages) ; les frais sont avancés puis remboursés. Estimation à vérifier selon ta situation.</p>';
    if (window.CPFact) window.CPFact.monter({ ecran: $('ecran'), factures: etat.factures, missions: etat.missions, feuille: $('feuille'), contenu: $('feuilleContenu'), toast, rafraichir: vueFactures });   // V224
  }
  // V99 : mission réellement disponible = statut disponible, date non dépassée depuis plus d'un jour, pas une ligne de « Mes trajets » (plaque devant la ville).
  const PLAQUE_VILLE = /^\s*[A-Z]{1,2}-?\d{3}-?[A-Z]{2}\b/;
  // V122 : « passée » = la FIN de la période est dépassée (une mission DriiveMe ouverte du 05/10 au 15/10 reste claire jusqu'au 15/10).
  const estPassee = m => { const t = Date.parse((m.platform === 'DriiveMe' ? (m.delivery_end || m.pickup_end || m.pickup_start) : m.pickup_start) || ''); return Number.isFinite(t) && t < Date.now() - (m.platform === 'DriiveMe' ? 0 : 86400000); };
  // V240 : un devis Hiflow accepté devient une mission de l'Agenda : il ne reste plus dans la liste des missions disponibles.
  let _accRef = null, _accSet = new Set(), _devRef = null, _devSet = new Set();
  const clesAcceptees = () => { if (_accRef !== etat.missions) { _accRef = etat.missions; _accSet = new Set(etat.missions.filter(x => x && x.kind === 'acceptee').map(x => x.platform + '|' + x.external_id)); } return _accSet; };
  const clesDevis = () => { if (_devRef !== etat.missions) { _devRef = etat.missions; _devSet = new Set(etat.missions.filter(x => x && x.kind === 'disponible' && x.fees && x.fees.devis_numero).map(x => x.platform + '|' + x.external_id)); } return _devSet; };
  const devisAccepte = m => !!m && m.platform === 'Hiflow' && (m.kind === 'acceptee' || !!(m.fees && m.fees.devis_accepte === 1));   // V241 : toute mission Hiflow de l'Agenda vient d'un devis accepté
  const estDisponible = m => { if (!m || m.kind !== 'disponible' || m.status !== 'disponible') return false;
    if (clesAcceptees().has(m.platform + '|' + m.external_id) || (m.fees && m.fees.devis_accepte === 1)) return false;
    if (PLAQUE_VILLE.test(String(m.from_city || '')) || PLAQUE_VILLE.test(String(m.to_city || ''))) return false;
    const d = Date.parse(m.delivery_end || m.delivery_start || m.pickup_start || ''); return !(Number.isFinite(d) && d < Date.now()); };   // V123 : plus aucune marge — une mission dont l'heure est dépassée disparaît toute seule   // V122 : une mission DriiveMe dont la période est finie (ex. « ven. 09/10 00:00-23:59 » vue le 10/10) n'est plus disponible
  function vueMissions() {
    const dispo = etat.missions.filter(estDisponible);
    const puces = (EDITION.plateformes.length > 1 ? ['toutes'].concat(EDITION.plateformes) : []).map(p => `<button class="puce${etat.filtre === p ? ' actif' : ''}" data-filtre="${p}">${p === 'toutes' ? 'Toutes' : esc(PLATS[p])} ${p === 'toutes' ? dispo.length : dispo.filter(m => m.platform === p).length}</button>`).join('');
    const aVille = etat.zones.some(z => z.type === 'ville');
    $('ecran').innerHTML = `<div class="puces" role="group" aria-label="Plateformes">${puces}</div>
      <div class="filtres"><div class="recherche"><input id="recherche" type="search" placeholder="Ville, département ou région (3 lettres)" value="${esc(etat.recherche)}" aria-label="Rechercher un lieu" autocomplete="off" aria-autocomplete="list" aria-controls="sugg">
      <div id="sugg" class="sugg" role="listbox" hidden></div></div>
      <select id="tri" aria-label="Trier"><option value="recent">Plus récentes</option><option value="date">Date de départ</option><option value="prix">Prix</option><option value="heure">€/heure</option><option value="proche">Les plus proches de moi</option></select></div>
      <div class="ligneFiltres"><label>Date début<input id="fDateDeb" type="date" value="${esc((etat.plus || {}).dateDeb || '')}"></label><label>Date fin<input id="fDateFin" type="date" value="${esc((etat.plus || {}).dateFin || '')}"></label></div>
      <div class="ligneFiltres"><select id="cote" aria-label="Lieu cherché">${Object.entries(COTES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <select id="rayon" aria-label="Autour de la ville"${aVille ? '' : ' disabled'}><option value="0">Ville exacte</option><option value="20">Ville + 20 km</option><option value="50">Ville + 50 km</option><option value="100">Ville + 100 km</option></select></div>
      <div class="lignePos"><select id="posSource" aria-label="Chercher depuis"><option value="position">Depuis ma position GPS</option><option value="domicile">Depuis mon domicile</option></select><button id="btnPos" class="second" type="button">📍 Ma position</button><select id="posMax" aria-label="Distance maximale depuis ma position"><option value="0">Distance max à vol d’oiseau : sans limite</option>${[20, 50, 100, 150, 200, 300].map(k => `<option value="${k}">Max ${k} km à vol d’oiseau</option>`).join('')}</select><span class="doux" id="posInfo"></span></div>
      ${blocPlusFiltres(dispo)}
      <div class="zones" id="zones"></div>
      ${etat.erreur ? `<p class="erreur">${esc(etat.erreur)}</p>` : ''}<div id="liste"></div>`;
    $('tri').value = etat.tri; $('cote').value = etat.cote; $('rayon').value = String(etat.rayon);
    for (const b of document.querySelectorAll('[data-filtre]')) b.onclick = () => { etat.filtre = b.dataset.filtre; memoriser(); afficher(); };
    for (const b of document.querySelectorAll('[data-zone]')) b.onclick = () => { etat.zones.splice(Number(b.dataset.zone), 1); memoriser(); afficher(); };
    $('tri').onchange = ev => { etat.tri = ev.target.value; memoriser(); listeMissions(); };
    $('cote').onchange = ev => { etat.cote = ev.target.value; memoriser(); };
    for (const id of ['fDateDeb', 'fDateFin']) $(id).onchange = () => { etat.plus = { ...etat.plus, dateDeb: $('fDateDeb').value, dateFin: $('fDateFin').value }; memoriser(); listeMissions(); };
    $('rayon').onchange = ev => { etat.rayon = Number(ev.target.value); memoriser(); listeMissions(); };
    $('posMax').value = String(etat.posMax); $('posSource').value = sourceRecherche(); $('posSource').onchange = ev => { ecrireLocal('cp_depuis', ev.target.value); if (ev.target.value === 'domicile' && !RT.domicile(etat.reglages)) toast('Renseigne ton domicile dans les Réglages'); listeMissions(); }; infoPosition();
    $('btnPos').onclick = () => localiser(true);
    $('posMax').onchange = ev => { etat.posMax = Number(ev.target.value); memoriser(); if (etat.posMax > 0 && sourceRecherche() === 'position' && !positionRecente(60)) localiser(false); else listeMissions(); };
    brancherPlusFiltres();
    const champ = $('recherche');
    champ.oninput = () => { etat.recherche = champ.value; memoriser(); montrerSuggestions(); clearTimeout(vueMissions.t); vueMissions.t = setTimeout(listeMissions, 250); };
    champ.onkeydown = ev => { if (ev.key === 'Enter') { const p = document.querySelector('#sugg button'); if (p && !$('sugg').hidden) { ev.preventDefault(); p.click(); } } else if (ev.key === 'Escape') $('sugg').hidden = true; };
    listeMissions();
  }
  // V137 : position du téléphone (service de localisation de Google sur Android), demandée UNE FOIS quand on touche « Ma position » ou qu'on choisit une distance — jamais en continu. Gardée seulement sur ce téléphone (jamais envoyée au serveur).
  // V138 : on cherche depuis « ma position » (GPS) ou depuis le domicile habituel (réglages) — au choix, gardé sur ce téléphone.
  const sourceRecherche = () => lireLocal('cp_depuis', 'position') === 'domicile' ? 'domicile' : 'position';
  const pointRecherche = () => sourceRecherche() === 'domicile' ? RT.domicile(etat.reglages) : etat.pos;
  const kmVolOiseau = m => { const p = pointRecherche(), c = p ? G.coordonnees(m, 'origin') : null; return c ? Math.round(G.volOiseauKm(p, c)) : null; };
  const positionRecente = minutes => !!(etat.pos && Date.now() - etat.pos.at < minutes * 60000);
  function infoPosition() {
    const i = $('posInfo'); if (!i) return;
    i.textContent = etat.pos ? 'Position prise il y a ' + (Math.max(1, Math.round((Date.now() - etat.pos.at) / 60000)) < 60 ? Math.max(1, Math.round((Date.now() - etat.pos.at) / 60000)) + ' min' : Math.round((Date.now() - etat.pos.at) / 3600000) + ' h') : (etat.posMax > 0 ? 'Position inconnue : touche « Ma position ».' : '');
  }
  function localiser(manuel) {
    if (!navigator.geolocation) { if (manuel) toast('Ce téléphone ne permet pas la localisation'); return; }
    if (manuel) toast('Localisation…');
    navigator.geolocation.getCurrentPosition(p => {
      etat.pos = { lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000, at: Date.now() };
      ecrireLocal('cp_position', etat.pos); infoPosition(); if ($('liste')) listeMissions(); if (manuel) toast('Position mise à jour');
    }, e => { if (manuel || etat.posMax > 0) toast(e && e.code === 1 ? 'Localisation refusée : autorise-la pour Convoyage (réglages du téléphone ou du site)' : 'Position introuvable pour l’instant'); },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 5 * 60000 });   // une seule lecture, position récente (≤ 5 min) réutilisée
  }
  // Suggestions dès 3 lettres (ou un numéro de département) : villes, départements, régions.
  function montrerSuggestions() {
    const box = $('sugg'); if (!box) return;
    const l = G.suggestions(etat.recherche, { villes: villesConnues(), max: 7 }); chargerVillesNet(etat.recherche, montrerSuggestions);
    if (!l.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = l.map((s, i) => `<button role="option" data-sugg="${i}">${esc(s.libelle)}<small>${esc(s.detail)}</small></button>`).join('');
    box.hidden = false;
    for (const b of box.querySelectorAll('[data-sugg]')) b.onclick = () => {
      const s = l[Number(b.dataset.sugg)];
      const z = s.type === 'ville' ? { type: 'ville', nom: s.nom, dep: s.dep, lat: s.lat, lng: s.lng } : { type: s.type, code: s.code };
      z.cote = etat.cote;
      if (!etat.zones.some(x => x.type === z.type && x.cote === z.cote && (x.code || x.nom + x.dep) === (z.code || z.nom + z.dep))) etat.zones.push(z);
      etat.recherche = ''; memoriser(); afficher();
    };
  }
  // V274 : lignes des filtres appliqués au-dessus de la liste, avec une croix pour retirer chaque filtre
  function puces(q) {
    const P = [], plus = etat.plus || {};
    const add = (cle, txt) => P.push('<button type="button" class="puceFiltre" data-rm="' + esc(cle) + '" aria-label="Retirer ce filtre" style="font-size:.85rem;padding:3px 10px;border-radius:14px;border:1px solid #c9a227;background:#2a2108;color:#f5d26b;cursor:pointer">' + esc(txt) + ' <b>✕</b></button>');
    if (etat.filtre !== 'toutes') add('plateforme', 'Plateforme : ' + etat.filtre);
    etat.zones.forEach((z, i) => add('zone:' + i, (COTES[z.cote || 'tous'] || 'Lieu') + ' : ' + G.libelleZone(z)));
    if (etat.zones.length && etat.rayon > 0) add('rayon', 'Autour : ville + ' + etat.rayon + ' km');
    if (etat.posMax > 0) add('posMax', 'Max ' + etat.posMax + ' km à vol d’oiseau depuis ' + (sourceRecherche() === 'domicile' ? 'mon domicile' : 'ma position'));
    if (q) add('recherche', 'Recherche : ' + etat.recherche);
    const dj = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(s || '')); return m ? m[3] + '/' + m[2] : String(s); };
    [['client', 'Client : ', ''], ['type', 'Véhicule : ', ''], ['energie', 'Motorisation : ', ''], ['marque', 'Marque : ', ''], ['kmMin', 'Longueur min : ', ' km'], ['kmMax', 'Longueur max : ', ' km'], ['dureeMax', 'Durée max : ', ' h'], ['dateDeb', 'Départ à partir du ', ''], ['dateFin', 'Livraison jusqu’au ', '']].forEach(([k, pre, suf]) => { const v = plus[k]; if (v !== null && v !== undefined && v !== '') add('plus:' + k, pre + (k === 'dateDeb' || k === 'dateFin' ? dj(v) : v) + suf); });
    return { n: P.length, h: P.join('') };
  }
  const retirerPuce = cle => { if (cle === 'plateforme') etat.filtre = 'toutes'; else if (cle === 'rayon') etat.rayon = 0; else if (cle === 'posMax') etat.posMax = 0; else if (cle === 'recherche') etat.recherche = ''; else if (cle.startsWith('zone:')) etat.zones.splice(Number(cle.slice(5)), 1); else if (cle.startsWith('plus:')) { etat.plus = Object.assign({}, etat.plus); delete etat.plus[cle.slice(5)]; } memoriser(); afficher(); };
  function listeMissions() {
    planifierGps();
    const zoneListe = $('liste'); if (!zoneListe) return;
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = norm(etat.recherche);
    let l = etat.missions.filter(estDisponible);
    const total = l.length;
    if (etat.filtre !== 'toutes') l = l.filter(m => m.platform === etat.filtre);
    l = G.filtrer(l, etat.zones, etat.rayon);
    l = FI.appliquer(l, etat.plus, m => CALC.dureeEstimee(m).heures);   // V96 : client, véhicule, distance, durée
    // V137/V138 : distance maximale DEPUIS MA POSITION, comptée À VOL D'OISEAU ; départ de position inconnue → gardé.
    const kmDeMoi = m => { const p = pointRecherche(), c = p ? G.coordonnees(m, 'origin') : null; return c ? G.volOiseauKm(p, c) : null; };
    if (etat.posMax > 0 && pointRecherche()) l = l.filter(m => { const d = kmDeMoi(m); return d == null || d <= etat.posMax; });
    // Texte libre (sans choisir de suggestion) : recherche simple, comme avant.
    if (q) l = l.filter(m => q.split(/[\s,]+/).filter(Boolean).some(t => [m.from_city, m.to_city, m.from_department, m.to_department, m.origin_address, m.destination_address].some(v => norm(v).includes(t))));
    const cache = new Map(), ph = m => { if (!cache.has(m)) cache.set(m, renta(m)); return cache.get(m); };
    if (etat.tri === 'prix') l.sort((a, b) => (b.fee || 0) - (a.fee || 0));
    else if (etat.tri === 'heure') l.sort((a, b) => (ph(b).parHeure || 0) - (ph(a).parHeure || 0));
    else if (etat.tri === 'proche' && pointRecherche()) l.sort((a, b) => (kmDeMoi(a) ?? 1e9) - (kmDeMoi(b) ?? 1e9));
    else if (etat.tri === 'date') { const t = m => { const d = Date.parse(m.pickup_start || ''); return Number.isFinite(d) ? d : Infinity; }; l.sort((a, b) => { const x = t(a), y = t(b); return x === y ? 0 : x < y ? -1 : 1; }); }   // V146 : date ET heure de départ (la plus proche en haut), toutes plateformes mélangées ; sans date → en bas
    else l.sort((a, b) => String(b.first_seen_at || '').localeCompare(String(a.first_seen_at || '')) || String(a.pickup_start || '9').localeCompare(String(b.pickup_start || '9')));   // V99 : les plus récemment parues en haut
    listeAffichee = l;
    const lesPuces = puces(q);
    zoneListe.innerHTML = `${lesPuces.n ? `<div id="puces" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">${lesPuces.h}</div><p class="doux" id="compte">${l.length} mission(s) sur ${total} correspondent à tes filtres <button id="toutVoir" class="lienBouton">Tout afficher</button></p>` : ''}` +
      (l.length ? (() => { let jr = ''; return l.map((m, i) => { let h = ''; { const d = Date.parse(m.pickup_start || ''); const j = Number.isFinite(d) ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }) : 'Date à préciser'; if (j !== jr) { h = '<div class="jour">' + esc(j) + '</div>'; jr = j; } } return h + carteMission(m, i); }).join(''); })() : `<div class="vide">${total ? 'Aucune mission ne correspond à tes filtres.' : 'Aucune mission reçue pour l’instant. Vérifie que l’extension de ton ordinateur est connectée à ton compte (Sources → Application téléphone).'}</div>`);
    for (const b of zoneListe.querySelectorAll('.mission')) b.onclick = () => detail(listeAffichee[Number(b.dataset.i)]);
    for (const b of zoneListe.querySelectorAll('[data-rm]')) b.onclick = ev => { ev.stopPropagation(); retirerPuce(b.dataset.rm); };
    const tv = $('toutVoir'); if (tv) tv.onclick = () => { etat.zones = []; etat.recherche = ''; etat.plus = {}; etat.filtre = 'toutes'; memoriser(); afficher(); };   // V99 : retirer tous les filtres d'un coup
  }
  // V79 : Agenda complet — états (à venir, en cours, passée, annulée ?, terminée), conflits horaires, modifications.
  const ETATS = { en_cours: ['en cours', 'ok'], annulee: ['annulée ? à vérifier', 'ko'], terminee: ['terminée', ''], passee: ['passée', ''], date_inconnue: ['date à préciser', 'nv'] };
  function vueAgenda() {
    const agendaMissions = planningMissions();
    const A = window.CPAgenda.analyser(agendaMissions, etat.reglages);
    const items = A.items.filter(x => etat.agendaTout || !((x.etat === 'passee' || x.etat === 'terminee') && x.fin && Date.now() - x.fin.t > 7 * 86400000));
    // Calcule les enchaînements une seule fois par rendu. Les transports ne sont pas vérifiés par ce résumé.
    const nowChain = Date.now();
    const futureChainItems = A.items.filter(x => x.etat === 'a_venir' || x.etat === 'en_cours').sort((a, b) => (a.debut ?? Infinity) - (b.debut ?? Infinity));
    const recentCompleted = A.items.filter(x => (x.etat === 'terminee' || x.etat === 'passee') && x.fin && Number.isFinite(x.fin.t) && nowChain - x.fin.t >= 0 && nowChain - x.fin.t <= 24 * 3600000);
    const chainItems = [...recentCompleted, ...futureChainItems].sort((a, b) => (a.debut ?? a.fin?.t ?? Infinity) - (b.debut ?? b.fin?.t ?? Infinity));
    const unknownAccepted = A.items.some(x => x.etat === 'date_inconnue');
    const chainMap = Object.create(null);
    for (let ci = 0; ci < chainItems.length; ci++) {
      const cur = chainItems[ci];
      const next = chainItems.slice(ci + 1).find(x => x.etat === 'a_venir' || x.etat === 'en_cours') || null;
      const conflictDetail = next ? A.conflits.find(c => c.a === cur.mission && c.b === next.mission || c.b === cur.mission && c.a === next.mission) || null : null;
      chainMap[cur.cle] = { next, intervalMin: cur.fin && next && Number.isFinite(next.debut) ? Math.round((next.debut - cur.fin.t) / 60000) : null, intervalEstimated: !!(cur.fin && cur.fin.estimee), conflictType: conflictDetail && conflictDetail.type || null, blocked: unknownAccepted };
    }
    window.__cpAgendaChain = chainMap;
    const debutAff = x => { try { if (hfDates(x.mission)) { const t = Date.parse(hfPk(x.mission)); if (Number.isFinite(t)) return t; } } catch (_) {} return x.debut; };   // V241 : la date du groupe = la date de prise en charge affichée sur la fiche
    items.sort((x, y) => (debutAff(y) ?? -1) - (debutAff(x) ?? -1));   // V90 : les plus récentes (dates les plus lointaines) en haut ; date inconnue en bas
    const caches = A.items.length - items.length;
    listeAffichee = items.map(x => x.mission);
    if (!A.items.length) { $('ecran').innerHTML = '<div class="vide">Aucune mission acceptée. Elles arrivent automatiquement depuis « Mes trajets » (Hiflow), « Mes réservations » (DriiveMe), « Missions réservées » (Otoqi) et « Propositions réservées » (Pop Valet), ou d’un e-mail de confirmation Hiflow collé dans l’extension.</div>'; return; }
    const resume = RT.resumeAgenda(agendaMissions, etat.reglages);
    // V139 : plus de bandeau « N conflits » dans l'Agenda (les estimations produisaient des dizaines de faux conflits).
    let html = false && A.conflits.length ? `<div class="carte conflit" id="conflits"><h2>⚠️ ${A.conflits.length} conflit${A.conflits.length > 1 ? 's' : ''} dans ton agenda</h2>${A.conflits.map(c => `<p>${esc(window.CPAgenda.libelleConflit(c))}</p>`).join('')}<p class="doux">Estimation (durées et liaisons approximatives) : vérifie sur les plateformes.</p></div>` : '';
    let jour = '';
    items.forEach((x, i) => {
      const m = x.mission, te = debutAff(x), d = te != null ? new Date(te) : null;
      const j = d ? d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }) : 'Date à préciser';
      if (j !== jour) { html += `<div class="jour">${esc(j)}</div>`; jour = j; }
      const nb = (x.etat === 'a_venir' || x.etat === 'en_cours') ? resume[x.cle] : 0;
      const e = ETATS[x.etat];
      const modifs = (m.modifications || []).filter(z => z.champ !== 'statut').slice(-2);
      const extra = (e ? `<div><span class="etiq ${e[1]}">${esc(e[0])}</span></div>` : '') +
        modifs.map(z => `<div class="modifLigne">✏️ ${esc(window.CPAgenda.libelleModification(z))}</div>`).join('') +
        (nb ? `<div class="retoursBadge">🔁 ${nb} retour${nb > 1 ? 's' : ''} possible${nb > 1 ? 's' : ''} après cette mission</div>` : '');
      html += carteMission(m, i, extra, agendaDateBlocks(m,x.fin)).replace('class="mission', `class="mission etat-${x.etat}${''}`);
      // Agenda–Transports : résumé prudent de l'enchaînement. Le trajet n'est jamais déclaré confirmé ici.
      const chain = window.__cpAgendaChain && window.__cpAgendaChain[x.cle];
      const isAlbertvilleDelivery = /albertville/i.test([
        m.to_city, m.destination_city, m.to_address, m.destination_address
      ].filter(Boolean).join(' '));
      if (chain && (x.etat === 'a_venir' || x.etat === 'en_cours' ||
          ((x.etat === 'terminee' || x.etat === 'passee') && x.fin &&
            (Date.now() - x.fin.t <= 24 * 3600000 || isAlbertvilleDelivery)))) {
        const title = chain.next ? 'Prochaine mission : ' + (chain.next.mission.from_city || chain.next.mission.origin_city || 'départ à préciser') + ' → ' + (chain.next.mission.to_city || chain.next.mission.destination_city || 'arrivée à préciser') : (chain.blocked ? 'Prochaine mission à déterminer' : 'Aucune prochaine mission prévue — retour au domicile à préparer');
        const y51Origin = [m.to_address, m.destination_address, m.delivery_address].filter(Boolean).join(' ');
        const y51Gps = G.coordonnees(m, 'destination');
        const y51GpsAttr = y51Gps && y51Gps.precision === 'gps' &&
          Number.isFinite(Number(y51Gps.lat)) && Number.isFinite(Number(y51Gps.lng)) ?
          ' data-y51-lat="' + Number(y51Gps.lat) + '" data-y51-lng="' + Number(y51Gps.lng) + '"' : '';
        const y51ExactEysseric = /1\s*,?\s*rue\s+(?:du\s+)?lieutenant\s+gustave\s+eysseric/i.test(y51Origin);
        const y51Reference = !chain.next && !chain.blocked && /albertville/i.test([m.to_city, m.destination_city, m.to_address, m.destination_address].filter(Boolean).join(' ')) ? '<div class="doux">🚌 Y51 Albertville → Annecy : <a href="https://hawk.hanoverdisplays.com/y51/public/" target="_blank" rel="noopener noreferrer">suivi officiel des départs</a> · <a href="https://annecy.transdev.com/line/ligne-y51/" target="_blank" rel="noopener noreferrer">horaires de ligne</a> · <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-haute-savoie-74" target="_blank" rel="noopener noreferrer">données officielles GTFS Haute-Savoie</a>. Horaires théoriques : vérifiez la date de mise à jour, l’arrêt et les perturbations avant le départ. <a href="https://www.google.com/maps/dir/?api=1&amp;destination=%C3%89cole%20Saint-Fran%C3%A7ois%2C%20Albertville&amp;travelmode=walking" target="_blank" rel="noopener noreferrer">Itinéraire piéton vers École Saint-François</a> (départ à préciser dans Maps).</div>' : '';
        const y51TrafficDate = x.fin && Number.isFinite(x.fin.t) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(x.fin.t)) : '';
        const y51TrafficAlert = y51Reference && y51TrafficDate >= '2026-10-22' && y51TrafficDate <= '2026-10-30'
          ? '<div class="doux">⚠️ Y51 : du 22 au 30 octobre 2026, l’arrêt Ugine – Rue Derobert n’est pas desservi (report vers Ugine – Les Fontaines). Les express travaux ont aussi été modifiés à partir du 19 octobre. <a href="https://annecy.transdev.com/trafic/" target="_blank" rel="noopener noreferrer">Vérifier les alertes officielles</a>. Transport non confirmé — vérifiez vous-même.</div>'
          : '';
        const y51WalkLink = y51ExactEysseric ? y51Reference.replace('destination=%C3%89cole', 'origin=1%20rue%20Lieutenant%20Gustave%20Eysseric%2C%2073200%20Albertville&amp;destination=%C3%89cole').replace('(départ à préciser dans Maps).', '(départ prérempli depuis la rue Lieutenant Gustave Eysseric ; vérifiez l’adresse réelle).') : y51Reference.replace(/ <a href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1[^<]*<\/a> \(départ à préciser dans Maps\)\./, ' Arrêt de départ à déterminer selon l’adresse exacte de la mission.');
        const interval = Number.isFinite(chain.intervalMin) ? '<div><strong>' + (chain.intervalEstimated ? 'Intervalle estimé entre missions :' : 'Intervalle entre missions :') + '</strong> ' + esc(String(chain.intervalMin)) + ' min</div>' : '';
        const conflictNote = chain.conflictType === 'chevauchement' ? '⚠️ Chevauchement horaire détecté.' : (chain.conflictType ? '⚠️ Enchaînement potentiellement trop juste : vérifiez le trajet et la marge de sécurité.' : 'Transport non confirmé — vérifiez vous-même. Temps disponible après trajet non déterminé.');
        const note = chain.blocked ? 'Enchaînement à vérifier : une mission acceptée n’a pas de date exploitable.' : (!chain.next ? 'Retour après la dernière mission : horaires interurbains, correspondances locales et marches à vérifier. Transport non confirmé — vérifiez vous-même.' : conflictNote);
        html += '<div class="carte cpAgendaChain" data-mission-end-ms="' + (x.fin && Number.isFinite(x.fin.t) ? x.fin.t : '') + '"' + y51GpsAttr + ' data-sibra-date="' + esc(chain.next && Number.isFinite(chain.next.debut) ? (date => { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const get = type => parts.find(p => p.type === type).value; return get('year') + '-' + get('month') + '-' + get('day'); })(new Date(chain.next.debut)) : (x.fin && Number.isFinite(x.fin.t) ? (date => { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const get = type => parts.find(p => p.type === type).value; return get('year') + '-' + get('month') + '-' + get('day'); })(new Date(x.fin.t)) : '')) + '" style="margin-top:-6px;border-top:0;border-radius:0 0 12px 12px;font-size:.94em"><strong>' + (chain.next ? '↔ Enchaînement des missions' : '🏠 Retour après mission') + '</strong><div>' + esc(title) + '</div>' + interval + '<div class="doux">' + esc(note) + '</div>' + y51WalkLink + y51TrafficAlert + '</div>';
      }
    });
    if (caches || etat.agendaTout) html += `<button id="agTout" class="second" style="width:100%;margin-top:10px">${etat.agendaTout ? 'Masquer les missions passées' : 'Afficher les ' + caches + ' mission(s) passée(s) de plus de 7 jours'}</button>`;
    $('ecran').innerHTML = html;
    // SIBRA : consultation volontaire des horaires du jour, hors étiquettes.
    // Aucun trajet n'est déclaré réalisable sans approche piétonne vérifiée.
    const todayParis = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    if (window.CPSibraFeed && typeof window.CPSibraFeed.loadDay === 'function') {
      const cards = document.querySelectorAll('.cpAgendaChain');
      cards.forEach(card => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'second';
        button.style.marginTop = '8px';
        const requestedDate = card.getAttribute('data-sibra-date');
        if (!requestedDate) return;
        // Optional regional multimodal search: use the same engine for every
        // delivery with exact GPS, never modify platform synchronization.
        const regional = window.CPRegionalRouting;
        const regionalEndpoint = window.CP_REGIONAL_ROUTING_URL;
        const regionalHome = RT.domicile(etat.reglages);
        const regionalLat = Number(card.getAttribute('data-y51-lat'));
        const regionalLon = Number(card.getAttribute('data-y51-lng'));
        const regionalEnd = Number(card.getAttribute('data-mission-end-ms'));
        if (regional && typeof regional.plan === 'function' &&
            /^https:\/\//.test(String(regionalEndpoint || '')) &&
            card.hasAttribute('data-y51-lat') && card.hasAttribute('data-y51-lng') &&
            regionalHome && Number.isFinite(Number(regionalHome.lat)) &&
            Number.isFinite(Number(regionalHome.lng)) &&
            Number.isFinite(regionalLat) && Number.isFinite(regionalLon) &&
            Number.isFinite(regionalEnd) && regionalEnd > 0) {
          const regionalButton = document.createElement('button');
          regionalButton.type = 'button';
          regionalButton.className = 'second';
          regionalButton.style.marginTop = '8px';
          regionalButton.textContent = '🚌 Recherche multimodale régionale';
          card.appendChild(regionalButton);
          regionalButton.addEventListener('click', async () => {
            regionalButton.disabled = true;
            const result = document.createElement('div');
            result.className = 'doux';
            result.textContent = 'Recherche régionale en cours…';
            card.appendChild(result);
            try {
              const answer = await regional.plan({
                endpoint: regionalEndpoint,
                from: {lat:regionalLat,lon:regionalLon},
                to: {lat:regionalHome.lat,lon:regionalHome.lng},
                departure: new Date(regionalEnd + 15 * 60000).toISOString(),
                fetcher:regionalFetch
              });
              const fmt = ms => new Intl.DateTimeFormat('fr-FR', {
                timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'
              }).format(new Date(ms));
              result.style.whiteSpace = 'pre-line';
              result.textContent = answer.itineraries.length ?
                answer.itineraries.slice(0,5).map((it, index) =>
                  'Trajet ' + (index + 1) + ' — ' +
                  fmt(it.startTime) + ' → ' + fmt(it.endTime) + ' · ' +
                  Math.round(it.durationSeconds / 60) + ' min · ' +
                  it.transfers + ' correspondance(s) · ' +
                  Math.round(it.walkMeters) + ' m à pied' +
                  '\n' + it.legs.map(leg =>
                    '  ' + (leg.route || leg.mode) + ' : ' +
                    (leg.from || 'départ non précisé') + ' ' + fmt(leg.startTime) +
                    ' → ' + (leg.to || 'arrivée non précisée') + ' ' +
                    fmt(leg.endTime)
                  ).join('\n')
                ).join('\n\n') +
                '\\n\\n' + (regionalHome.precision === 'gps' ?
                  'Destination GPS renseignée.' :
                  'Destination approximative (centre de ville), pas votre adresse exacte.') +
                '\\nHoraires théoriques. Transport non confirmé — vérifiez vous-même.' :
                'Aucun itinéraire régional proposé. Transport non confirmé — vérifiez vous-même.';
            } catch (error) {
              result.textContent = 'Recherche régionale indisponible : ' +
                String(error.message || error) + '. Transport non confirmé — vérifiez vous-même.';
            } finally {
              regionalButton.disabled = false;
            }
          });
        }
        // Y51: read the published official GTFS export on demand, not a guessed timetable.
        // This panel does not assert live service or walking feasibility.
        if (/Y51 Albertville/.test(card.textContent || '')) {
          const y51Button = document.createElement('button');
          y51Button.type = 'button';
          y51Button.className = 'second';
          y51Button.style.marginTop = '8px';
          y51Button.textContent = '🚌 Vérifier les courses officielles Y51 du ' + requestedDate;
          const y51Result = document.createElement('div');
          y51Result.className = 'doux';
          y51Result.setAttribute('aria-live', 'polite');
          y51Button.addEventListener('click', async () => {
            y51Button.disabled = true;
            y51Result.textContent = 'Chargement des données officielles Y51…';
            try {
              const response = await window.fetch('data/interurban/y51-gtfs-source.json', { cache: 'no-cache' });
              if (!response.ok) throw new Error('GTFS unavailable');
              const data = await response.json();
              const planner = window.CPSibraPlanner;
              if (!planner || typeof planner.activeServiceIds !== 'function' ||
                  !Array.isArray(data.trips) || !Array.isArray(data.stop_times) ||
                  !Array.isArray(data.routes) || !Array.isArray(data.stops) ||
                  !Array.isArray(data.calendar) || !Array.isArray(data.calendar_dates)) {
                throw new Error('Invalid Y51 data');
              }
              const services = planner.activeServiceIds(data.calendar, data.calendar_dates, requestedDate);
              const routeIds = new Set(data.routes.map(route => String(route.route_id)));
              const trips = data.trips.filter(trip => routeIds.has(String(trip.route_id)) &&
                services.has(String(trip.service_id)));
              const ids = new Set(trips.map(trip => String(trip.trip_id)));
              const times = data.stop_times.filter(time => ids.has(String(time.trip_id)));
              const stamp = data.checked_at_utc ? new Date(data.checked_at_utc).toLocaleString('fr-FR') : 'inconnue';
              // Select real stop IDs, preserving trip order and calendar exceptions.
              const normalized = value => String(value || '').normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '').toLowerCase();
              const stopLabel = stop => normalized([stop.stop_name, stop.stop_desc,
                stop.stop_code, stop.stop_id].filter(Boolean).join(' '));
              const boarding = data.stops.filter(stop =>
                /ecole[\s-]*st[\s-]*francois|ecole[\s-]*saint[\s-]*francois/.test(stopLabel(stop)));
              const annecy = data.stops.filter(stop =>
                /annecy/.test(stopLabel(stop)) && /gare|routiere/.test(stopLabel(stop)));
              const rides = [];
              if (typeof planner.datedInterurbanRides === 'function') {
                for (const route of data.routes) for (const from of boarding) for (const to of annecy) {
                  rides.push(...planner.datedInterurbanRides(data, requestedDate,
                    String(route.route_id), String(from.stop_id), String(to.stop_id)));
                }
              }
              // Exclude coaches departing before the delivery has finished.
              // No walking time is inferred: the remaining margin still needs verification.
              const endMs = Number(card.getAttribute('data-mission-end-ms'));
              const endDate = card.getAttribute('data-mission-end-ms') && Number.isFinite(endMs) ?
                new Date(endMs) : null;
              const endParts = endDate && Number.isFinite(endDate.getTime()) ?
                new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris',
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                  hourCycle: 'h23' }).formatToParts(endDate) : [];
              const part = type => (endParts.find(p => p.type === type) || {}).value;
              const endDay = endParts.length ? part('year') + '-' + part('month') + '-' + part('day') : null;
              const earliestY51 = endDay === requestedDate ?
                Number(part('hour')) * 3600 + Number(part('minute')) * 60 + Number(part('second')) : null;
              const unique = [...new Map(rides.filter(ride =>
                earliestY51 !== null && ride.departureSeconds > earliestY51)
                .map(ride => [ride.trip_id + ':' + ride.departureSeconds, ride])).values()]
                .sort((a, b) => a.departureSeconds - b.departureSeconds);
              const clock = sec => String(Math.floor(sec / 3600) % 24).padStart(2, '0') +
                ':' + String(Math.floor(sec / 60) % 60).padStart(2, '0');
              const missionLat = Number(card.getAttribute('data-y51-lat'));
              const missionLng = Number(card.getAttribute('data-y51-lng'));
              const footEndpoint = window.CP_PEDESTRIAN_OSRM_URL;
              const boardingMarginMinutes = 5;
              const selectedRides = unique.slice(0, 8);
              // Every GTFS trip may board at a different platform/stop ID.
              // Never reuse an unrelated stop's walking time for another trip.
              const stopById = new Map(data.stops.map(stop => [String(stop.stop_id), stop]));
              const walkByStopId = new Map();
              const boardingChecks = [];
              for (const ride of selectedRides) {
                const stopId = String(ride.from_stop_id);
                const stop = stopById.get(stopId);
                let walkMinutes = walkByStopId.get(stopId);
                if (walkMinutes === undefined) {
                  walkMinutes = null;
                  if (card.hasAttribute('data-y51-lat') && card.hasAttribute('data-y51-lng') &&
                      stop && Number.isFinite(Number(stop.stop_lat)) &&
                      Number.isFinite(Number(stop.stop_lon)) &&
                      typeof planner.requestPedestrianOSRM === 'function' &&
                      typeof footEndpoint === 'string' && /^https:\/\//.test(footEndpoint)) {
                    const walk = await planner.requestPedestrianOSRM(
                      [missionLng, missionLat],
                      [Number(stop.stop_lon), Number(stop.stop_lat)],
                      window.fetch.bind(window), footEndpoint);
                    if (walk && walk.status === 'VERIFIE_PIETON' &&
                        Number.isFinite(walk.duration_seconds)) {
                      walkMinutes = Math.ceil(walk.duration_seconds / 60);
                    }
                  }
                  walkByStopId.set(stopId, walkMinutes);
                }
                const enoughTime = walkMinutes !== null &&
                  ride.departureSeconds - earliestY51 >=
                  (walkMinutes + boardingMarginMinutes) * 60;
                boardingChecks.push(clock(ride.departureSeconds) + ' : ' +
                  (walkMinutes === null ? 'marche non vérifiée' :
                    (enoughTime ? 'approche piétonne compatible' : 'départ trop proche') +
                    ' (' + walkMinutes + ' min à pied + ' +
                    boardingMarginMinutes + ' min de marge)'));
              }
              const boardingStatus = boardingChecks.length ?
                boardingChecks.join(' ; ') : 'Marche depuis la livraison non vérifiée.';
              // Show the actual Y51 arrival stop from GTFS for each proposed trip.
              // These map links help locate the SIBRA transfer, without inventing it.
              const arrivalStops = [...new Map(selectedRides.map(ride => {
                const stop = stopById.get(String(ride.to_stop_id));
                return [String(ride.to_stop_id), stop];
              }).filter(entry => entry[1])).values()];
              const arrivalLinks = arrivalStops.filter(stop =>
                Number.isFinite(Number(stop.stop_lat)) &&
                Number.isFinite(Number(stop.stop_lon)) &&
                Math.abs(Number(stop.stop_lat)) <= 90 &&
                Math.abs(Number(stop.stop_lon)) <= 180);
              y51Result.textContent = 'Y51 du ' + requestedDate + ' :' + trips.length +
                ' courses programmées, ' + times.length + ' passages GTFS. Source vérifiée le ' +
                stamp + '. ' + (unique.length ?
                  'École Saint-François → Annecy gare routière : ' +
                  unique.slice(0, 8).map(ride => clock(ride.departureSeconds) +
                    ' → ' + clock(ride.arrivalSeconds) +
                    ' (temps disponible avant le car : ' +
                    Math.floor((ride.departureSeconds - earliestY51) / 60) +
                    ' min, trajet piéton et marge à déduire)').join(' ; ') + '.' :
                  'Aucun départ après la fin de mission identifié entre École Saint-François et Annecy gare routière' +
                  (earliestY51 === null ? ' (heure de fin de mission indisponible)' : '') +
                  ' : vérifiez les noms exacts des arrêts et les horaires GTFS.') +
                ' ' + boardingStatus + '. Correspondances et circulation réelle non vérifiées. ' +
                'Transport non confirmé — vérifiez vous-même.';
              // First Y51 -> SIBRA connection: GTFS timetable only. The home
              // coordinates are city-level, so this cannot certify the last walk.
              const sibraFeed = window.CPSibraFeed;
              const home = RT.domicile(etat.reglages);
              if (selectedRides.length && sibraFeed &&
                  typeof sibraFeed.loadDayCached === 'function' &&
                  typeof sibraFeed.coordinateDayJourneys === 'function' &&
                  home && Number.isFinite(home.lat) && Number.isFinite(home.lng)) {
                const sibraLine = document.createElement('div');
                sibraLine.className = 'doux';
                sibraLine.textContent = 'Recherche des correspondances Y51 → SIBRA…';
                y51Result.appendChild(sibraLine);
                try {
                  const local = await sibraFeed.loadDayCached(requestedDate, window.fetch.bind(window));
                  if (!local.usable) {
                    sibraLine.textContent = 'SIBRA indisponible à cette date — correspondance non confirmée.';
                  } else {
                    const transferCandidates = [];
                    for (const ride of selectedRides) {
                      const stop = stopById.get(String(ride.to_stop_id));
                      if (!stop || !Number.isFinite(Number(stop.stop_lat)) ||
                          !Number.isFinite(Number(stop.stop_lon))) continue;
                      const departures = sibraFeed.coordinateDayJourneys(local.data,
                        Number(stop.stop_lat), Number(stop.stop_lon),
                        home.lat, home.lng, ride.arrivalSeconds + 300);
                      for (const bus of departures.slice(0, 3)) {
                        transferCandidates.push({ ride, bus, stop });
                      }
                    }
                    // Deduplicate walking requests between identical Y51 and SIBRA stops,
                    // and calculate independent connections concurrently.
                    const walkCache = new Map();
                    const footService = window.CP_PEDESTRIAN_OSRM_URL;
                    const combinations = await Promise.all(transferCandidates.map(async candidate => {
                      const { ride, bus, stop } = candidate;
                      const board = bus.originStop;
                      let transferWalkMinutes = null;
                      if (board && Number.isFinite(Number(board.latitude)) &&
                          Number.isFinite(Number(board.longitude)) &&
                          typeof planner.requestPedestrianOSRM === 'function' &&
                          typeof footService === 'string' && /^https:\/\//.test(footService)) {
                        const key = String(ride.to_stop_id) + ':' + String(board.stopId || '') +
                          ':' + Number(board.latitude) + ':' + Number(board.longitude);
                        if (!walkCache.has(key)) {
                          walkCache.set(key, planner.requestPedestrianOSRM(
                            [Number(stop.stop_lon), Number(stop.stop_lat)],
                            [Number(board.longitude), Number(board.latitude)],
                            window.fetch.bind(window), footService).catch(() => null));
                        }
                        const walk = await walkCache.get(key);
                        if (walk && walk.status === 'VERIFIE_PIETON' &&
                            Number.isFinite(walk.duration_seconds)) {
                          transferWalkMinutes = Math.ceil(walk.duration_seconds / 60);
                        }
                      }
                      const transferCompatible = transferWalkMinutes !== null &&
                        bus.departureSeconds - ride.arrivalSeconds >=
                        (transferWalkMinutes + 5) * 60;
                      // The saved home location is city-level, not the exact address.
                      // Calculate the last pedestrian leg as an indicative estimate only.
                      let lastWalkMinutes = null;
                      const alight = bus.destinationStop;
                      if (alight && Number.isFinite(Number(alight.latitude)) &&
                          Number.isFinite(Number(alight.longitude)) &&
                          typeof planner.requestPedestrianOSRM === 'function' &&
                          typeof footService === 'string' && /^https:\/\//.test(footService)) {
                        const key = 'home:' + Number(alight.latitude) + ':' +
                          Number(alight.longitude) + ':' + home.lat + ':' + home.lng;
                        if (!walkCache.has(key)) {
                          walkCache.set(key, planner.requestPedestrianOSRM(
                            [Number(alight.longitude), Number(alight.latitude)],
                            [home.lng, home.lat], window.fetch.bind(window),
                            footService).catch(() => null));
                        }
                        const walk = await walkCache.get(key);
                        if (walk && walk.status === 'VERIFIE_PIETON' &&
                            Number.isFinite(walk.duration_seconds)) {
                          lastWalkMinutes = Math.ceil(walk.duration_seconds / 60);
                        }
                      }
                      return { ride, bus, transferWalkMinutes, transferCompatible,
                        lastWalkMinutes, estimatedHomeSeconds: lastWalkMinutes === null ?
                          null : bus.arrivalSeconds + lastWalkMinutes * 60 };
                    }));
                    combinations.sort((a, b) =>
                      Number(b.transferCompatible) - Number(a.transferCompatible) ||
                      (a.estimatedHomeSeconds ?? Infinity) -
                        (b.estimatedHomeSeconds ?? Infinity) ||
                      a.bus.arrivalSeconds - b.bus.arrivalSeconds);
                    sibraLine.textContent = combinations.length ?
                      'Correspondances théoriques Y51 → SIBRA : ' +
                      combinations.slice(0, 5).map(x =>
                        'Y51 ' + clock(x.ride.departureSeconds) + '–' +
                        clock(x.ride.arrivalSeconds) + ', SIBRA ' +
                        clock(x.bus.departureSeconds) + '–' +
                        clock(x.bus.arrivalSeconds) + ' (' +
                        (x.bus.originStop && x.bus.originStop.name || 'arrêt à vérifier') +
                        ' → ' +
                        (x.bus.destinationStop && x.bus.destinationStop.name || 'arrêt à vérifier') +
                        ', correspondance : ' +
                        (x.transferWalkMinutes === null ? 'marche non vérifiée' :
                          x.transferWalkMinutes + ' min à pied, ' +
                          (x.transferCompatible ? 'délai théorique suffisant' : 'délai insuffisant')) +
                        ', fin de trajet : ' + (x.estimatedHomeSeconds === null ?
                          'marche non vérifiée' : clock(x.estimatedHomeSeconds) +
                          ' estimé au point domicile enregistré (précision ville)') +
                        ')').join(' ; ') +
                        '. Marches de correspondance et vers le domicile non vérifiées. ' +
                        'Transport non confirmé — vérifiez vous-même.' :
                      'Aucune correspondance SIBRA théorique trouvée près des arrivées Y51. ' +
                      'Transport non confirmé — vérifiez vous-même.';
                  }
                } catch (_) {
                  sibraLine.textContent = 'Calcul Y51 → SIBRA indisponible — transport non confirmé.';
                }
              }
              for (const stop of arrivalLinks.slice(0, 3)) {
                const link = document.createElement('a');
                link.href = 'https://www.google.com/maps/search/?api=1&query=' +
                  encodeURIComponent(Number(stop.stop_lat) + ',' + Number(stop.stop_lon));
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.style.display = 'block';
                link.textContent = '🗺️ Arrivée Y51 : ' +
                  (stop.stop_name || stop.stop_id) + ' — localiser pour la correspondance SIBRA';
                y51Result.appendChild(link);
              }
            } catch (_) {
              y51Result.textContent = 'Données officielles Y51 indisponibles ou non exploitables pour cette date. ' +
                'Transport non confirmé — vérifiez vous-même.';
            } finally {
              y51Button.disabled = false;
            }
          });
          card.appendChild(y51Button);
          card.appendChild(y51Result);
        }
        button.textContent = '🚌 Consulter les horaires SIBRA du ' + requestedDate;
        const result = document.createElement('div');
        result.className = 'doux';
        result.setAttribute('aria-live', 'polite');
        button.addEventListener('click', async () => {
          button.disabled = true;
          result.textContent = 'Chargement des horaires SIBRA…';
          try {
            const response = await window.CPSibraFeed.loadDayCached(requestedDate, window.fetch.bind(window));
            if (!response.usable) {
              result.textContent = 'Horaires SIBRA indisponibles pour ce jour — transport non confirmé.';
            } else {
              const d = response.data;
              result.textContent = 'Horaires programmés SIBRA du ' + requestedDate + ' : ' +
                d.trips.length.toLocaleString('fr-FR') + ' courses, ' +
                d.stop_times.length.toLocaleString('fr-FR') + ' passages et ' +
                d.stops.length.toLocaleString('fr-FR') + ' arrêts. ' +
                'Trajet vers la mission non calculé : adresses et marche d’approche à vérifier. Transport non confirmé.';
            }
          } catch (_) {
            result.textContent = 'Chargement impossible — transport non confirmé.';
          } finally {
            button.disabled = false;
          }
        });
        card.appendChild(button);
        card.appendChild(result);
      });
    }
    // SIBRA: affichage distinct des étiquettes de missions. Recherche seulement si
    // deux adresses possèdent des coordonnées GPS précises et des horaires connus.
    const feed = window.CPSibraFeed;
    if (feed && typeof feed.loadDayCached === 'function' && typeof feed.coordinateDayJourneys === 'function') {
      for (const x of items) {
        const chain = chainMap[x.cle];
        if (!chain || !chain.next || !x.fin || !Number.isFinite(x.fin.t) ||
            !Number.isFinite(chain.next.debut) || chain.next.debut <= x.fin.t) continue;
        const origin = G.coordonnees(x.mission, 'destination');
        const destination = G.coordonnees(chain.next.mission, 'origin');
        if (!origin || !destination || origin.precision !== 'gps' || destination.precision !== 'gps') continue;
        const date = (date => { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const get = type => parts.find(p => p.type === type).value; return get('year') + '-' + get('month') + '-' + get('day'); })(new Date(x.fin.t));
        const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(x.fin.t)).split(':');
        const earliest = Number(timeParts[0]) * 3600 + Number(timeParts[1]) * 60 + Number(timeParts[2]);
        const card = document.querySelectorAll('.mission')[items.indexOf(x)];
        let panel = card && card.nextElementSibling;
        while (panel && !panel.classList.contains('mission') && !panel.classList.contains('cpAgendaChain')) panel = panel.nextElementSibling;
        if (!panel || !panel.classList.contains('cpAgendaChain')) continue;
        const line = document.createElement('div');
        line.className = 'doux';
        line.textContent = 'SIBRA : recherche des horaires programmés…';
        panel.appendChild(line);
        feed.loadDayCached(date, window.fetch.bind(window)).then(result => {
          if (!line.isConnected) return;
          if (!result.usable) {
            line.textContent = 'SIBRA : horaires indisponibles pour cette date — transport non confirmé.';
            return;
          }
          const nextDate = (date => { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const get = type => parts.find(p => p.type === type).value; return get('year') + '-' + get('month') + '-' + get('day'); })(new Date(chain.next.debut));
          const nextClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(chain.next.debut)).split(':');
          const nextSeconds = Number(nextClock[0]) * 3600 + Number(nextClock[1]) * 60 + Number(nextClock[2]);
          const directJourneys = feed.coordinateDayJourneys(result.data,
            origin.lat, origin.lng, destination.lat, destination.lng, earliest);
          const transferJourneys = typeof feed.coordinateOneTransferDayJourneys === 'function' ?
            feed.coordinateOneTransferDayJourneys(result.data,
              origin.lat, origin.lng, destination.lat, destination.lng, earliest) : [];
          const journeys = directJourneys.concat(transferJourneys)
            .filter(j => nextDate === date && j.arrivalSeconds <= nextSeconds - 5 * 60)
            // Préférer une arrivée à l'arrêt 30–45 min avant la mission, sans
            // considérer cet écart comme une marge réelle (marche non vérifiée).
            .sort((a, b) => {
              const score = j => {
                const advance = (nextSeconds - j.arrivalSeconds) / 60;
                return advance >= 30 && advance <= 45 ? 0 :
                  advance > 45 ? advance - 45 : 30 - advance;
              };
              return score(a) - score(b) || a.arrivalSeconds - b.arrivalSeconds;
            });
          if (!journeys.length) {
            line.textContent = 'SIBRA : aucun trajet direct ou avec une correspondance identifié entre arrêts proches — transport non confirmé.';
            return;
          }
          const formatTime = seconds => String(Math.floor(seconds / 3600) % 24).padStart(2, '0') +
            ':' + String(Math.floor(seconds / 60) % 60).padStart(2, '0');
          const stopDistance = stop => stop && Number.isFinite(stop.straightLineMeters) ?
            ' (à ' + stop.straightLineMeters + ' m à vol d’oiseau, marche à vérifier)' : '';
          // Carte des arrêts de l'option SIBRA (ne valide ni le service ni les marches).
          const addStopsMapLinks = options => {
            for (const [index, journey] of options.slice(0, 3).entries()) {
              if (!journey || !journey.originStop || !journey.destinationStop) continue;
              const a = journey.originStop, b = journey.destinationStop;
              if (![a.latitude, a.longitude, b.latitude, b.longitude].every(Number.isFinite)) continue;
              const transfer = journey.transferStopId && result.data.stops.find(stop => String(stop[0]) === String(journey.transferStopId));
              const transferLat = transfer && Number(transfer[2]);
              const transferLon = transfer && Number(transfer[3]);
              const via = Number.isFinite(transferLat) && Number.isFinite(transferLon) &&
                Math.abs(transferLat) <= 90 && Math.abs(transferLon) <= 180 ?
                '&waypoints=' + encodeURIComponent(transferLat + ',' + transferLon) : '';
            const link = document.createElement('a');
            link.href = 'https://www.google.com/maps/dir/?api=1&origin=' +
              encodeURIComponent(a.latitude + ',' + a.longitude) + '&destination=' +
              encodeURIComponent(b.latitude + ',' + b.longitude) + via + '&travelmode=transit';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
              link.textContent = '🗺️ Trajet ' + (index + 1) + (via ? ' (avec correspondance)' : '') +
                ' : voir les arrêts sur la carte (à vérifier)';
            link.style.display = 'block';
            link.style.marginTop = '6px';
            line.appendChild(link);
            }
          };
          // Route piétonne : uniquement un service foot HTTPS configuré explicitement.
          // Une durée à vol d'oiseau ne valide jamais une correspondance.
          const planner = window.CPSibraPlanner;
          const footEndpoint = window.CP_PEDESTRIAN_OSRM_URL;
          const canCheckWalk = planner && typeof planner.requestPedestrianOSRM === 'function' &&
            typeof planner.assessScheduledSibraJourney === 'function' &&
            typeof footEndpoint === 'string' && /^https:\/\//.test(footEndpoint);
          if (canCheckWalk) {
            const from = [Number(origin.lng), Number(origin.lat)];
            const to = [Number(destination.lng), Number(destination.lat)];
            const selected = journeys.slice(0, 12);
            Promise.all(selected.map(async j => {
              const firstStop = [Number(j.originStop.longitude), Number(j.originStop.latitude)];
              const lastStop = [Number(j.destinationStop.longitude), Number(j.destinationStop.latitude)];
              const [firstWalk, lastWalk] = await Promise.all([
                planner.requestPedestrianOSRM(from, firstStop, window.fetch.bind(window), footEndpoint),
                planner.requestPedestrianOSRM(lastStop, to, window.fetch.bind(window), footEndpoint)
              ]);
              return { journey: j, check: planner.assessScheduledSibraJourney(
                j, earliest, nextSeconds, from, to, firstWalk, lastWalk, 300) };
            })).then(assessed => {
              if (!line.isConnected) return;
              const ranked = assessed.sort((a, b) => Number(b.check.feasible) - Number(a.check.feasible) ||
                a.journey.arrivalSeconds - b.journey.arrivalSeconds);
              line.textContent = 'SIBRA (horaires programmés) : ' + ranked.slice(0, 3).map(({ journey: j, check }) =>
                (j.transferStopId ? 'Correspondance à ' +
                  ((result.data.stops.find(stop => String(stop[0]) === j.transferStopId) || [null, j.transferStopId])[1]) +
                  ' (attente ' + Math.round(j.transferWaitSeconds / 60) + ' min) : ' : 'Direct : ') +
                j.originStop.name + stopDistance(j.originStop) + ' ' + formatTime(j.departureSeconds) + ' → ' +
                j.destinationStop.name + stopDistance(j.destinationStop) + ' ' + formatTime(j.arrivalSeconds) + ' — ' +
                (check.feasible ? 'marche départ ' + Math.ceil(check.firstWalkSeconds / 60) + ' min, marche arrivée ' + Math.ceil(check.lastWalkSeconds / 60) + ' min, arrivée à l’adresse ' + formatTime(check.arrivalAtNextMissionSeconds) + ', avance ' + Math.floor(check.advanceSeconds / 60) + ' min (horaires théoriques)' :
                  check.status === 'marches_non_verifiees' ? 'marche non vérifiée' :
                  'enchaînement non réalisable avec la marche et la marge de sécurité')
              ).join(' ; ') + '. Transport non confirmé — vérifiez vous-même.';
              addStopsMapLinks(ranked.map(x => x.journey));
            }).catch(() => {
              if (line.isConnected) line.textContent = 'SIBRA : vérification piétonne indisponible — transport non confirmé.';
            });
            return;
          }
          line.textContent = 'SIBRA (horaires théoriques, approche à pied non vérifiée) : ' +
            journeys.slice(0, 3).map(j => (j.transferStopId ? 'Correspondance à ' +
              ((result.data.stops.find(stop => String(stop[0]) === j.transferStopId) || [null, j.transferStopId])[1]) +
              ' (attente ' + Math.round(j.transferWaitSeconds / 60) + ' min) : ' : 'Direct : ') +
              j.originStop.name + stopDistance(j.originStop) + ' ' +
              formatTime(j.departureSeconds) + ' → ' + j.destinationStop.name + stopDistance(j.destinationStop) + ' ' +
              formatTime(j.arrivalSeconds) + ' (écart théorique avant prise en charge : ' + Math.floor((nextSeconds - j.arrivalSeconds) / 60) + ' min, hors marche et marge de sécurité)').join(' ; ') +
            '. Transport non confirmé — vérifiez vous-même.';
          addStopsMapLinks(journeys);
        }).catch(() => {
          if (line.isConnected) line.textContent = 'SIBRA : recherche indisponible — transport non confirmé.';
        });
      }
    }
    for (const b of document.querySelectorAll('.mission')) b.onclick = () => detail(listeAffichee[Number(b.dataset.i)]);
    const t = $('agTout'); if (t) t.onclick = () => { etat.agendaTout = !etat.agendaTout; afficher(); };
  }
  // ---------- V80 : planning sur plusieurs jours ----------
  const PL = window.CPPlanning;
  const demainParis = () => { const d = new Date(Date.now() + 86400000); return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); };
  function vuePlanning() {
    const p = etat.plan = { date: demainParis(), heure: '06:00', jours: 3, nuits: 2, hotel: 60, hotelOn: false, seuil: 150, zones: [], rayon: 50, acc: true, tri: 'net', ...(etat.plan || {}) };
    if (!p.date || p.date < new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })) p.date = demainParis();
    const opt = (l, v, f) => l.map(x => `<option value="${x}"${String(x) === String(v) ? ' selected' : ''}>${f(x)}</option>`).join('');
    const dom = RT.domicile(etat.reglages);
    $('ecran').innerHTML = `<div class="carte plusFiltres"><h2>🗺️ Préparer plusieurs jours</h2>
      ${dom ? `<p class="doux">Départ et retour : ${esc(etat.reglages.domicile_ville)} (Réglages). Liaisons, marge et attente maximale : tes réglages.</p>` : '<p class="erreur">Renseigne d’abord la ville de ton domicile dans Réglages → « Approche, retours et liaisons ».</p>'}
      <div class="grilleFiltres"><div><label for="pDate">Départ le</label><input id="pDate" type="date" value="${esc(p.date)}"></div><div><label for="pHeure">à partir de</label><input id="pHeure" type="time" value="${esc(p.heure)}"></div>
      <div><label for="pJours">Durée</label><select id="pJours">${opt([1, 2, 3, 4, 5, 6, 7], p.jours, x => x + ' jour' + (x > 1 ? 's' : ''))}</select></div>
      <div><label for="pNuits">Nuits hors de chez toi (max)</label><select id="pNuits">${opt([0, 1, 2, 3, 4, 5, 6], p.nuits, x => x ? x + ' nuit' + (x > 1 ? 's' : '') : 'aucune')}</select></div>
      <div><label for="pHotelOn">Frais d’hôtel</label><label style="margin:0;display:flex;align-items:center;gap:8px;min-height:44px;color:var(--texte)"><input id="pHotelOn" type="checkbox" style="width:auto;min-height:0"${p.hotelOn ? ' checked' : ''}> à compter</label></div>
      <div><label for="pHotel">Budget hôtel par nuit (€)</label><input id="pHotel" type="number" min="0" max="500" step="5" inputmode="numeric" value="${esc(p.hotel)}"${p.hotelOn ? '' : ' disabled'}></div>
      <div><label for="pSeuil">Nuit à ton domicile si moins de (km par la route)</label><input id="pSeuil" type="number" min="0" max="2000" value="${esc(p.seuil != null ? p.seuil : 150)}"></div>
      <div><label for="pTri">Priorité</label><select id="pTri"><option value="net"${p.tri === 'net' ? ' selected' : ''}>Gagner le plus</option><option value="heure"${p.tri === 'heure' ? ' selected' : ''}>Meilleur €/heure</option></select></div></div>
      <label for="pZone">Zones de travail (vide = toute la France)</label>
      <div class="recherche"><input id="pZone" autocomplete="off" placeholder="Région, département ou ville (3 lettres)" aria-controls="pSugg"><div id="pSugg" class="sugg" role="listbox" hidden></div></div>
      <div class="zones" id="pZones">${p.zones.map((z, i) => `<button class="zone" data-pzone="${i}" aria-label="Retirer cette zone">${esc(G.libelleZone(z))} ✕</button>`).join('')}</div>
      <label><input id="pAcc" type="checkbox" style="width:auto;min-height:0"${p.acc ? ' checked' : ''}> Inclure obligatoirement mes missions déjà acceptées</label>
      <button id="pGo" style="width:100%;margin-top:12px"${dom ? '' : ' disabled'}>Calculer les meilleurs enchaînements</button></div>
      <div id="pRes"></div>`;
    const lire = () => Object.assign(p, { date: $('pDate').value, heure: $('pHeure').value || '06:00', jours: Number($('pJours').value), nuits: Number($('pNuits').value), hotel: Math.max(0, Math.min(500, Number($('pHotel').value) || 0)), hotelOn: $('pHotelOn').checked, seuil: Math.max(0, Math.min(2000, Number($('pSeuil').value) || 150)), acc: $('pAcc').checked, tri: $('pTri').value });
    for (const id of ['pDate', 'pHeure', 'pJours', 'pNuits', 'pHotel', 'pSeuil', 'pAcc', 'pTri']) $(id).onchange = () => { lire(); memoriser(); };
    $('pHotelOn').onchange = () => { lire(); memoriser(); $('pHotel').disabled = !p.hotelOn; };   // frais d'hôtel en option (coche)
    for (const b of document.querySelectorAll('[data-pzone]')) b.onclick = () => { lire(); p.zones.splice(Number(b.dataset.pzone), 1); memoriser(); afficher(); };
    $('pZone').oninput = () => {
      const box = $('pSugg'), l = G.suggestions($('pZone').value, { villes: villesConnues(), max: 6 }); chargerVillesNet($('pZone').value, () => { if ($('pZone')) $('pZone').oninput(); });
      box.innerHTML = l.map((x, i) => `<button role="option" data-pz="${i}">${esc(x.libelle)}<small>${esc(x.detail)}</small></button>`).join(''); box.hidden = !l.length;
      for (const b of box.querySelectorAll('[data-pz]')) b.onclick = () => { const x = l[Number(b.dataset.pz)]; lire(); p.zones.push(x.type === 'ville' ? { type: 'ville', nom: x.nom, dep: x.dep, lat: x.lat, lng: x.lng } : { type: x.type, code: x.code }); memoriser(); afficher(); };
    };
    $('pGo').onclick = () => { lire(); memoriser(); calculerPlanning(); };
    if (etat.planResultat) afficherPlans(etat.planResultat);
  }
  function calculerPlanning() {
    const p = etat.plan, debut = PL.parisVersMs(p.date, p.heure);
    if (debut == null) return toast('Date ou heure invalide');
    const res = PL.planifier(planningMissions(), etat.reglages, { debut, jours: p.jours, nuits_max: p.nuits, budget_hotel: p.hotelOn ? p.hotel : 0, seuil_dom: p.seuil, zones: p.zones, rayon: p.rayon, inclureAcceptees: p.acc, tri: p.tri });
    etat.planResultat = res; afficherPlans(res);
    const r = $('pRes'); if (r) r.scrollIntoView({ block: 'start' });
  }
  function afficherPlans(res) {
    const box = $('pRes'); if (!box) return;
    if (res.erreurs.includes('domicile')) { box.innerHTML = ''; return; }
    const e = res.ecartees, ecartes = [[e.horsPeriode, 'hors période'], [e.horsZone, 'hors zones'], [e.sansDate, 'sans horaire'], [e.sansLieu, 'lieu inconnu']].filter(([k]) => k).map(([k, t]) => k + ' ' + t).join(', ');
    if (!res.plans.length) {
      box.innerHTML = `<div class="carte" id="pAucun"><h2>Aucun enchaînement possible</h2><p>${res.erreurs.includes('acceptees_incompatibles') ? 'Tes missions déjà acceptées ne peuvent pas être toutes enchaînées dans cette période avec ces contraintes (nuits, retour au domicile). Allonge la période, autorise plus de nuits ou décoche l’inclusion des missions acceptées.' : 'Essaie une période plus longue, plus de nuits ou des zones plus larges.'}</p><p class="doux">${res.candidates || 0} mission(s) utilisable(s)${ecartes ? ' · écartées : ' + esc(ecartes) : ''}.</p></div>`;
      return;
    }
    const duree = h => { const t = Math.round(h * 60); return t < 60 ? t + ' min' : Math.floor(t / 60) + ' h' + (t % 60 ? String(t % 60).padStart(2, '0') : ''); };
    const hm = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    const domNom = (etat.reglages && etat.reglages.domicile_ville) || 'domicile';
    box.innerHTML = res.plans.map((pl, ip) => {
      let nuit = 0;
      const jours = PL.parJour(pl).map((j, ij, tous) => {
        const lignes = j.lignes.map(l => {
          if (l.type === 'depart') { const e0 = pl.etapes[0]; return bk('bkTr', '🏠 DÉPART', '<b>' + hm(l.t) + '</b> départ de ' + esc(domNom) + (e0.liaison.km >= 2 ? '<br>🚆 liaison ≈ ' + esc(e0.liaison.km) + ' km · ' + esc(duree(e0.liaison.heures)) + ' · ' + esc(euros(e0.liaison.cout)) : '')); }
          if (l.type === 'retour') return bk('bkTr', '🏠 RETOUR', '<b>' + hm(l.t) + '</b> retour à ' + esc(domNom) + (pl.retour.km >= 2 ? '<br>🚆 ≈ ' + esc(pl.retour.km) + ' km · ' + esc(duree(pl.retour.heures)) + ' · ' + esc(euros(pl.retour.cout)) : ''));
          const et = l.etape, m = et.mission, ie = pl.etapes.indexOf(et);
          const nlM = (pl.nuitsLiaison || []).find(x => x && x.cle === et.cle && x.matin);
          const lienPlan = nlM ? bk('bkTr', '🚆 LE MATIN', '<b>Domicile → ' + esc(m.from_city || '?') + '</b><br>≈ ' + esc(Math.round(nlM.matin.km)) + ' km · ' + esc(duree(nlM.matin.heures)) + ' · ' + esc(euros(nlM.matin.cout))) : (ie > 0 && et.liaison.km >= 2 && !(pl.nuitsLiaison || []).some(x => x && x.cle === et.cle)) ? bk('bkTr', '🚆 TRANSPORT', '<b>' + esc(et.depuis) + ' → ' + esc(m.from_city || '?') + '</b><br>≈ ' + esc(et.liaison.km) + ' km · ' + esc(duree(et.liaison.heures)) + ' · ' + esc(euros(et.liaison.cout)) + (et.attenteH ? ' · attente ' + esc(duree(et.attenteH)) : '')) : '';
          return lienPlan + `<button class="mission${clsPlat(m.platform)}" data-plan="${ip}" data-etape="${ie}"><div class="haut"><span><span class="etiq">${esc(PLATS[m.platform] || m.platform)}</span>${et.acceptee ? ' <span class="etiq ok">déjà acceptée</span>' : ''}</span><span><div class="prix">${m.fee != null ? esc(euros(m.fee)) : '—'}</div><div class="net">net ≈ ${esc(euros(et.net))}</div></span></div><div class="trajet">${trajetHtml(m)}</div><div class="meta">${agendaDateBlocks(m,{t:et.fin,estimee:et.finEstimee},et.debut)}</div></button>`;
        }).join('');
        const dort = ij < tous.length - 1 && nuit < pl.nuits ? `${(pl.nuitsLiaison || [])[nuit] && pl.nuitsLiaison[nuit].km >= 2 ? bk('bkTr', '🚆 EN SOIRÉE', '<b>' + esc(pl.nuitsLiaison[nuit].depuis) + ' → ' + esc(pl.nuitsLiaison[nuit].soir ? 'Domicile' : pl.lieuxNuits[nuit]) + '</b><br>≈ ' + esc(Math.round((pl.nuitsLiaison[nuit].soir || pl.nuitsLiaison[nuit]).km)) + ' km · ' + esc(duree((pl.nuitsLiaison[nuit].soir || pl.nuitsLiaison[nuit]).heures)) + ' · ' + esc(euros((pl.nuitsLiaison[nuit].soir || pl.nuitsLiaison[nuit]).cout))) : ''}<div class="bk bkC bkSuite nuit"><div class="bkt">🌙 NUIT</div>${(() => { const nd = (pl.nuitsDom || [])[nuit]; const vl = pl.lieuxNuits[nuit++]; return nd && nd.domicile ? 'Nuit à ton domicile' + (nd.km != null && nd.km >= nd.seuil * 0.6 ? ' <span class="doux">(≈ ' + esc(Math.round(nd.km)) + ' km par la route)</span>' : '') : 'Nuit à ' + esc(vl) + (nd && nd.km != null && nd.km < nd.seuil * 1.4 ? ' <span class="doux">(≈ ' + esc(Math.round(nd.km)) + ' km du domicile)</span>' : ''); })()}${pl.coutHotel > 0 ? ' (hôtel ≈ ' + esc(euros(pl.coutHotel / pl.nuits)) + ')' : ''}</div>` : '';
        return `<div class="jour">${esc(new Date(j.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }))}</div>${lignes}${dort}`;
      }).join('');
      return `<div class="carte plan propC" id="plan${ip}"><div class="propBandeau">Proposition ${ip + 1}</div>
        <div class="resume">≈ ${esc(euros(pl.net))} net${pl.parHeure != null ? ' · ' + esc(euros(pl.parHeure)) + '/h' : ''} · ${pl.etapes.length} mission${pl.etapes.length > 1 ? 's' : ''} · ${pl.nuits ? pl.nuits + ' nuit' + (pl.nuits > 1 ? 's' : '') : 'sans nuit'}</div>
        <div class="bk bkC bkRen bilan"><div class="bkt">💶 BILAN</div>Prestations ${esc(euros(pl.prestations))} → net des missions ${esc(euros(pl.netMissions))} (cotisations et liaisons déduites)${pl.coutHotel > 0 ? ' − hôtel ' + esc(euros(pl.coutHotel)) : ''} − retour ${esc(euros(pl.retour.cout))} · ${esc(duree(pl.heures))} de travail et de trajets · ≈ ${esc(pl.liaisonKm)} km de liaisons</div>
        ${jours}</div>`;
    }).join('') + `<p class="doux">Estimation (distances à vol d’oiseau × 1,25, durées approximatives)${ecartes ? ' · écartées : ' + esc(ecartes) : ''}. Rien n’est réservé : prends chaque mission sur sa plateforme, en commençant par la plus proche.</p>`;
    for (const b of box.querySelectorAll('[data-plan]')) b.onclick = () => { const pl = res.plans[Number(b.dataset.plan)], i = Number(b.dataset.etape); detail(pl.etapes[i].mission, i > 0 ? G.coordonnees(pl.etapes[i - 1].mission, 'destination') : null); };
  }
  // V90 : alerte → sa mission (fiche avec « Faire le devis »).
  const missionDeAlerte = a => a && a.external_id ? etat.missions.find(m => m.platform === a.platform && String(m.external_id) === String(a.external_id) && (a.type === 'mission_acceptee' || a.type === 'mission_modifiee' || a.type === 'mission_annulee' ? m.kind === 'acceptee' : m.kind !== 'acceptee')) || null : null;
  function vueAlertes() {
    const l = etat.alertes;
    $('ecran').innerHTML = (l.some(a => !a.lue) ? '<button id="toutLu" class="second" style="width:100%">Tout marquer comme lu</button>' : '') +
      (l.length ? l.map(a => `<div class="carte alerte${clsPlat(a.platform)}${a.lue ? '' : ' nonlue'}${missionDeAlerte(a) ? ' cliquable' : ''}" data-alerte="${esc(a.id)}"><span>${({ hausse_prix: '📈', mission_acceptee: '✅', mission_modifiee: '✏️', mission_annulee: '❌' })[a.type] || '🆕'}</span><div><div class="msg">${a.lue ? '' : '<span class="etiq nv pNouveau">NOUVEAU</span> '}${esc(a.message)}</div><div class="doux">${esc(fmtDate(a.created_at))}${a.lue ? ' · ✓ déjà lue' : ''}</div></div></div>`).join('')
        : '<div class="vide">Aucune alerte. Tu seras prévenu des nouvelles missions.</div>');
    // V142 : toucher une alerte (nouvelle mission…) la marque aussitôt comme lue : couleur atténuée, étiquette « NOUVEAU » retirée, compteur mis à jour, et enregistré sur le compte.
    const lireAlerte = (el, a) => {
      if (!a || a.lue) return; a.lue = true; el.classList.remove('nonlue'); const e = el.querySelector('.pNouveau'); if (e) e.remove();
      const d = el.querySelector('.doux'); if (d && !/déjà lue/.test(d.textContent)) d.textContent += ' · ✓ déjà lue';
      const nb = etat.alertes.filter(x => !x.lue).length, bd = $('badge'); if (bd) { bd.hidden = !nb; bd.textContent = nb > 99 ? '99+' : nb; }
      if (!nb) { const t = $('toutLu'); if (t) t.remove(); }
      try { const r = api.marquerLue && api.marquerLue(a.id); if (r && r.catch) r.catch(() => { a.lue = false; }); } catch (_) {}
    };
    for (const el of document.querySelectorAll('[data-alerte]')) { const a = l.find(x => String(x.id) === el.dataset.alerte), m = missionDeAlerte(a); el.onclick = () => { lireAlerte(el, a); if (m) detail(m); }; }
    const b = $('toutLu'); if (b) b.onclick = async () => { try { await api.marquerLues(); etat.alertes.forEach(a => { a.lue = true; }); afficher(); } catch (e) { toast(e.message); } };
  }
  // V243 : mise à jour des péages (fichiers peages-aprr.json + peages-overlay.json), avec indicateur d'avancement
  // (nombre de barrières/gares traitées) et déclenchement automatique quand une nouvelle grille tarifaire entre
  // en vigueur (chaque 1er février), sans attendre que Laurent clique lui-même sur le bouton des Réglages.
  async function executerMajPeages(onProgress) {
    const [r1, r2] = await Promise.all([fetch('peages-aprr.json', { cache: 'reload' }), fetch('peages-overlay.json', { cache: 'reload' })]);
    const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
    if (!j1 || !j1.p || !j1.g) throw new Error('peages-aprr.json vide ou invalide');
    if (!j2 || !j2.paires) throw new Error('peages-overlay.json vide ou invalide');
    try {
      const ks = await caches.keys();
      for (const k of ks) {
        const c = await caches.open(k);
        for (const nom of ['peages-aprr.json', 'peages-overlay.json']) { await c.delete(nom); await c.delete(new URL(nom, location.href).href); }
      }
    } catch (_) {}
    // Parcours réel de toutes les barrières/gares des deux fichiers (pas une simple barre animée) : chaque entrée
    // traitée fait avancer le compteur affiché, par lots pour laisser l'écran se rafraîchir.
    const points = (j1.g || []).concat(j2.barrieres || [], j2.gares || []);
    const total = points.length;
    let fait = 0;
    for (let i = 0; i < total; i += 40) {
      fait = Math.min(total, i + 40);
      for (let k = i; k < fait; k++) if (!points[k]) throw new Error('entrée péage invalide (#' + k + ')');
      if (onProgress) onProgress(fait, total);
      if (i + 40 < total) await new Promise(ok => setTimeout(ok, 0));
    }
    const versions = [j1.v, j2.v].filter(Boolean).join(' · ');
    const resultat = { total, versions, le: new Date().toISOString() };
    try { localStorage.setItem('cp_peages_maj', resultat.le); } catch (_) {}
    ecrireLocal('cp_peages_maj_detail', resultat);   // persisté (pas qu'en mémoire) : reste affiché après un rechargement ou un redémarrage de l'appli
    return resultat;
  }
  // Déclenchement automatique : dès qu'une nouvelle grille (1er février) est détectée ET qu'elle n'a pas déjà
  // été appliquée automatiquement pour cette revalorisation, on lance la mise à jour sans intervention de Laurent.
  async function autoMajPeagesSiNecessaire() {
    try {
      const r = await fetch('peages-aprr.json'); const j = await r.json();
      const ms = (String(j.v || '').match(/\d{4}-\d{2}/g) || []).sort(); if (!ms.length) return;
      const [a, m] = ms[0].split('-').map(Number);
      const n = new Date(); let an = n.getFullYear(); if (n.getMonth() < 1) an -= 1;
      if (a * 12 + (m - 1) >= an * 12 + 1) return;   // déjà à jour pour la revalorisation en cours
      const cle = 'cp_peages_maj_auto_' + an; if (lireLocal(cle, false)) return;   // déjà tenté/réussi cette année
      const res = await executerMajPeages(null);
      ecrireLocal(cle, true);
      toast('Péages mis à jour automatiquement : ' + res.total + ' barrières/gares (' + res.versions.slice(0, 70) + ')');
    } catch (_) { /* pas de connexion ou fichier indisponible : on retentera au prochain démarrage */ }
  }
  function vueReglages() {
    const r = { statut: 'micro', taux_cotisations: 21.2, cout_km: 0, prix_minimum: 0, alertes_nouvelles: true, alertes_prix: true, domicile_ville: null, domicile_lat: null, domicile_lng: null, cout_transport_km: 0.12, vitesse_liaison: 60, marge_minutes: 60, rayon_retour_km: 60, attente_max_h: 24, carte_sncf: 'aucune', trottinette: false, ...(etat.reglages || {}) };
    $('ecran').innerHTML = `<div class="carte plusFiltres"><h2>Rentabilité</h2>
      <label for="rStatut">Statut</label><select id="rStatut"><option value="micro">Micro-entrepreneur</option><option value="autre">Autre statut</option></select>
      <label for="rTaux">Taux de cotisations (%)</label><input id="rTaux" type="number" step="0.1" min="0" max="60" inputmode="decimal">
      <p class="doux">Valeur de travail à vérifier selon ta situation : ce taux n’est pas une valeur légale fixe.</p>
      <label for="rKm">Coût à ta charge par km (€/km, 0 si remboursé)</label><input id="rKm" type="number" step="0.01" min="0" max="5" inputmode="decimal">
      <label for="rMin">Prix minimum pour être alerté (€)</label><input id="rMin" type="number" step="1" min="0" inputmode="numeric">
      <label><input id="rNv" type="checkbox" style="width:auto;min-height:0"> Alerte nouvelles missions</label>
      <h2 style="margin-top:16px">Approche, retours et liaisons</h2>
      <label for="rDom">Ville de ton domicile (point de départ et de retour)</label>
      <div class="recherche"><input id="rDom" autocomplete="off" placeholder="3 lettres puis choisis dans la liste" aria-controls="rDomSugg"><div id="rDomSugg" class="sugg" role="listbox" hidden></div></div>
      <p class="doux">Seule la ville est enregistrée (jamais ton adresse). Sert à estimer l’approche et le retour.</p>
      <label for="rTr">Coût des transports de liaison (€/km : train, car, covoiturage)</label><input id="rTr" type="number" step="0.01" min="0" max="2" inputmode="decimal">
      <label for="rVit">Vitesse moyenne porte à porte de ces liaisons (km/h)</label><input id="rVit" type="number" step="1" min="10" max="300" inputmode="numeric">
      <label for="rMarge">Marge de sécurité entre deux missions (minutes)</label><input id="rMarge" type="number" step="5" min="0" max="600" inputmode="numeric">
      <label for="rRayon">Chercher les retours jusqu’à (km du lieu de livraison)</label><input id="rRayon" type="number" step="5" min="1" max="500" inputmode="numeric">
      <label for="rAtt">Attente maximale avant le retour (heures)</label><input id="rAtt" type="number" step="1" min="1" max="96" inputmode="numeric">
      <label for="rSncf">Carte de réduction SNCF</label><select id="rSncf">${Object.entries(CALC.CARTES_SNCF).map(([k, v]) => `<option value="${k}">${esc(v.nom)}</option>`).join('')}</select>
      ${(lireLocal('cp_masquees', []) || []).length ? `<p class="doux">${(lireLocal('cp_masquees', []) || []).length} mission(s) retirée(s) de l’Agenda : <button id="remettre" class="lienBouton" type="button">Tout remettre</button></p>` : ''}
      <label for="rTransport">Transport pour l’aller et le retour (le prix et la durée sont calculés avec ce moyen)</label><select id="rTransport"><option value="moyenne">Moyenne des moyens (train avec ta carte, BlaBlaCar, BlaBlaCar Daily, Flixbus…)</option><option value="general">Estimation générale (coût au km ci-dessous)</option><option value="moins_cher">Le moins cher disponible</option><option value="covoiturage">Covoiturage BlaBlaCar</option><option value="blablacar_daily">BlaBlaCar Daily (trajets du quotidien)</option><option value="flixbus">Flixbus / car longue distance</option><option value="train">Train (avec ta carte de réduction)</option><option value="bus">Bus</option><option value="taxi">Taxi / VTC</option><option value="trottinette">Trottinette (courts trajets)</option></select>
      <label><input id="rBus" type="checkbox" style="width:auto;min-height:0"> Compter les bus dans les liaisons (les bus de villes et villages changent souvent d’horaires et de jours : à cocher seulement si tu as vérifié la ligne)</label>
      <label><input id="rTrot" type="checkbox" style="width:auto;min-height:0"> J’ai une trottinette (gratuite, utilisée pour les courts trajets jusqu’à ≈ 8 km)</label>
      <p class="doux">Les retours choisissent le moyen le moins cher qui arrive à temps ; prix et horaires estimés (réduction SNCF ≈ −30 % sur le train), pas des tarifs réels.</p>
      <p class="doux">Valeurs de travail : distances à vol d’oiseau × 1,25 et durées estimées, à ajuster à ton expérience.</p>
      <button id="rOk" style="width:100%;margin-top:12px">Enregistrer</button></div>
      <div class="carte plusFiltres" id="cartePause"><h2>Heures de désactivation</h2><p class="doux">La nuit, la lecture des plateformes, la mise à jour et les alertes peuvent s’arrêter.</p>
        <label><input id="pzOn" type="checkbox" style="width:auto;min-height:0"> Désactiver la nuit</label>
        <label for="pzDeb">Arrêt à</label><input id="pzDeb" type="time"><label for="pzFin">Reprise à</label><input id="pzFin" type="time"></div>
      <div class="carte plusFiltres" id="carteNotif"><h2>Notifications</h2><label><input id="nPrefOn" type="checkbox" style="width:auto;min-height:0"> Recevoir les notifications</label><label><input id="nPrefSon" type="checkbox" style="width:auto;min-height:0"> Son et vibration des notifications</label><p class="doux" id="notifEtat">Vérification…</p><div id="notifBoutons" class="boutons"></div></div>
      <div class="carte plusFiltres"><h2>Compte</h2><p class="doux">${esc(api?.session?.email || '')}</p>
      <div class="boutons"><button id="dOk" class="second">Se déconnecter</button><button id="eOk" class="danger">Effacer mes données</button></div></div>
      <p class="doux" style="text-align:center">Convoyage Ultra · outil d’aide à la décision : aucune mission n’est acceptée à ta place.</p>`;
    $('rStatut').value = r.statut; $('rTaux').value = r.taux_cotisations; $('rKm').value = r.cout_km; $('rMin').value = r.prix_minimum; $('rNv').checked = !!r.alertes_nouvelles;
    $('rBus').checked = window.CP_BUS_ACTIF === true; $('rTransport').value = window.CP_TRANSPORT_CHOISI || 'general';
    $('rDom').value = r.domicile_ville || ''; $('rTr').value = r.cout_transport_km; $('rVit').value = r.vitesse_liaison; $('rMarge').value = r.marge_minutes; $('rRayon').value = r.rayon_retour_km; $('rAtt').value = r.attente_max_h; $('rSncf').value = r.carte_sncf || 'aucune'; $('rTrot').checked = r.trottinette === true;
    let domChoisi = r.domicile_ville ? { nom: r.domicile_ville, lat: r.domicile_lat, lng: r.domicile_lng, libelle: r.domicile_ville } : null;
    $('rDom').oninput = () => {
      const box = $('rDomSugg'), l = G.suggestions($('rDom').value, { types: ['ville'], villes: villesConnues().filter(v => v.lat != null), max: 6 }); chargerVillesNet($('rDom').value, () => { if ($('rDom')) $('rDom').oninput(); });
      box.innerHTML = l.map((x, i) => `<button role="option" data-dom="${i}">${esc(x.libelle)}<small>${esc(x.detail)}</small></button>`).join(''); box.hidden = !l.length;
      for (const b of box.querySelectorAll('[data-dom]')) b.onclick = () => { const x = l[Number(b.dataset.dom)]; domChoisi = { nom: x.nom, lat: x.lat, lng: x.lng, libelle: x.nom }; $('rDom').value = x.nom; box.hidden = true; };
    };
    $('rOk').onclick = async () => {
      const v = { statut: $('rStatut').value, taux_cotisations: Number($('rTaux').value), cout_km: Number($('rKm').value), prix_minimum: Number($('rMin').value), alertes_nouvelles: $('rNv').checked, alertes_prix: false,
        cout_transport_km: Number($('rTr').value), vitesse_liaison: Number($('rVit').value), marge_minutes: Math.round(Number($('rMarge').value)), rayon_retour_km: Math.round(Number($('rRayon').value)), attente_max_h: Math.round(Number($('rAtt').value)), carte_sncf: $('rSncf').value, trottinette: $('rTrot').checked };
      if (!(v.taux_cotisations >= 0 && v.taux_cotisations <= 60) || !(v.cout_km >= 0 && v.cout_km <= 5) || !(v.prix_minimum >= 0)) return toast('Valeurs hors limites');
      if (!(v.cout_transport_km >= 0 && v.cout_transport_km <= 2) || !(v.vitesse_liaison >= 10 && v.vitesse_liaison <= 300) || !(v.marge_minutes >= 0 && v.marge_minutes <= 600) || !(v.rayon_retour_km >= 1 && v.rayon_retour_km <= 500) || !(v.attente_max_h >= 1 && v.attente_max_h <= 96)) return toast('Valeurs de liaison hors limites');
      const texteDom = $('rDom').value.trim();
      if (!texteDom) Object.assign(v, { domicile_ville: null, domicile_lat: null, domicile_lng: null });
      else {
        const x = domChoisi && G.norm(domChoisi.nom) === G.norm(texteDom) ? domChoisi : G.trouverVille(texteDom);
        if (!x || x.lat == null) return toast('Ville du domicile non reconnue : choisis-la dans la liste proposée');
        Object.assign(v, { domicile_ville: x.nom, domicile_lat: Math.round(x.lat * 1e5) / 1e5, domicile_lng: Math.round(x.lng * 1e5) / 1e5 });
      }
      window.CP_BUS_ACTIF = $('rBus').checked; ecrireLocal('cp_bus_actif', window.CP_BUS_ACTIF); window.CP_TRANSPORT_CHOISI = $('rTransport').value; ecrireLocal('cp_transport', window.CP_TRANSPORT_CHOISI);
      try { await api.enregistrerReglages(v); etat.reglages = { ...r, ...v }; ecrireLocal('cp_cache', { missions: etat.missions, alertes: etat.alertes, reglages: etat.reglages, chargeLe: etat.chargeLe }); toast('Réglages enregistrés'); } catch (e) { toast(e.message); }
    };
    etatNotifications(); brancherPrefsNotif();
    { const p = lirePause(); $('pzOn').checked = p.choix === 'oui'; $('pzDeb').value = p.debut; $('pzFin').value = p.fin;
      const maj = () => { enregistrerPause($('pzOn').checked ? 'oui' : 'non', $('pzDeb').value, $('pzFin').value); toast($('pzOn').checked ? 'Désactivation la nuit : activée' : 'Toujours actif'); };
      $('pzOn').onchange = maj; $('pzDeb').onchange = $('pzFin').onchange = () => { if ($('pzOn').checked) maj(); }; }
    { const bloc = document.createElement('div'); bloc.className = 'doux'; bloc.style.textAlign = 'center'; bloc.style.margin = '12px 0';
      let der = null; try { der = localStorage.getItem('cp_peages_maj'); if (!der) { der = new Date().toISOString(); localStorage.setItem('cp_peages_maj', der); } } catch (_) { der = null; }
      const jours = der ? Math.floor((Date.now() - Date.parse(der)) / 86400000) : 0;
      const info = document.createElement('p'); info.id = 'infoPeages'; info.textContent = 'Péages : dernière mise à jour il y a ' + jours + ' jour(s)' + (jours >= 183 ? ' — mise à jour conseillée (tous les 6 mois).' : '.'); if (jours >= 183) info.style.color = '#b45309';
      fetch('peages-aprr.json').then(r => r.json()).then(j => { const ms = (String(j.v || '').match(/\d{4}-\d{2}/g) || []).sort(); if (!ms.length) return; const [a, m] = ms[0].split('-').map(Number); const n = new Date(); let an = n.getFullYear(); if (n.getMonth() < 1) an -= 1; const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']; if (a * 12 + (m - 1) < an * 12 + 1) { info.textContent = 'Nouveaux tarifs de péage en vigueur depuis le 1er février ' + an + ' : mise à jour à faire.'; info.style.color = '#b45309'; } else { info.textContent = 'Péages à jour (tarifs de ' + mois[m - 1] + ' ' + a + '). Prochaine revalorisation prévue le 1er février ' + (an + 1) + '.'; info.style.color = ''; } }).catch(() => { });
      const bt = document.createElement('button'); bt.type = 'button'; bt.id = 'majPeages'; bt.textContent = 'Mettre à jour les péages';
      const prog = document.createElement('div'); prog.id = 'majPeagesProgression'; prog.hidden = true; prog.style.margin = '8px 0';
      const barre = document.createElement('progress'); barre.id = 'majPeagesBarre'; barre.style.width = '100%'; barre.max = 1;
      const texteProg = document.createElement('p'); texteProg.className = 'doux'; texteProg.id = 'majPeagesTexte';
      prog.appendChild(barre); prog.appendChild(texteProg);
      const detailInfo = document.createElement('p'); detailInfo.className = 'doux'; detailInfo.id = 'infoPeagesDetail';
      const d = lireLocal('cp_peages_maj_detail', null);
      if (d) { detailInfo.textContent = d.total + ' barrières/gares mises à jour le ' + new Date(d.le).toLocaleString('fr-FR') + (d.versions ? ' · sources : ' + d.versions : '') + '.'; }
      bt.onclick = async () => {
        bt.disabled = true; prog.hidden = false; barre.removeAttribute('value'); texteProg.textContent = 'Mise à jour en cours…';
        try {
          const res = await executerMajPeages((fait, total) => { barre.max = total; barre.value = fait; texteProg.textContent = fait + ' / ' + total + ' barrières de péage mises à jour'; });
          texteProg.textContent = res.total + ' / ' + res.total + ' barrières de péage mises à jour';
          toast('Péages à jour : ' + res.total + ' barrières/gares (' + res.versions.slice(0, 70) + ')');
          setTimeout(() => location.reload(), 1500);
        } catch (e) { toast('Mise à jour impossible : ' + e.message); bt.disabled = false; prog.hidden = true; }
      };
      bloc.appendChild(info); bloc.appendChild(detailInfo); bloc.appendChild(prog); bloc.appendChild(bt); $('ecran').appendChild(bloc); }
    { const p = document.createElement('p'); p.className = 'doux'; p.id = 'versionReglages'; p.style.textAlign = 'center'; p.textContent = 'Convoyage Ultra — version ' + VERSION_APP + versionApk(); $('ecran').appendChild(p); }
    { const bm = $('remettre'); if (bm) bm.onclick = () => { ecrireLocal('cp_masquees', []); toast('Missions remises : actualisation…'); charger(); }; }
    $('dOk').onclick = () => { api.deconnexion(); localStorage.removeItem('cp_cache'); Object.assign(etat, { missions: [], alertes: [], reglages: null }); ecranConnexion(); };
    $('eOk').onclick = async () => {
      if (!confirm('Effacer définitivement toutes tes missions, alertes et réglages du serveur ? L’extension renverra les missions à sa prochaine synchronisation si elle reste connectée.')) return;
      try { await api.effacerMesDonnees(); localStorage.removeItem('cp_cache'); Object.assign(etat, { missions: [], alertes: [], reglages: null }); toast('Données effacées'); afficher(); } catch (e) { toast(e.message); }
    };
  }
  const duree = h => { const t = Math.round(h * 60); return t < 60 ? t + ' min' : Math.floor(t / 60) + ' h' + (t % 60 ? String(t % 60).padStart(2, '0') : ''); };
  // V129 : liens « transports » prêts à cliquer (rien n'est lu ni réservé) : Google Maps (bus, train, tram dans la ville) et Rome2rio (train, car, covoiturage… avec prix réels sur leurs sites).
  const lieuTr = (ville, dep) => String(ville || '').trim() + (dep ? ' ' + dep : '') + ', France';
  // V130 : pages « trajet » des opérateurs (adresses relevées sur leurs sites : SNCF Connect /train/horaires/A/B, Flixbus /voyages-car/A-B, BlaBlaCar /ride-sharing/A/B). Elles affichent les horaires et prix À JOUR ;
  // si la ligne n'existe pas ou plus, le site le dit (l'appli ne peut pas le vérifier elle-même). Cars Région / TER / bus d'Auvergne-Rhône-Alpes : calculateur OùRA, seulement si les deux bouts sont dans la région.
  const slugVille = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const DEP_ARA = ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'];
  const RESEAUX_VILLES = [
    { slugs: ['lyon', 'villeurbanne', 'venissieux', 'vaulx-en-velin', 'bron', 'caluire-et-cuire', 'saint-fons'], dep: '69', liens: [['🚇 TCL (Lyon)', 'https://www.tcl.fr/'], ['🏙️ Citymapper', 'https://citymapper.com/']] },
    { slugs: ['grenoble', 'echirolles', 'saint-martin-d-heres', 'fontaine', 'meylan'], dep: '38', liens: [['🚋 M réso (Grenoble)', 'https://www.reso-m.fr/']] },
    { slugs: ['annecy', 'seynod', 'cran-gevrier', 'meythet', 'annecy-le-vieux', 'pringy'], dep: '74', liens: [['🚌 Sibra (Annecy)', 'https://www.sibra.fr/']] },
    { slugs: ['chambery', 'la-motte-servolex', 'cognin', 'bassens', 'barberaz'], dep: '73', liens: [['🚌 Synchro (Chambéry)', 'https://www.synchro-bus.fr/']] },
    { slugs: ['amberieu-en-bugey'], dep: '01', liens: [['🚌 Moovit (Ambérieu-en-Bugey)', 'https://moovitapp.com/']] },
    { slugs: ['geneve', 'carouge', 'lancy', 'meyrin', 'vernier', 'onex', 'annemasse', 'ferney-voltaire', 'saint-julien-en-genevois', 'gaillard', 'thonex'], dep: '', liens: [['🚌 tpg (Genève et alentours)', 'https://www.tpg.ch/']] },
    { slugs: ['paris'], dep: '75', liens: [['🏙️ Citymapper (Paris)', 'https://citymapper.com/']] },
    { slugs: ['marseille'], dep: '13', liens: [['🏙️ Citymapper (Marseille)', 'https://citymapper.com/']] },
    { slugs: ['toulouse'], dep: '31', liens: [['🏙️ Citymapper (Toulouse)', 'https://citymapper.com/']] }];
  // V137 : réseau régional (cars + trains) de la région de chaque bout, d'après la liste donnée par Laurent (liens des sites officiels).
  const RESEAUX_REGION = {
    ARA: ['🚍 La Région vous transporte (Cars Région)', 'https://www.laregionvoustransporte.fr/'], BFC: ['🚍 Mobigo (Bourgogne-Franche-Comté)', 'https://www.viamobigo.fr/'],
    BRE: ['🚍 BreizhGo (Bretagne)', 'https://www.breizhgo.bzh/'], CVL: ['🚍 Rémi (Centre-Val de Loire)', 'https://www.remi-centrevaldeloire.fr/'],
    GES: ['🚍 Fluo (Grand Est)', 'https://www.fluo.grandest.fr/'], HDF: ['🚍 Transports Hauts-de-France', 'https://transports.hautsdefrance.fr/'],
    IDF: ['🚍 Île-de-France Mobilités', 'https://www.iledefrance-mobilites.fr/'], NOR: ['🚍 Nomad (Normandie)', 'https://nomad.normandie.fr/'],
    NAQ: ['🚍 Transports Nouvelle-Aquitaine', 'https://transports.nouvelle-aquitaine.fr/'], OCC: ['🚍 liO (Occitanie)', 'https://www.lio-occitanie.fr/'],
    PDL: ['🚍 Aléop (Pays de la Loire)', 'https://aleop.paysdelaloire.fr/'], PAC: ['🚍 ZOU ! (Provence-Alpes-Côte d’Azur)', 'https://zou.maregionsud.fr/'],
    COR: ['🚍 Transports de Corse', 'https://www.isula.corsica/']
  };
  const reseauRegion = dep => { const d = G.DEPARTEMENTS && G.DEPARTEMENTS[String(dep || '')]; return d && RESEAUX_REGION[d.region] ? [RESEAUX_REGION[d.region]] : []; };
  const reseauxLocaux = (ville, dep) => { const sl = slugVille(ville), d = String(dep || ''); const r = RESEAUX_VILLES.find(x => x.slugs.includes(sl) && (!d || x.dep === d)); return r ? r.liens : []; };
  function liensTransports(deVille, deDep, versVille, versDep, cleVerif) {
    if (!deVille || !versVille) return '';
    const a = slugVille(deVille), b = slugVille(versVille); if (!a || !b || a === b) return '';
    const gm = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(lieuTr(deVille, deDep)) + '&destination=' + encodeURIComponent(lieuTr(versVille, versDep)) + '&travelmode=transit';
    const r2 = 'https://www.rome2rio.com/map/' + encodeURIComponent(String(deVille).trim()) + '/' + encodeURIComponent(String(versVille).trim());
    const L = [['🚆 SNCF Connect', 'https://www.sncf-connect.com/billet-train'], ['🚌 Flixbus', 'https://www.flixbus.fr/voyages-car/' + a + '-' + b], ['🚗 BlaBlaCar', 'https://www.blablacar.fr/ride-sharing/' + a + '/' + b], ['🚙 BlaBlaCar Daily', 'https://www.blablacar.fr/blablacar-daily']];
    if (DEP_ARA.includes(String(deDep || '')) || DEP_ARA.includes(String(versDep || ''))) L.push(['🚍 Cars Région / TER (OùRA)', 'https://www.oura.com/']);
    // V137 : OùRA dès qu'un des deux bouts est dans la région (voir plus haut) ; réseaux de la ville de départ ou d'arrivée (bus, tram, métro de la ville) + Citymapper dans les grandes villes.
    for (const x of reseauxLocaux(deVille, deDep).concat(reseauxLocaux(versVille, versDep), reseauRegion(deDep), reseauRegion(versDep))) if (!L.some(y => y[1] === x[1]) && !(/laregionvoustransporte/.test(x[1]) && L.some(y => /oura\.com/.test(y[1])))) L.push(x);
    L.unshift(['🚆 Rome2rio', r2]); L.push(['🗺️ Maps bus/train', gm]);
    const v = cleVerif ? (lireLocal('cp_verif', {}) || {})[cleVerif] : null;
    const caseV = cleVerif ? `<label class="liensVerif${v ? ' ok' : ''}"><input type="checkbox" data-verif="${esc(cleVerif)}"${v ? ' checked' : ''}> ${v ? '✓ Vérifié par toi le ' + esc(new Date(v).toLocaleDateString('fr-FR')) + ' (horaires et prix valables le jour de la mission)' : 'Je coche quand j’ai vérifié que ce transport circule et son prix le jour de la mission'}</label>` : '';
    return `<span class="liensTr">${L.map(([t, u]) => `<a href="${esc(u)}">${t}</a>`).join('')}</span><span class="doux liensNote">⚠ Horaires et prix NON vérifiés par l’application : ouvre le site, contrôle-les pour le jour de la mission (le bouton retour te ramène ici).</span>${caseV}`;
  }
  // V215 : exposé à la fenêtre « Trajet réel » (onglet Transports) : Rome2rio en premier, sites de transport seulement, sans les outils d'itinéraire routier.
  window.CPLiensTr = (a, ad, b, bd) => { const h = liensTransports(a, ad, b, bd, ''); return h ? h.replace(/<a href="[^"]*travelmode=transit[^"]*">[^<]*<\/a>/, '') : ''; };
  // V78 : retours possibles après cette mission (toutes plateformes), estimés.
  function blocRetours(m) {
    const acceptees = etat.missions.filter(x => x.kind === 'acceptee');
    const res = RT.retours(m, etat.missions.filter(x => x.kind === 'disponible'), etat.reglages, { acceptees: m.kind === 'acceptee' ? acceptees : acceptees.concat([m]) });
    // V223 : une mission « à la suite » doit pouvoir démarrer le MÊME JOUR que la fin de la mission précédente ; les jours suivants relèvent du Planning sur plusieurs jours
    const jP = ms => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date(ms));
    const jSrc = (res.finSource && res.finSource.t) ? jP(res.finSource.t) : (Number.isFinite(Date.parse(m.delivery_end || m.delivery_start || '')) ? jP(Date.parse(m.delivery_end || m.delivery_start)) : '');
    const jMis = z => { const q = Date.parse(z.pickup_start || z.pickup_end || z.delivery_start || ''); return Number.isFinite(q) ? jP(q) : ''; };
    const memeJour = (r0, x) => { if (!jSrc) return true; if (x.arrivee != null && jP(x.arrivee) !== jSrc) return false; const jm = jMis(x.mission || {}); return jm ? jm === jSrc : x.arrivee != null; };   // V231 : sans preuve du même jour -> retiré (étapes 2 et 3 comprises) ; le reste va dans Planning sur plusieurs jours
    res.compatibles = res.compatibles.filter(x => memeJour(res, x));
    res.dateInconnue = jSrc ? [] : (res.dateInconnue || []);   // V231 : sans horaire on ne peut pas prouver que c'est le même jour -> on les retire
    detail.retours = res.compatibles.concat(res.dateInconnue);
    const sugIds = new Set(m.platform === 'DriiveMe' ? sugListe(m).map(z => String(z.id)) : []);
    const estSug = x => sugIds.has(String(x.mission.external_id)) && x.mission.platform === m.platform;
    res.compatibles.concat(res.dateInconnue).forEach(x => { if (estSug(x)) x.sug = true; });
    const extras = [];
    if (false && sugIds.size && res.arriveeSource) {   // V223 : les suites DriiveMe hors critères (autre jour, trop loin) ne sont plus ajoutées : même règle que les autres missions
      const dejaC = new Set(res.compatibles.concat(res.dateInconnue).map(x => RT.cle(x.mission)));
      const rg = etat.reglages || {}, dom = (rg.domicile_lat != null && rg.domicile_lat !== '' && rg.domicile_lng != null && rg.domicile_lng !== '' && Number.isFinite(Number(rg.domicile_lat)) && Number.isFinite(Number(rg.domicile_lng))) ? { lat: Number(rg.domicile_lat), lng: Number(rg.domicile_lng) } : null;
      for (const c of etat.missions) {
        if (c.platform !== m.platform || !sugIds.has(String(c.external_id)) || dejaC.has(RT.cle(c)) || c.kind === 'acceptee' || RT.cle(c) === RT.cle(m)) continue;
        try {
          const o = G.coordonnees(c, 'origin'); if (!o) continue;
          const km = G.routeKm(res.arriveeSource, o), cd = G.coordonnees(c, 'destination'), lien = CALC.liaisonMoinsChere(km, rg); if (!lien) continue;
          const dk = dom ? G.routeKm(res.arriveeSource, dom) : null, rk = dom && cd ? G.routeKm(cd, dom) : null;
          const rr = CALC.rentabiliteComplete(c, rg, { approcheKm: km, retourKm: rk, approcheLiaison: lien });
          extras.push({ mission: c, liaison: lien, rentabilite: rr, rapprocheKm: dk != null && rk != null ? dk - rk : null, retourDomicileKm: rk, estimations: [], sug: true, horsCriteres: true });
        } catch (_) {}
      }
    }
    const baseIdx = detail.retours.length; detail.retours = detail.retours.concat(extras);
    const estProche = x => x.retourDomicileKm != null && x.retourDomicileKm <= 50;   // V221 : « retour vers le domicile » = la mission arrive à 50 km ou moins du domicile
    if (res.raison === 'lieu_arrivee_inconnu') return '<div class="carte" id="retours"><h2>🔁 Retours possibles</h2><p class="doux">Lieu d’arrivée non localisable : recherche impossible.</p></div>';
    // V159 : chaînage — pour chaque retour proposé, les suites possibles après lui (2 niveaux), avec distance et durée de liaison.
    const dispoR = etat.missions.filter(z => z.kind === 'disponible');
    const suites = (src, deja, prof) => {
      if (prof > 2) return [];
      let r2; try { r2 = RT.retours(src, dispoR, etat.reglages, { acceptees: acceptees.concat(deja) }); } catch (_) { return []; }
      return r2.compatibles.filter(z => memeJour(r2, z) && !deja.some(d => RT.cle(d) === RT.cle(z.mission))).slice(0, 2).map(z => ({ x: z, src, suite: suites(z.mission, deja.concat([z.mission]), prof + 1) }));
    };
    // V179 : étiquettes titrées, sections encadrées (Quand / Transport / Rentabilité), une carte par suggestion.
    const ICO = { covoiturage: '🚗', bus: '🚌', train: '🚆', taxi: '🚕' };
    const ligne = (l, v, c) => '<div class="rd' + (c ? ' ' + c : '') + '"><span>' + l + '</span><b>' + v + '</b></div>';
    const puces = (x, c, p) => {
      const lia = x.liaison, rr = x.rentabilite, ic = ICO[lia.mode] || '🚆';
      const tr = bk('bkTr', ic + ' TRANSPORT POUR Y ALLER', ligne('Moyen', esc(lia.mode || 'liaison')) + ligne('De → À', esc(p.to_city || 'arrivée') + ' → ' + esc(c.from_city || 'départ')) + ligne('Distance', '≈ ' + esc(lia.km) + ' km') + ligne('Durée', esc(duree(lia.heures))) + ligne('Coût', esc(euros(lia.cout))));
      const n = [];
      if (rr && rr.connu) { n.push(ligne('Net', '≈ ' + esc(euros(rr.net)), 'gras')); if (rr.parHeure) n.push(ligne('Par heure', esc(euros(rr.parHeure)) + '/h')); } else n.push(ligne('Net', 'prix inconnu'));
      if (x.rapprocheKm != null) n.push(Math.abs(x.rapprocheKm) < 1 ? ligne('Position', 'même distance de chez toi') : x.rapprocheKm > 0 ? ligne('Position', 'te rapproche de ≈ ' + esc(x.rapprocheKm) + ' km', 'ok') : ligne('Position', 't’éloigne de ≈ ' + esc(-x.rapprocheKm) + ' km', 'ko'));
      return tr + bk('bkRen', '💶 RENTABILITÉ', n.join(''));
    };
    const quand = (c, z) => bkDates(c, arriveeTxt(c)) + (z.attenteH ? bk('bkTr', '⏱ ATTENTE', '≈ ' + esc(duree(z.attenteH))) : '');
    const tete = c => '<div class="haut"><span><span class="etiq">' + esc(PLATS[c.platform] || c.platform) + '</span></span><span><div class="prix">' + (c.fee != null ? esc(euros(c.fee)) : '?') + '</div></span></div><div class="trajet">' + trajetHtml(c) + '</div>';
    const suiteHtml = (s, prof) => { const z = s.x, c = z.mission, p = s.src; return '<div class="retour retourSuite' + clsPlat(c.platform) + '" style="margin-left:' + (prof * 8) + 'px"><div class="suiteT2">↪ ÉTAPE ' + (prof + 1) + ' : MISSION POSSIBLE ENSUITE</div>' + tete(c) + quand(c, z) + puces(z, c, p) + '</div>' + s.suite.map(u => suiteHtml(u, prof + 1)).join(''); };
    const chaine = (x, c, i) => (i < 4 && x.statut === 'compatible') ? suites(c, [m, c], 1).map(s => suiteHtml(s, 1)).join('') : '';
    const dernLiens = (() => { let k = -1; res.compatibles.slice(0, 6).forEach((z, q) => { if (z.liaison && z.liaison.km >= 2) k = q; }); return k; })();   // V211 : sites de transport une seule fois, sous la dernière étiquette
    // V271 : logo W et bandeau « Devis proposé » aussi sur les cartes Retour / Suite possible
    const devisProp = c => (c && c.fees && c.fees.devis_numero && c.kind !== 'acceptee' && c.fees.devis_accepte !== 1) ? '<div style="background:#ffe8a3;color:#222;border-radius:8px;padding:4px 8px;margin:4px 0;font-weight:600">📝 Devis proposé</div>' : '';
    const item = (x, i) => { const c = x.mission; return '<div class="retourBloc"><button class="retour' + clsPlat(c.platform) + '" data-retour="' + i + '">' + (x.sug ? bk('bkSuite', '↪ SUITE PROPOSÉE PAR DRIIVEME', 'Cette mission figure dans les suites de la fiche DriiveMe' + (x.horsCriteres ? ' (hors des critères de l’application : distance, jour ou délai).' : '.')) : '') + plaqueW(c) + tete(c) + '<div class="verifLigne"><span class="verif">' + esc(verifPast(c)) + '</span></div>' + devisProp(c) + quand(c, x) + puces(x, c, m) + (x.estimations.length ? bk('bkTr', 'ESTIMATION', esc(x.estimations.join(', '))) : '') + '</button>' + (i === dernLiens && x.liaison && x.liaison.km >= 2 ? liensTransports(m.to_city, m.to_department, c.from_city, c.from_department, 'r|' + (m.id || m.external_id) + '|' + (c.id || c.external_id)) : '') + chaine(x, c, i) + '</div>'; };
    const dP = Date.parse(m.pickup_start || ''), dF = Date.parse(m.delivery_end || m.delivery_start || ''), multi = Number.isFinite(dP) && Number.isFinite(dF) && new Date(dP).toDateString() !== new Date(dF).toDateString();
    const n = res.compatibles.length, r = etat.reglages || {};
    const ecartes = [[res.autreJour, 'un autre jour'], [res.tropTot, 'partent trop tôt'], [res.conflits, 'chevauchent ton agenda'], [res.horsZone, 'trop loin'], [res.tropTard, 'attente trop longue'], [res.passees, 'déjà passées']].filter(([k]) => k).map(([k, t]) => k + ' ' + t).join(', ');
    return `<div class="carte" id="retours">
      <p class="doux">Départ à moins de ${esc(r.rayon_retour_km ?? 60)} km de ${esc(m.to_city ? lieu(m, 'destination') : 'l’arrivée')}, même jour que l’arrivée, moyen de transport le moins cher qui arrive à temps (covoiturage, bus, train…, estimations), marge de sécurité ${esc(r.marge_minutes ?? 60)} min${res.finSource && res.finSource.estimee ? ', heure de livraison estimée' : ''}. Toutes plateformes.</p>
      ${(n || extras.length) ? (() => { const L = res.compatibles.slice(0, 6).map((x, i) => [x, i]).concat(extras.map((x, k) => [x, baseIdx + k])), prox = L.filter(([x]) => estProche(x)), suite = L.filter(([x]) => !estProche(x)), T = s => '<h2>' + s + '</h2>'; return (prox.length ? T('Retour possible vers le domicile') + prox.map(([x, i]) => item(x, i)).join('') : '') + (suite.length ? T('Mission à la suite possible') + suite.map(([x, i]) => item(x, i)).join('') : ''); })() : '<p>Aucun retour compatible pour l’instant.</p>'}
      ${res.dateInconnue.length ? `<p class="doux">À vérifier (horaire non fourni) :</p>${res.dateInconnue.slice(0, 3).map((x, i) => item(x, n + i)).join('')}` : ''}
      ${ecartes ? `<p class="doux">Écartées : ${esc(ecartes)}.</p>` : ''}
      <p class="doux">Rien n’est réservé : ouvre la mission sur sa plateforme pour la prendre.</p></div>`;
  }
  function blocHistorique(m) {
    const A = window.CPAgenda.analyser(etat.missions, etat.reglages), x = A.parCle[RT.cle(m)] || { conflits: [], etat: '' };
    // V138 : journal lisible — mêmes changements répétés regroupés, 5 plus récents visibles, le reste dans « Voir les N autres ».
    const toutes = (m.modifications || []).slice().reverse(), vues = new Set(), mods = toutes.filter(z => { const k = [z.champ, z.de, z.a].join('|'); if (vues.has(k)) return false; vues.add(k); return true; });
    const e = ETATS[x.etat];
    if (!mods.length && !e) return '';
    return `<div class="carte" id="historique"><h2>📋 Suivi de la mission</h2>
      ${e ? `<p><span class="etiq ${e[1]}">${esc(e[0])}</span>${x.etat === 'annulee' ? ' Elle n’apparaît plus dans tes missions acceptées sur ' + esc(PLATS[m.platform] || m.platform) + '. Vérifie sur le site avant de t’organiser autrement.' : ''}</p>` : ''}
      ${mods.length ? '<p class="doux">Modifications relevées :</p>' + (l => l(mods.slice(0, 5)) + (mods.length > 5 ? `<details><summary class="doux">Voir les ${mods.length - 5} autres</summary>${l(mods.slice(5))}</details>` : ''))(zs => zs.map(z => `<div class="modifLigne">✏️ ${esc(window.CPAgenda.libelleModification(z))}${z.le ? ' <span class="doux">(' + esc(fmtDate(z.le)) + ')</span>' : ''}</div>`).join('')) + (toutes.length > mods.length ? `<p class="doux">${toutes.length - mods.length} répétition(s) du même changement masquée(s).</p>` : '') : ''}</div>`;
  }
  // V95 : mission acceptée déjà livrée (fin passée) → plus de retours proposés.
  const missionPassee = m => { const f = Date.parse(m.delivery_end || m.delivery_start || ''), d = Date.parse(m.pickup_start || ''); return Number.isFinite(f) ? f < Date.now() : (Number.isFinite(d) ? d + 12 * 3600000 < Date.now() : false); };
  // V212 : rentabilité en bloc : prestation, transport (approche, retour), cotisations en gras ; net et par heure en vert (rentable) ou rouge.
  function blocRenta(m, r, frais, dv, depuis) {
    if (!r.connu) return bk('bkRen', 'RENTABILITÉ', '<div class="doux">Prix non connu.</div>');
    const ph = r.parHeure, ok = r.net > 0 && (!ph || ph >= 15);
    const row = (x, y, c) => '<div class="rd' + (c ? ' ' + c : '') + '"><span>' + x + '</span><span>' + y + '</span></div>';
    const L = [];
    if (dv) L.push('<div class="petit">📄 Montants de ton devis Hiflow n° ' + esc(dv.n) + ' (' + (dv.accepte ? 'accepté' : 'envoyé, en attente') + ')' + (dv.total != null ? ' — total ' + esc(euros(dv.total)) : '') + '</div>');
    L.push(row('Prestation', esc(euros(r.prestation)), 'gras'));
    if (frais.length) { L.push(row(dv ? '+ Frais remboursés (devis)' : '+ Remboursements prévus', esc(frais.map(([k, v]) => (FRAIS[k.toLowerCase()] || k) + ' ' + euros(v)).join(' · ')))); L.push(row('− Frais avancés (remboursés après)', '− ' + esc(euros(r.fraisAvances)))); }
    if (m.kind === 'acceptee' && m.platform === 'Hiflow' && !dv) L.push(row('Frais du devis Hiflow', '<span class="doux">montant du devis non lu</span>'));
    if (r.peageCharge > 0) L.push(row('− Péage à ta charge (non remboursé)', '− ' + esc(euros(r.peageCharge)))); else if (r.peageAbsent && m.kind === 'acceptee') L.push(row('Péage (non remboursé)', '<span class="doux">à renseigner</span>'));
    L.push(r.coutTransport ? (r.transportRembourse ? row('Transport', '≈ ' + esc(euros(r.coutTransport)) + ' <span class="petit">avancé puis remboursé par Hiflow</span>', 'gras') : row('Transport à ta charge', '− ' + esc(euros(r.transportNonCouvert)), 'gras')) : row('Transport', '<span class="doux">inconnu</span>', 'gras'));
    L.push(row('↳ Approche' + (depuis ? ' depuis la livraison précédente' : ' depuis ton domicile'), r.approche ? (r.approche.mode ? esc(r.approche.mode) + ' ' : '') + '≈ ' + esc(r.approche.km) + ' km · ' + esc(duree(r.approche.heures)) + ' · ' + esc(euros(r.approche.cout)) : '<span class="doux">inconnue — renseigne ta ville dans Réglages</span>', 'sub'));
    L.push(row('↳ Retour à ton domicile', r.retour ? '≈ ' + esc(r.retour.km) + ' km · ' + esc(duree(r.retour.heures)) + ' · ' + esc(euros(r.retour.cout)) : '<span class="doux">inconnu</span>', 'sub'));
    if (r.rembTransport && r.coutTransport) L.push(row('↳ Couvert par le remboursement prévu', esc(euros(Math.min(r.rembTransport, r.coutTransport))), 'sub'));
    L.push(row('Cotisations (' + String(r.taux).replace('.', ',') + ' %)', '− ' + esc(euros(r.cotisations)), 'gras'));
    L.push(row('Net estimé', esc(euros(r.net)), 'gras gros ' + (ok ? 'ok' : 'ko')));
    L.push(row('Par heure', ph ? esc(euros(ph)) + '/h <span class="petit">(' + esc(duree(r.heures)) + (r.liaisonsConnues ? ', approche et retour compris' : ', hors liaisons inconnues') + ')</span>' : 'durée inconnue', 'gras ' + (ph ? (ph >= 15 ? 'ok' : 'ko') : (ok ? 'ok' : 'ko'))));
    L.push('<div class="petit" style="margin-top:4px">Vert : rentable (net positif et au moins 15 €/h). Rouge : non rentable. Estimation' + (r.dureeEstimee && r.heuresMission ? ', durée de conduite estimée d’après la distance' : '') + ' · distances à vol d’oiseau × 1,25 · cotisations sur la prestation seule.</div>');
    return bk('bkRen ' + (ok ? 'bkRenOk' : 'bkRenKo'), 'RENTABILITÉ', L.join(''));
  }
  function detail(m, depuis) {
    if (!m) return;
    stopGTFSTransports();
    const r = renta(m, depuis);
    const itin = a => a ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}` : '';
    const frais = window.CPCalc.fraisRembourses(m);
    const dv = m.fees && m.fees.devis_numero ? { n: m.fees.devis_numero, total: m.fees.devis_total, accepte: m.fees.devis_accepte === 1 } : null;   // V95 : montants du devis Hiflow
    const lien = m.detail_url && /^https:\/\//.test(m.detail_url) ? m.detail_url : LIENS[m.platform];
    const ligne = (a, b) => { const t = String(a); const c = /^= /.test(t) ? 'net' : /^Rentabilit/.test(t) ? 'horaire' : /^[−-] /.test(t) ? 'neg' : /^(Prestation|\+)/.test(t) ? 'pos' : ''; return `<tr${c ? ' class="r-' + c + '"' : ''}><td>${esc(a)}</td><td>${b}</td></tr>`; };   // V146 : rangées colorées dans « Rentabilité estimée »
    $('feuilleContenu').innerHTML = `<div class="doux"><span class="etiq">${esc(PLATS[m.platform])}</span> <span class="verif">${esc(verifPast(m))}</span> n° ${esc(m.external_id)}${m.validation === 'non_validee' ? ' · lecture non validée : vérifie sur le site' : ''}${verifFiche(m) ? '<br>🕒 ' + esc(verifFiche(m)) : ''}</div>
      <h2 id="feuilleTitre" class="trajet" style="font-size:20px">${esc(trajet(m))}</h2>
      ${dv && !dv.accepte && m.kind !== 'acceptee' ? `<div style="background:#ffe8a3;color:#222;border-radius:8px;padding:6px 10px;margin:6px 0;font-weight:600">📝 Devis proposé · n° ${esc(dv.n)} (envoyé, en attente)${dv.total != null ? ' · total ' + esc(euros(dv.total)) : ''}</div>` : ''}
      ${m.kind === 'acceptee' ? '<button id="btnRetirer" class="second" type="button">🚫 Pas acceptée : retirer de l’Agenda</button>' : ''}
      ${lienDevis(m) ? `<a href="${esc(lienAppliHiflow() || lienDevis(m))}"${lienAppliHiflow() ? '' : ' target="_blank" rel="noopener"'} id="lienDevis" data-numero="${esc(m.external_id)}"><button style="width:100%;margin:4px 0 2px">📱 Faire le devis dans l’application Hiflow</button></a><p class="doux" style="margin:0 0 8px">Mission n° <b>${esc(m.external_id)}</b> (copié en touchant le bouton) · ${esc(trajet(m))}</p>` : ''}
      ${m.kind === 'acceptee' ? agendaDateBlocks(m) : bkDates(m, arriveeTxt(m))}
      ${vehHtml(m)}${repriseHtml(m)}${plaqueW(m)}${compHtml(m)}
      ${blocKm(m, false)}
      <button id="btnVol" class="btnVert" type="button" aria-label="Visualisation trajet voiture">🚗 Visualisation trajet voiture</button>
      <button id="btnTransportsMission" class="second" type="button" style="width:100%;margin-top:8px;background:#cdeaff;color:#123d72;border:1px solid #70b7eb;font-weight:600" aria-label="Visualisation des transports aller, jonction mission et retour">🚌 Visualisation des transports<span style="display:block;font-size:.9em;font-weight:500;margin-top:3px">Aller / Jonction mission / Retour</span></button>
      ${bk('bkLieu', 'LIEUX', `<div>📍 <b>Départ</b> : ${esc(adresse(m, 'origin'))}</div><div id="gpsO">${mentionGps(m, 'origin')}</div>${(m.origin_address || m.from_city) ? `<a href="${esc(itin(m.origin_address || m.from_city + (m.from_department ? ' ' + m.from_department : '')))}" target="_blank" rel="noopener">Itinéraire vers le départ${m.origin_address ? '' : ' (ville)'}</a>` : ''}<div style="margin-top:8px">🏁 <b>Arrivée</b> : ${esc(adresse(m, 'destination'))}</div><div id="gpsD">${mentionGps(m, 'destination')}</div>${(m.destination_address || m.to_city) ? `<a href="${esc(itin(m.destination_address || m.to_city + (m.to_department ? ' ' + m.to_department : '')))}" target="_blank" rel="noopener">Itinéraire vers l’arrivée${m.destination_address ? '' : ' (ville)'}</a>` : ''}`)}
      ${mailBloc(m)}
      ${blocRenta(m, r, frais, dv, depuis)}
      ${m.kind === 'acceptee' ? blocHistorique(m) : ''}
      ${m.status === 'annulee' || m.status === 'terminee' || (m.kind === 'acceptee' && missionPassee(m)) ? '' : blocRetours(m)}
      ${m.vehicle && /[ée]lectri|\bev\b|\bbev\b/i.test(String(m.vehicle.energy || '')) ? `<div class="carte"><b>🔌 Véhicule électrique : calculer la charge</b><p class="doux" style="margin:4px 0">Le prix et le temps de charge dépendent de la voiture, de la borne et de l’itinéraire : ces sites les calculent (l’appli ne les connaît pas).</p><span class="liensTr"><a href="https://abetterrouteplanner.com/">⚡ A Better Routeplanner</a><a href="https://fr.chargemap.com/">🗺️ Chargemap (bornes et prix)</a>${(m.origin_address || m.from_city) && (m.destination_address || m.to_city) ? `<a href="${esc('https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(m.origin_address || m.from_city + ' ' + (m.from_department || '')) + '&destination=' + encodeURIComponent(m.destination_address || m.to_city + ' ' + (m.to_department || '')))}">📍 Itinéraire Google Maps</a>` : ''}</span></div>` : ''}
      ${(m.price_history || []).length ? bk('bkKm', 'PRIX', 'Premier prix : <b>' + esc(euros(m.price_history[0].de)) + '</b> · dernier prix : <b>' + esc(euros(m.price_history[m.price_history.length - 1].a)) + '</b>') : ''}
      ${m.platform === 'Hiflow' && lienAppliHiflow() ? `<a href="${esc(lienAppliHiflow())}" class="lienAppli" data-numero="${esc(m.external_id)}"><button style="width:100%;margin-top:6px">📱 Ouvrir l’application Hiflow</button></a>` : (lienAppliAutre(m.platform, lien) ? `<a href="${esc(lienAppliAutre(m.platform, lien))}"><button style="width:100%;margin-top:6px">📱 Ouvrir l’application ${esc(PLATS[m.platform])}</button></a>` : `<a href="${esc(lien)}" target="_blank" rel="noopener"><button style="width:100%;margin-top:6px">Ouvrir sur ${esc(PLATS[m.platform])}</button></a>`)}`;
    for (const a of document.querySelectorAll('#feuilleContenu [data-numero]')) a.addEventListener('click', () => { try { navigator.clipboard && navigator.clipboard.writeText(a.dataset.numero).then(() => toast('N° ' + a.dataset.numero + ' copié : colle-le dans la recherche de l’application Hiflow'), () => {}); } catch (_) {} });
    for (const b of document.querySelectorAll('#feuilleContenu [data-suite]')) b.addEventListener('click', () => { const z = etat.missions.find(x => x.platform === m.platform && String(x.external_id) === b.dataset.suite); if (z) detail(z); });
    $('feuille').hidden = false; $('feuille').querySelector('.feuilleBoite').scrollTop = 0;
    const suivants = detail.retours || [], dest = G.coordonnees(m, 'destination');
    for (const b of document.querySelectorAll('[data-retour]')) b.onclick = () => detail(suivants[Number(b.dataset.retour)].mission, dest);
    { const bv = $('btnVol'); if (bv) bv.onclick = () => popupVol(m); }
    { const bt = $('btnTransportsMission'); if (bt) bt.onclick = () => {
      const existing = $('cpTransportMissionDetails');
      if (existing) {
        stopGTFSTransports();
        if (!existing.hidden) {
          existing.hidden = true;
          bt.setAttribute('aria-expanded', 'false');
          return;
        }
        existing.remove();
      }
      const panel = document.createElement('section');
      panel.id = 'cpTransportMissionDetails';
      panel.className = 'bk bkC bkTr';
      panel.style.marginTop = '10px';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Détails des transports de la mission');
      panel.innerHTML = '<div class="bkt">🚌 TRANSPORTS DE LA MISSION</div><p class="doux" role="status">Chargement des informations de transport…</p>';
      bt.insertAdjacentElement('afterend', panel);
      bt.setAttribute('aria-controls', panel.id);
      bt.setAttribute('aria-expanded', 'true');
      try {
      // Use the same confirmed Hiflow schedule as the mission header; read only.
      const timing = missionTiming(m);
      const transportPickup = timing.pickup;
      const transportPlanKey = timing.key;
      const transportPlannedReturn = timing.planned;
      const transportFinish = RT.fin(missionForPlanning(m));
      const transportDelivery = transportPlannedReturn ||
        (transportFinish ? new Date(transportFinish.t).toISOString() : null);
      const home = etat.reglages && (etat.reglages.domicile_adresse ||
        etat.reglages.adresse_domicile || etat.reglages.domicile_ville);
      const locationText = (address, city, department) => {
        const a = String(address || '').trim(), c = String(city || '').trim();
        if (!a) return [c, department].filter(Boolean).join(', ');
        return c && !a.toLocaleLowerCase('fr').includes(c.toLocaleLowerCase('fr')) ?
          [a, c, department].filter(Boolean).join(', ') : a;
      };
      const from = locationText(m.origin_address || m.from_address, m.from_city, m.from_department);
      const to = locationText(m.destination_address || m.to_address, m.to_city, m.to_department);
      const directions = (a, b, when) => {
        if (!a || !b) return '<span class="doux">Adresse manquante — trajet non calculable.</span>';
        const base = 'https://www.google.com/maps/dir/?api=1&origin=' +
          encodeURIComponent(a) + '&destination=' + encodeURIComponent(b);
        const link = (mode, label) => '<a href="' + esc(base + '&travelmode=' + mode) +
          '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
        const transitExtra = '<a href="' + esc('https://www.sncf-connect.com/app/home/search' ) +
          '" target="_blank" rel="noopener noreferrer">🚆 SNCF Connect</a>' +
          '<a href="https://www.flixbus.fr/" target="_blank" rel="noopener noreferrer">🚌 FlixBus</a>' +
          '<a href="https://www.blablacar.fr/bus" target="_blank" rel="noopener noreferrer">🚌 BlaBlaCar Bus</a>';
        return '<div class="liensTr">' +
          link('transit', '🚌 Bus / train') +
          transitExtra +
          link('walking', '🚶 Marche') +
          link('bicycling', '🚲 Vélo (repère trottinette, à vérifier)') +
          '</div>' +
          (when ? '<div class="doux">Heure de référence : ' + esc(formatParis(when)) +
          ' · sélectionner la date et l’heure exactes dans le calculateur externe.</div>' : '');
      };
      // Moteur régional : coordonnées et fournisseur existant, ou endpoint explicitement configuré.
      // Ne jamais transformer une recherche externe en trajet prétendument confirmé.
      const regionalEngineReady = !!(window.CPRegionalRouting &&
        typeof window.CPRegionalRouting.plan === 'function');
      // A configured endpoint has priority; the public M provider is geographically gated.
      const regionalEndpointConfigured = !!(window.CP_REGIONAL_ROUTING_ENDPOINT &&
        /^https:\/\/[^\s/]+/i.test(String(window.CP_REGIONAL_ROUTING_ENDPOINT)));
      const regionalPointsReady = (from,to) => regionalEndpointConfigured ||
        !!(window.CPRegionalRouting?.supportsPublic && window.CPRegionalRouting.supportsPublic(from,to));
      const regionalProviderReady = regionalEndpointConfigured ||
        typeof window.CPRegionalRouting?.supportsPublic === 'function';
      const y51FeedStatus = 'Source horaire Y51 non chargée dans cette fiche : départs non confirmés.';
      const y51ServiceDay = (() => {
        const d = new Date(transportDelivery || m.delivery_start || '');
        if (!Number.isFinite(d.getTime())) return '';
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(d);
        const val = type => parts.find(x => x.type === type)?.value || '';
        return val('year') + '-' + val('month') + '-' + val('day');
      })();
      const y51WorksWarning = y51ServiceDay >= '2026-09-14' && y51ServiceDay <= '2026-12-18' ?
        '⚠️ Travaux rive est du lac du 14 septembre au 18 décembre 2026 : certains départs matinaux Y51 sont avancés de 15 min (05h40, 06h10 et 06h20 au départ d’Albertville notamment). Les autres horaires, dont un éventuel 11h48 à École Saint-François, ne doivent pas être déduits de cette mesure. Vérifier la fiche officielle et le suivi temps réel.' :
        'Vérifier la fiche horaire officielle en vigueur et les éventuelles perturbations.';
      const y51OfficialPdf = 'https://www.mobilites-arlysere.fr/wp-content/uploads/2026/07/FHY51-sept-dec-2026.pdf';
      const y51DayOfWeek = y51ServiceDay ?
        new Date(y51ServiceDay + 'T12:00:00Z').getUTCDay() : -1;
      const y51Weekday = y51DayOfWeek >= 1 && y51DayOfWeek <= 5;
      // Les jours fériés français ne peuvent pas être assimilés aux services du lundi au vendredi.
      const y51FrenchHolidays = new Set(['2026-11-01', '2026-11-11', '2026-12-25']);
      const y51Holiday = y51FrenchHolidays.has(y51ServiceDay);
      const y51ScheduleApplies = y51ServiceDay >= '2026-09-01' &&
        y51ServiceDay <= '2026-12-31' && y51Weekday && !y51Holiday;
      const y51Indicative = y51ScheduleApplies ?
        'Grille officielle septembre–décembre 2026, page 2 : École Saint-François, direction Annecy, 11 h 48 (lundi à vendredi). ' +
        'Se présenter au moins 5 min avant, soit 11 h 43. Horaires théoriques : perturbations possibles, marche et circulation non vérifiées.' :
        (y51Holiday ? 'Jour férié : le service du lundi au vendredi ne peut pas être présumé. ' : '') +
        'Le service de 11 h 48 à École Saint-François n’est pas validé pour cette date et ce type de jour. Vérifier la grille applicable.';
      const y51WalkingWindow = (() => {
        if (!y51ScheduleApplies) return '';
        const end = new Date(transportDelivery || '');
        if (!Number.isFinite(end.getTime())) return 'Heure de fin de livraison absente : temps d’approche impossible à calculer.';
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(end);
        const minute = type => Number(parts.find(x => x.type === type)?.value || 0);
        const available = 11 * 60 + 43 - (minute('hour') * 60 + minute('minute'));
        return available <= 0 ?
          '⚠️ Arrivée recommandée à l’arrêt (11 h 43) déjà dépassée à la livraison.' :
          'Temps théorique entre livraison et arrivée recommandée à l’arrêt (11 h 43) : ' +
          available + ' min. Durée de marche exacte non mesurée ; transport non confirmé — vérifiez vous-même.';
      })();
      const y51SummerReference = y51ServiceDay >= '2026-07-04' && y51ServiceDay <= '2026-08-31' ?
        'Grille officielle été 2026 : École Saint-François → Annecy à 11 h 47 du lundi au vendredi (hors jours fériés). ' +
        'Horaire théorique historique de cette période uniquement ; aucune confirmation temps réel.' :
        'La grille été 2026 ne doit pas être utilisée pour cette date : consulter la grille 2026–2027.';
      const y51CheckDate = y51ServiceDay ?
        'Date de service à vérifier : ' + y51ServiceDay + ' (heure locale Europe/Paris).' :
        'Date de livraison absente : impossible de choisir le bon calendrier de circulation.';
      const endTime = Date.parse(transportDelivery || ''); // Une heure de début de livraison n'est pas une heure de fin.
      const next = Number.isFinite(endTime) ? planningMissions()
        .filter(x => x && RT.cle(x) !== RT.cle(m) && (x.kind === 'acceptee' || x.status === 'acceptee') &&
          !['annulee', 'cancelled', 'canceled', 'refusee'].includes(String(x.status || '').toLowerCase()) &&
          Number.isFinite(Date.parse(x.pickup_start || '')) &&
          Date.parse(x.pickup_start) > endTime)
        .sort((a,b) => Date.parse(a.pickup_start) - Date.parse(b.pickup_start))[0] : null;
      const formatParis = value => {
        if (value === null || value === undefined || value === '') return 'heure non renseignée';
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ?
          new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit' }).format(date) : 'heure non renseignée';
      };
      const nextGapMin = next ? Math.floor((Date.parse(next.pickup_start) - endTime) / 60000) : null;
      const securityMarginMin = 5;
      const pickupDate = Number.isFinite(Date.parse(transportPickup || '')) ? transportPickup : null;
      const deliveryDate = Number.isFinite(Date.parse(transportDelivery || '')) ?
        transportDelivery : null;
      const connectionBudgetMin = nextGapMin == null ? null : nextGapMin - securityMarginMin;
      const connectionStatus = nextGapMin == null ? '' :
        connectionBudgetMin < 0 ?
          '⚠️ Jonction non réalisable avec une marge minimale de 5 min, même sans trajet d’approche.' :
          'Temps maximum théorique pour transport et approche : ' +
          connectionBudgetMin + ' min, après réservation d’une marge minimale de 5 min. ' +
          'Transport non confirmé — vérifiez vous-même.';
      const nextOrigin = next && locationText(next.origin_address || next.from_address,
        next.from_city, next.from_department);
      panel.innerHTML = '<div class="bkt">🚌 TRANSPORTS DE LA MISSION</div>' +
        '<details id="cpSibraFareReference" class="doux" style="margin:8px 0"><summary>Tarifs et abonnement SIBRA — secteur Annecy</summary>' +
        '<p>Repères consultés le 31/10/2026 : 1 voyage à 2,50 € à bord ou 2,00 € en achat digital / rechargement (support éventuel en supplément). ' +
        'Ce sont des prix de titres, pas le prix total de cet itinéraire. ' +
        '<a href="https://www.sibra.fr/voyages-occasionnels/" target="_blank" rel="noopener noreferrer">Titres et conditions actuels</a> · ' +
        '<a href="https://www.sibra.fr/app/uploads/2026/07/Reglement_BUS_CARS_CGV_01072026_3.pdf" target="_blank" rel="noopener noreferrer">Barème officiel, pages 4 et 6</a>.</p>' +
        '<p>Un abonnement SIBRA personnel valide évite un billet supplémentaire sur les portions éligibles. ' +
        'Les lignes régionales Y21, Y22, Y51, Y62, Y63 et 272 acceptent les titres SIBRA pour les trajets dans le Grand Annecy (hors SMS). ' +
        'Des arrêts supplémentaires Y21/Y22 sont précisés dans le règlement. Ne pas étendre cette couverture à toute la ligne. ' +
        '<a href="https://www.sibra.fr/voyages-reguliers/" target="_blank" rel="noopener noreferrer">Périmètre et abonnements</a>. ' +
        'L’abonnement n’est pas encore déduit des prix affichés.</p></details>' +
        '<div><strong>1. Aller au départ de mission</strong><div>' +
        esc(home || 'Domicile non renseigné') + ' → ' + esc(from || 'Départ non renseigné') +
        '</div><div class="doux">Prise en charge : ' + esc(formatParis(pickupDate)) +
        ' · minimum : 5 min au point GPS exact, marche finale comprise ; préférence : 30 à 45 min.</div>' +
        directions(home, from, transportPickup) + '</div>' +
        '<div style="margin-top:12px"><strong>2. Jonction vers la prochaine mission</strong><div>' +
        (next ? esc((to || 'Livraison non renseignée') + ' → ' +
          (nextOrigin || 'Départ suivant non renseigné')) +
          '</div><div class="doux">Livraison prévue : ' +
          esc(formatParis(transportDelivery || m.delivery_start)) +
          ' · prochaine prise en charge : ' + esc(formatParis(next.pickup_start)) +
          ' · intervalle brut : ' + esc(String(nextGapMin)) +
          ' min (avant marge et trajet d’approche).</div>' +
          '<div class="doux">' + esc(connectionStatus) + '</div>' +
          directions(to, nextOrigin, next.pickup_start) :
          '</div><span class="doux">Aucune prochaine mission prévue.</span>') + '</div>' +
        '<div style="margin-top:12px"><strong>3. Retour au domicile</strong><div>' +
        esc(to || 'Livraison non renseignée') + ' → ' +
        esc(home || 'Domicile non renseigné') + '</div>' +
        '<div class="doux">' + (transportPlannedReturn ? 'Livraison prévue pour ce calcul : ' : 'Livraison estimée pour ce calcul (à confirmer) : ') + esc(formatParis(deliveryDate)) +
        ' · prévoir la marche jusqu’à l’arrêt.</div>' +
        directions(to, home, transportDelivery || m.delivery_start) +
        (/albertville/i.test(String(to || '')) ?
          '<div class="doux" style="margin-top:8px">🚌 Retour Y51 Albertville → Annecy : ' +
          '<a href="https://annecy.transdev.com/line/ligne-y51/" target="_blank" rel="noopener noreferrer">horaires officiels 2026–2027</a> · ' +
          '<a href="https://annecy.transdev.com/trafic/" target="_blank" rel="noopener noreferrer">perturbations et mises à jour Transdev</a> · ' +
          '<a href="https://hawk.hanoverdisplays.com/y51/public/" target="_blank" rel="noopener noreferrer">suivi des départs</a> · ' +
          '<a href="https://transports.s33d.fr/arret/ecole-saint-francois-73011" target="_blank" rel="noopener noreferrer">horaires de l’arrêt École Saint-François (données régionales)</a> · ' +
          '<a href="' + esc('https://www.google.com/maps/dir/?api=1&origin=' +
            encodeURIComponent(to) + '&destination=' +
            encodeURIComponent('École Saint-François, Albertville') +
            '&travelmode=walking') +
          '" target="_blank" rel="noopener noreferrer">marche vers École Saint-François</a>. ' +
          '<a href="' + esc(y51OfficialPdf) + '" target="_blank" rel="noopener noreferrer">PDF officiel septembre–décembre 2026 (page 2)</a>. ' +
          esc(y51FeedStatus) + '<div>' + esc(y51Indicative) + '</div>' +
          '<div>' + esc(y51WorksWarning) + '</div>' +
          '<div>' + esc(y51CheckDate) + '</div>' +
          '<div>' + esc(y51WalkingWindow) + '</div>' +
          '<div>' + esc(y51SummerReference) + '</div></div>' : '') + '</div>' +
        '<p class="doux">Moteur régional : ' +
        (regionalEngineReady && regionalEndpointConfigured ?
          'adaptateur et adresse de service disponibles, itinéraires non encore calculés dans cette fiche.' :
          regionalEngineReady && regionalProviderReady ?
          'Mobilités M disponible pour les trajets locaux du secteur Grenoble ; les trajets complets vers Annecy ou Ambérieu ne sont pas encore raccordés.' :
          regionalEngineReady ? 'aucun fournisseur régional disponible.' :
          'adaptateur non chargé.') +
        ' Aucun horaire ni tarif réel n’est actuellement validé dans cette fiche.</p>' +
        '<p class="doux">Le minimum de 5 min se mesure au point GPS exact de prise en charge, après la marche finale. Une arrivée à la gare ou à l’arrêt ne suffit pas. Ces liens ouvrent une recherche de transports. Horaires, prix, marche d’approche et faisabilité non confirmés — vérifiez vous-même.</p>';
      const planningBox = document.createElement('div');
      planningBox.className = 'doux';
      planningBox.style.marginTop = '10px';
      const planningLabel = document.createElement('label');
      planningLabel.textContent = 'Livraison prévue pour préparer le retour (heure de Paris)';
      const planningInput = document.createElement('input');
      planningInput.type = 'datetime-local';
      planningInput.required = true;
      planningInput.id = 'cpTransportPlannedReturn';
      planningLabel.htmlFor = planningInput.id;
      const planningButton = document.createElement('button');
      planningButton.type = 'button';
      planningButton.className = 'second';
      planningButton.textContent = 'Calculer avec cette livraison prévue';
      const planningStatus = document.createElement('p');
      planningStatus.setAttribute('role','status');
      planningStatus.setAttribute('aria-live','polite');
      planningStatus.dataset.planningFeedback = 'true';
      planningStatus.textContent = transportPlannedReturn ?
        'Livraison prévue prise en compte : ' + formatParis(transportPlannedReturn) +
        '. Agenda et recherches utilisent cet horaire. Les résultats disponibles apparaissent ci-dessous ; un trajet non raccordé ne peut pas être calculé.' :
        'Indique la date et l’heure prévues de livraison pour recalculer. La date limite reste inchangée. Ce choix est conservé uniquement pendant cette session.';
      planningBox.appendChild(planningLabel);
      planningBox.appendChild(planningInput);
      planningBox.appendChild(planningButton);
      planningBox.appendChild(planningStatus);
      refreshPlanValue();
      function refreshPlanValue() {
        if (!transportPlannedReturn) return;
        const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', {
          timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',
          hour:'2-digit',minute:'2-digit',hourCycle:'h23'
        }).formatToParts(new Date(transportPlannedReturn)).map(part => [part.type,part.value]));
        planningInput.value = p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
      }
      const planningError = message => {
        planningStatus.textContent = message;
        planningStatus.setAttribute('role','alert');
        planningInput.focus();
        planningStatus.scrollIntoView({behavior:'smooth',block:'nearest'});
      };
      planningButton.onclick = () => {
        const chosen = transportParisDate(planningInput.value);
        if (!chosen || !m.platform || m.external_id == null ||
            !Number.isFinite(Date.parse(transportPickup || '')) ||
            Date.parse(chosen) < Date.parse(transportPickup)) {
          planningError('Indiquer une date et une heure valides après la prise en charge. Une heure ambiguë au changement d’heure doit être évitée.');
          return;
        }
        if (timing.deadline && Number.isFinite(Date.parse(timing.deadline)) &&
            Date.parse(chosen) > Date.parse(timing.deadline)) {
          planningError('Cette livraison prévue dépasse la date limite de la plateforme.');
          return;
        }
        if (transportReturnPlans.size >= 64) transportReturnPlans.delete(transportReturnPlans.keys().next().value);
        transportReturnPlans.set(transportPlanKey,chosen);
        etat.planResultat = null;
        planningButton.disabled = true;
        planningStatus.textContent = 'Livraison prévue prise en compte. Actualisation des informations…';
        try {
          if (etat.onglet === 'agenda') vueAgenda();
          // Rebuild the visible mission header too, rather than clicking its old button.
          detail(timing.original, depuis);
          const updatedButton = $('btnTransportsMission');
          if (!updatedButton) throw new Error('Bouton transports indisponible');
          updatedButton.dataset.transportRefreshAt = String(Date.now());
          updatedButton.click();
          const feedback = $('cpTransportMissionDetails')?.querySelector('[data-planning-feedback]');
          if (feedback) feedback.scrollIntoView({behavior:'smooth',block:'center'});
          toast('Livraison prévue prise en compte : ' + formatParis(chosen));
        } catch (_) {
          planningButton.disabled = false;
          planningError('Livraison prévue retenue, mais affichage non actualisé. Ferme puis rouvre la fiche pour réessayer.');
          toast('Affichage des transports non actualisé. Ferme puis rouvre la fiche.');
        }
      };
      panel.appendChild(planningBox);
      // Allow an explicit fresh check when mobile connectivity has recovered.
      // Reopen the existing transport panel so all date-scoped searches are rerun.
      const refreshTransport = document.createElement('button');
      refreshTransport.type = 'button';
      refreshTransport.className = 'second';
      refreshTransport.textContent = '🔄 Actualiser maintenant';
      refreshTransport.setAttribute('aria-label', 'Actualiser maintenant les transports de cette mission');
      refreshTransport.style.marginTop = '8px';
      refreshTransport.onclick = () => {
        if (!panel.isConnected) return;
        // Explicit user refresh must bypass browser HTTP caches for day JSON.
        // The timestamp is scoped to this panel only; mission sync is untouched.
        bt.dataset.transportRefreshAt = String(Date.now());
        stopGTFSTransports();
        panel.remove();
        bt.setAttribute('aria-expanded', 'false');
        bt.removeAttribute('aria-controls');
        bt.click();
      };
      panel.appendChild(refreshTransport);
      if (bt.dataset.transportRefreshAt) {
        const refreshed = document.createElement('p');
        refreshed.className = 'doux';
        refreshed.setAttribute('role', 'status');
        refreshed.textContent = 'Actualisation réseau demandée : si les données sont indisponibles, aucun horaire récent ne sera confirmé.';
        panel.appendChild(refreshed);
      }
      // GTFS candidate search: one worker for the open panel, no mission writes.
      if (window.CPGTFSAgenda && window.CPGTFSWorker) {
        let gtfsTaskSignature = null;
        const runGTFS = () => {
        if (!panel.isConnected || panel.hidden || $('feuille').hidden) return;
        const point = gps => transportAddressPoint(gps) ?
          {lat:Number(gps.lat),lon:Number(gps.lng)} : null;
        const homeLat = etat.reglages?.domicile_lat, homeLon = etat.reglages?.domicile_lng;
        const homePoint = homeLat != null && homeLon != null && homeLat !== '' && homeLon !== '' &&
          Number.isFinite(Number(homeLat)) && Number.isFinite(Number(homeLon)) ?
          {lat:Number(homeLat),lon:Number(homeLon)} : null;
        const gtfsTasks = [];
        if (pickupDate) gtfsTasks.push({label:'Aller',from:homePoint,
          to:point(G.coordonnees(m,'origin')),latestArrival:pickupDate,marginMinutes:securityMarginMin});
        if (deliveryDate) gtfsTasks.push({label:'Retour',from:point(G.coordonnees(m,'destination')),
          to:homePoint,earliestDeparture:deliveryDate});
        if (next && deliveryDate && next.pickup_start) gtfsTasks.push({label:'Jonction',
          from:point(G.coordonnees(m,'destination')),to:point(G.coordonnees(next,'origin')),
          earliestDeparture:deliveryDate,latestArrival:next.pickup_start,marginMinutes:securityMarginMin});
        const signature = JSON.stringify(gtfsTasks);
        if (signature === gtfsTaskSignature) return;
        stopGTFSTransports();
        panel.querySelector('[data-gtfs-agenda]')?.remove();
        gtfsAgendaSession = window.CPGTFSAgenda.mount(panel,{tasks:gtfsTasks,
          ...(Array.isArray(window.CP_GTFS_AGENDA_RESOURCES) ? {resources:window.CP_GTFS_AGENDA_RESOURCES} : {})});
        gtfsTaskSignature = signature;
        };
        bt.cpRefreshGTFS = runGTFS;
        runGTFS();
      }
      if (next) pointsMission(next, () => {
        if (!panel.isConnected || panel.hidden || $('feuille').hidden || $('btnTransportsMission') !== bt) return;
        bt.cpRefreshGTFS?.();
        bt.cpRefreshRegional?.();
      });
      // Swiss public transport connections for an accepted mission junction.
      // Results are advisory until realtime validity and exact walking approaches are checked.
      if (window.CPSwissTransport && next && deliveryDate && next.pickup_start) {
        const swissFrom = G.coordonnees(m, 'destination');
        const swissTo = G.coordonnees(next, 'origin');
        const nextPickupMs = Date.parse(next.pickup_start);
        if (transportAddressPoint(swissFrom) && transportAddressPoint(swissTo) &&
            Number.isFinite(nextPickupMs) && nextPickupMs > Date.parse(deliveryDate)) {
          const swissStatus = document.createElement('div');
          swissStatus.className = 'doux';
          swissStatus.setAttribute('role', 'status');
          swissStatus.textContent = 'Jonction suisse : recherche des bus, trams et trains…';
          panel.appendChild(swissStatus);
          window.CPSwissTransport.plan({
            from: {lat:swissFrom.lat, lon:swissFrom.lng},
            to: {lat:swissTo.lat, lon:swissTo.lng},
            when: deliveryDate,
            limit: 6
          }).then(options => {
            if (!swissStatus.isConnected) return;
            const departureMs = Date.parse(deliveryDate);
            const compatible = options.filter(option => {
              const start = Date.parse(option.departure);
              const end = Date.parse(option.arrival);
              return Number.isFinite(start) && Number.isFinite(end) &&
                start >= departureMs && end <= nextPickupMs - securityMarginMin * 60000;
            }).slice(0, 5);
            const diagnostic = options.diagnostic;
            const diagnosticLabel = diagnostic && diagnostic.status === 'success' ? ' (API : ' + diagnostic.valid + '/' + diagnostic.received + ' horaires valides)' : '';
            swissStatus.textContent = compatible.length ?
              'Jonction suisse : ' + compatible.length +
              ' proposition(s) indicatives' + diagnosticLabel + '. Prix et circulation non confirmés :' :
              'Jonction suisse : aucune proposition compatible' + diagnosticLabel + '. Transport non confirmé — vérifiez vous-même.';
            compatible.forEach(option => {
              const line = document.createElement('p');
              const legs = option.sections.map(s => [s.mode === 'WALK' ? '🚶 Marche' : s.mode,s.line,s.from && s.to ? s.from+' → '+s.to : '',s.mode === 'WALK' && Number.isFinite(s.walkSeconds) ? Math.ceil(s.walkSeconds/60)+' min à pied' : ''].filter(Boolean).join(' ')).join(' · ');
              line.textContent = formatParis(option.departure) + ' → ' +
                formatParis(option.arrival) + ' · ' + legs +
                ' · avance avant prochaine mission : ' + Math.max(0,Math.floor((nextPickupMs-Date.parse(option.arrival))/60000)) + ' min (marge de sécurité requise : ' + securityMarginMin + ' min, approche exacte non vérifiée)' +
                ' · tarif non communiqué · Transport non confirmé — vérifiez vous-même.';
              swissStatus.appendChild(line);
            });
          }).catch(() => {
            if (swissStatus.isConnected) swissStatus.textContent =
              'Jonction suisse : service indisponible. Transport non confirmé — vérifiez vous-même.';
          });
        }
      }
      // Regional refresh slots: rerun only the tasks whose precise inputs change.
      const regionalRefreshers = [];
      const regionalActive = () => panel.isConnected && !panel.hidden &&
        !$('feuille').hidden && $('btnTransportsMission') === bt;
      const regionalControllers=new Set();
      const regionalObserver=typeof MutationObserver==='function'?new MutationObserver(()=>{
        if(!regionalActive()){
          for(const controller of regionalControllers)controller.abort();
          regionalControllers.clear();regionalObserver.disconnect();
        }
      }):null;
      regionalObserver?.observe($('feuille'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
      const regionalPoint = gps => transportAddressPoint(gps) ?
        {lat:Number(gps.lat),lon:Number(gps.lng)} : null;
      const regionalHome = () => {
        const lat = etat.reglages?.domicile_lat, lon = etat.reglages?.domicile_lng;
        return lat != null && lon != null && lat !== '' && lon !== '' ?
          {lat:Number(lat),lon:Number(lon)} : null;
      };
      const regionalSlot = (inputs, render) => {
        let signature = null, previous = null, controller = null;
        const refresh = () => {
          if (!regionalActive()) return;
          const key = JSON.stringify(inputs());
          if (key === signature) return;
          signature = key;
          controller?.abort();regionalControllers.delete(controller);
          controller=new AbortController();regionalControllers.add(controller);
          previous?.remove();
          previous = document.createElement('div');
          previous.setAttribute('data-regional-slot', '');
          panel.appendChild(previous);
          render(previous,controller.signal);
        };
        regionalRefreshers.push(refresh);
        refresh();
      };
      bt.cpRefreshRegional = () => regionalRefreshers.forEach(refresh => refresh());
      regionalSlot(() => [regionalPoint(G.coordonnees(m,'destination')),regionalPoint(next && G.coordonnees(next,'origin')),deliveryDate,next?.pickup_start,securityMarginMin], (panel,signal) => {
      // Regional journeys use a configured endpoint or the public M provider,
      // only when both mission endpoints have exact GPS.
      if (regionalEngineReady && regionalProviderReady && next && deliveryDate) {
        const finishGps = G.coordonnees(m, 'destination');
        const nextGps = G.coordonnees(next, 'origin');
        if (transportAddressPoint(finishGps) && transportAddressPoint(nextGps) &&
            regionalPointsReady({lat:finishGps.lat,lon:finishGps.lng},{lat:nextGps.lat,lon:nextGps.lng})) {
          const regionalStatus = document.createElement('div');
          regionalStatus.className = 'doux';
          regionalStatus.setAttribute('role', 'status');
          regionalStatus.textContent = 'Jonction régionale : recherche des correspondances…';
          panel.appendChild(regionalStatus);
          window.CPRegionalRouting.plan({
            signal,
            endpoint: window.CP_REGIONAL_ROUTING_ENDPOINT,
            from: {lat: finishGps.lat, lon: finishGps.lng},
            to: {lat: nextGps.lat, lon: nextGps.lng},
            departure: deliveryDate,
            refresh: !!bt.dataset.transportRefreshAt,
            fetcher: regionalFetch
          }).then(answer => {
            if (!regionalActive() || !regionalStatus.isConnected) return;
            const options = window.CPRegionalRouting.feasibleBetween(
              answer.itineraries, deliveryDate, next.pickup_start, securityMarginMin);
            regionalStatus.textContent = options.length ?
              'Jonction régionale : ' + options.length +
              ' proposition(s) théoriques, horaires et circulation à vérifier :' :
              'Jonction régionale : aucune correspondance compatible avec la marge minimale de 5 min. Transport non confirmé — vérifiez vous-même.';
            if (window.CPTransportAdapters && window.CPTransportRanking && options.length) {
              const ranked = window.CPTransportRanking.rank(
                window.CPTransportAdapters.withVerifiedFares(window.CPTransportAdapters.adaptRegional(options,'Régional')),
                {deadline:next.pickup_start,marginMinutes:securityMarginMin});
              if (ranked.length) {
                const summary = document.createElement('p');
                summary.textContent = 'Classement Jonction régionale théorique : ' +
                  ranked.map(choice => (choice.journey.priceEUR === null && choice.label === 'Moins cher' ? 'Tarif inconnu' : choice.label) + ' (' +
                    choice.journey.durationMinutes + ' min, ' + (choice.journey.priceEUR === null ? 'tarif non vérifié' : choice.journey.priceEUR.toFixed(2).replace('.', ',') + ' € (tarif vérifié)') + ')').join(' · ') +
                  '. Accès aux arrêts, correspondances et circulation non confirmés.';
                regionalStatus.appendChild(summary);
              }
            }
            options.slice(0, 5).forEach(option => {
              const line = document.createElement('p');
              const legs = option.legs.map(leg => [
                leg.mode, leg.route, leg.from + ' → ' + leg.to
              ].filter(Boolean).join(' ')).join(' · ');
              line.textContent = formatParis(option.startTime) + ' → ' +
                formatParis(option.endTime) + ' · ' + legs +
                ' · horaire théorique, transport non confirmé.';
              regionalStatus.appendChild(line);
            });
          }).catch(() => {
            if (regionalActive() && regionalStatus.isConnected) regionalStatus.textContent =
              'Service régional indisponible ou incompatible. Transport non confirmé — vérifiez vous-même.';
          });
        }
      }
      });
      // Swiss API: outbound and return suggestions. Home coordinates may be a city centre.
      // Only show indicative options; never imply door-to-door or realtime confirmation.
      if (window.CPSwissTransport) {
        const homeLat = Number(etat.reglages?.domicile_lat);
        const homeLon = Number(etat.reglages?.domicile_lng);
        const homeReady = etat.reglages?.domicile_lat != null &&
          etat.reglages?.domicile_lng != null &&
          window.CPSwissTransport.point({lat:homeLat,lon:homeLon});
        const swissSuggestions = (label, from, to, when, arriveBy, accept) => {
          const status = document.createElement('div');
          status.className = 'doux';
          status.setAttribute('role', 'status');
          status.textContent = label + ' suisse : recherche des correspondances…';
          panel.appendChild(status);
          window.CPSwissTransport.plan({from,to,when,arriveBy,limit:6})
            .then(results => {
              if (!status.isConnected) return;
              const valid = results.filter(accept).slice(0,5);
              const diagnostic = results.diagnostic;
              const diagnosticLabel = diagnostic && diagnostic.status === 'success' ? ' (API : ' + diagnostic.valid + '/' + diagnostic.received + ' horaires valides)' : '';
              status.textContent = valid.length ?
                label + ' suisse : ' + valid.length + ' proposition(s) indicatives' + diagnosticLabel + '. Accès aux adresses exactes et temps de marche non vérifiés :' :
                label + ' suisse : aucun itinéraire compatible' + diagnosticLabel + '. Transport non confirmé — vérifiez vous-même.';
              valid.forEach(result => {
                const line = document.createElement('p');
                const legs = result.sections.map(s =>
                  [s.mode === 'WALK' ? '🚶 Marche' : s.mode,s.line,s.from && s.to ? s.from+' → '+s.to : '',s.mode === 'WALK' && Number.isFinite(s.walkSeconds) ? Math.ceil(s.walkSeconds/60)+' min à pied' : ''].filter(Boolean).join(' ')).join(' · ');
                line.textContent = formatParis(result.departure) + ' → ' +
                  formatParis(result.arrival) + ' · ' + legs +
                  (label === 'Aller' && Number.isFinite(Date.parse(pickupDate)) ? ' · avance avant prise en charge : ' + Math.max(0,Math.floor((Date.parse(pickupDate)-Date.parse(result.arrival))/60000)) + ' min (marge de sécurité requise : ' + securityMarginMin + ' min)' : '') +
                  ' · tarif non communiqué · Transport non confirmé — vérifiez vous-même.';
                status.appendChild(line);
              });
            }).catch(() => {
              if (status.isConnected) status.textContent =
                label + ' suisse : service indisponible. Transport non confirmé — vérifiez vous-même.';
            });
        };
        if (homeReady && pickupDate && Number.isFinite(Date.parse(pickupDate))) {
          const pickupGps = G.coordonnees(m,'origin');
          if (transportAddressPoint(pickupGps)) {
            const limit = Date.parse(pickupDate) - securityMarginMin * 60000;
            swissSuggestions('Aller',{lat:homeLat,lon:homeLon},
              {lat:pickupGps.lat,lon:pickupGps.lng},new Date(limit).toISOString(),true,
              r => Number.isFinite(Date.parse(r.departure)) &&
                Number.isFinite(Date.parse(r.arrival)) && Date.parse(r.arrival)<=limit);
          }
        }
        if (homeReady && deliveryDate && Number.isFinite(Date.parse(deliveryDate))) {
          const finishGps = G.coordonnees(m,'destination');
          if (transportAddressPoint(finishGps)) {
            const earliest = Date.parse(deliveryDate);
            swissSuggestions('Retour',{lat:finishGps.lat,lon:finishGps.lng},
              {lat:homeLat,lon:homeLon},deliveryDate,false,
              r => Number.isFinite(Date.parse(r.departure)) &&
                Number.isFinite(Date.parse(r.arrival)) && Date.parse(r.departure)>=earliest);
          }
        }
      }
      // SNCF station-only fallback runs independently of public routing API availability.
      // Only dated public files are fetched: addresses/GPS stay in this browser.
      if (window.CPSncfFallback && typeof window.CPSncfFallback.plan === 'function') {
        const homeStation = () => {
          const name=String(etat.reglages?.domicile_ville || '').trim();
          return {name,point:etat.reglages?.domicile_lat != null && etat.reglages?.domicile_lng != null ?
            {lat:etat.reglages.domicile_lat,lon:etat.reglages.domicile_lng} : G.trouverVille(name)};
        };
        const stationKey = station => [station.name,station.point?.lat ?? null,station.point?.lon ?? station.point?.lng ?? null];
        const missionStation = (mission,side) => ({
          name:String((side === 'origin' ? mission.from_city : mission.to_city) || ''),
          point:G.coordonnees(mission,side)
        });
        const railSearch = (label,inputs) => regionalSlot(() => {
          const v=inputs();
          return [stationKey(v.fromStation),stationKey(v.toStation),v.when,v.arriveBy,v.latestArrival];
        }, (panel,signal) => {
          const {fromStation,toStation,when,arriveBy,latestArrival}=inputs();
          if (!when || (!fromStation.name && !fromStation.point) || (!toStation.name && !toStation.point) ||
              (fromStation.name && toStation.name && fromStation.name.trim().toLocaleLowerCase('fr') === toStation.name.trim().toLocaleLowerCase('fr'))) return;
          const status = document.createElement('div');
          status.className = 'doux';
          status.style.marginTop = '10px';
          status.setAttribute('role','status');
          status.textContent = label + ' — secours SNCF : recherche des trains de gare à gare…';
          panel.appendChild(status);
          window.CPSncfFallback.plan({from:fromStation,to:toStation,when,arriveBy,
            limit:10,fetcher:regionalFetch,signal,
            ...(latestArrival ? {latestArrival:new Date(latestArrival).toISOString()} : {})}).then(answer => {
            if (!regionalActive() || signal.aborted || !status.isConnected) return;
            const itineraries = answer.itineraries.filter(it => !latestArrival || Date.parse(it.arrival) <= latestArrival).slice(0,3);
            status.textContent = label + ' — secours SNCF, horaires théoriques du flux ' + answer.sourceVersion + ' : ' +
              (itineraries.length ? itineraries.length + ' proposition(s) de gare à gare.' :
              answer.status === 'stations_not_found' ? 'gare non identifiée pour une des communes.' :
              'aucun train direct ou avec une correspondance trouvé dans les journées chargées.');
            if (window.CPTransportAdapters && window.CPTransportRanking) {
              const normalized = window.CPTransportAdapters.withVerifiedFares(window.CPTransportAdapters.adaptSNCF(itineraries));
              const deadline = label === 'Aller' && pickupDate ? pickupDate :
                label === 'Jonction' && next?.pickup_start ? next.pickup_start : null;
              const choices = window.CPTransportRanking.rank(normalized,{deadline,marginMinutes:securityMarginMin});
              if (choices.length) {
                const summary = document.createElement('p');
                summary.textContent = 'Classement SNCF de gare à gare : ' +
                  choices.map(choice => (choice.journey.priceEUR === null && choice.label === 'Moins cher' ? 'Tarif inconnu' : choice.label) + ' (' + choice.journey.durationMinutes +
                    ' min, ' + (choice.journey.priceEUR === null ? 'prix non vérifié' : choice.journey.priceEUR.toFixed(2).replace('.', ',') + ' € (tarif vérifié)') + ')').join(' · ') +
                  '. Aucun trajet complet confirmé.';
                status.appendChild(summary);
              }
            }
            itineraries.forEach(itinerary => {
              const row = document.createElement('p');
              row.textContent = itinerary.legs.map(leg =>
                [leg.line,leg.trainNumber,leg.from + ' ' + formatParis(leg.departure) +
                  ' → ' + leg.to + ' ' + formatParis(leg.arrival)].filter(Boolean).join(' ')).join(' · puis ') +
                (itinerary.transferMinutes != null ? ' · changement en gare : ' + itinerary.transferMinutes + ' min (cheminement non vérifié)' : ' · direct') +
                ' · prix et réservation éventuelle à vérifier.';
              status.appendChild(row);
            });
            const warning = document.createElement('p');
            warning.textContent = 'Accès aux gares, marche finale, prix et circulation réelle non vérifiés. Ce résultat ne valide pas le trajet complet jusqu’à la mission ou au domicile. Transport non confirmé — vérifiez vous-même.';
            status.appendChild(warning);
            const source = document.createElement('a');
            source.href = 'https://transport.data.gouv.fr/datasets/horaires-sncf';
            source.target = '_blank';source.rel = 'noopener noreferrer';
            source.textContent = 'Source : SNCF Voyageurs — données ouvertes ODbL';
            status.appendChild(source);
          }).catch(() => {
            if (regionalActive() && !signal.aborted && status.isConnected) status.textContent = label +
              ' — secours SNCF indisponible pour cette date. Aucun résultat ne prouve pas l’absence de transport. Transport non confirmé — vérifiez vous-même.';
          });
        });
        if (pickupDate) railSearch('Aller',()=>({fromStation:homeStation(),toStation:missionStation(m,'origin'),
          when:new Date(Date.parse(pickupDate)-securityMarginMin*60000).toISOString(),arriveBy:true}));
        if (deliveryDate) railSearch('Retour',()=>({fromStation:missionStation(m,'destination'),toStation:homeStation(),when:deliveryDate,arriveBy:false}));
        if (next && deliveryDate) railSearch('Jonction',()=>({fromStation:missionStation(m,'destination'),
          toStation:missionStation(next,'origin'),when:deliveryDate,arriveBy:false,
          latestArrival:Date.parse(next.pickup_start)-securityMarginMin*60000}));
      }
      // Regional return from the exact delivery point to the configured home
      // coordinate (which may only represent a city centre, not a door).
      regionalSlot(() => [regionalPoint(G.coordonnees(m,'destination')),regionalHome(),deliveryDate], (panel,signal) => {
      if (regionalEngineReady && regionalProviderReady && deliveryDate) {
        const finishGps = G.coordonnees(m, 'destination');
        const homeLat = Number(etat.reglages?.domicile_lat);
        const homeLon = Number(etat.reglages?.domicile_lng);
        const homeGpsReady = etat.reglages?.domicile_lat != null &&
          etat.reglages?.domicile_lng != null &&
          window.CPRegionalRouting.validPoint({lat:homeLat,lon:homeLon});
        if (transportAddressPoint(finishGps) && homeGpsReady &&
            regionalPointsReady({lat:finishGps.lat,lon:finishGps.lng},{lat:homeLat,lon:homeLon})) {
          const returnStatus = document.createElement('div');
          returnStatus.className = 'doux';
          returnStatus.setAttribute('role', 'status');
          returnStatus.textContent = 'Retour régional : recherche des itinéraires…';
          panel.appendChild(returnStatus);
          window.CPRegionalRouting.plan({
            signal,
            endpoint: window.CP_REGIONAL_ROUTING_ENDPOINT,
            from: {lat:finishGps.lat, lon:finishGps.lng},
            to: {lat:homeLat, lon:homeLon},
            departure:deliveryDate,
            refresh: !!bt.dataset.transportRefreshAt,
            fetcher:regionalFetch
          }).then(answer => {
            if (!regionalActive() || !returnStatus.isConnected) return;
            const options = answer.itineraries.filter(it =>
              it.startTime >= Date.parse(deliveryDate)).slice(0, 5);
            returnStatus.textContent = options.length ?
              'Retour régional : ' + options.length +
              ' itinéraire(s) théoriques vers le point de domicile enregistré (adresse exacte non vérifiée) :' :
              'Retour régional : aucun itinéraire trouvé. Transport non confirmé — vérifiez vous-même.';
            if (window.CPTransportAdapters && window.CPTransportRanking && options.length) {
              const ranked = window.CPTransportRanking.rank(
                window.CPTransportAdapters.withVerifiedFares(window.CPTransportAdapters.adaptRegional(options,'Régional')));
              if (ranked.length) {
                const summary = document.createElement('p');
                summary.textContent = 'Classement Retour régional théorique : ' +
                  ranked.map(choice => (choice.journey.priceEUR === null && choice.label === 'Moins cher' ? 'Tarif inconnu' : choice.label) + ' (' +
                    choice.journey.durationMinutes + ' min, ' + (choice.journey.priceEUR === null ? 'tarif non vérifié' : choice.journey.priceEUR.toFixed(2).replace('.', ',') + ' € (tarif vérifié)') + ')').join(' · ') +
                  '. Accès au domicile et circulation non confirmés.';
                returnStatus.appendChild(summary);
              }
            }
            options.forEach(option => {
              const line = document.createElement('p');
              const legs = option.legs.map(leg =>
                [leg.mode, leg.route, leg.from + ' → ' + leg.to]
                  .filter(Boolean).join(' ')).join(' · ');
              line.textContent = formatParis(option.startTime) + ' → ' +
                formatParis(option.endTime) + ' · ' + legs +
                ' · horaire théorique, transport non confirmé.';
              returnStatus.appendChild(line);
            });
          }).catch(() => {
            if (regionalActive() && returnStatus.isConnected) returnStatus.textContent =
              'Retour régional : service indisponible. Transport non confirmé — vérifiez vous-même.';
          });
        }
      }
      });
      // Regional outbound itinerary: use only a known home reference point
      // and the exact GPS pickup, with a 30-minute arrival buffer.
      regionalSlot(() => [regionalHome(),regionalPoint(G.coordonnees(m,'origin')),pickupDate,securityMarginMin], (panel,signal) => {
      if (regionalEngineReady && regionalProviderReady && pickupDate) {
        const pickupGps = G.coordonnees(m, 'origin');
        const homeLat = Number(etat.reglages?.domicile_lat);
        const homeLon = Number(etat.reglages?.domicile_lng);
        const homeGpsReady = etat.reglages?.domicile_lat != null &&
          etat.reglages?.domicile_lng != null &&
          window.CPRegionalRouting.validPoint({lat:homeLat,lon:homeLon});
        if (transportAddressPoint(pickupGps) && homeGpsReady &&
            regionalPointsReady({lat:homeLat,lon:homeLon},{lat:pickupGps.lat,lon:pickupGps.lng})) {
          const outboundStatus = document.createElement('div');
          outboundStatus.className = 'doux';
          outboundStatus.setAttribute('role', 'status');
          outboundStatus.textContent = 'Aller régional : recherche des itinéraires…';
          panel.appendChild(outboundStatus);
          const earliest = new Date(Date.parse(pickupDate) - 6 * 3600000);
          window.CPRegionalRouting.plan({
            signal,
            endpoint:window.CP_REGIONAL_ROUTING_ENDPOINT,
            from:{lat:homeLat,lon:homeLon},
            to:{lat:pickupGps.lat,lon:pickupGps.lng},
            departure:earliest.toISOString(),
            ...(!regionalEndpointConfigured ? {arrivalDeadline:
              new Date(Date.parse(pickupDate)-securityMarginMin*60000).toISOString()} : {}),
            refresh: !!bt.dataset.transportRefreshAt,
            fetcher:regionalFetch
          }).then(answer => {
            if (!regionalActive() || !outboundStatus.isConnected) return;
            const options = window.CPRegionalRouting.feasibleBefore(
              answer.itineraries, pickupDate, securityMarginMin).slice(0, 5);
            outboundStatus.textContent = options.length ?
              'Aller régional : ' + options.length +
              ' proposition(s) théoriques depuis le point de domicile enregistré (adresse exacte non vérifiée) :' :
              'Aller régional : aucune arrivée compatible avec la marge minimale de 5 min. Transport non confirmé — vérifiez vous-même.';
            if (window.CPTransportAdapters && window.CPTransportRanking && options.length) {
              const ranked = window.CPTransportRanking.rank(
                window.CPTransportAdapters.withVerifiedFares(window.CPTransportAdapters.adaptRegional(options,'Régional')),
                {deadline:pickupDate,marginMinutes:securityMarginMin});
              if (ranked.length) {
                const rankingLine = document.createElement('p');
                rankingLine.textContent = 'Classement régional théorique : ' +
                  ranked.map(choice => (choice.journey.priceEUR === null && choice.label === 'Moins cher' ? 'Tarif inconnu' : choice.label) + ' (' + choice.journey.durationMinutes +
                    ' min, ' + (choice.journey.priceEUR === null ? 'tarif non vérifié' : choice.journey.priceEUR.toFixed(2).replace('.', ',') + ' € (tarif vérifié)') + ')').join(' · ') +
                  '. Correspondances et trajet complet non confirmés.';
                outboundStatus.appendChild(rankingLine);
              }
            }
            options.forEach(option => {
              const line = document.createElement('p');
              const legs = option.legs.map(leg =>
                [leg.mode, leg.route, leg.from + ' → ' + leg.to]
                  .filter(Boolean).join(' ')).join(' · ');
              line.textContent = formatParis(option.startTime) + ' → ' +
                formatParis(option.endTime) + ' · ' + legs +
                ' · horaire théorique, transport non confirmé.';
              outboundStatus.appendChild(line);
            });
          }).catch(() => {
            if (regionalActive() && outboundStatus.isConnected) outboundStatus.textContent =
              'Aller régional : service indisponible. Transport non confirmé — vérifiez vous-même.';
          });
        }
      }
      });
      // TripGo is optional and uses only a private key saved on this device.
      if (window.CPTripGo) {
        const tripgo=window.CPTripGo,config=document.createElement('div');
        let busRealtime=null;
        try{busRealtime=window.CPBlaBlaRealtime?.createClient({fetcher:regionalFetch,...(window.CP_BLABLACAR_REALTIME_URL?{endpoint:window.CP_BLABLACAR_REALTIME_URL}:{})});}catch(_){}
        config.className='doux';config.style.marginTop='10px';
        const keyInput=document.createElement('input');keyInput.type='password';keyInput.autocomplete='off';
        keyInput.setAttribute('aria-label','Clé TripGo privée sur cet appareil');keyInput.placeholder='Clé TripGo privée';
        const keyStatus=document.createElement('p');
        const keyState=()=>{keyStatus.textContent=tripgo.getKey()?'TripGo actif sur cet appareil. La clé reste privée ; les coordonnées des recherches sont envoyées à TripGo.':'TripGo peut compléter les trajets interurbains. Sa clé privée doit être enregistrée sur cet appareil.';};
        const saveKey=document.createElement('button');saveKey.className='second';saveKey.type='button';saveKey.textContent='Activer TripGo sur cet appareil';
        saveKey.onclick=()=>{try{tripgo.setKey(keyInput.value);keyInput.value='';keyState();bt.cpRefreshRegional?.();}catch(_){keyStatus.textContent='Clé invalide ou stockage de cet appareil indisponible.';}};
        const clearKey=document.createElement('button');clearKey.className='second';clearKey.type='button';clearKey.textContent='Retirer la clé TripGo de cet appareil';
        clearKey.onclick=()=>{try{tripgo.setKey('');keyInput.value='';keyState();bt.cpRefreshRegional?.();}catch(_){keyStatus.textContent='Retrait de la clé impossible sur cet appareil.';}};
        keyState();for(const item of [keyStatus,keyInput,saveKey,clearKey])config.appendChild(item);panel.appendChild(config);
        const tripSearch=(label,inputs)=>regionalSlot(()=>[tripgo.getKey(),inputs()],(target,signal)=>{
          const task=inputs();if(!tripgo.getKey()||!task?.from||!task?.to||!task.when)return;
          const status=document.createElement('div');status.className='doux';status.setAttribute('role','status');
          status.textContent=label+' TripGo : recherche des transports et des marches…';target.appendChild(status);
          tripgo.plan({...task,signal,fetcher:regionalFetch,refresh:!!bt.dataset.transportRefreshAt}).then(answer=>{
            if(!regionalActive()||signal.aborted||!status.isConnected)return;
            const shown=(Array.isArray(answer?.itineraries)?answer.itineraries:[]).filter(result=>Array.isArray(result?.legs)&&result.legs.length>0&&result.legs.every(leg=>leg&&typeof leg==='object')&&Number.isFinite(Date.parse(result.departure))&&Number.isFinite(Date.parse(result.arrival))&&Date.parse(result.arrival)>=Date.parse(result.departure)&&result.evidence&&Array.isArray(result.evidence.missing)&&Number.isFinite(result.evidence.startGapMeters)&&result.evidence.startGapMeters>=0&&Number.isFinite(result.evidence.endGapMeters)&&result.evidence.endGapMeters>=0&&Array.isArray(result.alerts)).slice(0,3);
            status.textContent=label+' TripGo : '+(shown.length?shown.length+' proposition(s) datées, marches comprises.':'aucune proposition compatible retournée ; cela ne prouve pas l’absence de transport.');
            for(const result of shown){
              const line=document.createElement('p');line.textContent=formatParis(result.departure)+' → '+formatParis(new Date(Math.ceil(Date.parse(result.arrival)/60000)*60000).toISOString())+' · '+
                result.legs.map(l=>(l.mode==='wa_wal'?'Marche':l.line||l.mode)+' '+l.from+' → '+l.to).join(' · ')+
                ' · réponse du fournisseur reçue le '+formatParis(answer.receivedAt)+
                ' · raccordement aux coordonnées : '+Math.ceil(result.evidence.startGapMeters)+' m / '+Math.ceil(result.evidence.endGapMeters)+' m (accès physique à vérifier)'+
                (result.alerts.length?' · Alertes fournisseur : '+result.alerts.join(' ; '):'');
              const proof=document.createElement('span');
              const renderProof=confirmed=>{proof.textContent=' · Preuves manquantes : '+result.evidence.missing.filter(item=>!confirmed||!item.startsWith('circulation')).join(', ')+'. Transport non confirmé — vérifiez vous-même.';};
              renderProof(false);line.appendChild(proof);status.appendChild(line);
              if(window.CPBlaBlaRealtime&&Array.isArray(result.legs)&&result.legs.some(window.CPBlaBlaRealtime.eligible)){
                const live=document.createElement('span');live.textContent=' · Prévisions BlaBlaCar Bus : recherche auprès de l’opérateur…';line.appendChild(live);
                if(!busRealtime){live.textContent=' · Prévisions BlaBlaCar Bus indisponibles sur cet appareil. La circulation reste à vérifier.';continue;}
                busRealtime.check(result,task,{signal}).then(check=>{
                  if(!regionalActive()||signal.aborted||!live.isConnected)return;
                  const update=check.updates[0];
                  const label=check.status==='cancelled'?'annulation signalée par l’opérateur':
                    check.status==='missed_boarding'?'départ trop tôt pour l’approche disponible':
                    check.status==='arrival_too_late'?'retard incompatible avec le minimum de 5 min au point GPS exact':
                    update?.status==='observed'?'circulation observée par l’opérateur':
                    update?.status==='predicted'?'prévision reçue de l’opérateur':
                    update?.status==='stale'?'aucune donnée opérateur valide à cet instant':
                    update?.status==='not_matched'?'aucune prévision raccordée à cette course et à ce jour':
                    update?.status==='ambiguous'?'plusieurs versions opérateur incompatibles':'pas de prévision exploitable pour cette course';
                  renderProof(check.serviceConfirmed===true);
                  const exclusions={cancelled:'⛔ Annulation signalée — ne pas retenir ce trajet avant actualisation. ',arrival_too_late:'⛔ Prévision incompatible avec les 5 minutes requises — actualisez avant de retenir ce trajet. ',missed_boarding:'⛔ Embarquement incompatible avec l’approche disponible — actualisez avant de retenir ce trajet. '};
                  if(exclusions[check.status]){const warning=document.createElement('strong');warning.textContent=exclusions[check.status];line.prepend(warning);}
                  live.textContent=' · Prévisions BlaBlaCar Bus : '+label+
                    (check.doorArrival?' · arrivée estimée après la marche finale : '+formatParis(new Date(Math.ceil(Date.parse(check.doorArrival)/60000)*60000).toISOString()):'')+
                    (update?.sourceTimestamp?' · source du '+formatParis(update.sourceTimestamp):'')+'. Accès physique et prix restent à vérifier.';
                  const expires=check.validUntil||update?.validUntil;
                  if(expires&&Date.parse(expires)>Date.now()){const timer=setTimeout(()=>{
                    if(regionalActive()&&live.isConnected){renderProof(false);live.textContent=' · Prévisions BlaBlaCar Bus expirées — actualisez les transports.';}
                  },Math.max(0,Date.parse(expires)-Date.now()));signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});}
                }).catch(()=>{if(regionalActive()&&!signal.aborted&&live.isConnected)live.textContent=' · Prévisions BlaBlaCar Bus indisponibles sur cet appareil. La circulation reste à vérifier.';});
              }
            }
            const credit=document.createElement('p');credit.textContent='Source : TripGo / opérateurs indiqués ; marches : © contributeurs OpenStreetMap. La disponibilité annoncée ne constitue pas une réservation.';const attribution=document.createElement('a');attribution.href='https://www.openstreetmap.org/copyright';attribution.target='_blank';attribution.rel='noopener noreferrer';attribution.textContent=' Attribution OpenStreetMap';credit.appendChild(attribution);status.appendChild(credit);
          }).catch(()=>{if(regionalActive()&&!signal.aborted&&status.isConnected)status.textContent=label+' TripGo indisponible. Horaires, circulation, accès et prix restent à vérifier.';});
        });
        if(pickupDate)tripSearch('Aller',()=>({from:regionalHome(),to:regionalPoint(G.coordonnees(m,'origin')),
          when:new Date(Date.parse(pickupDate)-securityMarginMin*60000).toISOString(),arriveBy:true}));
        if(deliveryDate)tripSearch('Retour',()=>({from:regionalPoint(G.coordonnees(m,'destination')),to:regionalHome(),when:deliveryDate}));
        if(next&&deliveryDate&&next.pickup_start)tripSearch('Jonction',()=>({from:regionalPoint(G.coordonnees(m,'destination')),to:regionalPoint(G.coordonnees(next,'origin')),
          when:deliveryDate,latestArrival:new Date(Date.parse(next.pickup_start)-securityMarginMin*60000).toISOString()}));
      }
      // Statut réel du fichier GTFS quotidien : ne pas annoncer de trajets sans données.
      if (window.CPSibraFeed && typeof window.CPSibraFeed.loadDay === 'function') {
        const daySource = transportDelivery || m.delivery_start || transportPickup;
        const dayDate = new Date(daySource || '');
        if (Number.isFinite(dayDate.getTime())) {
          const dayParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
          }).formatToParts(dayDate);
          const dayPart = type => dayParts.find(part => part.type === type)?.value || '';
          const day = dayPart('year') + '-' + dayPart('month') + '-' + dayPart('day');
          const status = document.createElement('p');
          status.className = 'doux';
          status.setAttribute('role', 'status');
          status.textContent = 'SIBRA ' + day + ' : vérification des horaires GTFS…';
          panel.appendChild(status);
          window.CPSibraFeed.loadDay(day, (url, options) => window.fetch(url + (bt.dataset.transportRefreshAt ? '?refresh=' + encodeURIComponent(bt.dataset.transportRefreshAt) : ''), {...options, cache: bt.dataset.transportRefreshAt ? 'no-store' : 'default'})).then(result => {
            if (!status.isConnected) return;
            status.textContent = result && result.usable ?
              'SIBRA ' + day + ' : données horaires théoriques chargées (' +
              result.data.trips.length + ' courses). Aucun trajet à cette adresse ni circulation en temps réel confirmé.' :
              'SIBRA ' + day + ' : fichier horaire quotidien indisponible. Transport non confirmé — vérifiez vous-même.';
            // Automatic SIBRA suggestions for the mission-to-mission connection.
            // Coordinates are read from the existing mission data, never guessed from a city.
            // Outbound is an indicative city-centre departure, not an exact home
            // address. Only the mission pickup GPS is treated as precise.
            if (typeof window.CPSibraFeed.coordinateDayJourneys === 'function') {
              const pickupGps = G.coordonnees(m, 'origin');
              const homeLat = Number(etat.reglages?.domicile_lat);
              const homeLon = Number(etat.reglages?.domicile_lng);
              const homeKnown = etat.reglages?.domicile_lat != null &&
                etat.reglages?.domicile_lng != null &&
                Number.isFinite(homeLat) && Number.isFinite(homeLon) &&
                Math.abs(homeLat) <= 90 && Math.abs(homeLon) <= 180;
              const outbound = document.createElement('div');
              outbound.className = 'doux';
              outbound.style.marginTop = '8px';
              outbound.setAttribute('role', 'status');
              const pickupMs = Date.parse(transportPickup || '');
              const pickupDay = Number.isFinite(pickupMs) ? (() => {
                const p = new Intl.DateTimeFormat('en-GB', {
                  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
                }).formatToParts(new Date(pickupMs));
                const v = k => p.find(x => x.type === k)?.value || '';
                return v('year') + '-' + v('month') + '-' + v('day');
              })() : '';
              const pickupFeed = pickupDay && pickupDay !== day ?
                window.CPSibraFeed.loadDay(pickupDay, (url, options) => window.fetch(url + (bt.dataset.transportRefreshAt ? '?refresh=' + encodeURIComponent(bt.dataset.transportRefreshAt) : ''), {...options, cache: bt.dataset.transportRefreshAt ? 'no-store' : 'default'})) :
                Promise.resolve(result);
              pickupFeed.then(pickupResult => {
              if (!status.isConnected) return;
              if (transportAddressPoint(pickupGps) && homeKnown &&
                  pickupResult?.usable && Number.isFinite(pickupMs)) {
                const p = new Intl.DateTimeFormat('en-GB', {
                  timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
                  hourCycle: 'h23'
                }).formatToParts(new Date(pickupMs));
                const v = k => Number(p.find(x => x.type === k)?.value || 0);
                const latest = (v('hour') * 60 + v('minute') - securityMarginMin) * 60;
                const rides = window.CPSibraFeed.coordinateDayJourneys(
                  pickupResult.data, homeLat, homeLon, pickupGps.lat, pickupGps.lng, 0,
                  { radiusMeters: 600 }).filter(j =>
                    j.departureSeconds >= Math.ceil(j.originStop.straightLineMeters / 1.2) &&
                    j.arrivalSeconds + Math.ceil(j.destinationStop.straightLineMeters / 1.2) <= latest).slice(0, 5);
                const clock = sec => String(Math.floor(sec / 3600)).padStart(2, '0') +
                  ':' + String(Math.floor(sec % 3600 / 60)).padStart(2, '0');
                const changes = !rides.length &&
                  typeof window.CPSibraFeed.coordinateOneTransferDayJourneys === 'function' ?
                  window.CPSibraFeed.coordinateOneTransferDayJourneys(
                    pickupResult.data, homeLat, homeLon, pickupGps.lat, pickupGps.lng, 0,
                    { radiusMeters: 600, minTransferSeconds: 300, limit: 10 })
                    .filter(j => j.departureSeconds >=
                      Math.ceil(j.originStop.straightLineMeters / 1.2) && j.arrivalSeconds +
                      Math.ceil(j.destinationStop.straightLineMeters / 1.2) <= latest).slice(0, 3) : [];
                outbound.textContent = rides.length ?
                  '🚌 Aller SIBRA indicatif depuis le centre de ' +
                  (etat.reglages.domicile_ville || 'la ville du domicile') + ' : ' +
                  rides.map(j => j.originStop.name + ' ' + clock(j.departureSeconds) +
                    ' → ' + j.destinationStop.name + ' ' + clock(j.arrivalSeconds)).join(' ; ') +
                  '. Marge minimale de 5 min après estimation minimale de marche à 1,2 m/s en ligne droite (non vérifiée). Domicile exact, approche piétonne, tarifs et circulation non vérifiés. Transport non confirmé — vérifiez vous-même.' :
                  (changes.length ?
                    '🚌 Aller SIBRA avec 1 correspondance (horaires théoriques) depuis le centre de ' +
                    (etat.reglages.domicile_ville || 'la ville du domicile') + ' : ' +
                    changes.map(j => j.originStop.name + ' ' + clock(j.departureSeconds) +
                      ' → changement ' + clock(j.firstLeg.arrivalSeconds) + ' / ' +
                      clock(j.secondLeg.departureSeconds) + ' → ' +
                      j.destinationStop.name + ' ' + clock(j.arrivalSeconds)).join(' ; ') +
                    '. Marge minimale de 5 min après estimation minimale de marche à 1,2 m/s en ligne droite (non vérifiée). Domicile exact, marche et circulation non vérifiés. Transport non confirmé — vérifiez vous-même.' :
                    'Aller SIBRA : aucun bus direct ou avec 1 correspondance trouvé avec 5 min de marge minimale depuis le centre de la ville du domicile. Transport non confirmé — vérifiez vous-même.');
              } else {
                outbound.textContent = pickupDay && !pickupResult?.usable ?
                  'Aller SIBRA ' + pickupDay +
                  ' : fichier horaire du jour de prise en charge indisponible. Transport non confirmé — vérifiez vous-même.' :
                  'Aller SIBRA automatique indisponible : point de départ précis (adresse ou GPS), coordonnées du domicile ou heure de prise en charge indisponibles. Un repère de rue seul ne suffit pas.';
              }
              if (status.isConnected) status.insertAdjacentElement('afterend', outbound);
              }).catch(() => {
                if (status.isConnected) {
                  outbound.textContent = 'Aller SIBRA : chargement des horaires impossible. Transport non confirmé — vérifiez vous-même.';
                  status.insertAdjacentElement('afterend', outbound);
                }
              });
            }
            // Return suggestions use the home *city* coordinate, not a precise
            // home address. They must never be presented as door-to-door routes.
            if (result && result.usable &&
                window.CPSibraFeed.coordinateDayJourneys &&
                Number.isFinite(endTime)) {
              const deliveryGps = G.coordonnees(m, 'destination');
              const homeLat = Number(etat.reglages?.domicile_lat);
              const homeLon = Number(etat.reglages?.domicile_lng);
              const homeKnown = etat.reglages?.domicile_lat != null &&
                etat.reglages?.domicile_lng != null &&
                Number.isFinite(homeLat) && Number.isFinite(homeLon) &&
                Math.abs(homeLat) <= 90 && Math.abs(homeLon) <= 180;
              const ret = document.createElement('div');
              ret.className = 'doux';
              ret.style.marginTop = '8px';
              ret.setAttribute('role', 'status');
              if (transportAddressPoint(deliveryGps) && homeKnown) {
                const parts = new Intl.DateTimeFormat('en-GB', {
                  timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
                  hourCycle: 'h23'
                }).formatToParts(new Date(endTime));
                const n = key => Number(parts.find(p => p.type === key)?.value || 0);
                const earliest = (n('hour') * 60 + n('minute')) * 60;
                const args = [result.data, deliveryGps.lat, deliveryGps.lng,
                  homeLat, homeLon, earliest, { radiusMeters: 600 }];
                const direct = window.CPSibraFeed.coordinateDayJourneys(...args);
                const clock = sec => String(Math.floor(sec / 3600)).padStart(2, '0') +
                  ':' + String(Math.floor(sec % 3600 / 60)).padStart(2, '0');
                const show = direct.filter(j => j.departureSeconds >= earliest +
                  Math.ceil(j.originStop.straightLineMeters / 1.2)).slice(0, 5);
                const changes = !show.length &&
                  typeof window.CPSibraFeed.coordinateOneTransferDayJourneys === 'function' ?
                  window.CPSibraFeed.coordinateOneTransferDayJourneys(
                    result.data, deliveryGps.lat, deliveryGps.lng,
                    homeLat, homeLon, earliest,
                    { radiusMeters: 600, minTransferSeconds: 300, limit: 10 })
                    .filter(j => j.departureSeconds >= earliest +
                      Math.ceil(j.originStop.straightLineMeters / 1.2)).slice(0, 3) : [];
                ret.textContent = show.length ?
                  '🚌 Retour SIBRA indicatif vers le centre de ' +
                  (etat.reglages.domicile_ville || 'la ville du domicile') + ' : ' +
                  show.map(j => j.originStop.name + ' ' + clock(j.departureSeconds) +
                    ' → ' + j.destinationStop.name + ' ' + clock(j.arrivalSeconds)).join(' ; ') +
                  '. Le domicile exact n’est PAS géolocalisé. Arrêts dans un rayon de 600 m à vol d’oiseau, marche, tarifs et circulation non vérifiés. Transport non confirmé — vérifiez vous-même.' :
                  (changes.length ?
                    '🚌 Retour SIBRA avec 1 correspondance (horaires théoriques) vers le centre de ' +
                    (etat.reglages.domicile_ville || 'la ville du domicile') + ' : ' +
                    changes.map(j => j.originStop.name + ' ' + clock(j.departureSeconds) +
                      ' → changement ' + clock(j.firstLeg.arrivalSeconds) + ' / ' +
                      clock(j.secondLeg.departureSeconds) + ' → ' +
                      j.destinationStop.name + ' ' + clock(j.arrivalSeconds)).join(' ; ') +
                    '. Même arrêt GTFS pour le changement, domicile exact, marche et circulation non vérifiés. Transport non confirmé — vérifiez vous-même.' :
                    'Retour SIBRA : aucune course directe ou avec 1 correspondance trouvée vers le centre de la ville du domicile. Transport non confirmé — vérifiez vous-même.');
              } else {
                ret.textContent = 'Retour SIBRA automatique indisponible : point de livraison précis (adresse ou GPS) ou coordonnées du domicile indisponibles.';
              }
              if (status.isConnected) status.insertAdjacentElement('afterend', ret);
            }
            if (result && result.usable && next &&
                window.CPSibraFeed.coordinateDayJourneys) {
              const startCoords = G.coordonnees(m, 'destination');
              const endCoords = G.coordonnees(next, 'origin');
              const coordinates = value => {
                if (Array.isArray(value) && value.length >= 2)
                  return [Number(value[0]), Number(value[1])];
                if (value && typeof value === 'object')
                  return [Number(value.lat ?? value.latitude), Number(value.lon ?? value.lng ?? value.longitude)];
                return [NaN, NaN];
              };
              const [startLat, startLon] = coordinates(startCoords);
              const [endLat, endLon] = coordinates(endCoords);
              const auto = document.createElement('div');
              auto.className = 'doux';
              auto.setAttribute('role', 'status');
              auto.style.marginTop = '8px';
              if (transportAddressPoint(startCoords) && transportAddressPoint(endCoords) &&
                  y51ServiceDay === (() => { const d = new Date(next.pickup_start); return Number.isFinite(d.getTime()) ? (() => { const p = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d); const v = k => p.find(x => x.type === k)?.value || ''; return v('year') + '-' + v('month') + '-' + v('day'); })() : ''; })() &&
                  [startLat, startLon, endLat, endLon].every(Number.isFinite) &&
                  Math.abs(startLat) <= 90 && Math.abs(endLat) <= 90 &&
                  Math.abs(startLon) <= 180 && Math.abs(endLon) <= 180 &&
                  Number.isFinite(endTime)) {
                const parisTime = new Intl.DateTimeFormat('en-GB', {
                  timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
                  hourCycle: 'h23'
                }).formatToParts(new Date(endTime));
                const part = key => Number(parisTime.find(p => p.type === key)?.value || 0);
                const earliest = (part('hour') * 60 + part('minute')) * 60;
                const journeys = window.CPSibraFeed.coordinateDayJourneys(
                  result.data, startLat, startLon, endLat, endLon, earliest,
                  { radiusMeters: 600 });
                const clock = seconds => String(Math.floor(seconds / 3600)).padStart(2, '0') +
                  ':' + String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
                const latestArrival = (() => {
                  const p = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
                    hourCycle: 'h23'
                  }).formatToParts(new Date(next.pickup_start));
                  const n = key => Number(p.find(q => q.type === key)?.value || 0);
                  return (n('hour') * 60 + n('minute') - securityMarginMin) * 60;
                })();
                const candidates = journeys.filter(j => j.departureSeconds >= earliest +
                  Math.ceil(j.originStop.straightLineMeters / 1.2) && j.arrivalSeconds +
                  Math.ceil(j.destinationStop.straightLineMeters / 1.2) <= latestArrival).slice(0, 5);
                // Only search a one-change alternative if no direct service fits.
                const changes = !candidates.length &&
                  typeof window.CPSibraFeed.coordinateOneTransferDayJourneys === 'function' ?
                  window.CPSibraFeed.coordinateOneTransferDayJourneys(
                    result.data, startLat, startLon, endLat, endLon, earliest,
                    { radiusMeters: 600, minTransferSeconds: 300, limit: 10 })
                    .filter(j => j.departureSeconds >= earliest +
                      Math.ceil(j.originStop.straightLineMeters / 1.2) && j.arrivalSeconds +
                      Math.ceil(j.destinationStop.straightLineMeters / 1.2) <= latestArrival).slice(0, 3) : [];
                auto.textContent = candidates.length ?
                  '🚌 Jonction SIBRA automatique — horaires théoriques : ' +
                  candidates.map(j => j.originStop.name + ' ' + clock(j.departureSeconds) +
                    ' → ' + j.destinationStop.name + ' ' + clock(j.arrivalSeconds)).join(' ; ') +
                  '. Arrêts à 600 m maximum à vol d’oiseau ; marche minimale à 1,2 m/s prise en compte pour la marge minimale de 5 min, trajet piéton non vérifié. Tarifs et perturbations non vérifiés. Transport non confirmé — vérifiez vous-même.' :
                  (changes.length ?
                    '🚌 Jonction SIBRA avec 1 correspondance (horaires théoriques) : ' +
                    changes.map(j => j.originStop.name + ' ' + clock(j.departureSeconds) +
                      ' → correspondance ' + clock(j.firstLeg.arrivalSeconds) +
                      ' / ' + clock(j.secondLeg.departureSeconds) +
                      ' → ' + j.destinationStop.name + ' ' + clock(j.arrivalSeconds)).join(' ; ') +
                    '. Correspondance au même arrêt GTFS, marche et circulation non vérifiées. Transport non confirmé — vérifiez vous-même.' :
                    'Jonction SIBRA : aucune course directe ou avec une correspondance trouvée à proximité avec la marge minimale de 5 min. Transport non confirmé — vérifiez vous-même.');
              } else {
                auto.textContent = 'Jonction SIBRA automatique indisponible : coordonnées GPS précises des deux missions manquantes, dates différentes ou heure de livraison absente.';
              }
              if (status.isConnected) status.insertAdjacentElement('afterend', auto);
            }
            if (result && result.usable && window.CPSibraFeed.directDayJourneys) {
              const feed = result.data;
              const picker = document.createElement('div');
              picker.className = 'doux';
              const label = document.createElement('strong');
              label.textContent = 'Recherche SIBRA entre deux arrêts (horaires théoriques)';
              picker.appendChild(label);
              const selects = [];
              for (const title of ['Départ', 'Arrivée']) {
                const field = document.createElement('label');
                field.textContent = title + ' : ';
                const select = document.createElement('select');
                const empty = document.createElement('option');
                empty.value = '';
                empty.textContent = 'Choisir un arrêt';
                select.appendChild(empty);
                for (const stop of feed.stops) {
                  const option = document.createElement('option');
                  option.value = String(stop[0]);
                  option.textContent = String(stop[1]);
                  select.appendChild(option);
                }
                field.appendChild(select);
                picker.appendChild(field);
                selects.push(select);
              }
              const timeLabel = document.createElement('label');
              timeLabel.textContent = 'Départ après : ';
              const timeInput = document.createElement('input');
              timeInput.type = 'time';
              timeInput.value = '08:00';
              timeLabel.appendChild(timeInput);
              picker.appendChild(timeLabel);
              const search = document.createElement('button');
              search.type = 'button';
              search.className = 'second';
              search.textContent = 'Chercher les courses SIBRA';
              picker.appendChild(search);
              const output = document.createElement('div');
              output.setAttribute('role', 'status');
              output.textContent = 'Sélectionner deux arrêts pour rechercher des horaires théoriques.';
              picker.appendChild(output);
              search.addEventListener('click', () => {
                const match = /^(\\d{2}):(\\d{2})$/.exec(timeInput.value);
                if (!selects[0].value || !selects[1].value || !match) {
                  output.textContent = 'Sélectionner les arrêts et une heure valide.';
                  return;
                }
                const earliest = (Number(match[1]) * 60 + Number(match[2])) * 60;
                const journeys = window.CPSibraFeed.directDayJourneys(
                  feed, selects[0].value, selects[1].value, earliest, 8);
                const clock = seconds => String(Math.floor(seconds / 3600)).padStart(2, '0') +
                  ':' + String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
                output.textContent = journeys.length ?
                  journeys.map(j => clock(j.departureSeconds) + ' → ' +
                    clock(j.arrivalSeconds) + ' (course ' + j.tripId + ')').join(' ; ') +
                  '. Horaires GTFS théoriques : marche, tarifs, perturbations et circulation non vérifiés.' :
                  'Aucune course directe trouvée à ces arrêts et cette heure. Transport non confirmé — vérifiez vous-même.';
              });
              if (status.isConnected) status.insertAdjacentElement('afterend', picker);
            }
          }).catch(() => {
            if (status.isConnected) status.textContent =
              'SIBRA : erreur de lecture. Transport non confirmé — vérifiez vous-même.';
          });
        }
      }
      if (/albertville/i.test(String(to || '')) && y51ScheduleApplies) {
        const estimate = document.createElement('div');
        estimate.className = 'doux';
        estimate.style.marginTop = '8px';
        estimate.innerHTML = '<label for="cpY51WalkMinutes">🚶 Temps de marche estimé jusqu’à École Saint-François (minutes, à vérifier)</label> ' +
          '<input id="cpY51WalkMinutes" type="number" min="0" max="120" step="1" inputmode="numeric" placeholder="Ex. 10" style="max-width:90px" />' +
          '<label for="cpY51ActualDelivery">Heure réelle de fin de livraison (facultatif)</label> ' +
          '<input id="cpY51ActualDelivery" type="time" />' +
          '<div id="cpY51WalkResult" role="status">Renseigner le temps de marche pour tester la correspondance théorique.</div>' +
          '<div class="doux">Ce champ est une simulation manuelle, pas un calcul GPS. ' +
          'Utiliser le lien « marche vers École Saint-François » pour vérifier le trajet.</div>';
        const backSection = panel.querySelectorAll('div');
        const target = Array.from(backSection).find(el =>
          el.querySelector('strong')?.textContent?.includes('3. Retour au domicile'));
        (target || panel).appendChild(estimate);
        const walkingRoute = document.createElement('a');
        walkingRoute.textContent = '🚶 Ouvrir le trajet piéton précis depuis la livraison';
        walkingRoute.target = '_blank';
        walkingRoute.rel = 'noopener noreferrer';
        if (to) {
          walkingRoute.href = 'https://www.google.com/maps/dir/?api=1&origin=' +
            encodeURIComponent(to) + '&destination=' +
            encodeURIComponent('École Saint-François, Albertville, France') +
            '&travelmode=walking';
          estimate.appendChild(walkingRoute);
        } else {
          const missingAddress = document.createElement('div');
          missingAddress.textContent = 'Adresse exacte de livraison absente : trajet piéton non calculable.';
          estimate.appendChild(missingAddress);
        }
        const routingLink = document.createElement('a');
        routingLink.textContent = '🗺️ Vérifier l’emplacement de l’arrêt École Saint-François';
        routingLink.href = 'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent('Arrêt École Saint-François Y51 Albertville');
        routingLink.target = '_blank';
        routingLink.rel = 'noopener noreferrer';
        estimate.appendChild(routingLink);
        const stopLocationNote = document.createElement('div');
        stopLocationNote.className = 'doux';
        stopLocationNote.textContent = 'Vérifier que la carte pointe vers le quai Y51 direction Annecy : le nom de l’arrêt seul peut être ambigu.';
        estimate.appendChild(stopLocationNote);
        const input = estimate.querySelector('#cpY51WalkMinutes');
        const result = estimate.querySelector('#cpY51WalkResult');
        const actualDeliveryInput = estimate.querySelector('#cpY51ActualDelivery');
        // Conserver uniquement une estimation de marche locale, liée à l’adresse
        // de livraison, sans enregistrer les données de mission ni les identifiants.
        const walkCacheKey = to ?
          'cp_y51_walk_' + encodeURIComponent(String(to).trim().toLowerCase()) : null;
        try {
          const cached = walkCacheKey ? window.localStorage.getItem(walkCacheKey) : null;
          if (cached !== null && /^\d{1,3}$/.test(cached) && Number(cached) <= 120) {
            input.value = cached;
          }
        } catch (_) { /* stockage facultatif sur cet appareil */ }
        const clearWalk = document.createElement('button');
        clearWalk.type = 'button';
        clearWalk.className = 'btnSec';
        clearWalk.textContent = 'Effacer l’estimation enregistrée';
        clearWalk.addEventListener('click', () => {
          try { if (walkCacheKey) window.localStorage.removeItem(walkCacheKey); } catch (_) {}
          input.value = '';
          result.textContent = 'Estimation effacée. Saisir un temps de marche vérifié pour recalculer.';
        });
        estimate.appendChild(clearWalk);
        input.addEventListener('input', () => {
          const n = Number(input.value);
          if (input.value === '') {
            try { if (walkCacheKey) window.localStorage.removeItem(walkCacheKey); } catch (_) {}
            result.textContent = 'Temps de marche non renseigné : aucune correspondance validée.';
            return;
          }
          if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 120) {
            result.textContent = 'Indiquer une durée de marche entière entre 0 et 120 minutes.';
            return;
          }
          try { if (walkCacheKey) window.localStorage.setItem(walkCacheKey, String(n)); } catch (_) {}
          const delivery = new Date(transportDelivery || m.delivery_start || '');
          if (!Number.isFinite(delivery.getTime())) {
            result.textContent = 'Livraison sans horaire : comparaison impossible.';
            return;
          }
          const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
          }).formatToParts(delivery);
          const get = type => Number(parts.find(x => x.type === type)?.value || 0);
          const deliveryDayParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
          }).formatToParts(delivery);
          const dayValue = type => deliveryDayParts.find(x => x.type === type)?.value || '';
          const deliveryDay = dayValue('year') + '-' + dayValue('month') + '-' + dayValue('day');
          if (deliveryDay !== y51ServiceDay) {
            result.textContent = 'Date de livraison incohérente avec la date du service Y51 : vérification nécessaire.';
            return;
          }
          const actualValue = actualDeliveryInput.value;
          const actualMatch = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(actualValue);
          if (actualValue && !actualMatch) {
            result.textContent = 'Heure réelle de livraison invalide : saisir une heure entre 00:00 et 23:59.';
            return;
          }
          const finishMinutes = actualMatch ?
            Number(actualMatch[1]) * 60 + Number(actualMatch[2]) :
            get('hour') * 60 + get('minute');
          // Une saisie d’heure seule ne permet pas de changer de date :
          // le car de 11 h 48 ne doit jamais être raccordé au jour suivant.
          const scheduledMinutes = get('hour') * 60 + get('minute');
          if (actualMatch && Math.abs(finishMinutes - scheduledMinutes) > 720) {
            result.textContent = 'Écart supérieur à 12 h : vérifier la date réelle de livraison avant de calculer le Y51.';
            return;
          }
          if (!transportDelivery && !actualMatch) {
            result.textContent = 'Heure de fin de livraison non renseignée : saisir l’heure réelle pour calculer la correspondance. ' +
              'L’heure de début de livraison ne peut pas servir d’heure de fin.';
            return;
          }
          const available = 11 * 60 + 43 - finishMinutes;
          const remaining = available - n;
          const arrivalAtStop = finishMinutes + n;
          const latestDeparture = 11 * 60 + 43 - n;
          const hhmm = minutes => String(Math.floor(minutes / 60)).padStart(2, '0') +
            ' h ' + String(minutes % 60).padStart(2, '0');
          // Un horaire positif ne prouve pas que le chemin piéton ni le car sont disponibles.
          const marginAssessment = remaining < 0 ?
            'Correspondance théorique impossible.' :
            remaining < 15 ?
              '⚠️ Marge faible (moins de 15 min) : correspondance fragile en cas de retard.' :
              remaining < 30 ?
                'Marge de 15 à 29 min : prévoir les aléas de livraison et de marche.' :
                'Marge d’au moins 30 min avant l’arrivée recommandée à l’arrêt.';
          result.textContent = remaining >= 0 ?
            'Si départ dès la fin de livraison : arrivée estimée à l’arrêt à ' +
            hhmm(arrivalAtStop) + '. Départ du lieu de livraison au plus tard à ' +
            hhmm(latestDeparture) + ' pour être à l’arrêt à 11 h 43. Marge théorique : ' +
            remaining + ' min. ' + marginAssessment +
            ' Marche et circulation non confirmées.' :
            '⚠️ Correspondance théorique impossible : arrivée estimée à l’arrêt à ' +
            hhmm(arrivalAtStop) + ', soit ' + (-remaining) +
            ' min après 11 h 43. Départ nécessaire au plus tard à ' + hhmm(latestDeparture) + '.';
        });
        actualDeliveryInput.addEventListener('input', () => {
          if (input.value !== '') {
            input.dispatchEvent(new Event('input'));
            return;
          }
          const value = actualDeliveryInput.value;
          if (!value) {
            result.textContent = 'Renseigner le temps de marche pour tester la correspondance théorique.';
            return;
          }
          const match = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(value);
          if (!match) {
            result.textContent = 'Heure réelle invalide : utiliser le format HH:MM.';
            return;
          }
          const minutes = Number(match[1]) * 60 + Number(match[2]);
          result.textContent = minutes >= 11 * 60 + 43 ?
            '⚠️ Le départ Y51 de 11 h 48 n’est plus atteignable avec les 5 min d’avance, même sans marche. Chercher un autre départ.' :
            'Fin de livraison avant 11 h 43 : indiquer le temps de marche pour vérifier la correspondance.';
        });
        if (input.value !== '') input.dispatchEvent(new Event('input'));
      }
      bt.setAttribute('aria-controls', panel.id);
      bt.setAttribute('aria-expanded', 'true');
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Détails des transports de la mission');
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        stopGTFSTransports();
        console.error('Transports mission : affichage incomplet', error);
        panel.innerHTML = '<div class="bkt">🚌 TRANSPORTS DE LA MISSION</div><p role="alert">Impossible de calculer les détails de transport pour cette mission. Transport non confirmé — vérifiez vous-même.</p>';
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }; }

    { const br = $('btnRetirer'); if (br) br.onclick = () => { if (!window.confirm('Retirer cette mission de ton Agenda sur ce téléphone ? (rien n’est supprimé chez Hiflow ni sur le serveur ; tu peux tout remettre dans Réglages)')) return; const t = lireLocal('cp_masquees', []) || []; const k = m.platform + '|' + m.external_id; if (!t.includes(k)) t.push(k); ecrireLocal('cp_masquees', t); etat.missions = etat.missions.filter(x => !(x.kind === 'acceptee' && x.platform + '|' + x.external_id === k)); ecrireLocal('cp_cache', { missions: etat.missions, alertes: etat.alertes, reglages: etat.reglages, chargeLe: etat.chargeLe, factures: etat.factures }); $('feuille').hidden = true; afficher(); toast('Retirée de l’Agenda'); }; }
    const transportDetailButton = $('btnTransportsMission');
    pointsMission(m, () => {
      if ($('btnTransportsMission') !== transportDetailButton || $('feuille').hidden) return;
      if ($('gpsO')) $('gpsO').innerHTML = mentionGps(m, 'origin');
      if ($('gpsD')) $('gpsD').innerHTML = mentionGps(m, 'destination');
      const openPanel = $('cpTransportMissionDetails');
      if (openPanel && !openPanel.hidden) {
        transportDetailButton.cpRefreshGTFS?.();
        transportDetailButton.cpRefreshRegional?.();
      }
    });
  }

  // ---------- V77 : notifications même application fermée (Web Push) ----------
  const estIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installee = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const b64uEnOctets = s => { const p = s.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(p + '==='.slice((p.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  async function abonnementActuel() { try { const reg = await navigator.serviceWorker?.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch (_) { return null; } }
  async function etatNotifications() {
    const el = $('notifEtat'), bt = $('notifBoutons'); if (!el) return;
    const bouton = (id, txt, cls) => `<button id="${id}"${cls ? ' class="' + cls + '"' : ''}>${txt}</button>`;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      el.textContent = estIOS && !installee() ? 'Sur iPhone, ajoute d’abord l’application à l’écran d’accueil (bouton Partager → « Sur l’écran d’accueil »), puis ouvre-la depuis son icône : les notifications deviendront disponibles.' : 'Ce navigateur ne prend pas en charge les notifications. Sur Android, utilise Chrome ; sur iPhone, l’application installée sur l’écran d’accueil (iOS 16.4 ou plus récent).';
      bt.innerHTML = ''; return;
    }
    if (Notification.permission === 'denied') { el.textContent = 'Notifications refusées : autorise-les dans les réglages du téléphone (Notifications → Convoyage Ultra), puis reviens ici.'; bt.innerHTML = ''; return; }
    const sub = await abonnementActuel();
    if (sub && Notification.permission === 'granted') {
      el.textContent = 'Activées sur cet appareil : tu es prévenu même application fermée (nouvelle mission, hausse de prix, mission acceptée), dès que l’extension de ton ordinateur synchronise.';
      bt.innerHTML = bouton('nTest', 'Envoyer un test', 'second') + bouton('nOff', 'Désactiver', 'danger');
      $('nTest').onclick = async () => { try { const r = await api.testNotification(); toast(r.envoyees ? 'Notification de test envoyée' : 'Aucun appareil abonné'); } catch (e) { toast(e.message); } };
      $('nOff').onclick = async () => { try { await api.desabonnerPush(sub.endpoint); await sub.unsubscribe(); toast('Notifications désactivées sur cet appareil'); } catch (e) { toast(e.message); } etatNotifications(); };
    } else {
      el.textContent = 'Désactivées. Active-les pour être prévenu même quand l’application est fermée.';
      bt.innerHTML = bouton('nOn', 'Activer les notifications');
      $('nOn').onclick = activerNotifications;
    }
  }
  async function activerNotifications() {
    try {
      const perm = await Notification.requestPermission(); if (perm !== 'granted') { toast('Autorisation refusée'); return etatNotifications(); }
      const reg = await navigator.serviceWorker.ready;
      const cle = await api.cleNotifications();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uEnOctets(cle) });
      const j = sub.toJSON();
      await api.abonnerPush({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, appareil: (estIOS ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Ordinateur') + ' · ' + new Date().toLocaleDateString('fr-FR') });
      await api.testNotification().catch(() => {});
      toast('Notifications activées : une notification de test arrive');
    } catch (e) { toast(String(e.message || e)); }
    etatNotifications();
  }
  function memoriser() { ecrireLocal('cp_preferences', { filtre: etat.filtre, recherche: etat.recherche, tri: etat.tri, zones: etat.zones, cote: etat.cote, rayon: etat.rayon, plan: etat.plan, plus: etat.plus, posMax: etat.posMax }); }

  // ---------- Navigation ----------
  for (const b of document.querySelectorAll('#onglets button')) b.onclick = () => { etat.onglet = b.dataset.onglet; afficher(); window.scrollTo(0, 0); };
  $('actualiser').onclick = () => charger(false);
  $('pastille').onclick = feuilleEtat;
  setInterval(majPastille, 30000);
  $('fermer').onclick = () => { stopGTFSTransports(); $('feuille').hidden = true; };
  $('feuille').onclick = ev => { if (ev.target === $('feuille')) { stopGTFSTransports(); $('feuille').hidden = true; } };
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { stopGTFSTransports(); $('feuille').hidden = true; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') charger(true); });
  setInterval(() => { if (document.visibilityState === 'visible') charger(true); }, 60000);

  if (location.hash === '#alertes') etat.onglet = 'alertes';
  // V90 : notification touchée → la fiche de SA mission s'ouvre directement (bouton « Faire le devis » en haut).
  let missionDemandee = null;
  function lireLien() { const h = location.hash.match(/^#mission=([^|]+)\|(.+)$/) || decodeURIComponent(location.hash).match(/^#mission=([^|]+)\|(.+)$/); if (h) missionDemandee = { platform: decodeURIComponent(h[1]), id: decodeURIComponent(h[2]) }; }
  function ouvrirMissionDemandee() {
    if (!missionDemandee) return false;
    const l = etat.missions.filter(m => m.platform === missionDemandee.platform && String(m.external_id) === missionDemandee.id);
    const m = l.find(x => x.kind !== 'acceptee') || l[0]; if (!m) return false;
    missionDemandee = null; try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    detail(m); return true;
  }
  window.__cpOuvrirMissionDemandee = ouvrirMissionDemandee;
  lireLien();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && etat.posMax > 0 && etat.onglet === 'missions' && !positionRecente(15)) localiser(false); });
  window.addEventListener('hashchange', () => { if (location.hash === '#alertes') { etat.onglet = 'alertes'; afficher(); } lireLien(); ouvrirMissionDemandee(); });
  // V122 : styles de l'application (couleurs + polices), inspirés de l'icône : noir & or, rouge, crépuscule, jour contrasté. Le bouton 🎨 fait défiler les styles.
  const STYLES = [['classique', 'Classique'], ['ultra', 'Ultra (noir & or)'], ['braise', 'Braise (noir & rouge)'], ['crepuscule', 'Crépuscule (violet & orange)'], ['jour', 'Jour contrasté (bleu & jaune)']];
  const styleCourant = () => { try { const v = localStorage.getItem('cp_style'); return STYLES.some(x => x[0] === v) ? v : 'ultra'; } catch (_) { return 'ultra'; } };
  const appliquerStyle = v => { document.documentElement.dataset.style = v; const c = { ultra: '#0a0a0a', braise: '#1a0608', crepuscule: '#1b1030', jour: '#0c4a6e', classique: '#101827' }[v]; const m = document.querySelector('meta[name="theme-color"]'); if (m && c) m.content = c; };
  appliquerStyle(styleCourant());
  // V138 : polices au choix (polices du téléphone, aucune ne se télécharge) ; le bouton « Aa » les fait défiler.
  const POLICES = [['standard', 'Standard'], ['lisible', 'Lisible (Verdana)'], ['classique', 'Classique (Georgia)'], ['arrondie', 'Arrondie'], ['machine', 'Machine (chiffres alignés)'], ['grande', 'Grande taille']];
  const policeCourante = () => { try { const v = localStorage.getItem('cp_police'); return POLICES.some(x => x[0] === v) ? v : 'standard'; } catch (_) { return 'standard'; } };
  document.documentElement.dataset.police = policeCourante();
  { const b = document.getElementById('policeBtn'); if (b) b.onclick = () => { const i = POLICES.findIndex(x => x[0] === policeCourante()), n = POLICES[(i + 1) % POLICES.length]; try { localStorage.setItem('cp_police', n[0]); } catch (_) {} document.documentElement.dataset.police = n[0]; const t = document.getElementById('sousTitre'); if (t) t.textContent = 'Police : ' + n[1]; }; }
  { const b = document.getElementById('styleBtn'); if (b) b.onclick = () => { const i = STYLES.findIndex(x => x[0] === styleCourant()), n = STYLES[(i + 1) % STYLES.length]; try { localStorage.setItem('cp_style', n[0]); } catch (_) {} appliquerStyle(n[0]); const t = document.getElementById('sousTitre'); if (t) t.textContent = 'Style : ' + n[1]; }; }
  // V242 : lien reçu par e-mail (invitation ou mot de passe oublié) → l'adresse contient une connexion temporaire : on demande de choisir un mot de passe.
  function lienAcces() {
    try {
      const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
      const t = h.get('access_token'), ty = h.get('type');
      if (t && (ty === 'invite' || ty === 'recovery')) return { token: t, refresh: h.get('refresh_token') || '', exp: Number(h.get('expires_in')) || 3600, type: ty };
    } catch (_) {}
    return null;
  }
  function erreurLien() {
    try {
      const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
      if (h.get('error') || h.get('error_code')) { history.replaceState(null, '', location.pathname + location.search); return 'Ce lien a expiré ou a déjà été utilisé. Appuyez sur « Mot de passe oublié ? » pour recevoir un nouveau lien.'; }
    } catch (_) {}
    return '';
  }
  function ecranMotDePasse(lien) {
    try { api.deconnexion(); } catch (_) {}
    $('onglets').hidden = true; $('actualiser').hidden = true; $('pastille').hidden = true; $('sousTitre').textContent = lien.type === 'invite' ? 'Bienvenue' : 'Nouveau mot de passe';
    $('ecran').innerHTML = `<div class="carte"><h2>${lien.type === 'invite' ? 'Bienvenue sur Convoyage Ultra' : 'Nouveau mot de passe'}</h2>
      <p class="doux">Choisissez votre mot de passe (8 caractères minimum). Vous l’utiliserez pour vous connecter ensuite.</p>
      <label for="mp1">Mot de passe</label><input id="mp1" type="password" autocomplete="new-password">
      <label for="mp2">Confirmez le mot de passe</label><input id="mp2" type="password" autocomplete="new-password">
      <div class="erreur" id="mpErr" hidden></div>
      <button id="mpOk" style="width:100%;margin-top:14px">Enregistrer et entrer</button></div>`;
    $('mpOk').onclick = async () => {
      const a = $('mp1').value, b = $('mp2').value, err = $('mpErr');
      if (a.length < 8) { err.textContent = 'Le mot de passe doit faire 8 caractères au minimum.'; err.hidden = false; return; }
      if (a !== b) { err.textContent = 'Les deux mots de passe ne sont pas identiques.'; err.hidden = false; return; }
      $('mpOk').disabled = true;
      try {
        const r = await fetch(api.url + '/auth/v1/user', { method: 'PUT', headers: { apikey: api.cle, authorization: 'Bearer ' + lien.token, 'content-type': 'application/json' }, body: JSON.stringify({ password: a }) });
        let j = null; try { j = await r.json(); } catch (_) {}
        if (!r.ok) throw new Error((j && (j.msg || j.message || j.error_description)) || ('Erreur ' + r.status));
        api._garder({ access_token: lien.token, refresh_token: lien.refresh, expires_in: lien.exp, user: j });
        history.replaceState(null, '', location.pathname + location.search);
        demarrer();
      } catch (x) { err.textContent = 'Impossible : ' + String(x.message || x); err.hidden = false; $('mpOk').disabled = false; }
    };
  }
  function demarrer() {
    if (!api) return ecranConfiguration();
    const lien = lienAcces(); if (lien) return ecranMotDePasse(lien);
    if (!api.connecte) return ecranConnexion(erreurLien());
    afficher(); charger(true); setTimeout(questionPause, 1200);
    setTimeout(autoMajPeagesSiNecessaire, 4000);   // V243 : après l'affichage, sans gêner le démarrage ; indépendant de la connexion aux plateformes
    // V246 (demande de Laurent) : communes des pays limitrophes (Suisse, Belgique, Luxembourg, Allemagne, Italie,
    // Espagne, Monaco, Andorre), chargées une fois au démarrage pour que le filtre « Ville + rayon » et les distances
    // sachent repérer ces villes sans attendre une recherche réseau par mission.
    setTimeout(() => { G.chargerVillesFrontalieres(u => fetch(u)).then(n => { if (n) try { listeMissions(); } catch (_) {} }).catch(() => {}); }, 2000);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) { try { navigator.serviceWorker.register('sw.js'); } catch (_) {} }
  window.__cp = { etat, charger };
  demarrer();
})();
 


