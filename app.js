Warning: truncated output (original token count: 89842)
Total output lines: 3753

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
  const PLATS = { Hiflow: 'Hiflow', DriiveMe: 'DriiveMe', Otoqi: 'Otoqi', PopValet: 'Pop Valet', DeliveryCar: 'Delivery Car' };
  const clsPlat = p => ' plat-' + String(p || '').replace(/[^A-Za-z]/g, '');   // V122 : couleur de fond et de police propres à chaque plateforme
  // V83 : édition (une par plateforme, ou personnelle) : seules ses plateformes sont affichées.
  const EDITION = window.CP_EDITION || { code: 'personnelle', nom: 'Convoyage Ultra', plateformes: Object.keys(PLATS) };
  // V139 : missions que TOI as retirées de l'Agenda (« pas acceptée ») : mémorisées sur ce téléphone, jamais effacées du serveur.
  const masquees = () => new Set(lireLocal('cp_masquees', []) || []);
  // V276 : une mission DriiveMe « disponible » qui n'a plus été vue depuis plus de 90 min alors que l'APK a lu DriiveMe depuis (autres missions plus récentes) n'est plus sur le site : on la retire.
  const deLEdition = l => { const mq = masquees(); return (l || []).filter(m => EDITION.plateformes.includes(m.platform) && !(m.kind === 'acceptee' && mq.has(m.platform + '|' + m.external_id)) && !(m.kind === 'acceptee' && m.platform === 'Hiflow' && m.status === 'annulee')); };   // V278 : une mission Hiflow annulée quitte l'Agenda et redevient disponible
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
  // V301 : la copie locale (cp_cache) est plafonnée à ~1,2 Mo : des milliers de missions remplissaient les 5 Mo du téléphone et bloquaient tout enregistrement (choix des plateformes compris).
