// Convoyage Ultra — application téléphone (Android, iPhone, ordinateur). Lecture seule des missions
// synchronisées par l'extension ; aucune action n'est faite sur les plateformes.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euros = v => Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const PLATS = { Hiflow: 'Hiflow', DriiveMe: 'DriiveMe', Otoqi: 'Otoqi', PopValet: 'Pop Valet' };
  const clsPlat = p => ' plat-' + String(p || '').replace(/[^A-Za-z]/g, '');   // V122 : couleur de fond et de police propres à chaque plateforme
  // V83 : édition (une par plateforme, ou personnelle) : seules ses plateformes sont affichées.
  const EDITION = window.CP_EDITION || { code: 'personnelle', nom: 'Convoyage Ultra', plateformes: Object.keys(PLATS) };
  // V139 : missions que TOI as retirées de l'Agenda (« pas acceptée ») : mémorisées sur ce téléphone, jamais effacées du serveur.
  const masquees = () => new Set(lireLocal('cp_masquees', []) || []);
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
  const VERSION_APP = 'V143 (2.0.43)';   // affichée dans l'en-tête et les Réglages
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
  const seulesNouvelles = l => (l || []).filter(a => !['mission_acceptee', 'hausse_prix', 'mission_modifiee', 'mission_annulee'].includes(a.type));
  const etat = { onglet: 'missions', missions: [], alertes: [], reglages: null, filtre: 'toutes', recherche: '', tri: 'recent', zones: [], cote: 'tous', rayon: 0, chargeLe: null, erreur: '', plus: {}, factures: [], facturesServeur: true, sources: undefined };
  const G = window.CPGeo, RT = window.CPRetours, CALC = window.CPCalc;
  { const mq = document.getElementById('marque'); if (mq && !document.getElementById('versionApp')) { const v = document.createElement('span'); v.id = 'versionApp'; v.className = 'version'; v.textContent = ' · ' + VERSION_APP; mq.appendChild(v); } }
  Object.assign(etat, lireLocal('cp_preferences', {}));
  window.CP_TRANSPORT_CHOISI = lireLocal('cp_transport', 'moyenne');   // V137 : transport choisi pour l'aller et le retour (gardé sur ce téléphone)
  etat.pos = lireLocal('cp_position', null); etat.posMax = Number(etat.posMax) || 0;   // V137 : position du téléphone, prise seulement sur demande, gardée sur ce téléphone
  if (!lireLocal('cp_tri_v143', null)) { etat.tri = 'date'; ecrireLocal('cp_tri_v143', 1); }   // V143 : tri par date de départ (la plus proche en haut), plateformes mélangées — par défaut une seule fois, ton choix est gardé ensuite
  // Données gardées sur l'appareil : consultables hors connexion.
  const cache = lireLocal('cp_cache', null); if (cache) { etat.factures = cache.factures || []; etat.missions = window.CPFiltres.francais(deLEdition(cache.missions)); etat.alertes = seulesNouvelles(cache.alertes); etat.reglages = cache.reglages || null; etat.chargeLe = cache.chargeLe; }

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500); }
  const fmtDate = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const heure = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const jourCourt = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' }); };
  // V122 : période de plusieurs jours (DriiveMe) → « du ven. 09/10 au lun. 12/10 » ; même jour → heures comme avant.
  // V139 : dates et heures de mission en GROS et en couleur : rouge < 24 h, orange < 3 jours, vert au-delà, gris si dépassée.
  // V139 : villes de départ (vert) et d'arrivée (rouge) en gros ; adresses, km, durée et loueur lisibles.
  const trajetHtml = m => { const t = String(trajet(m)), i = t.indexOf(' → '); return i < 0 ? esc(t) : `<span class="vD">${esc(t.slice(0, i))}</span> <span class="fl">→</span> <span class="vA">${esc(t.slice(i + 3))}</span>`; };
  // L'icône 🗺️ d'une carte de mission ouvre la visualisation du trajet SANS ouvrir la fiche.
  document.addEventListener('click', ev => { const ic = ev.target && ev.target.closest && ev.target.closest('[data-carte]'); if (!ic) return; ev.preventDefault(); ev.stopPropagation(); const m = etat.missions.find(x => x.platform + '|' + x.external_id === ic.dataset.carte); if (m) popupVol(m); }, true);
  const classeQuand = m => { const t = Date.parse(m.pickup_start || ''); if (!Number.isFinite(t)) return 'q-inconnu'; const f = Date.parse(m.pickup_end || m.delivery_end || '') || t; if (f < Date.now()) return 'q-passee'; const h = (t - Date.now()) / 3600000; return h < 24 ? 'q-urgent' : h < 72 ? 'q-proche' : 'q-ok'; };
  const quandHtml = (m, ico) => `<span class="quand ${classeQuand(m)}">${ico || '📅'} ${esc(quand(m))}</span>`;
  const quand = m => { if (!m.pickup_start) return m.pickup_text || 'Date non fournie'; const j0 = jourCourt(m.pickup_start), j1 = m.pickup_end ? jourCourt(m.pickup_end) : ''; if (j1 && j1 !== j0) return 'du ' + j0 + ' au ' + j1; return fmtDate(m.pickup_start) + (m.pickup_end ? '–' + heure(m.pickup_end) : ''); };

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
    $('onglets').hidden = true; $('actualiser').hidden = true; $('pastille').hidden = true; $('sousTitre').textContent = 'Connexion';
    $('ecran').innerHTML = `<div class="carte"><h2>Connexion à Convoyage Ultra</h2>
      <p class="doux">Utilise le même compte que dans l’extension de ton ordinateur. Ce n’est pas ton compte Hiflow, DriiveMe, Otoqi ou Pop Valet.</p>
      <label for="lEmail">E-mail</label><input id="lEmail" type="email" autocomplete="username" inputmode="email">
      <label for="lMdp">Mot de passe</label><input id="lMdp" type="password" autocomplete="current-password">
      <div class="erreur" id="lErr" ${msg ? '' : 'hidden'}>${esc(msg || '')}</div>
      <button id="lOk" style="width:100%;margin-top:14px">Se connecter</button>
      <button id="lCree" class="second" style="width:100%;margin-top:8px">Créer un compte</button>
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
  async function charger(silencieux) {
    if (!api?.connecte) return;
    try {
      const [missions, alertes, reglages, factures] = await Promise.all([api.missions(), api.alertes(), api.reglages(), api.factures()]);
      etat.facturesServeur = factures !== null; if (factures) etat.factures = factures;   // V96
      try { etat.sources = await api.sourcesEtat(); } catch (_) { etat.sources = null; }   // V114
      const alertesNouv = seulesNouvelles(alertes);
      const avant = new Set(etat.alertes.map(a => a.id));
      const nouvelles = alertesNouv.filter(a => !a.lue && !avant.has(a.id));
      Object.assign(etat, { missions: window.CPFiltres.francais(deLEdition(missions)), alertes: alertesNouv, reglages, chargeLe: new Date().toISOString(), erreur: '' });
      ecrireLocal('cp_cache', { missions: etat.missions, alertes: etat.alertes, reglages: etat.reglages, chargeLe: etat.chargeLe, factures: etat.factures });
      if (etat.chargeLeDejaVu && nouvelles.length) notifier(nouvelles);
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
  async function notifier(liste) {
    toast(liste[0].message);
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const reg = await navigator.serviceWorker?.getRegistration();
      for (const a of liste.slice(0, 3)) {
        const titre = ({ hausse_prix: 'Hausse de prix', mission_acceptee: 'Mission acceptée', mission_modifiee: 'Mission modifiée', mission_annulee: 'Mission annulée ?' })[a.type] || 'Nouvelle mission';
        if (reg) reg.showNotification(titre, { body: a.message, icon: 'icones/icone-192.png', tag: 'cp-' + a.id }); else new Notification(titre, { body: a.message });
      }
    } catch (_) {}
  }

  // ---------- V114 : pastille verte / orange / rouge en haut ----------
  function etatPlateformes() { return window.CPEtat.etat(etat.sources, Date.now(), { horsConnexion: !!etat.erreur }); }
  function majPastille() {
    const b = $('pastille'); if (!b) return; const e = etatPlateformes();
    b.hidden = false; b.className = 'pastille ' + e.couleur; b.setAttribute('aria-label', 'État des plateformes : ' + e.resume); b.title = e.resume;
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
    const titres = { missions: 'Missions disponibles', agenda: 'Agenda — missions acceptées', planning: 'Planning sur plusieurs jours', factures: 'Factures validées et bénéfice', alertes: 'Alertes', reglages: 'Réglages' };
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
    const ancien = document.getElementById('popVol'); if (ancien) ancien.remove();
    const d = document.createElement('div'); d.id = 'popVol'; d.className = 'popVol'; d.setAttribute('role', 'dialog');
    document.body.appendChild(d); d.onclick = ev => { if (ev.target === d || ev.target.id === 'popVolX') d.remove(); };
    const W = 320, H = 260, px = (p, z) => { const n = 256 * 2 ** z, r = p.lat * Math.PI / 180; return [(p.lng + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n]; };
    const ap = p => p.precision === 'gps' || p.precision === 'adresse' || p.precision === 'rue' ? 'point précis' : p.precision === 'ville' ? 'centre de la commune (approximatif)' : 'centre du département (approximatif)';
    // Carte OpenStreetMap (gratuite) : vignettes 256 px calculées ici, sans bibliothèque ; le zoom est choisi pour que tout le tracé tienne.
    const dessiner = (a, b, routes) => {
      const lignes = routes.filter(r => r.coords && r.coords.length > 1), pts = lignes.length ? [].concat(...lignes.map(r => r.coords)) : [[a.lng, a.lat], [b.lng, b.lat]];
      let z = 14; for (; z > 2; z--) { const P = pts.map(q => px({ lng: q[0], lat: q[1] }, z)), xs = P.map(q => q[0]), ys = P.map(q => q[1]); if (Math.max(...xs) - Math.min(...xs) <= W * 0.8 && Math.max(...ys) - Math.min(...ys) <= H * 0.8) break; }
      const P = pts.map(q => px({ lng: q[0], lat: q[1] }, z)), xs = P.map(q => q[0]), ys = P.map(q => q[1]), ox = (Math.min(...xs) + Math.max(...xs)) / 2 - W / 2, oy = (Math.min(...ys) + Math.max(...ys)) / 2 - H / 2, N = 2 ** z;
      let tuiles = ''; for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++) for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++) if (ty >= 0 && ty < N) tuiles += `<img alt="" referrerpolicy="no-referrer" src="https://tile.openstreetmap.org/${z}/${((tx % N) + N) % N}/${ty}.png" style="position:absolute;left:${Math.round(tx * 256 - ox)}px;top:${Math.round(ty * 256 - oy)}px;width:256px;height:256px">`;
      const A = px(a, z), B = px(b, z), pl = (co, coul, dash, ep) => `<polyline points="${co.map(q => { const t = px({ lng: q[0], lat: q[1] }, z); return (t[0] - ox).toFixed(1) + ',' + (t[1] - oy).toFixed(1); }).join(' ')}" fill="none" stroke="${coul}" stroke-width="${ep}" stroke-linejoin="round" stroke-linecap="round"${dash ? ' stroke-dasharray="9 6"' : ''}/>`;
      const traces = lignes.length ? lignes.map(r => pl(r.coords, r.couleur, r.pointille, r.ep)).join('') : pl([[a.lng, a.lat], [b.lng, b.lat]], '#1d4ed8', true, 4);
      return `<div class="carteVol" style="position:relative;width:${W}px;max-width:100%;height:${H}px;overflow:hidden;border-radius:10px;background:var(--accentDoux);margin:0 auto">${tuiles}<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;left:0;top:0" role="img" aria-label="Trajet">${traces}<circle cx="${A[0] - ox}" cy="${A[1] - oy}" r="8" fill="#16a34a" stroke="#fff" stroke-width="2"/><circle cx="${B[0] - ox}" cy="${B[1] - oy}" r="8" fill="#dc2626" stroke="#fff" stroke-width="2"/></svg><span style="position:absolute;right:3px;bottom:2px;font-size:10px;background:rgba(255,255,255,.8);color:#333;padding:0 4px;border-radius:3px">© OpenStreetMap</span></div>`;
    };
    // Itinéraires gratuits (OpenStreetMap) : Valhalla (FOSSGIS) sait éviter les péages (use_tolls 0) ou les accepter (1) ; OSRM sert de secours pour le trajet « avec péages ».
    const decoder = (enc, prec) => { const out = []; let i = 0, lat = 0, lng = 0; while (i < enc.length) { for (const k of [0, 1]) { let r = 0, sh = 0, c; do { c = enc.charCodeAt(i++) - 63; r |= (c & 31) << sh; sh += 5; } while (c >= 32); const v = (r & 1) ? ~(r >> 1) : (r >> 1); if (k === 0) lat += v; else lng += v; } out.push([lng / 10 ** prec, lat / 10 ** prec]); } return out; };
    const valhalla = async (a, b, peages) => { try { const r = await fetch('https://valhalla1.openstreetmap.de/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locations: [{ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng }], costing: 'auto', costing_options: { auto: { use_tolls: peages ? 1 : 0 } }, directions_options: { units: 'kilometers' } }) }); const j = r.ok ? await r.json() : null, t = j && j.trip; return t && t.legs && t.legs[0] && t.legs[0].shape ? { coords: decoder(t.legs[0].shape, 6), km: t.summary.length, h: t.summary.time / 3600, peageKm: Array.isArray(t.legs[0].maneuvers) ? t.legs[0].maneuvers.reduce((s, x) => s + (x && x.toll ? Number(x.length) || 0 : 0), 0) : null } : null; } catch (_) { return null; } };
    const osrm = async (a, b) => { try { const r = await fetch('https://router.project-osrm.org/route/v1/driving/' + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=simplified&geometries=geojson'); const j = r.ok ? await r.json() : null, rt = j && j.code === 'Ok' && j.routes && j.routes[0]; return rt && rt.geometry && rt.geometry.coordinates.length > 1 ? { coords: rt.geometry.coordinates, km: rt.distance / 1000, h: rt.duration / 3600 } : null; } catch (_) { return null; } };
    const itineraire = async (a, b, sansPeage) => sansPeage ? valhalla(a, b, false) : ((await valhalla(a, b, true)) || (await osrm(a, b)));
    const rendre = async () => {
      const a = G.coordonnees(m, 'origin'), b = G.coordonnees(m, 'destination');
      const cadre = (carte, bas) => `<div class="popVolBoite"><button class="icone" id="popVolX" aria-label="Fermer">✕</button><h3>🗺️ Visualisation trajet estimé</h3>${carte}<p class="doux">🟢 ${esc(m.from_city || 'Départ')} → 🔴 ${esc(m.to_city || 'Arrivée')}</p>${bas}</div>`;
      if (!a || !b) { d.innerHTML = '<div class="popVolBoite"><button class="icone" id="popVolX" aria-label="Fermer">✕</button><h3>🗺️ Visualisation trajet estimé</h3><p>Départ ou arrivée non localisable : pas de carte possible.</p></div>'; return; }
      const pts = `<p class="doux">🟢 Départ : ${esc(ap(a))} · 🔴 Arrivée : ${esc(ap(b))}.</p>`;
      d.innerHTML = cadre(dessiner(a, b, []), '<p>Calcul des deux trajets en cours…</p>' + pts);
      const [avec, sans] = await Promise.all([itineraire(a, b, false), itineraire(a, b, true)]);
      if (!document.getElementById('popVol')) return;
      const meme = avec && sans && Math.abs(avec.km - sans.km) < 1;
      const ligne = (ico, nom, r) => r ? `<p>${ico} <b>${nom} : ≈ ${esc(Math.round(r.km))} km</b> · ≈ ${esc(duree(r.h))} en voiture, sans pause</p>` : `<p>${ico} ${nom} : indisponible : le service gratuit de calcul n’a pas répondu depuis ce téléphone</p>`;
      let bas;
      if (meme) bas = ligne('🛣️', 'Trajet (aucun péage sur le parcours le plus rapide)', avec);
      else bas = ligne('🛣️', 'Avec péages (autoroutes autorisées)', avec) + ligne('🟢', 'Sans péage', sans);
      // V142 : péage estimé, par catégorie de véhicule (kilomètres à péage lus dans l'itinéraire « avec péages »).
      const kmP = avec && !meme ? avec.peageKm : (meme ? 0 : null);
      const calcP = typeof CALC !== 'undefined' ? CALC : (typeof window !== 'undefined' ? window.CPCalc : null), tarifs = kmP != null && calcP && calcP.estimerPeage ? calcP.estimerPeage(kmP < 1 ? 0 : kmP) : null;
      if (tarifs) bas += kmP < 1 ? '<p>💶 <b>Péage : aucun</b> sur ce trajet.</p>' : `<div class="peages"><p>💶 <b>Péage estimé : ≈ ${esc(Math.round(kmP))} km à péage</b></p><table class="tPeage">${tarifs.map(t => `<tr><td><b>Classe ${t.classe}</b> · ${esc(t.nom)}<div class="doux">${esc(t.detail)}</div></td><td><b>≈ ${esc(Math.round(t.euros))} €</b><div class="doux">${esc(Math.round(t.min))}–${esc(Math.round(t.max))} €</div></td></tr>`).join('')}</table></div>`;
      else bas += '<p class="doux">💶 Péage : kilomètres à péage non disponibles pour ce trajet.</p>';
      bas += (m.distance_km ? `<p class="doux">Distance donnée par la plateforme : ${esc(m.distance_km)} km.</p>` : '') + '<p class="doux" id="popCommunes">Communes sur le trajet : recherche…</p>' + pts + '<p class="doux">Les durées sont des estimations de conduite normale ; le prix des péages est une estimation (≈ 0,09 € par km à péage pour une voiture, tarifs 2026 ; les autres classes sont des ordres de grandeur) : le tarif exact dépend de l’autoroute. <a href="https://fr.mappy.com/itineraire" target="_blank" rel="noopener">Comparer sur Mappy</a></p>';
      d.innerHTML = cadre(dessiner(a, b, meme ? [{ coords: avec.coords, couleur: '#1d4ed8', ep: 4 }] : [sans && { coords: sans.coords, couleur: '#16a34a', ep: 4, pointille: true }, avec && { coords: avec.coords, couleur: '#1d4ed8', ep: 4 }].filter(Boolean)), bas + (meme || !(avec && sans) ? '' : '<p class="doux">Bleu : avec péages · Vert pointillé : sans péage.</p>'));
      const base = avec || sans; if (!base) { const el0 = document.getElementById('popCommunes'); if (el0) el0.textContent = ''; return; }
      const route = base.coords, communes = [], idx = [0.2, 0.4, 0.6, 0.8].map(f => route[Math.min(route.length - 1, Math.round(f * (route.length - 1)))]);
      for (const q of idx) { try { const r = await fetch('https://api-adresse.data.gouv.fr/reverse/?limit=1&lon=' + q[0] + '&lat=' + q[1]); const j = r.ok ? await r.json() : null, f = j && j.features && j.features[0]; if (f && f.properties && f.properties.city && !communes.includes(f.properties.city)) communes.push(f.properties.city); } catch (_) {} }
      const el = document.getElementById('popCommunes'); if (el) el.textContent = communes.length ? 'Communes sur le trajet (repères) : ' + [m.from_city].concat(communes, [m.to_city]).filter(Boolean).join(' → ') : '';
    };
    pointsMission(m).finally(rendre);
  }
  // Cherche tout de suite (sans attendre la liste) les points GPS des deux bouts d'UNE mission ; renvoie vrai si un nouveau point a été trouvé.
  async function pointsMission(m) { let n = 0; for (const cote of ['origin', 'destination']) { const cle = G.cleAdresse(m, cote); if (!cle || G.POINTS[cle]) continue; try { const r = await G.chercherPoint(m, cote, u => fetch(u)); if (r && r.trouve) { G.POINTS[cle] = r.point; gpsMem.pts[cle] = r.point; n++; } } catch (_) {} } if (n) ecrireLocal('cp_gps', gpsMem); return n > 0; }
  function adresse(m, cote) {
    const a = m[cote + '_address']; if (a) return a;
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
  function carteMission(m, i, extra) {
    const r = renta(m), reste = heuresRestantes(m);
    return `<button class="mission${clsPlat(m.platform)}${estPassee(m) ? ' passe' : ''}${reste != null && reste > 0 && reste < SEUIL_URGENT_H && !estPassee(m) ? ' urgent' : ''}" data-i="${i}">
      <div class="haut"><span><span class="etiq">${esc(PLATS[m.platform] || m.platform)}</span>${m.validation === 'non_validee' ? ' <span class="etiq nv">non validée</span>' : ''} <span class="iconeCarte" role="button" tabindex="0" data-carte="${esc(m.platform + '|' + m.external_id)}" aria-label="Visualisation du trajet sur une carte" title="Visualisation du trajet sur une carte">🗺️</span></span>
      <span><div class="prix">${m.fee != null ? esc(euros(m.fee)) : '—'}</div>${r.connu ? `<div class="net">net ≈ ${esc(euros(r.net))}${r.parHeure ? ' · ' + esc(euros(r.parHeure)) + '/h' : ''}</div>` : ''}</span></div>
      ${reste != null && reste > 0 && reste < SEUIL_URGENT_H && !estPassee(m) ? `<div class="urgence">⏳ Plus que ${esc(reste < 1 ? Math.max(1, Math.round(reste * 60)) + ' min' : Math.round(reste) + ' h')} pour la faire</div>` : ''}<div class="trajet">${trajetHtml(m)}</div>
      <div class="meta">${quandHtml(m)}
      <span class="adr">📍 Départ : <b>${esc(adresse(m, 'origin'))}</b></span>${kmVolOiseau(m) != null && etat.posMax > 0 ? `<span class="vol">✈️ ≈ ${esc(kmVolOiseau(m))} km à vol d’oiseau de ${sourceRecherche() === 'domicile' ? 'ton domicile' : 'ta position'} jusqu’au départ</span>` : ''}
      <span class="adr">🏁 Arrivée : <b>${esc(adresse(m, 'destination'))}</b></span>
      ${m.distance_km ? `<span class="kms">🛣 <b>${esc(m.distance_km)} km</b>${m.duree_h ? ' · <b>' + esc(duree(m.duree_h)) + '</b>' : ''}</span>` : ''}${m.client ? `<span class="loueur">🏢 Loueur : <b>${esc(m.client)}</b></span>` : ''}</div>${extra || ''}</button>`;
  }
  // V137 : mission dont il reste peu de temps (moins de 24 h avant la fin de la période ou l'heure de livraison) → cadre rouge qui clignote.
  const SEUIL_URGENT_H = 24;
  function heuresRestantes(m) {
    const t = [m.delivery_end, m.delivery_start, m.pickup_end, m.pickup_start].map(x => Date.parse(x || '')).find(Number.isFinite);
    return t == null ? null : (t - Date.now()) / 3600000;
  }
  let listeAffichee = [];
  const COTES = { tous: 'Départ ou arrivée', depart: 'Départ', arrivee: 'Arrivée' };
  const villesConnues = () => G.villesDesMissions(etat.missions);
  // V96 : filtres par client (société), véhicule, distance et durée.
  const FI = window.CPFiltres;
  function blocPlusFiltres(dispo) {
    const o = FI.options(dispo), f = etat.plus || {}, nb = FI.actifs(f);
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
    const lire = () => { etat.plus = { client: $('fClient').value, type: $('fType').value, energie: $('fEnergie').value, marque: $('fMarque').value, kmMin: $('fKmMin').value, kmMax: $('fKmMax').value, dureeMax: $('fDuree').value }; etat.plusOuvert = true; memoriser(); };
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
        ${g.factures.map(f => `<div class="factureLigne"><span><b>Facture n° ${esc(f.numero || f.external_id)}</b> · ${esc(jour(f.emise_le))} · ${esc(f.nb_trajets || 0)} trajet${f.nb_trajets > 1 ? 's' : ''}</span><span>${esc(euros(f.total))} <span class="etiq ${f.statut === 'payee' ? 'ok' : 'nv'}">${f.statut === 'payee' ? 'payée' + (f.payee_le ? ' le ' + esc(jour(f.payee_le)) : '') : 'validée, en attente'}</span></span></div>`).join('')}</div>`).join('') +
      '<p class="doux">Seules les factures validées par Hiflow sont comptées. Bénéfice estimé = prestations − cotisations (taux des Réglages) ; les frais sont avancés puis remboursés. Estimation à vérifier selon ta situation.</p>';
  }
  // V99 : mission réellement disponible = statut disponible, date non dépassée depuis plus d'un jour, pas une ligne de « Mes trajets » (plaque devant la ville).
  const PLAQUE_VILLE = /^\s*[A-Z]{1,2}-?\d{3}-?[A-Z]{2}\b/;
  // V122 : « passée » = la FIN de la période est dépassée (une mission DriiveMe ouverte du 05/10 au 15/10 reste claire jusqu'au 15/10).
  const estPassee = m => { const t = Date.parse((m.platform === 'DriiveMe' ? (m.delivery_end || m.pickup_end || m.pickup_start) : m.pickup_start) || ''); return Number.isFinite(t) && t < Date.now() - (m.platform === 'DriiveMe' ? 0 : 86400000); };
  const estDisponible = m => { if (!m || m.kind !== 'disponible' || m.status !== 'disponible') return false;
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
      <div class="ligneFiltres"><select id="cote" aria-label="Lieu cherché">${Object.entries(COTES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <select id="rayon" aria-label="Autour de la ville"${aVille ? '' : ' disabled'}><option value="0">Ville exacte</option><option value="20">Ville + 20 km</option><option value="50">Ville + 50 km</option><option value="100">Ville + 100 km</option></select></div>
      <div class="lignePos"><select id="posSource" aria-label="Chercher depuis"><option value="position">Depuis ma position GPS</option><option value="domicile">Depuis mon domicile</option></select><button id="btnPos" class="second" type="button">📍 Ma position</button><select id="posMax" aria-label="Distance maximale depuis ma position"><option value="0">Distance max à vol d’oiseau : sans limite</option>${[20, 50, 100, 150, 200, 300].map(k => `<option value="${k}">Max ${k} km à vol d’oiseau</option>`).join('')}</select><span class="doux" id="posInfo"></span></div>
      ${blocPlusFiltres(dispo)}
      <div class="zones" id="zones">${etat.zones.map((z, i) => `<button class="zone" data-zone="${i}" aria-label="Retirer ce filtre">${esc(COTES[z.cote || 'tous'])} : ${esc(G.libelleZone(z))} ✕</button>`).join('')}</div>
      ${etat.erreur ? `<p class="erreur">${esc(etat.erreur)}</p>` : ''}<div id="liste"></div>`;
    $('tri').value = etat.tri; $('cote').value = etat.cote; $('rayon').value = String(etat.rayon);
    for (const b of document.querySelectorAll('[data-filtre]')) b.onclick = () => { etat.filtre = b.dataset.filtre; memoriser(); afficher(); };
    for (const b of document.querySelectorAll('[data-zone]')) b.onclick = () => { etat.zones.splice(Number(b.dataset.zone), 1); memoriser(); afficher(); };
    $('tri').onchange = ev => { etat.tri = ev.target.value; memoriser(); listeMissions(); };
    $('cote').onchange = ev => { etat.cote = ev.target.value; memoriser(); };
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
    const l = G.suggestions(etat.recherche, { villes: villesConnues(), max: 7 });
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
    else if (etat.tri === 'date') l.sort((a, b) => String(a.pickup_start || '9').localeCompare(String(b.pickup_start || '9')));
    else l.sort((a, b) => String(b.first_seen_at || '').localeCompare(String(a.first_seen_at || '')) || String(a.pickup_start || '9').localeCompare(String(b.pickup_start || '9')));   // V99 : les plus récemment parues en haut
    listeAffichee = l;
    zoneListe.innerHTML = `${etat.zones.length || q || FI.actifs(etat.plus) ? `<p class="doux" id="compte">${l.length} mission(s) sur ${total} correspondent à tes filtres <button id="toutVoir" class="lienBouton">Tout afficher</button></p>` : ''}` +
      (l.length ? l.map((m, i) => carteMission(m, i)).join('') : `<div class="vide">${total ? 'Aucune mission ne correspond à tes filtres.' : 'Aucune mission reçue pour l’instant. Vérifie que l’extension de ton ordinateur est connectée à ton compte (Sources → Application téléphone).'}</div>`);
    for (const b of zoneListe.querySelectorAll('.mission')) b.onclick = () => detail(listeAffichee[Number(b.dataset.i)]);
    const tv = $('toutVoir'); if (tv) tv.onclick = () => { etat.zones = []; etat.recherche = ''; etat.plus = {}; etat.filtre = 'toutes'; memoriser(); afficher(); };   // V99 : retirer tous les filtres d'un coup
  }
  // V79 : Agenda complet — états (à venir, en cours, passée, annulée ?, terminée), conflits horaires, modifications.
  const ETATS = { en_cours: ['en cours', 'ok'], annulee: ['annulée ? à vérifier', 'ko'], terminee: ['terminée', ''], passee: ['passée', ''], date_inconnue: ['date à préciser', 'nv'] };
  function vueAgenda() {
    const A = window.CPAgenda.analyser(etat.missions, etat.reglages);
    const items = A.items.filter(x => etat.agendaTout || !((x.etat === 'passee' || x.etat === 'terminee') && x.fin && Date.now() - x.fin.t > 7 * 86400000));
    items.sort((x, y) => (y.debut ?? -1) - (x.debut ?? -1));   // V90 : les plus récentes (dates les plus lointaines) en haut ; date inconnue en bas
    const caches = A.items.length - items.length;
    listeAffichee = items.map(x => x.mission);
    if (!A.items.length) { $('ecran').innerHTML = '<div class="vide">Aucune mission acceptée. Elles arrivent automatiquement depuis « Mes trajets » (Hiflow), « Mes réservations » (DriiveMe), « Missions réservées » (Otoqi) et « Propositions réservées » (Pop Valet), ou d’un e-mail de confirmation Hiflow collé dans l’extension.</div>'; return; }
    const resume = RT.resumeAgenda(etat.missions, etat.reglages);
    // V139 : plus de bandeau « N conflits » dans l'Agenda (les estimations produisaient des dizaines de faux conflits).
    let html = false && A.conflits.length ? `<div class="carte conflit" id="conflits"><h2>⚠️ ${A.conflits.length} conflit${A.conflits.length > 1 ? 's' : ''} dans ton agenda</h2>${A.conflits.map(c => `<p>${esc(window.CPAgenda.libelleConflit(c))}</p>`).join('')}<p class="doux">Estimation (durées et liaisons approximatives) : vérifie sur les plateformes.</p></div>` : '';
    let jour = '';
    items.forEach((x, i) => {
      const m = x.mission, d = x.debut != null ? new Date(x.debut) : null;
      const j = d ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Date à préciser';
      if (j !== jour) { html += `<div class="jour">${esc(j)}</div>`; jour = j; }
      const nb = (x.etat === 'a_venir' || x.etat === 'en_cours') ? resume[x.cle] : 0;
      const e = ETATS[x.etat];
      const modifs = (m.modifications || []).filter(z => z.champ !== 'statut').slice(-2);
      const extra = (e ? `<div><span class="etiq ${e[1]}">${esc(e[0])}</span></div>` : '') +
        modifs.map(z => `<div class="modifLigne">✏️ ${esc(window.CPAgenda.libelleModification(z))}</div>`).join('') +
        (nb ? `<div class="retoursBadge">🔁 ${nb} retour${nb > 1 ? 's' : ''} possible${nb > 1 ? 's' : ''} après cette mission</div>` : '');
      html += carteMission(m, i, extra).replace('class="mission', `class="mission etat-${x.etat}${''}`);
    });
    if (caches || etat.agendaTout) html += `<button id="agTout" class="second" style="width:100%;margin-top:10px">${etat.agendaTout ? 'Masquer les missions passées' : 'Afficher les ' + caches + ' mission(s) passée(s) de plus de 7 jours'}</button>`;
    $('ecran').innerHTML = html;
    for (const b of document.querySelectorAll('.mission')) b.onclick = () => detail(listeAffichee[Number(b.dataset.i)]);
    const t = $('agTout'); if (t) t.onclick = () => { etat.agendaTout = !etat.agendaTout; afficher(); };
  }
  // ---------- V80 : planning sur plusieurs jours ----------
  const PL = window.CPPlanning;
  const demainParis = () => { const d = new Date(Date.now() + 86400000); return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); };
  function vuePlanning() {
    const p = etat.plan = { date: demainParis(), heure: '06:00', jours: 3, nuits: 2, hotel: 60, hotelOn: false, zones: [], rayon: 50, acc: true, tri: 'net', ...(etat.plan || {}) };
    if (!p.date || p.date < new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })) p.date = demainParis();
    const opt = (l, v, f) => l.map(x => `<option value="${x}"${String(x) === String(v) ? ' selected' : ''}>${f(x)}</option>`).join('');
    const dom = RT.domicile(etat.reglages);
    $('ecran').innerHTML = `<div class="carte"><h2>🗺️ Préparer plusieurs jours</h2>
      ${dom ? `<p class="doux">Départ et retour : ${esc(etat.reglages.domicile_ville)} (Réglages). Liaisons, marge et attente maximale : tes réglages.</p>` : '<p class="erreur">Renseigne d’abord la ville de ton domicile dans Réglages → « Approche, retours et liaisons ».</p>'}
      <div class="grille2"><div><label for="pDate">Départ le</label><input id="pDate" type="date" value="${esc(p.date)}"></div><div><label for="pHeure">à partir de</label><input id="pHeure" type="time" value="${esc(p.heure)}"></div>
      <div><label for="pJours">Durée</label><select id="pJours">${opt([1, 2, 3, 4, 5, 6, 7], p.jours, x => x + ' jour' + (x > 1 ? 's' : ''))}</select></div>
      <div><label for="pNuits">Nuits hors de chez toi (max)</label><select id="pNuits">${opt([0, 1, 2, 3, 4, 5, 6], p.nuits, x => x ? x + ' nuit' + (x > 1 ? 's' : '') : 'aucune')}</select></div>
      <div><label for="pHotelOn">Frais d’hôtel</label><label style="margin:0;display:flex;align-items:center;gap:8px;min-height:44px;color:var(--texte)"><input id="pHotelOn" type="checkbox" style="width:auto;min-height:0"${p.hotelOn ? ' checked' : ''}> à compter</label></div>
      <div><label for="pHotel">Budget hôtel par nuit (€)</label><input id="pHotel" type="number" min="0" max="500" step="5" inputmode="numeric" value="${esc(p.hotel)}"${p.hotelOn ? '' : ' disabled'}></div>
      <div><label for="pTri">Priorité</label><select id="pTri"><option value="net"${p.tri === 'net' ? ' selected' : ''}>Gagner le plus</option><option value="heure"${p.tri === 'heure' ? ' selected' : ''}>Meilleur €/heure</option></select></div></div>
      <label for="pZone">Zones de travail (vide = toute la France)</label>
      <div class="recherche"><input id="pZone" autocomplete="off" placeholder="Région, département ou ville (3 lettres)" aria-controls="pSugg"><div id="pSugg" class="sugg" role="listbox" hidden></div></div>
      <div class="zones" id="pZones">${p.zones.map((z, i) => `<button class="zone" data-pzone="${i}" aria-label="Retirer cette zone">${esc(G.libelleZone(z))} ✕</button>`).join('')}</div>
      <label><input id="pAcc" type="checkbox" style="width:auto;min-height:0"${p.acc ? ' checked' : ''}> Inclure obligatoirement mes missions déjà acceptées</label>
      <button id="pGo" style="width:100%;margin-top:12px"${dom ? '' : ' disabled'}>Calculer les meilleurs enchaînements</button></div>
      <div id="pRes"></div>`;
    const lire = () => Object.assign(p, { date: $('pDate').value, heure: $('pHeure').value || '06:00', jours: Number($('pJours').value), nuits: Number($('pNuits').value), hotel: Math.max(0, Math.min(500, Number($('pHotel').value) || 0)), hotelOn: $('pHotelOn').checked, acc: $('pAcc').checked, tri: $('pTri').value });
    for (const id of ['pDate', 'pHeure', 'pJours', 'pNuits', 'pHotel', 'pAcc', 'pTri']) $(id).onchange = () => { lire(); memoriser(); };
    $('pHotelOn').onchange = () => { lire(); memoriser(); $('pHotel').disabled = !p.hotelOn; };   // frais d'hôtel en option (coche)
    for (const b of document.querySelectorAll('[data-pzone]')) b.onclick = () => { lire(); p.zones.splice(Number(b.dataset.pzone), 1); memoriser(); afficher(); };
    $('pZone').oninput = () => {
      const box = $('pSugg'), l = G.suggestions($('pZone').value, { villes: villesConnues(), max: 6 });
      box.innerHTML = l.map((x, i) => `<button role="option" data-pz="${i}">${esc(x.libelle)}<small>${esc(x.detail)}</small></button>`).join(''); box.hidden = !l.length;
      for (const b of box.querySelectorAll('[data-pz]')) b.onclick = () => { const x = l[Number(b.dataset.pz)]; lire(); p.zones.push(x.type === 'ville' ? { type: 'ville', nom: x.nom, dep: x.dep, lat: x.lat, lng: x.lng } : { type: x.type, code: x.code }); memoriser(); afficher(); };
    };
    $('pGo').onclick = () => { lire(); memoriser(); calculerPlanning(); };
    if (etat.planResultat) afficherPlans(etat.planResultat);
  }
  function calculerPlanning() {
    const p = etat.plan, debut = PL.parisVersMs(p.date, p.heure);
    if (debut == null) return toast('Date ou heure invalide');
    const res = PL.planifier(etat.missions, etat.reglages, { debut, jours: p.jours, nuits_max: p.nuits, budget_hotel: p.hotelOn ? p.hotel : 0, zones: p.zones, rayon: p.rayon, inclureAcceptees: p.acc, tri: p.tri });
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
          if (l.type === 'depart') { const e0 = pl.etapes[0]; return `<div class="lignePlan">🏠 <b>${hm(l.t)}</b> départ de ${esc(domNom)}${e0.liaison.km >= 2 ? `<span class="doux">🚆 liaison ≈ ${esc(e0.liaison.km)} km · ${esc(duree(e0.liaison.heures))} · ${esc(euros(e0.liaison.cout))}</span>` : ''}</div>`; }
          if (l.type === 'retour') return `<div class="lignePlan">🏠 <b>${hm(l.t)}</b> retour à ${esc(domNom)}${pl.retour.km >= 2 ? `<span class="doux">🚆 ≈ ${esc(pl.retour.km)} km · ${esc(duree(pl.retour.heures))} · ${esc(euros(pl.retour.cout))}</span>` : ''}</div>`;
          const et = l.etape, m = et.mission, ie = pl.etapes.indexOf(et);
          return `<button class="lignePlan${clsPlat(m.platform)}" data-plan="${ip}" data-etape="${ie}">🚗 <b>${hm(et.debut)}–${hm(et.fin)}</b> <span class="etiq">${esc(PLATS[m.platform] || m.platform)}</span> <b>${esc(trajet(m))}</b> · ${m.fee != null ? esc(euros(m.fee)) : '?'}${et.acceptee ? ' <span class="etiq ok">déjà acceptée</span>' : ''}
            ${ie > 0 && et.liaison.km >= 2 && !(pl.nuitsLiaison || []).some(x => x && x.cle === et.cle) ? `<span class="doux">🚆 depuis ${esc(et.depuis)} : ≈ ${esc(et.liaison.km)} km · ${esc(duree(et.liaison.heures))} · ${esc(euros(et.liaison.cout))}${et.attenteH ? ' · attente ' + esc(duree(et.attenteH)) : ''}</span>` : ''}
            <span class="doux">💶 net ≈ ${esc(euros(et.net))}${et.finEstimee ? ' · fin estimée' : ''}</span></button>`;
        }).join('');
        const dort = ij < tous.length - 1 && nuit < pl.nuits ? `${(pl.nuitsLiaison || [])[nuit] && pl.nuitsLiaison[nuit].km >= 2 ? `<div class="lignePlan">🚆 <b>en soirée</b> trajet de ${esc(pl.nuitsLiaison[nuit].depuis)} vers ${esc(pl.lieuxNuits[nuit])}<span class="doux">≈ ${esc(pl.nuitsLiaison[nuit].km)} km · ${esc(duree(pl.nuitsLiaison[nuit].heures))} · ${esc(euros(pl.nuitsLiaison[nuit].cout))}</span></div>` : ''}<div class="nuit">🌙 Nuit à ${esc(pl.lieuxNuits[nuit++])}${pl.coutHotel > 0 ? ' (hôtel ≈ ' + esc(euros(pl.coutHotel / pl.nuits)) + ')' : ''}</div>` : '';
        return `<div class="jour">${esc(new Date(j.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }))}</div>${lignes}${dort}`;
      }).join('');
      return `<div class="carte plan" id="plan${ip}"><div class="doux">Proposition ${ip + 1}</div>
        <div class="resume">≈ ${esc(euros(pl.net))} net${pl.parHeure != null ? ' · ' + esc(euros(pl.parHeure)) + '/h' : ''} · ${pl.etapes.length} mission${pl.etapes.length > 1 ? 's' : ''} · ${pl.nuits ? pl.nuits + ' nuit' + (pl.nuits > 1 ? 's' : '') : 'sans nuit'}</div>
        <div class="bilan">Prestations ${esc(euros(pl.prestations))} → net des missions ${esc(euros(pl.netMissions))} (cotisations et liaisons déduites)${pl.coutHotel > 0 ? ' − hôtel ' + esc(euros(pl.coutHotel)) : ''} − retour ${esc(euros(pl.retour.cout))} · ${esc(duree(pl.heures))} de travail et de trajets · ≈ ${esc(pl.liaisonKm)} km de liaisons</div>
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
  function vueReglages() {
    const r = { statut: 'micro', taux_cotisations: 21.2, cout_km: 0, prix_minimum: 0, alertes_nouvelles: true, alertes_prix: true, domicile_ville: null, domicile_lat: null, domicile_lng: null, cout_transport_km: 0.12, vitesse_liaison: 60, marge_minutes: 60, rayon_retour_km: 60, attente_max_h: 24, carte_sncf: 'aucune', trottinette: false, ...(etat.reglages || {}) };
    $('ecran').innerHTML = `<div class="carte"><h2>Rentabilité</h2>
      <label for="rStatut">Statut</label><select id="rStatut"><option value="micro">Micro-entrepreneur</option><option value="autre">Autre statut</option></select>
      <label for="rTaux">Taux de cotisations (%)</label><input id="rTaux" type="number" step="0.1" min="0" max="60" inputmode="decimal">
      <p class="doux">Valeur de travail à vérifier selon ta situation : ce taux n’est pas une valeur légale fixe.</p>
      <label for="rKm">Coût à ta charge par km (€/km, 0 si remboursé)</label><input id="rKm" type="number" step="0.01" min="0" max="5" inputmode="decimal">
      <label for="rMin">Prix minimum pour être alerté (€)</label><input id="rMin" type="number" step="1" min="0" inputmode="numeric">
      <label><input id="rNv" type="checkbox" style="width:auto;min-height:0"> Alerte nouvelles missions</label>
      <label><input id="rPx" type="checkbox" style="width:auto;min-height:0"> Alerte hausses de prix</label>
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
      <div class="carte" id="carteNotif"><h2>Notifications</h2><p class="doux" id="notifEtat">Vérification…</p><div id="notifBoutons" class="boutons"></div></div>
      <div class="carte"><h2>Compte</h2><p class="doux">${esc(api?.session?.email || '')}</p>
      <div class="boutons"><button id="dOk" class="second">Se déconnecter</button><button id="eOk" class="danger">Effacer mes données</button></div></div>
      <p class="doux" style="text-align:center">Convoyage Ultra · outil d’aide à la décision : aucune mission n’est acceptée à ta place.</p>`;
    $('rStatut').value = r.statut; $('rTaux').value = r.taux_cotisations; $('rKm').value = r.cout_km; $('rMin').value = r.prix_minimum; $('rNv').checked = !!r.alertes_nouvelles; $('rPx').checked = !!r.alertes_prix;
    $('rBus').checked = window.CP_BUS_ACTIF === true; $('rTransport').value = window.CP_TRANSPORT_CHOISI || 'general';
    $('rDom').value = r.domicile_ville || ''; $('rTr').value = r.cout_transport_km; $('rVit').value = r.vitesse_liaison; $('rMarge').value = r.marge_minutes; $('rRayon').value = r.rayon_retour_km; $('rAtt').value = r.attente_max_h; $('rSncf').value = r.carte_sncf || 'aucune'; $('rTrot').checked = r.trottinette === true;
    let domChoisi = r.domicile_ville ? { nom: r.domicile_ville, lat: r.domicile_lat, lng: r.domicile_lng, libelle: r.domicile_ville } : null;
    $('rDom').oninput = () => {
      const box = $('rDomSugg'), l = G.suggestions($('rDom').value, { types: ['ville'], villes: villesConnues().filter(v => v.lat != null), max: 6 });
      box.innerHTML = l.map((x, i) => `<button role="option" data-dom="${i}">${esc(x.libelle)}<small>${esc(x.detail)}</small></button>`).join(''); box.hidden = !l.length;
      for (const b of box.querySelectorAll('[data-dom]')) b.onclick = () => { const x = l[Number(b.dataset.dom)]; domChoisi = { nom: x.nom, lat: x.lat, lng: x.lng, libelle: x.nom }; $('rDom').value = x.nom; box.hidden = true; };
    };
    $('rOk').onclick = async () => {
      const v = { statut: $('rStatut').value, taux_cotisations: Number($('rTaux').value), cout_km: Number($('rKm').value), prix_minimum: Number($('rMin').value), alertes_nouvelles: $('rNv').checked, alertes_prix: $('rPx').checked,
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
    etatNotifications();
    { const p = document.createElement('p'); p.className = 'doux'; p.id = 'versionReglages'; p.style.textAlign = 'center'; p.textContent = 'Convoyage Ultra — version ' + VERSION_APP; $('ecran').appendChild(p); }
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
    for (const x of reseauxLocaux(deVille, deDep).concat(reseauxLocaux(versVille, versDep), reseauRegion(deDep), reseauRegion(versDep))) if (!L.some(y => y[1] === x[1])) L.push(x);
    L.push(['🚆 Rome2rio', r2], ['🗺️ Maps bus/train', gm]);
    const v = cleVerif ? (lireLocal('cp_verif', {}) || {})[cleVerif] : null;
    const caseV = cleVerif ? `<label class="liensVerif${v ? ' ok' : ''}"><input type="checkbox" data-verif="${esc(cleVerif)}"${v ? ' checked' : ''}> ${v ? '✓ Vérifié par toi le ' + esc(new Date(v).toLocaleDateString('fr-FR')) + ' (horaires et prix valables le jour de la mission)' : 'Je coche quand j’ai vérifié que ce transport circule et son prix le jour de la mission'}</label>` : '';
    return `<span class="liensTr">${L.map(([t, u]) => `<a href="${esc(u)}">${t}</a>`).join('')}</span><span class="doux liensNote">⚠ Horaires et prix NON vérifiés par l’application : ouvre le site, contrôle-les pour le jour de la mission (le bouton retour te ramène ici).</span>${caseV}`;
  }
  // V78 : retours possibles après cette mission (toutes plateformes), estimés.
  function blocRetours(m) {
    const acceptees = etat.missions.filter(x => x.kind === 'acceptee');
    const res = RT.retours(m, etat.missions.filter(x => x.kind === 'disponible'), etat.reglages, { acceptees: m.kind === 'acceptee' ? acceptees : acceptees.concat([m]) });
    detail.retours = res.compatibles.concat(res.dateInconnue);
    if (res.raison === 'lieu_arrivee_inconnu') return '<div class="carte" id="retours"><h2>🔁 Retours possibles</h2><p class="doux">Lieu d’arrivée non localisable : recherche impossible.</p></div>';
    const item = (x, i) => { const c = x.mission, rr = x.rentabilite; return `<div class="retourBloc"><button class="retour${clsPlat(c.platform)}" data-retour="${i}"><span class="etiq">${esc(PLATS[c.platform] || c.platform)}</span> <b>${esc(trajet(c))}</b> · ${c.fee != null ? esc(euros(c.fee)) : 'prix ?'}
      <span class="doux">${quandHtml(c)}${x.attenteH ? ' · attente ≈ ' + esc(duree(x.attenteH)) : ''}</span>
      <span class="doux">${({covoiturage:'🚗',bus:'🚌',train:'🚆',taxi:'🚕'})[x.liaison.mode] || '🚆'} ${esc(x.liaison.mode || 'liaison')} (le moins cher) ≈ ${esc(x.liaison.km)} km · ${esc(duree(x.liaison.heures))} · ${esc(euros(x.liaison.cout))}</span>
      <span class="doux">💶 net ≈ ${rr.connu ? esc(euros(rr.net)) + (rr.parHeure ? ' · ' + esc(euros(rr.parHeure)) + '/h' : '') : 'prix inconnu'}${x.rapprocheKm != null ? (x.rapprocheKm > 0 ? ' · te rapproche de chez toi de ≈ ' + esc(x.rapprocheKm) + ' km' : ' · t’éloigne de chez toi de ≈ ' + esc(-x.rapprocheKm) + ' km') : ''}</span>
      ${x.estimations.length ? `<span class="estim">estimation : ${esc(x.estimations.join(', '))}</span>` : ''}</button>${x.liaison && x.liaison.km >= 2 ? liensTransports(m.to_city, m.to_department, c.from_city, c.from_department, 'r|' + (m.id || m.external_id) + '|' + (c.id || c.external_id)) : ''}</div>`; };
    const n = res.compatibles.length, r = etat.reglages || {};
    const ecartes = [[res.autreJour, 'un autre jour'], [res.tropTot, 'partent trop tôt'], [res.conflits, 'chevauchent ton agenda'], [res.horsZone, 'trop loin'], [res.tropTard, 'attente trop longue'], [res.passees, 'déjà passées']].filter(([k]) => k).map(([k, t]) => k + ' ' + t).join(', ');
    return `<div class="carte" id="retours"><h2>🔁 Retours possibles après cette mission</h2>
      <p class="doux">Départ à moins de ${esc(r.rayon_retour_km ?? 60)} km de ${esc(m.to_city ? lieu(m, 'destination') : 'l’arrivée')}, même jour que l’arrivée, moyen de transport le moins cher qui arrive à temps (covoiturage, bus, train…, estimations), marge de sécurité ${esc(r.marge_minutes ?? 60)} min${res.finSource && res.finSource.estimee ? ', heure de livraison estimée' : ''}. Toutes plateformes.</p>
      ${n ? res.compatibles.slice(0, 6).map(item).join('') : '<p>Aucun retour compatible pour l’instant.</p>'}
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
  function detail(m, depuis) {
    if (!m) return;
    const r = renta(m, depuis);
    const itin = a => a ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}` : '';
    const frais = Object.entries(m.fees || {}).filter(([k]) => !/^devis_/.test(k));
    const dv = m.fees && m.fees.devis_numero ? { n: m.fees.devis_numero, total: m.fees.devis_total, accepte: m.fees.devis_accepte === 1 } : null;   // V95 : montants du devis Hiflow
    const lien = m.detail_url && /^https:\/\//.test(m.detail_url) ? m.detail_url : LIENS[m.platform];
    const ligne = (a, b) => `<tr><td>${esc(a)}</td><td>${b}</td></tr>`;
    $('feuilleContenu').innerHTML = `<div class="doux"><span class="etiq">${esc(PLATS[m.platform])}</span> n° ${esc(m.external_id)}${m.validation === 'non_validee' ? ' · lecture non validée : vérifie sur le site' : ''}</div>
      <h2 id="feuilleTitre" class="trajet" style="font-size:20px">${esc(trajet(m))}</h2>
      ${m.kind === 'acceptee' ? '<button id="btnRetirer" class="second" type="button">🚫 Pas acceptée : retirer de l’Agenda</button>' : ''}
      <button id="btnVol" class="second" type="button" aria-label="Visualisation trajet estimé">🗺️ Visualisation trajet estimé</button>
      ${lienDevis(m) ? `<a href="${esc(lienAppliHiflow() || lienDevis(m))}"${lienAppliHiflow() ? '' : ' target="_blank" rel="noopener"'} id="lienDevis" data-numero="${esc(m.external_id)}"><button style="width:100%;margin:4px 0 2px">📱 Faire le devis dans l’application Hiflow</button></a><p class="doux" style="margin:0 0 8px">Mission n° <b>${esc(m.external_id)}</b> (copié en touchant le bouton) · ${esc(trajet(m))}</p>` : ''}
      <div class="meta"><span class="quand gros ${classeQuand(m)}">📅 Prise en charge : ${esc(quand(m))}</span>${m.delivery_start || m.delivery_end ? `<span class="quand gros q-ok">🏁 Livraison : ${esc(fmtDate(m.delivery_start || m.delivery_end))}</span>` : ''}</div>
      <div class="carte"><b>Départ</b><div>${esc(adresse(m, 'origin'))}</div><span id="gpsO">${mentionGps(m, 'origin')}</span>${etat.reglages && etat.reglages.domicile_ville && m.from_city ? liensTransports(etat.reglages.domicile_ville, '', m.from_city, m.from_department, 'a|' + (m.id || m.external_id)) : ''}${(m.origin_address || m.from_city) ? `<a href="${esc(itin(m.origin_address || m.from_city + (m.from_department ? ' ' + m.from_department : '')))}" target="_blank" rel="noopener">Itinéraire vers le départ${m.origin_address ? '' : ' (ville)'}</a>` : ''}</div>
      <div class="carte"><b>Arrivée</b><div>${esc(adresse(m, 'destination'))}</div><span id="gpsD">${mentionGps(m, 'destination')}</span>${(m.destination_address || m.to_city) ? `<a href="${esc(itin(m.destination_address || m.to_city + (m.to_department ? ' ' + m.to_department : '')))}" target="_blank" rel="noopener">Itinéraire vers l’arrivée${m.destination_address ? '' : ' (ville)'}</a>` : ''}</div>
      <div class="carte"><h2>Rentabilité estimée</h2>${dv ? `<p class="devisSource">📄 Montants de ton devis Hiflow n° ${esc(dv.n)} (${dv.accepte ? 'accepté' : 'envoyé, en attente'})${dv.total != null ? ' — total ' + esc(euros(dv.total)) : ''}</p>` : ''}${r.connu ? `<table class="tableau">
        ${ligne(dv ? 'Prestation (devis)' : 'Prestation', esc(euros(r.prestation)))}
        ${frais.length ? ligne(dv ? '+ Frais remboursés (devis)' : '+ Remboursements prévus', esc(frais.map(([k, v]) => (FRAIS[k.toLowerCase()] || k) + ' ' + euros(v)).join(' · '))) : ''}
        ${frais.length ? ligne('− Frais avancés (remboursés)', '− ' + esc(euros(r.fraisAvances))) : ''}
        ${ligne('− Approche' + (depuis ? ' depuis la livraison précédente' : ' depuis ton domicile'), r.approche ? `${r.approche.mode ? esc(r.approche.mode) + ' ' : ''}≈ ${esc(r.approche.km)} km · ${esc(duree(r.approche.heures))} · ${esc(euros(r.approche.cout))}` : '<span class="doux">inconnue — renseigne ta ville dans Réglages</span>')}
        ${ligne('− Retour à ton domicile', r.retour ? `≈ ${esc(r.retour.km)} km · ${esc(duree(r.retour.heures))} · ${esc(euros(r.retour.cout))}` : '<span class="doux">inconnu</span>')}
        ${r.rembTransport && r.coutTransport ? ligne('Transport couvert par le remboursement prévu', esc(euros(Math.min(r.rembTransport, r.coutTransport)))) : ''}
        ${r.coutTransport ? (r.transportRembourse ? ligne('Transport (approche et retour)', '≈ ' + esc(euros(r.coutTransport)) + ' <span class="doux">avancé puis remboursé par Hiflow</span>') : ligne('− Transport à ta charge', '− ' + esc(euros(r.transportNonCouvert)))) : ''}
        ${ligne('− Cotisations (' + String(r.taux).replace('.', ',') + ' %)', '− ' + esc(euros(r.cotisations)))}
        ${ligne('= Net estimé', '<b>' + esc(euros(r.net)) + '</b>')}
        ${ligne('Rentabilité horaire', r.parHeure ? `<b>${esc(euros(r.parHeure))}/h</b> (${esc(duree(r.heures))}${r.liaisonsConnues ? ' approche et retour compris' : ' hors liaisons inconnues'})` : 'durée inconnue')}</table>
        <p class="doux">Estimation${r.dureeEstimee && r.heuresMission ? ' · durée de conduite estimée d’après la distance' : ''} · distances à vol d’oiseau × 1,25 · cotisations sur la prestation seule (à vérifier selon ta situation).</p>` : '<p class="doux">Prix non connu.</p>'}</div>
      ${m.kind === 'acceptee' ? blocHistorique(m) : ''}
      ${m.status === 'annulee' || m.status === 'terminee' || (m.kind === 'acceptee' && missionPassee(m)) ? '' : blocRetours(m)}
      ${m.vehicle ? `<p>🚗 ${esc([m.vehicle.brand, m.vehicle.model, m.vehicle.energy].filter(Boolean).join(' '))}</p>` : ''}
      ${m.vehicle && /[ée]lectri|\bev\b|\bbev\b/i.test(String(m.vehicle.energy || '')) ? `<div class="carte"><b>🔌 Véhicule électrique : calculer la charge</b><p class="doux" style="margin:4px 0">Le prix et le temps de charge dépendent de la voiture, de la borne et de l’itinéraire : ces sites les calculent (l’appli ne les connaît pas).</p><span class="liensTr"><a href="https://abetterrouteplanner.com/">⚡ A Better Routeplanner</a><a href="https://fr.chargemap.com/">🗺️ Chargemap (bornes et prix)</a>${(m.origin_address || m.from_city) && (m.destination_address || m.to_city) ? `<a href="${esc('https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(m.origin_address || m.from_city + ' ' + (m.from_department || '')) + '&destination=' + encodeURIComponent(m.destination_address || m.to_city + ' ' + (m.to_department || '')))}">📍 Itinéraire Google Maps</a>` : ''}</span></div>` : ''}
      ${m.distance_km ? `<p>🛣 ${esc(m.distance_km)} km</p>` : ''}
      ${(m.price_history || []).length ? `<p class="doux">Historique du prix : ${m.price_history.map(h => esc(euros(h.de)) + ' → ' + esc(euros(h.a))).join(', ')}</p>` : ''}
      ${m.platform === 'Hiflow' && lienAppliHiflow() ? `<a href="${esc(lienAppliHiflow())}" class="lienAppli" data-numero="${esc(m.external_id)}"><button style="width:100%;margin-top:6px">📱 Ouvrir l’application Hiflow</button></a>` : `<a href="${esc(lien)}" target="_blank" rel="noopener"><button style="width:100%;margin-top:6px">Ouvrir sur ${esc(PLATS[m.platform])}</button></a>`}`;
    for (const a of document.querySelectorAll('#feuilleContenu [data-numero]')) a.addEventListener('click', () => { try { navigator.clipboard && navigator.clipboard.writeText(a.dataset.numero).then(() => toast('N° ' + a.dataset.numero + ' copié : colle-le dans la recherche de l’application Hiflow'), () => {}); } catch (_) {} });
    $('feuille').hidden = false; $('feuille').querySelector('.feuilleBoite').scrollTop = 0;
    const suivants = detail.retours || [], dest = G.coordonnees(m, 'destination');
    for (const b of document.querySelectorAll('[data-retour]')) b.onclick = () => detail(suivants[Number(b.dataset.retour)].mission, dest);
    { const bv = $('btnVol'); if (bv) bv.onclick = () => popupVol(m); }
    { const br = $('btnRetirer'); if (br) br.onclick = () => { if (!window.confirm('Retirer cette mission de ton Agenda sur ce téléphone ? (rien n’est supprimé chez Hiflow ni sur le serveur ; tu peux tout remettre dans Réglages)')) return; const t = lireLocal('cp_masquees', []) || []; const k = m.platform + '|' + m.external_id; if (!t.includes(k)) t.push(k); ecrireLocal('cp_masquees', t); etat.missions = etat.missions.filter(x => !(x.kind === 'acceptee' && x.platform + '|' + x.external_id === k)); ecrireLocal('cp_cache', { missions: etat.missions, alertes: etat.alertes, reglages: etat.reglages, chargeLe: etat.chargeLe, factures: etat.factures }); $('feuille').hidden = true; afficher(); toast('Retirée de l’Agenda'); }; }
    pointsMission(m).then(ok => { if (ok && $('gpsO')) { $('gpsO').innerHTML = mentionGps(m, 'origin'); if ($('gpsD')) $('gpsD').innerHTML = mentionGps(m, 'destination'); } });
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
  $('fermer').onclick = () => { $('feuille').hidden = true; };
  $('feuille').onclick = ev => { if (ev.target === $('feuille')) $('feuille').hidden = true; };
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') $('feuille').hidden = true; });
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
  function demarrer() {
    if (!api) return ecranConfiguration();
    if (!api.connecte) return ecranConnexion();
    afficher(); charger(true);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) { try { navigator.serviceWorker.register('sw.js'); } catch (_) {} }
  window.__cp = { etat, charger };
  demarrer();
})();
