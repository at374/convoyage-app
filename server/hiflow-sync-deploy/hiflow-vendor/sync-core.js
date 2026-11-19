// Convoyage Ultra V76 — préparation des lignes envoyées à la base en ligne (fonctions pures).
// Seuls des champs métier partent vers le serveur : jamais d'identifiant, de cookie, de jeton de
// plateforme, de téléphone, d'e-mail ou de nom de contact.
(function (root) {
  'use strict';
  const str = v => String(v == null ? '' : v).trim();
  const cut = (v, n) => { const s = str(v); return s ? s.slice(0, n) : null; };
  const num = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const iso = v => { const s = str(v); if (!s) return null; const t = Date.parse(s); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
  const https = v => /^https:\/\/[^\s]+$/.test(str(v)) ? str(v).slice(0, 500) : null;
  const PLACE_KEYS = ['name', 'street', 'postal_code', 'city', 'country', 'lat', 'lng'];
  function place(p) {
    if (!p || typeof p !== 'object') return null; const o = {};
    for (const k of PLACE_KEYS) if (p[k] != null && p[k] !== '') o[k] = (k === 'lat' || k === 'lng') ? num(p[k]) : str(p[k]).slice(0, 150);
    return Object.keys(o).length ? o : null;
  }
  function vehicle(v) {
    if (!v || typeof v !== 'object') return null; const o = {};
    for (const k of ['brand', 'model', 'energy', 'category', 'gearbox']) if (v[k]) o[k] = str(v[k]).slice(0, 60);
if (Array.isArray(v.competences)) { const C = v.competences.slice(0, 8).map(s => str(s).slice(0, 80)).filter(Boolean); if (C.length) o.competences = C; }   // V2.12 : compétences requises (plaque W…)
if (Array.isArray(v.suites)) { const L = v.suites.slice(0, 8).map(s => ({ id: str(s && s.id).slice(0, 64), t: str(s && (s.t || s.texte)).slice(0, 220) })).filter(s => s.id && s.t); if (L.length) o.suites = L; }
    if (v.reprise && typeof v.reprise === 'object') { const r = v.reprise, q = {}; for (const k of ['origin_address', 'destination_address', 'total_duree']) if (r[k]) q[k] = str(r[k]).slice(0, 250); if (r.total_km) q.total_km = Number(r.total_km) || undefined; if (r.vehicle && typeof r.vehicle === 'object') { const w = {}; for (const k of ['category', 'model', 'gearbox', 'energy', 'brand']) if (r.vehicle[k]) w[k] = str(r.vehicle[k]).slice(0, 60); if (Object.keys(w).length) q.vehicle = w; } if (Object.keys(q).length) o.reprise = q; }   // V270 : Livraison & Reprise DriiveMe (2e étape)
    return Object.keys(o).length ? o : null;
  }
  function fees(f) {
    if (!f || typeof f !== 'object') return null; const o = {};
    for (const [k, v] of Object.entries(f)) { const n = num(v); if (n != null && n >= 0 && (n < 10000 || /^(devis|facture)_(numero|id)$/.test(k))) o[k.split('.').pop().slice(0, 40)] = n; }
    return Object.keys(o).length ? o : null;
  }
  const STATUS = { available: 'disponible', not_seen_in_latest_scan: 'plus_vue', acceptee_par_moi: 'acceptee_par_moi' };
  const COLUMNS = ['user_id', 'platform', 'external_id', 'kind', 'status', 'validation', 'from_city', 'to_city', 'from_department', 'to_department',
    'origin_address', 'destination_address', 'origin', 'destination', 'pickup_start', 'pickup_end', 'delivery_start', 'delivery_end', 'pickup_text',
    'fee', 'fees', 'vehicle', 'distance_km', 'detail_url', 'last_seen_at', 'adresses_locales'];
  // V96 : colonnes ajoutées par supabase/maj_V96.sql. Tant que ce fichier n'a pas été exécuté, l'extension envoie sans elles.
  const COLUMNS_OPTION = ['client', 'duree_h'];
  const dureeTexte = t => { const m = String(t || '').match(/^(\d{1,3})\s*h\s*(\d{2})$/i); return m ? Math.round((+m[1] + +m[2] / 60) * 100) / 100 : null; };

  // options.confidentielHiflow (faux par défaut depuis la V76) : si vrai, les adresses exactes Hiflow restent sur l'ordinateur
  // (contrat conducteur Hiflow : art. 12 confidentialité, Annexe 1 données personnelles).
  function row(userId, platform, kind, m, d, options) {
    const dates = (m.reseau && m.reseau.dates) || m.dates || {};
    const r = {
      user_id: userId, platform, external_id: cut(m.external_id, 64), kind,
      status: kind === 'acceptee' ? (m.status === 'annulee' || m.status === 'terminee' ? m.status : 'acceptee') : (STATUS[m.status] || 'disponible'),   // V79 : annulée / terminée
      validation: (platform === 'Hiflow' || platform === 'PopValet') ? 'validee' : 'non_validee',
      from_city: cut(m.from, 120), to_city: cut(m.to, 120),
      from_department: cut(m.from_department, 3), to_department: cut(m.to_department, 3),
      origin_address: cut((d && d.origin_address) || m.origin_address, 300), destination_address: cut((d && d.destination_address) || m.destination_address, 300),
      origin: place((d && d.origin) || m.origin), destination: place((d && d.destination) || m.destination),
      pickup_start: iso(dates.pickup_start) || parisJourHeure(m.pickup_date, m.pickup_time), pickup_end: iso(dates.pickup_end), delivery_start: iso(dates.delivery_start), delivery_end: iso(dates.delivery_end) || parisJourHeure(m.delivery_date, m.delivery_time),
      pickup_text: cut([m.pickup_date, m.pickup_time].filter(Boolean).join(' '), 40),
      fee: num(m.fee != null ? m.fee : (m.reseau && m.reseau.fee)), fees: fees((m.reseau && m.reseau.fees) || m.fees),
      client: cut((m.reseau && m.reseau.client) || m.client || (m.customer && !/masqu/i.test(m.customer) ? m.customer : ''), 60) || null,
      duree_h: num(m.duree_h != null ? m.duree_h : (m.reseau && m.reseau.duree_h != null ? m.reseau.duree_h : dureeTexte(m.duration))),
      vehicle: vehicle((m.reseau && m.reseau.vehicle) || m.vehicle), distance_km: num(m.distance_km != null ? m.distance_km : (m.reseau && m.reseau.distance_km)),
      detail_url: https(m.detail_url) || (platform === 'Hiflow' && kind === 'disponible' && /^\d{6,9}$/.test(str(m.external_id)) ? 'https://partenaire.expedicar.com/transfer/' + str(m.external_id) + '/quotation' : null),
      last_seen_at: iso(m.last_seen_at) || new Date().toISOString()   // jamais vide : la colonne est obligatoire
    };
    r.adresses_locales = false;
    if (platform === 'Hiflow' && options && options.confidentielHiflow === true) {
      r.origin_address = null; r.destination_address = null; r.origin = null; r.destination = null; r.adresses_locales = true;
    }
    if (r.fee != null && (r.fee < 0 || r.fee >= 100000)) r.fee = null;
    if (r.distance_km != null && (r.distance_km < 0 || r.distance_km >= 5000)) r.distance_km = null;
    return r.external_id ? r : null;
  }

  // store : contenu de chrome.storage.local (clés des missions). Renvoie toutes les lignes à jour.
  // V95 : date « JJ/MM/AAAA » + « HH:MM » (heure de Paris, lue dans le tableau Hiflow) → instant ISO, quand la plateforme
  // n'a pas fourni de date exacte : sans elle, une mission passée pouvait être proposée en retour (« date inconnue »).
  function parisJourHeure(jour, heure) {
    const m = String(jour || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/), h = String(heure || '').match(/^(\d{1,2}):(\d{2})$/); if (!m) return null;
    const utc = Date.UTC(+m[3], +m[2] - 1, +m[1], h ? +h[1] : 0, h ? +h[2] : 0);
    try {
      const F = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const dec = x => { const p = {}; for (const e of F.formatToParts(new Date(x))) p[e.type] = e.value; return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - x; };
      let x = utc - dec(utc); x = utc - dec(x); return new Date(x).toISOString();
    } catch (_) { return new Date(utc).toISOString(); }
  }
  // V95 : devis Hiflow (« Mes devis ») → la prestation et les frais remboursés du DEVIS font foi.
  // Mission acceptée : son devis (n° de devis de la réservation, sinon devis « accepted » du même trajet).
  // Mission disponible : ton devis envoyé et pas refusé / supprimé.
  const REFUS = /^(rejected|deleted|refused|cancel)/;
  function devisPour(m, kind, dv) {
    const l = Object.values(dv || {}); if (!l.length) return null;
    const ids = m.ids || {}, recent = (a, b) => String(b.maj || b.vu_le || '').localeCompare(String(a.maj || a.vu_le || ''));
    if (kind === 'acceptee') {
      if (ids.id_quotation && dv[String(ids.id_quotation)]) return dv[String(ids.id_quotation)];
      const j = String(ids.id_journey || ''); if (!j) return null;
      return l.filter(q => q.id_journey === j && q.statut === 'accepted').sort(recent)[0] || null;
    }
    const j = String(m.external_id || '');
    return l.filter(q => q.id_journey === j && !REFUS.test(q.statut || '')).sort(recent)[0] || null;
  }
  function appliquerDevis(r, q) {
    if (!r || !q || q.prestation == null) return r;
    const f = {}; for (const [k, v] of Object.entries(q.frais || {})) if (Number(v) > 0) f[k] = Number(v);
    r.fee = q.prestation;
    r.fees = { ...f, devis_numero: Number(q.id_quotation), ...(q.total != null ? { devis_total: q.total } : {}), devis_accepte: q.statut === 'accepted' ? 1 : 0 };
    return r;
  }
  // V96 : factures Hiflow → table « factures » (une ligne par facture).
  function buildFactures(store, userId) {
    return Object.values(store.cp96_factures || {}).filter(f => f && f.id && f.total != null).map(f => ({ user_id: userId, platform: 'Hiflow', external_id: String(f.id), numero: f.numero || null, statut: f.payee ? 'payee' : 'validee', statut_plateforme: f.statut || null,
      prestation: f.prestation, frais: f.frais, total: f.total, emise_le: f.emise_le || null, payee_le: f.payee ? (f.payee_le || null) : null, nb_trajets: f.nb_trajets || 0 }));
  }
  // V97 : mission acceptée déjà reprise dans une facture validée → repère facture_id (jamais compté comme un frais).
  function facturesParReservation(store) {
    const m = new Map();
    for (const f of Object.values(store.cp96_factures || {})) if (f && f.id && Array.isArray(f.reservations)) for (const b of f.reservations) m.set(String(b), Number(f.id));
    return m;
  }
  function marquerFacture(r, m, parResa) {
    if (!r || !parResa.size) return r;
    const id = parResa.get(String((m.ids && m.ids.bookingId) || m.external_id));
    if (id != null && Number.isFinite(id)) r.fees = { ...(r.fees || {}), facture_id: id };
    return r;
  }
  // V98 : trajet en attente de facture lu dans « Mes factures » → montants RÉELS (prestation + frais) et état ;
  // mission annulée payée : statut « annulée » + montant dû. Repères facture_* jamais comptés comme frais.
  function appliquerAttente(r, t) {
    if (!r || !t || t.prestation == null) return r;
    const reperes = {}; for (const [k, v] of Object.entries(r.fees || {})) if (/^(devis|facture)_/.test(k)) reperes[k] = v;
    r.fee = t.prestation;
    r.fees = { ...(t.frais || {}), ...reperes, ...(t.sorti ? { facture_sortie: 1 } : { facture_attente: t.groupe === 'en_preparation' ? 2 : 1 }), ...(t.annulee ? { facture_annulee: 1 } : {}) };
    if (t.annulee) r.status = 'annulee';
    return r;
  }
  function buildRows(store, userId, options) {
    const out = [], dv = store.cp95_devis || {}, fr = facturesParReservation(store);
    const list = store.cp50_hiflow_missions || {}, details = store.cp50_hiflow_details || {};
    for (const m of Object.values(list)) { const r = row(userId, 'Hiflow', 'disponible', m, details[String(m.external_id)], options); if (r) out.push(appliquerDevis(r, devisPour(m, 'disponible', dv))); }
    for (const [p, bucket] of Object.entries(store.cp70_missions_autres || {})) for (const m of Object.values(bucket || {})) { const r = row(userId, p, 'disponible', m, null, options); if (r) out.push(r); }
    for (const [p, bucket] of Object.entries(store.cp72_acceptees || {})) for (const m of Object.values(bucket || {})) { const r = row(userId, p, 'acceptee', m, null, options); if (r) out.push(p === 'Hiflow' ? marquerFacture(appliquerDevis(r, devisPour(m, 'acceptee', dv)), m, fr) : r); }
    // V98 : trajets en attente de facture — complète la mission acceptée connue, sinon crée la ligne (mission annulée disparue de « Mes trajets »).
    for (const t of Object.values(store.cp98_attente || {})) {
      if (!t || !t.id_booking) continue;
      const ex = out.find(r => r.platform === 'Hiflow' && r.kind === 'acceptee' && String(r.external_id) === String(t.id_booking));
      if (ex) { appliquerAttente(ex, t); continue; }
      const r = row(userId, 'Hiflow', 'acceptee', { external_id: t.id_booking, ids: { bookingId: t.id_booking }, status: t.annulee ? 'annulee' : 'terminee', from: t.from, to: t.to, from_department: t.from_department, to_department: t.to_department,
        dates: { pickup_start: t.debut, delivery_end: t.fin }, fee: t.prestation, fees: {}, client: t.client, distance_km: t.distance_km, last_seen_at: t.vu_le }, null, options);
      if (r) out.push(marquerFacture(appliquerAttente(r, t), { external_id: t.id_booking }, fr));
    }
    const permises = options && Array.isArray(options.plateformes) ? options.plateformes : ['Hiflow', 'DriiveMe', 'Otoqi', 'PopValet', 'DeliveryCar'];   // V82 : plateformes désactivées non envoyées
    return out.filter(r => ['Hiflow', 'DriiveMe', 'Otoqi', 'PopValet', 'DeliveryCar'].includes(r.platform) && permises.includes(r.platform));
  }
  // V99 : missions encore « disponibles » sur le serveur mais plus dans la liste de l'ordinateur (lignes retirées, anciennes
  // lectures) → à marquer « plus vue ». Renvoie le filtre de la requête, ou null si la liste locale est vide (jamais de masquage à l'aveugle).
  function filtreOrphelines(rows, platform) {
    const ids = [...new Set((rows || []).filter(r => r.platform === platform && r.kind === 'disponible' && r.status === 'disponible' && /^[\w-]{1,64}$/.test(String(r.external_id))).map(r => String(r.external_id)))];
    if (ids.length < 1 || ids.length > 1500) return null;
    return 'platform=eq.' + platform + '&kind=eq.disponible&status=eq.disponible&external_id=not.in.(' + ids.join(',') + ')';
  }
  const keyOf = r => r.platform + '|' + r.kind + '|' + r.external_id;
  function hash(r) { const { last_seen_at, ...rest } = r; const t = JSON.stringify(rest); let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
  // Lignes nouvelles ou modifiées depuis le dernier envoi confirmé.
  function changedRows(rows, sent) { return rows.filter(r => (sent || {})[keyOf(r)] !== hash(r)); }
  // V88 : adresse collée avec un chemin (« …supabase.co/rest/v1/ », « /auth/v1 »…) ou sans « https:// » → ramenée à https://xxxx.supabase.co
  function normaliserServeur(u) {
    const t = str(u).trim(); if (!t) return '';
    try { const x = new URL(/^[a-z]+:\/\//i.test(t) ? t : 'https://' + t); if (/^[a-z0-9-]{3,63}\.supabase\.co$/i.test(x.hostname)) return 'https://' + x.hostname.toLowerCase(); } catch (_) {}
    return t.replace(/\/+$/, '');
  }
  function validServerUrl(u) { return /^https:\/\/[a-z0-9-]{3,63}\.supabase\.co$/i.test(str(u).replace(/\/+$/, '')); }

  const api = { filtreOrphelines, COLUMNS_OPTION, buildFactures, parisJourHeure, devisPour, appliquerDevis, buildRows, changedRows, keyOf, hash, validServerUrl, normaliserServeur, COLUMNS };
  root.CPSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