const ecrireLocal = (k, v) => { const ess = x => { try { localStorage.setItem(k, JSON.stringify(x)); return true; } catch (_) { return false; } }; try { if (k === 'cp_cache' && v && Array.isArray(v.missions)) { let ms = v.missions, s = JSON.stringify({ ...v, missions: ms }); while (s.length > 1200000 && ms.length > 50) { ms = ms.slice(0, Math.floor(ms.length / 2)); s = JSON.stringify({ ...v, missions: ms }); } if (ess({ ...v, missions: ms })) return; try { localStorage.removeItem(k); } catch (_) {} for (const m of [400, 150, 50]) if (ess({ ...v, missions: ms.slice(0, m) })) return; return; } ess(v); } catch (_) {} };
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
  const fmtDate = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const heure = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const jourCourt = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }); };
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
      const net = ''; // Pas de net affiché sans coût total des transports vérifié.
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
    try { for (const m of etat.missions.slice(0, 400)) for (const cote of ['origin', 'destination']) { if (nb >= 25) break; const cle = G.cleAdresse(m, cote); const cached = cle && G.POINTS[cle]; const streetNeedsLookup = G.aAdresseRue?.(m, cote) && cached?.precision === 'ville'; if (!cle || (cached && !streetNeedsLookup) || (gpsMem.rate[cle] && Date.now() - gpsMem.rate[cle] < 864e5)) continue; const c0 = m[cote]; if (c0 && Number.isFinite(Number(c0.lat)) && Number(c0.lat) !== 0) continue; nb++;
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
      const cached = cle && G.POINTS[cle];
      if (!cle || (cached && !(G.aAdresseRue?.(m, cote) && cached.precision === 'ville'))) return;
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
    const pre = cote === 'origin' ? 'from' : 'to';
    const a = m[cote + '_address'] || m[pre + '_address'] || (cote === 'origin' ? m.pickup_address : (m.delivery_address || m.dropoff_address)) ||
      (m[cote] && (m[cote].address || m[cote].street)) ||
      (m.mail_info && m.mail_info[cote === 'origin' ? 'depart' : 'arrivee'] && m.mail_info[cote === 'origin' ? 'depart' : 'arrivee'].adresse); if (a) return a;
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
  const verifLe = m => { if (m.platform === 'DriiveMe') { const t0 = Date.parse(m.last_seen_at || ''); if (Number.isFinite(t0)) return 'Disponible (vérifié le ' + new Date(t0).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }) + ' à ' + heureP(t0) + ')'; } const s = (etat.sources || []).find(x => cleP(x.platform) === cleP(m.platform)); const t = s ? Date.parse(s.lu_le || '') : NaN; if (!Number.isFinite(t)) return 'Disponible'; const d = new Date(t); return 'Disponible (vérifié le ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }) + ' à ' + heureP(t) + ')'; };
  // V273 : pastille « Disponible (vérifié le … à …) » sur TOUTES les fiches et cartes ; mission acceptée (agenda) : « Mission acceptée vérifiée le … à … » (une annulation reste possible)
  const verifPast = m => { const s = verifLe(m); const dev = typeof devisAccepte === 'function' && devisAccepte(m); if (m.kind !== 'acceptee' && !dev) return s; const r = /\(vérifié le (.*)\)$/.exec(s); return dev ? (r ? 'Devis accepté vérifié le ' + r[1] : 'Devis accepté') : (r ? 'Mission acceptée vérifiée le ' + r[1] : 'Mission acceptée'); };
  // V272 : date et heure de la dernière vérification de CETTE mission (DriiveMe : dernière fois vue dans la liste) dans la fiche
  const verifFiche = m => { let t = m.platform === 'DriiveMe' ? Date.parse(m.last_seen_at || '') : NaN; if (!Number.isFinite(t)) { const s = (etat.sources || []).find(x => cleP(x.platform) === cleP(m.platform)); t = s ? Date.parse(s.lu_le || '') : NaN; } if (!Number.isFinite(t)) t = Date.parse(m.last_seen_at || ''); if (!Number.isFinite(t)) return ''; const age = Math.max(0, Math.round((Date.now() - t) / 60000)); const ago = age < 60 ? 'il y a ' + age + ' min' : 'il y a ' + Math.floor(age / 60) + ' h' + (age % 60 ? ' ' + String(age % 60).padStart(2, '0') : ''); return 'dernière vérification le ' + new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }) + ' à ' + heureP(t) + ' (' + ago + ')' + (m.platform === 'DriiveMe' && age > 90 ? ' ⚠️ ancienne : vérifie sur le site' : ''); };
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
  const prixKm = (m, r) => { const km = Number(m.distance_km), f = Number(m.fee); if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(f) || m.fee === null) return ''; return '<div class="prixKm">' + (f / km).toFixed(2).replace('.', ',') + ' € /km</div>'; };
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
      <span><div class="prix">${m.fee != null ? esc(euros(m.fee)) : '—'}</div>${prixVar(m)}${prixKm(m, r)}</span></div>
      ${reste != null && reste > 0 && reste < SEUIL_URGENT_H && !estPassee(m) ? `<div class="urgence">⏳ Plus que ${esc(reste < 1 ? Math.max(1, Math.round(reste * 60)) + ' min' : Math.round(reste) + ' h')} pour la faire</div>` : ''}<div class="trajet">${trajetHtml(m)}</div>${adrHtml(m)}
      <div class="meta">${datesHtml || bkDates(m, hfDates(m) ? fmtDate(hfLiv(m)) : arriveeTxt(m))}
      ${devisAccepte(m) ? '<div style="background:#c9f2cf;color:#173;border-radius:8px;padding:4px 8px;margin:4px 0;font-weight:600">✅ Devis accepté</div>' : ''}${m.fees && m.fees.devis_numero && m.kind !== 'acceptee' && m.fees.devis_accepte !== 1 ? '<div style="background:#ffe8a3;color:#222;border-radius:8px;padding:4px 8px;margin:4px 0;font-weight:600">📝 Devis envoyé</div>' : ''}${vehHtml(m)}${blocKm(m, true)}${sugHtml(m)}</div>${extra || ''}</button>`;
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
        ${g.lignes.map(x => `<div class="factureLigne" data-afacturer="${esc(x.mission.external_id)}"><span><b>${lieu(x.mission.from_city, x.mission.from_department)} → ${lieu(x.mission.to_city, x.mission.to_department)}</b> · ${x.date != null ? esc(jour(new Date(x.date).toISOString())) : 'date ?'}</span><span>${x.mission.annulee_par_moi ? '' : esc(euros(x.prestation))} <span class="etiq ${x.annulee ? 'ko' : 'nv'}">${x.annulee ? (x.mission.annulee_par_moi ? 'annulée par toi — pénalité possible : ' + (x.mission.penalite_plateforme != null ? esc(euros(x.mission.penalite_plateforme)) : 'montant à confirmer') : x.confirme ? 'annulée — payée' : 'annulée — payée si annulation tardive') : 'effectuée'}</span>${x.etat === 1 ? ' <span class="etiq nv">à valider sur Hiflow</span>' : x.etat === 2 ? ' <…49842 tokens truncated…arriveBy,limit:6})
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
      // Présentation gare-à-gare historique désactivée : elle doublonnait les cartes
      // de la fiche et invitait à chercher manuellement des arrêts. Le moteur SNCF
      // reste actif via CPTransportMissionHub.makeProviders (sncf_fallback), où ses
      // résultats sont comparés aux autres modes et marches porte-à-porte.
      // Conserver temporairement l'ancien code pour retrait après tests de régression.
      if (false && window.CPSncfFallback && typeof window.CPSncfFallback.plan === 'function') {
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
        const railSearch = (label,inputs) => regionalSlot(label, () => {
          const v=inputs();
          return [stationKey(v.fromStation),stationKey(v.toStation),v.when,v.arriveBy,v.latestArrival];
        }, (panel,signal) => {
          const {fromStation,toStation,when,arriveBy,latestArrival}=inputs();
          const latestArrivalMs=latestArrival==null?null:
            typeof latestArrival==='number'?latestArrival:Date.parse(latestArrival);
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
            const itineraries = answer.itineraries.filter(it => latestArrivalMs===null || Date.parse(it.arrival) <= latestArrivalMs).slice(0,3);
            status.textContent = label + ' — secours SNCF, horaires théoriques du flux ' + answer.sourceVersion + ' : ' +
              (itineraries.length ? itineraries.length + ' proposition(s) de gare à gare.' :
              answer.status === 'stations_not_found' ? 'gare non identifiée pour une des communes.' :
              'aucun train direct ou avec une correspondance trouvé dans les journées chargées.');
            if (window.CPTransportAdapters && window.CPTransportRanking) {
              const normalized = window.CPTransportAdapters.withVerifiedFares(window.CPTransportAdapters.adaptSNCF(itineraries));
              const deadline = label === 'Aller' && pickupDate ? pickupDate :
                label === 'Jonction' && next?.pickup_start ? next.pickup_start : null;
              const choices = window.CPTransportRanking.rank(normalized,{
                deadline,earliestDeparture:label === 'Retour' || label === 'Jonction' ? deliveryDate : null,
                direction:label === 'Retour' ? 'return' : 'outbound',marginMinutes:securityMarginMin});
              if (choices.length) {
                const summary = document.createElement('p');
                summary.textContent = 'Classement SNCF de gare à gare. Aucun trajet complet confirmé.';
                status.appendChild(summary);
                showRegionalChoices(status, choices, label + ' SNCF · comparer (gare à gare)');
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
          when:new Date(Date.parse(pickupDate)-securityMarginMin*60000).toISOString(),arriveBy:true,latestArrival:new Date(Date.parse(pickupDate)-securityMarginMin*60000).toISOString()}));
        if (deliveryDate) railSearch('Retour',()=>({fromStation:missionStation(m,'destination'),toStation:homeStation(),when:deliveryDate,arriveBy:false}));
        if (next && deliveryDate) railSearch('Jonction',()=>({fromStation:missionStation(m,'destination'),
          toStation:missionStation(next,'origin'),when:deliveryDate,arriveBy:false,
          latestArrival:Date.parse(next.pickup_start)-securityMarginMin*60000}));
      }
      // Regional return from the exact delivery point to the configured home
      // coordinate (which may only represent a city centre, not a door).
      regionalSlot('Retour', () => [regionalPoint(G.coordonnees(m,'destination')),regionalHome(),deliveryDate], (panel,signal) => {
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
                window.CPTransportAdapters.withVerifiedFares(window.CPTransportAdapters.adaptRegional(options,'Régional')),
                {direction:'return',earliestDeparture:deliveryDate});
              if (ranked.length) {
                showRegionalChoices(returnStatus, ranked, 'Retour · comparer');
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
      regionalSlot('Aller', () => [regionalHome(),regionalPoint(G.coordonnees(m,'origin')),pickupDate,securityMarginMin], (panel,signal) => {
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
              'Aller régional : aucune arrivée compatible avec la marge minimale de 15 min. Transport non confirmé — vérifiez vous-même.';
            if (window.CPTransportAdapters && window.CPTransportRanking && options.length) {
              const ranked = window.CPTransportRanking.rank(
                window.CPTransportAdapters.withVerifiedFares(window.CPTransportAdapters.adaptRegional(options,'Régional')),
                {deadline:pickupDate,marginMinutes:securityMarginMin});
              if (ranked.length) {
                showRegionalChoices(outboundStatus, ranked, 'Aller · comparer');
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
      // TripGo retiré des moteurs (17/11/2026, demande de Laurent) : champ de clé et recherches masqués.
      if (false && window.CPTripGo) {
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
        keyState();for(const item of [keyStatus,keyInput,saveKey,clearKey])config.appendChild(item);sourcePanel.appendChild(config);
        const tripSearch=(label,inputs)=>regionalSlot(label,()=>[tripgo.getKey(),inputs()],(target,signal)=>{
          const task=inputs();if(!tripgo.getKey()||!task?.from||!task?.to||!task.when)return;
          const status=document.createElement('div');status.className='doux';status.setAttribute('role','status');
          status.textContent=label+' TripGo : recherche des transports et des marches…';target.appendChild(status);
          tripgo.plan({...task,signal,fetcher:regionalFetch,refresh:!!bt.dataset.transportRefreshAt}).then(answer=>{
            if(!regionalActive()||signal.aborted||!status.isConnected)return;
            const shown=(Array.isArray(answer?.itineraries)?answer.itineraries:[]).filter(result=>Array.isArray(result?.legs)&&result.legs.length>0&&result.legs.every(leg=>leg&&typeof leg==='object'&&Number.isFinite(Date.parse(leg.departure))&&Number.isFinite(Date.parse(leg.arrival))&&Date.parse(leg.arrival)>=Date.parse(leg.departure))&&result.legs.every((leg,index)=>index===0||Date.parse(leg.departure)>=Date.parse(result.legs[index-1].arrival))&&Number.isFinite(Date.parse(result.departure))&&Number.isFinite(Date.parse(result.arrival))&&Date.parse(result.arrival)>=Date.parse(result.departure)&&Date.parse(result.legs[0].departure)===Date.parse(result.departure)&&Date.parse(result.legs[result.legs.length-1].arrival)===Date.parse(result.arrival)&&(!task.latestArrival||Date.parse(result.arrival)<=Date.parse(task.latestArrival))&&result.evidence&&Array.isArray(result.evidence.missing)&&Number.isFinite(result.evidence.startGapMeters)&&result.evidence.startGapMeters>=0&&Number.isFinite(result.evidence.endGapMeters)&&result.evidence.endGapMeters>=0&&Array.isArray(result.alerts)).slice(0,3);
            status.textContent=label+' TripGo : '+(shown.length?shown.length+' proposition(s) datées, marches comprises.':'aucune proposition compatible retournée ; cela ne prouve pas l’absence de transport.');
            if(shown.length){
              const heading=document.createElement('h4');heading.textContent=label+' TripGo · comparer';status.appendChild(heading);
            }
            for(const [resultIndex,result] of shown.entries()){
              const details=document.createElement('details');details.setAttribute('data-tripgo-details','');
              details.style.cssText='padding:12px;border:1px solid #94a3b8;border-radius:12px;line-height:1.5;min-width:0;margin:10px 0';
              const summary=document.createElement('summary');summary.style.cursor='pointer';
              const name=document.createElement('strong');name.style.display='block';
              name.textContent='Proposition '+(resultIndex+1)+' · '+[...new Set(result.legs.filter(leg=>String(leg.mode||'').startsWith('pt_pub')).map(leg=>leg.line||leg.provider||'Transport'))].join(' · ');
              const times=document.createElement('span');times.style.display='block';
              times.textContent=formatParis(result.departure)+' → '+formatParis(new Date(Math.ceil(Date.parse(result.arrival)/60000)*60000).toISOString());
              const duration=document.createElement('span');duration.style.display='block';
              duration.textContent=Math.ceil((Date.parse(result.arrival)-Date.parse(result.departure))/60000)+' min · marches comprises';
              summary.append(name,times,duration);details.appendChild(summary);

              const line=document.createElement('p');line.textContent=formatParis(result.departure)+' → '+formatParis(new Date(Math.ceil(Date.parse(result.arrival)/60000)*60000).toISOString())+' · '+
                result.legs.map(l=>(l.mode==='wa_wal'?'Marche':l.line||l.mode)+' '+l.from+' → '+l.to).join(' · ')+
                ' · réponse du fournisseur reçue le '+formatParis(answer.receivedAt)+
                ' · raccordement aux coordonnées : '+Math.ceil(result.evidence.startGapMeters)+' m / '+Math.ceil(result.evidence.endGapMeters)+' m (accès physique à vérifier)'+
                (result.alerts.length?' · Alertes fournisseur : '+result.alerts.join(' ; '):'');
              const proof=document.createElement('span');
              const renderProof=confirmed=>{proof.textContent=' · Preuves manquantes : '+result.evidence.missing.filter(item=>!confirmed||result.legs.filter(leg=>String(leg.mode||'').startsWith('pt_pub')).length!==1||result.legs.some(leg=>String(leg.mode||'').startsWith('pt_pub')&&!window.CPBlaBlaRealtime.eligible(leg))||!item.startsWith('circulation')).join(', ')+'. Transport non confirmé — vérifiez vous-même.';};
              renderProof(false);proof.style.display='block';summary.appendChild(proof);
              // Do not treat TripGo's unverified price estimates as official fares.
              let fareSummary=null;
              if(window.CPTransportFares?.fare&&window.CPTransportFares?.describe){
                fareSummary=window.CPTransportFares.fare(result.legs,{travelDate:result.departure});
                const fareLine=document.createElement('span');fareLine.setAttribute('data-tripgo-fare','');
                fareLine.textContent=' · Tarifs : '+window.CPTransportFares.describe(fareSummary);
                fareLine.style.display='block';summary.appendChild(fareLine);
              }
              details.appendChild(line);
              const mapNote=document.createElement('p');mapNote.className='doux';
              mapNote.textContent='Les cartes localisent les coordonnées fournies. Le parcours piéton ouvert dans Maps fait l’objet d’un nouveau calcul ; il peut différer de la proposition. Accès réels à vérifier.';details.appendChild(mapNote);
              const steps=document.createElement('ol');
              const stepTime=value=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short',timeStyle:'medium'}).format(new Date(value));
              for(const [legIndex,leg] of result.legs.entries()){
                const step=document.createElement('li');step.textContent=(leg.mode==='wa_wal'?'Marche':leg.mode==='stationary_wait'?'Attente':leg.mode==='stationary_transfer'?'Correspondance à pied':leg.line||leg.provider||'Transport (ligne non identifiée)')+' · '+
                  stepTime(leg.departure)+' → '+stepTime(leg.arrival)+' · '+leg.from+' → '+leg.to;
                if(leg.mode==='wa_wal'&&Number.isFinite(leg.distanceMeters)&&leg.distanceMeters>=0){
                  const walkingDistance=document.createElement('span');walkingDistance.setAttribute('data-tripgo-walk-distance','');
                  walkingDistance.textContent=' · Marche : '+Math.ceil(leg.distanceMeters)+' m (distance fournisseur, cheminement à vérifier)';
                  step.appendChild(walkingDistance);
                }
                const legFare=fareSummary?.breakdown?.[legIndex];
                if(legFare){
                  const fareDetail=document.createElement('span');fareDetail.setAttribute('data-tripgo-leg-fare','');
                  fareDetail.textContent=' · '+(window.CPTransportFares.describeLeg?.(legFare)||'Tarif inconnu');
                  step.appendChild(fareDetail);
                }
                const validMapPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
                for(const [label,point] of [['Départ',leg.fromPoint],['Arrivée',leg.toPoint]]){
                  if(!validMapPoint(point))continue;
                  const link=document.createElement('a');link.textContent=' · '+label+' sur la carte';link.target='_blank';link.rel='noopener noreferrer';
                  link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(point.lat+','+point.lon);step.appendChild(link);
                }
                if(leg.mode==='wa_wal'&&validMapPoint(leg.fromPoint)&&validMapPoint(leg.toPoint)){
                  const walk=document.createElement('a');walk.textContent=' · Ouvrir la marche dans Maps';walk.target='_blank';walk.rel='noopener noreferrer';
                  walk.href='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(leg.fromPoint.lat+','+leg.fromPoint.lon)+
                    '&destination='+encodeURIComponent(leg.toPoint.lat+','+leg.toPoint.lon)+'&travelmode=walking';step.appendChild(walk);
                }
                steps.appendChild(step);
              }
              details.appendChild(steps);status.appendChild(details);
              if(window.CPBlaBlaRealtime&&Array.isArray(result.legs)&&result.legs.some(window.CPBlaBlaRealtime.eligible)){
                const live=document.createElement('span');live.textContent=' · Prévisions BlaBlaCar Bus : recherche auprès de l’opérateur…';live.style.display='block';summary.appendChild(live);
                if(!busRealtime){live.textContent=' · Prévisions BlaBlaCar Bus indisponibles sur cet appareil. La circulation reste à vérifier.';continue;}
                busRealtime.check(result,task,{signal}).then(check=>{
                  if(!regionalActive()||signal.aborted||!live.isConnected)return;
                  const update=check.updates[0];
                  const label=check.status==='cancelled'?'annulation signalée par l’opérateur':
                    check.status==='missed_boarding'?'départ trop tôt pour l’approche disponible':
                    check.status==='arrival_too_late'?'retard incompatible avec la marge normale de 15 min avant prise en charge (5 min uniquement si GPS exact fiable)':
                    update?.status==='observed'?'circulation observée par l’opérateur':
                    update?.status==='predicted'?'prévision reçue de l’opérateur':
                    update?.status==='stale'?'aucune donnée opérateur valide à cet instant':
                    update?.status==='not_matched'?'aucune prévision raccordée à cette course et à ce jour':
                    update?.status==='ambiguous'?'plusieurs versions opérateur incompatibles':'pas de prévision exploitable pour cette course';
                  renderProof(check.serviceConfirmed===true);
                  const exclusions={cancelled:'⛔ Annulation signalée — ne pas retenir ce trajet avant actualisation. ',arrival_too_late:'⛔ Prévision incompatible avec la marge normale de 15 min (5 min uniquement si GPS exact fiable) — actualisez avant de retenir ce trajet. ',missed_boarding:'⛔ Embarquement incompatible avec l’approche disponible — actualisez avant de retenir ce trajet. '};
                  if(exclusions[check.status]){const warning=document.createElement('strong');warning.textContent=exclusions[check.status];summary.prepend(warning);}
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
          when:new Date(Date.parse(pickupDate)-securityMarginMin*60000).toISOString(),arriveBy:true,latestArrival:new Date(Date.parse(pickupDate)-securityMarginMin*60000).toISOString()}));
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
          sourcePanel.appendChild(status);
          window.CPSibraFeed.loadDay(day, (url, options) => window.fetch(url + (bt.dataset.transportRefreshAt ? '?refresh=' + encodeURIComponent(bt.dataset.transportRefreshAt) : ''), {...options, cache: bt.dataset.transportRefreshAt ? 'no-store' : 'default'})).then(result => {
            if (!regionalActive() || !status.isConnected) return;
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
              if (!regionalActive() || !status.isConnected) return;
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
              if (regionalActive() && status.isConnected) status.insertAdjacentElement('afterend', outbound);
              }).catch(() => {
                if (regionalActive() && status.isConnected) {
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
              if (regionalActive() && status.isConnected) status.insertAdjacentElement('afterend', ret);
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
                  '. Arrêts à 600 m maximum à vol d’oiseau ; marche minimale à 1,2 m/s prise en compte pour la marge minimale de 15 min, trajet piéton non vérifié. Tarifs et perturbations non vérifiés. Transport non confirmé — vérifiez vous-même.' :
                  (changes.length ?
                    '🚌 Jonction SIBRA avec 1 correspondance (horaires théoriques) : ' +
                    changes.map(j => j.originStop.name + ' ' + clock(j.departureSeconds) +
                      ' → correspondance ' + clock(j.firstLeg.arrivalSeconds) +
                      ' / ' + clock(j.secondLeg.departureSeconds) +
                      ' → ' + j.destinationStop.name + ' ' + clock(j.arrivalSeconds)).join(' ; ') +
                    '. Correspondance au même arrêt GTFS, marche et circulation non vérifiées. Transport non confirmé — vérifiez vous-même.' :
                    'Jonction SIBRA : aucune course directe ou avec une correspondance trouvée à proximité avec la marge minimale de 15 min. Transport non confirmé — vérifiez vous-même.');
              } else {
                auto.textContent = 'Jonction SIBRA automatique indisponible : coordonnées GPS précises des deux missions manquantes, dates différentes ou heure de livraison absente.';
              }
              if (regionalActive() && status.isConnected) status.insertAdjacentElement('afterend', auto);
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
              if (regionalActive() && status.isConnected) status.insertAdjacentElement('afterend', picker);
            }
          }).catch(() => {
            if (regionalActive() && status.isConnected) status.textContent =
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
    { const cle = m.platform + '|' + m.external_id, sauve = msg => { ecrireLocal('cp_cache', { missions: etat.missions, alertes: etat.alertes, reglages: etat.reglages, chargeLe: etat.chargeLe, factures: etat.factures }); $('feuille').hidden = true; afficher(); toast(msg); };
      const b1 = $('btnAnnMoi'); if (b1) b1.onclick = () => { if (!window.confirm('Marquer cette mission comme annulée par toi ? Elle sort du planning et des revenus. Une pénalité de la plateforme reste possible (montant à confirmer par toi).')) return; const o = lireLocal('cp_annul', {}) || {}; o[cle] = { pen: null }; ecrireLocal('cp_annul', o); window.CPFiltres.francais(etat.missions); sauve('Mission marquée annulée'); };
      const b2 = $('btnPenAnn'); if (b2) b2.onclick = () => { const val = $('inPenAnn').value.trim().replace(',', '.'), o = lireLocal('cp_annul', {}) || {}; o[cle] = { pen: val === '' || !Number.isFinite(Number(val)) ? null : Math.max(0, Number(val)) }; ecrireLocal('cp_annul', o); window.CPFiltres.francais(etat.missions); sauve('Pénalité enregistrée'); };
      const b3 = $('btnAnnRetire'); if (b3) b3.onclick = () => { const o = lireLocal('cp_annul', {}) || {}; delete o[cle]; ecrireLocal('cp_annul', o); for (const x of etat.missions) if (x.kind === 'acceptee' && x.platform + '|' + x.external_id === cle && x._statutOrig !== undefined) { x.status = x._statutOrig; delete x._statutOrig; x.annulee_par_moi = false; } sauve('Annulation retirée'); };
    }
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
 


