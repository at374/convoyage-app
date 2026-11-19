// Convoyage Ultra V70 — noyau « données réseau » (fonctions pures, sans navigateur).
// Rôle : reconnaître des missions dans les réponses JSON que le site d'une plateforme reçoit déjà
// pour s'afficher dans le navigateur connecté de l'utilisateur. Aucune requête n'est émise ici.
// Seuls des champs métier sont extraits (identifiants, lieux, horaires, prix, frais, véhicule) :
// jamais de téléphone, e-mail, nom de personne, plaque, jeton ou mot de passe.
(function (root) {
  'use strict';

  // ---------- Plateformes ----------
  const PLATFORMS = [
    { key: 'Hiflow', hosts: [/^partenaire\.expedicar\.com$/i, /(^|\.)hiflow\.com$/i, /(^|\.)expedicar\.com$/i], validated: true },
    { key: 'DriiveMe', hosts: [/(^|\.)driiveme\.com$/i], validated: false },
    { key: 'Otoqi', hosts: [/(^|\.)otoqi\.com$/i], validated: false },
    { key: 'PopValet', hosts: [/(^|\.)popvalet\.com$/i], validated: false }
  ];
  // V72 : page des missions acceptées / en cours de chaque plateforme, repérée par son libellé de menu.
  const ACCEPTED_PAGES = {
    Hiflow: { key: 'HiflowTrajets', label: 'Mes trajets', re: /^\s*mes\s+trajets\s*$/i },
    DriiveMe: { key: 'DriiveMeReservations', label: 'Mes réservations', re: /^\s*(?:mes\s+)?r[ée]servations\s*$/i },
    Otoqi: { key: 'OtoqiReservees', label: 'Missions réservées', re: /^\s*missions?\s+r[ée]serv[ée]es?\s*$/i },
    PopValet: { key: 'PopValetReservees', label: 'Propositions réservées', re: /^\s*propositions?\s+r[ée]serv[ée]es?\s*$/i }
  };
  function platformOf(url) {
    try { const u = new URL(url); if (u.protocol !== 'https:') return ''; const p = PLATFORMS.find(p => p.hosts.some(h => h.test(u.hostname))); return p ? p.key : ''; } catch (_) { return ''; }
  }

  // ---------- Outils ----------
  const clean = s => String(s == null ? '' : s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  const num = v => { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string' && /^-?\d+(?:[.,]\d+)?$/.test(v.trim())) return Number(v.replace(',', '.')); return null; };
  const firstKey = (o, re) => Object.keys(o).find(k => re.test(k) && o[k] != null && o[k] !== '');

  // Clés sensibles jamais lues (ni valeur ni structure détaillée).
  const SENSITIVE = /(pass(word)?|token|secret|jwt|bearer|authori[sz]ation|cookie|session|iban|bic|siret|siren|phone|telephone|mobile|email|mail|firstname|lastname|first_name|last_name|birth|licen[cs]e|permis|plate|immat|registration|vin\b|signature|selfie|photo|avatar|document|file)/i;

  // ---------- Lieux ----------
  const K = {
    street: /^(street|streetAddress|street_address|address1|addressLine1|address_line_1|line1|adresse|address|rue|voie|route)$/i,
    streetNo: /^(streetNumber|street_number|houseNumber|numero|number)$/i,
    name: /^(name|label|placeName|place_name|siteName|site_name|companyName|company_name|company|raisonSociale|nom|title)$/i,
    zip: /^(zip|zipCode|zip_code|zipcode|postalCode|postal_code|postcode|codePostal|code_postal|cp)$/i,
    city: /^(city|town|locality|ville|commune|cityName|city_name)$/i,
    country: /^(country|pays|countryName|country_name|countryCode|country_code)$/i,
    lat: /^(lat|latitude)$/i, lng: /^(lng|lon|long|longitude)$/i,
    formatted: /^(formatted|formattedAddress|formatted_address|fullAddress|full_address|displayAddress|display_name|addressLabel)$/i,
    nest: /^(address|adresse|location|place|lieu|site|geo|coordinates|position|point)$/i
  };
  function parseAddressString(s) {
    const t = clean(s); const m = t.match(/^(.*?)(?:,\s*)?\b(\d{5})\b\s*,?\s*([^,]*)(?:,\s*(.*))?$/);
    if (!m) return null;
    const before = clean(m[1]).replace(/,$/, ''); const parts = before.split(/\s*,\s*/).filter(Boolean);
    return { name: parts.length > 1 ? parts.slice(0, -1).join(', ') : '', street: parts.length ? parts[parts.length - 1] : '', postal_code: m[2], city: clean(m[3]), country: clean(m[4] || '') };
  }
  function place(v, depth = 0) {
    if (v == null || depth > 2) return null;
    if (typeof v === 'string') { const p = parseAddressString(v); return p && (p.street || p.name) ? finishPlace(p) : null; }
    if (!isObj(v)) return null;
    const p = { name: '', street: '', postal_code: '', city: '', country: '', lat: null, lng: null };
    const s = firstKey(v, K.street); if (s && typeof v[s] === 'string') p.street = clean(v[s]);
    const n = firstKey(v, K.streetNo); if (n && (typeof v[n] === 'string' || typeof v[n] === 'number') && p.street && !/^\d/.test(p.street)) p.street = clean(v[n] + ' ' + p.street);
    const nm = firstKey(v, K.name); if (nm && typeof v[nm] === 'string' && !SENSITIVE.test(nm)) p.name = clean(v[nm]);
    const z = firstKey(v, K.zip); if (z && /^\d{5}$/.test(clean(v[z]))) p.postal_code = clean(v[z]);
    const c = firstKey(v, K.city); if (c) p.city = clean(typeof v[c] === 'object' ? (v[c].name || '') : v[c]);
    const co = firstKey(v, K.country); if (co) p.country = clean(typeof v[co] === 'object' ? (v[co].name || v[co].code || '') : v[co]);
    const la = firstKey(v, K.lat), lo = firstKey(v, K.lng); if (la && lo && num(v[la]) != null && num(v[lo]) != null) { p.lat = num(v[la]); p.lng = num(v[lo]); }
    const f = firstKey(v, K.formatted);
    // Adresse imbriquée : { address: {...} } ou { location: { lat, lng } }
    for (const k of Object.keys(v)) if (K.nest.test(k) && v[k] && typeof v[k] === 'object') {
      const inner = place(v[k], depth + 1); if (!inner) continue;
      for (const f2 of ['name', 'street', 'postal_code', 'city', 'country']) if (!p[f2] && inner[f2]) p[f2] = inner[f2];
      if (p.lat == null && inner.lat != null) { p.lat = inner.lat; p.lng = inner.lng; }
    } else if (K.nest.test(k) && typeof v[k] === 'string' && !p.street) { const q = parseAddressString(v[k]); if (q) for (const f2 of ['street', 'postal_code', 'city', 'country']) if (!p[f2] && q[f2]) p[f2] = q[f2]; }
    if (f && typeof v[f] === 'string' && (!p.street || !p.postal_code)) { const q = parseAddressString(v[f]); if (q) { for (const f2 of ['name', 'street', 'postal_code', 'city', 'country']) if (!p[f2] && q[f2]) p[f2] = q[f2]; } }
    // Un champ « street » contenant l'adresse complète (« Route des troques, 69630 Chaponost »).
    if (p.street && /\b\d{5}\b/.test(p.street) && !p.postal_code) { const q = parseAddressString(p.street); if (q) { p.street = q.street; p.postal_code = q.postal_code; p.city = p.city || q.city; } }
    return finishPlace(p);
  }
  function finishPlace(p) {
    const hasPostal = /^\d{5}$/.test(p.postal_code || '');
    const hasGeo = p.lat != null && p.lng != null && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);
    if (!(hasPostal && (p.street || p.name)) && !(hasGeo && p.city)) { return (p.city && (hasPostal || hasGeo)) ? { ...base(p), precise: false } : null; }
    return { ...base(p), precise: hasPostal && !!(p.street || p.name) };
    function base(p) {
      const full = [p.name, p.street, [p.postal_code, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ');
      return { name: p.name || '', street: p.street || '', postal_code: p.postal_code || '', city: p.city || '', country: p.country || '', lat: hasGeo ? p.lat : null, lng: hasGeo ? p.lng : null, full };
    }
  }

  // ---------- Missions ----------
  const ID_ORDER = ['transferId', 'transfer_id', 'journeyId', 'journey_id', 'missionId', 'mission_id', 'tripId', 'trip_id', 'id', 'bookingId', 'booking_id', 'orderId', 'order_id', 'reference', 'ref', 'number', 'code', 'uuid'];
  const ID_RE = new RegExp('^(' + ID_ORDER.join('|') + ')$', 'i');
  const ORIGIN_RE = /(pick_?up|origin|departure|depart|collect|enlevement|loading|^from(?=$|_|[A-Z])|^start(?=Address|Place|Location|Point|_address|_place|$))/i;
  const DEST_RE = /(delivery|drop_?off|destination|arrival|arrivee|restitution|livraison|unloading|^to(?=$|_|[A-Z])|^end(?=Address|Place|Location|Point|_address|_place|$))/i;
  const STEPS_RE = /^(steps|waypoints|stops|etapes|addresses|places|legs|itinerary|itineraire|route)$/i;
  const PRICE_RE = /(price|amount|fee|remuneration|remun|prestation|payout|earning|gain|montant|tarif|reward|total)/i;
  const PRICE_PREF = /(driver|conveyor|convoyeur|partner|partenaire|prestation|remuneration|payout|earning|gain|reward)/i;
  const FEES_RE = /(toll|peage|péage|fuel|carburant|gas(oline)?|train|taxi|transport|expense|frais|reimburs|rembours|travel|ticket|bus|parking|wash|lavage)/i;
  const DIST_RE = /^(distance|distanceKm|distance_km|km|kilometers|kilometres|mileage|distanceInMeters|distance_m|distanceMeters)$/i;
  const STATUS_RE = /^(status|state|statut|etat)$/i;
  const VEH_RE = /^(vehicle|vehicule|car|voiture|auto|vehicleInfo|vehicle_info)$/i;
  const CITY_FROM = /^(fromCity|from_city|originCity|origin_city|departureCity|departure_city|pickupCity|pickup_city|villeDepart)$/i;
  const CITY_TO = /^(toCity|to_city|destinationCity|destination_city|arrivalCity|arrival_city|deliveryCity|delivery_city|villeArrivee)$/i;

  function idsOf(o) {
    const out = {};
    for (const k of Object.keys(o)) if (ID_RE.test(k) && (typeof o[k] === 'number' || (typeof o[k] === 'string' && /^[A-Za-z0-9_-]{3,40}$/.test(o[k])))) out[k] = String(o[k]);
    return out;
  }
  function priceOf(k, v) {
    let n = num(v);
    if (n == null && isObj(v)) { const pk = Object.keys(v).find(x => PRICE_PREF.test(x) && num(v[x]) != null); n = num(pk ? v[pk] : (v.amount ?? v.value ?? v.total ?? v.ttc ?? v.ht)); if (pk && /cent/i.test(pk)) n = n / 100; }
    if (n == null) return null; if (/cent/i.test(k)) n = n / 100; return Math.round(n * 100) / 100;
  }
  function datesInto(o, prefix, out) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v !== 'string' || !ISO_RE.test(v.trim())) continue;
      if (/(created|updated|deleted|modified|expire|published|birth)/i.test(k)) continue;
      const side = prefix || (ORIGIN_RE.test(k) ? 'pickup' : DEST_RE.test(k) ? 'delivery' : '');
      if (!side) continue;
      const edge = /(end|max|to$|until|latest|fin|au$)/i.test(k) && !/^to/i.test(k) ? 'end' : 'start';
      const key = side + '_' + edge; if (!out[key]) out[key] = v.trim();
    }
  }
  function vehicleOf(v) {
    if (!isObj(v)) return null; const out = {};
    const pick = (re) => { const k = firstKey(v, re); return k && (typeof v[k] === 'string' || typeof v[k] === 'number') && !SENSITIVE.test(k) ? clean(v[k]) : ''; };
    out.brand = pick(/^(brand|make|marque|manufacturer)$/i); out.model = pick(/^(model|modele|modelName|model_name)$/i);
    out.category = pick(/^(category|type|segment|gabarit|size|vehicleType|vehicle_type|categorie)$/i);
    out.energy = pick(/^(fuel|fuelType|fuel_type|energy|energie|motorization|motorisation|engine|carburant)$/i);
    out.gearbox = pick(/^(gearbox|transmission|boite|boiteVitesse)$/i);
    for (const k of Object.keys(out)) if (!out[k]) delete out[k];
    return Object.keys(out).length ? out : null;
  }

  function missionFrom(o) {
    const ids = idsOf(o); if (!Object.keys(ids).length) return null;
    let origin = null, destination = null; const dates = {};
    for (const [k, v] of Object.entries(o)) {
      if (SENSITIVE.test(k) || v == null) continue;
      if (!origin && ORIGIN_RE.test(k) && !ISO_RE.test(String(v))) { const p = place(v); if (p) { origin = p; if (isObj(v)) datesInto(v, 'pickup', dates); } }
      if (!destination && DEST_RE.test(k) && !ISO_RE.test(String(v))) { const p = place(v); if (p) { destination = p; if (isObj(v)) datesInto(v, 'delivery', dates); } }
    }
    if ((!origin || !destination)) for (const [k, v] of Object.entries(o)) {
      if (!STEPS_RE.test(k)) continue;
      const arr = Array.isArray(v) ? v : (isObj(v) ? Object.values(v) : []);
      const places = arr.map(x => ({ x, p: place(x) })).filter(y => y.p);
      if (places.length >= 2) {
        origin = origin || places[0].p; destination = destination || places[places.length - 1].p;
        if (isObj(places[0].x)) datesInto(places[0].x, 'pickup', dates); if (isObj(places[places.length - 1].x)) datesInto(places[places.length - 1].x, 'delivery', dates);
      } else if (isObj(v)) { const inner = missionFrom({ ...ids, ...v }); if (inner) { origin = origin || inner.origin; destination = destination || inner.destination; Object.assign(dates, inner.dates || {}); } }
    }
    datesInto(o, '', dates);
    const cf = firstKey(o, CITY_FROM), ct = firstKey(o, CITY_TO);
    const from = (origin && origin.city) || (cf ? clean(o[cf]) : ''), to = (destination && destination.city) || (ct ? clean(o[ct]) : '');
    // Prix : préférer la rémunération du convoyeur.
    let fee = null, fee_key = ''; const fees = {};
    const priceKeys = Object.keys(o).filter(k => PRICE_RE.test(k) && !FEES_RE.test(k) && !SENSITIVE.test(k));
    for (const k of priceKeys.sort((a, b) => (PRICE_PREF.test(b) ? 1 : 0) - (PRICE_PREF.test(a) ? 1 : 0))) { const p = priceOf(k, o[k]); if (p != null) { fee = p; fee_key = k; break; } }
    const scanFees = (obj, pre) => { for (const [k, v] of Object.entries(obj || {})) { if (FEES_RE.test(k) && !SENSITIVE.test(k)) { const p = priceOf(k, v); if (p != null) fees[pre + k] = p; } } };
    scanFees(o, ''); for (const [k, v] of Object.entries(o)) if (isObj(v) && /(fees|frais|expenses|costs|pricing|price|quotation|devis)/i.test(k)) { scanFees(v, k + '.'); if (fee == null) for (const k2 of Object.keys(v).filter(x => PRICE_RE.test(x) && !FEES_RE.test(x))) { const p = priceOf(k2, v[k2]); if (p != null) { fee = p; fee_key = k + '.' + k2; break; } } }
    let distance_km = null; const dk = firstKey(o, DIST_RE);
    if (dk) { let d = num(o[dk]); if (d != null) { if (/(meter|_m$)/i.test(dk) && !/kilo/i.test(dk)) d = d / 1000; distance_km = Math.round(d * 10) / 10; } }
    const sk = firstKey(o, STATUS_RE); const status_raw = sk && typeof o[sk] === 'string' ? clean(o[sk]).slice(0, 40) : '';
    const vk = firstKey(o, VEH_RE); const vehicle = vk ? vehicleOf(o[vk]) : null;
    const complete = !!(origin && destination);
    if (!complete && !(from && to && fee != null)) return null;
    return { ids, external_id: preferredId(ids), from, to, origin, destination, dates, fee, fee_key, fees, distance_km, status_raw, vehicle };
  }
  function preferredId(ids) { for (const k of ID_ORDER) { const hit = Object.keys(ids).find(x => x.toLowerCase() === k.toLowerCase()); if (hit) return ids[hit]; } return Object.values(ids)[0] || ''; }

  // ---------- V87 : format RÉEL de Hiflow (constaté le 01/10/2026) ----------
  // getJourneysOpenToConveyorBooking → { response: { total_journeys, journeys: [ { id_journey, type, distance_km, duration,
  // dates: { start: "AAAAMMJJHHmm", end }, vehicle: { brand, model, type, engine_type, registration… }, pricing: { conveyor_price,
  // total_conveyor_fee, instant_booking_cost }, stations: { start: { address: { street, city, zip_code, country }, gps }, end } } ] } }.
  // Contacts du loueur / client, immatriculation et signatures ne sont JAMAIS repris.
  function parisVersIso(t) {
    const m = String(t || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/); if (!m) return null;
    const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    try {
      const F = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const dec = x => { const p = {}; for (const e of F.formatToParts(new Date(x))) p[e.type] = e.value; return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - x; };
      let x = utc - dec(utc); x = utc - dec(x); return new Date(x).toISOString();
    } catch (_) { return new Date(utc).toISOString(); }
  }
  const PETITS = new Set(['et', 'de', 'du', 'des', 'la', 'le', 'les', 'sur', 'sous', 'en', 'lès', 'les', 'aux', 'au', 'd', 'l']);
  const majuscules = t => clean(t).toLowerCase().split(/([\s'’-])/).map((w, i) => (i > 0 && PETITS.has(w)) ? w : w.replace(/^(\p{L})/u, c => c.toUpperCase())).join('');
  const ENERGIES = { combustion: 'Thermique', thermal: 'Thermique', diesel: 'Thermique', petrol: 'Thermique', electric: 'Électrique', hybrid: 'Hybride', plug_in_hybrid: 'Hybride rechargeable', hybrid_plugin: 'Hybride rechargeable', plugin_hybrid: 'Hybride rechargeable', 'plug-in hybrid': 'Hybride rechargeable' };
  const TYPES_VEHICULE = { particular: 'Particulière' };   // V99 : libellés Hiflow en français
  const typeVehicule = t => { const x = clean(t || ''); return TYPES_VEHICULE[x.toLowerCase()] || x; };
  function departementDuCp(cp) { const z = String(cp || ''); if (!/^\d{5}$/.test(z)) return ''; if (z.startsWith('97')) return z.slice(0, 3); if (z.startsWith('20')) return Number(z) < 20200 ? '2A' : '2B'; return z.slice(0, 2); }
  function lieuHiflow(st) {
    if (!isObj(st)) return null; const a = isObj(st.address) ? st.address : {}; const g = isObj(st.gps) ? st.gps : {};
    const p = { name: '', street: clean([a.street, a.street_2].filter(x => typeof x === 'string' && x).join(', ')), postal_code: /^\d{5}$/.test(clean(a.zip_code)) ? clean(a.zip_code) : '',
      city: majuscules(a.city || ''), country: clean(a.country || ''), lat: num(g.latitude), lng: num(g.longitude) };
    if (!p.city && !p.postal_code) return null;
    p.full = [p.street, [p.postal_code, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', ');
    p.precise = !!(p.street && p.postal_code && p.city);
    return p;
  }
  // V96 : société cliente (colonne « Client » de Hiflow) : uniquement brand.company, jamais contact / nom de personne / loueur.
  const societe = b => { const t = isObj(b) ? clean(b.company || '') : (typeof b === 'string' ? clean(b) : ''); return /@|\+?\d{6,}/.test(t) ? '' : t.slice(0, 60); };
  function prixListe(pr, instant) {
    const a = num(pr.conveyor_price) ?? num(pr.total_conveyor_fee), b = instant ? num(pr.instant_booking_cost) : null;
    return a != null && b != null ? Math.max(a, b) : (a != null ? a : b);
  }
  function trajetsHiflow(json) {
    const l = json && isObj(json.response) && Array.isArray(json.response.journeys) ? json.response.journeys : null;
    if (!l || !l.length || !isObj(l[0]) || l[0].id_journey == null) return null;
    if (isObj(l[0].booking)) return null;   // V98 : getJourneyBilling (« Mes factures ») = trajets DÉJÀ réservés, jamais des missions disponibles
    return l.filter(isObj).map(j => {
      const id = clean(j.id_journey); if (!/^\d{5,10}$/.test(id)) return null;
      const o = lieuHiflow(j.stations && j.stations.start), d = lieuHiflow(j.stations && j.stations.end);
      const pr = isObj(j.pricing) ? j.pricing : {}, v = isObj(j.vehicle) ? j.vehicle : {}, dt = isObj(j.dates) ? j.dates : {};
      const duree = String(j.duration || '').match(/^(\d{1,2}):(\d{2})$/);
      return { ids: { id_journey: id }, external_id: id, from: o ? o.city : '', to: d ? d.city : '', from_department: departementDuCp(o && o.postal_code), to_department: departementDuCp(d && d.postal_code),
        origin: o, destination: d, dates: { pickup_start: parisVersIso(dt.start), delivery_end: parisVersIso(dt.end) },
        fee: prixListe(pr, j.is_instant_booking_activated === true), fee_key: 'pricing.conveyor_price|instant_booking_cost', fees: {},   // V1.60 : les deux prix comptent ; s'il y a les deux, le plus haut (réservation immédiate)
        prix_reservation_immediate: j.is_instant_booking_activated === true ? num(pr.instant_booking_cost) : null,
        distance_km: num(j.distance_km), duree_h: duree ? Math.round((+duree[1] + +duree[2] / 60) * 100) / 100 : null, journey_type: clean(j.type),
        devis_recus: num(j.total_quotations), services: clean(j.ids_brand_extra_services || '').split(',').filter(x => /^\d+$/.test(x)).slice(0, 20),
        client: societe(j.brand),   // V96 : nom de la SOCIÉTÉ cliente seulement (choix de Laurent) — jamais de personne ni de contact
        status_raw: 'disponible', vehicle: { brand: clean(v.brand || ''), model: clean(v.model || ''), category: typeVehicule(v.type), energy: ENERGIES[clean(v.engine_type).toLowerCase()] || clean(v.engine_type || '') } };
    }).filter(Boolean);
  }

  // ---------- V88 : « Mes trajets » RÉEL de Hiflow (getBooking, constaté le 01/10/2026) ----------
  // { response: { total_bookings, booking: [ { id_booking, id_quotation, booking_status (booked / ongoing / done…), date { start, end },
  // journey { id_journey, distance_km, duration, status, date { start, end, appointment_* }, station { start, end : { address { street,
  // zip_code, city… }, gps { latitude, longitude }, contact… } } }, pricing { conveyor_price, toll, price_gas, price_taxi… },
  // vehicle { brand, model, category, type, engine_type, registration, chassis… }, brand, renter, driver… } ] } }.
  // Ce sont TES missions acceptées : les adresses exactes servent à t'y rendre. Contacts des agences / clients, nom des agences,
  // conducteur, immatriculation, numéro de châssis et documents ne sont JAMAIS repris.
  const STATUTS_RESA = { booked: 'Planifié', ongoing: 'En cours', done: 'Effectué', finished: 'Effectué', canceled: 'Annulé', cancelled: 'Annulé' };
  function reservationsHiflow(json) {
    const l = json && isObj(json.response) && Array.isArray(json.response.booking) ? json.response.booking : null;
    if (!l || !l.length || !isObj(l[0]) || l[0].id_booking == null) return null;
    return l.filter(isObj).map(b => {
      const id = clean(b.id_booking); if (!/^\d{5,10}$/.test(id)) return null;
      const j = isObj(b.journey) ? b.journey : {}, st = isObj(j.station) ? j.station : {};
      const o = lieuHiflow(st.start), d = lieuHiflow(st.end);
      const jd = isObj(j.date) ? j.date : {}, bd = isObj(b.date) ? b.date : {};
      const pr = isObj(b.pricing) ? b.pricing : {}, v = isObj(b.vehicle) ? b.vehicle : {};
      const duree = String(j.duration || '').match(/^(\d{1,3}):(\d{2})$/);
      const statut = clean(b.booking_status || '').toLowerCase();
      // V1.62 : heures EFFECTIVES de la mission (colonnes « Date de départ / d'arrivée » de Mes trajets) d'abord ; les créneaux de rendez-vous ne servent qu'à défaut
      const dates = { pickup_start: parisVersIso(jd.start) || parisVersIso(bd.start) || parisVersIso(jd.appointment_departure_start), pickup_end: parisVersIso(jd.appointment_departure_end),
        delivery_start: parisVersIso(jd.appointment_arrival_start), delivery_end: parisVersIso(jd.end) || parisVersIso(bd.end) || parisVersIso(jd.appointment_arrival_end) };
      const fees = {}; for (const [k, c] of [['toll', 'peages'], ['price_gas', 'carburant'], ['price_taxi', 'taxi']]) { const x = num(pr[k]); if (x != null && x > 0) fees[c] = x; }
      const idj = clean(j.id_journey || '');
      const idq = clean(b.id_quotation || '');
      return { ids: { bookingId: id, ...(/^\d{5,10}$/.test(idj) ? { id_journey: idj } : {}), ...(/^\d{3,10}$/.test(idq) ? { id_quotation: idq } : {}) }, external_id: id, from: o ? o.city : '', to: d ? d.city : '',
        from_department: departementDuCp(o && o.postal_code), to_department: departementDuCp(d && d.postal_code), origin: o, destination: d,
        dates: Object.fromEntries(Object.entries(dates).filter(([, x]) => x)), fee: num(pr.conveyor_price) ?? num(pr.total_conveyor_fee), fee_key: 'pricing.conveyor_price', fees,
        distance_km: num(j.distance_km), duree_h: duree ? Math.round((+duree[1] + +duree[2] / 60) * 100) / 100 : null,
        status_raw: STATUTS_RESA[statut] || clean(b.booking_status || '').slice(0, 40), source_reservation: 'getBooking', client: societe(b.brand),
        vehicle: { brand: clean(v.brand || ''), model: clean(v.model || ''), category: typeVehicule(v.category || v.type), energy: ENERGIES[clean(v.engine_type).toLowerCase()] || clean(v.engine_type || '') } };
    }).filter(Boolean);
  }

  // ---------- V95 : « Mes devis » RÉEL de Hiflow (getConveyorJourneyQuotation, constaté le 01/10/2026) ----------
  // { response: { total_quotations, quotations: [ { id_quotation, status (accepted / rejected / deleted / en attente…),
  // dates { created, updated, … }, pricing { conveyor_remuneration, gas_fee, toll_fee, taxi_fee, extra_transport_fee,
  // accommodation_fee, exceptional_fee, total_conveyor_fee, gas_level_instruction… }, journey { id_journey, … }, conveyor {…} } ] } }.
  // total_conveyor_fee = prestation + carburant + péage + taxi + transport + hébergement + exceptionnels (vérifié sur 15 devis).
  // Ton identité (conveyor), le client (brand / renter), les commentaires et les marges de Hiflow ne sont JAMAIS repris.
  const dateSouple = v => { const t = clean(v || ''); if (!t) return null; const p = parisVersIso(t); if (p) return p; const x = Date.parse(t.replace(' ', 'T')); return Number.isFinite(x) ? new Date(x).toISOString() : null; };
  function devisHiflow(json) {
    const l = json && isObj(json.response) && Array.isArray(json.response.quotations) ? json.response.quotations : null;
    if (!l || !l.length || !isObj(l[0]) || l[0].id_quotation == null) return null;
    const montant = v => { const x = num(v); return x != null && x >= 0 && x < 100000 ? x : null; };
    return l.filter(isObj).map(q => {
      const id = clean(q.id_quotation), j = isObj(q.journey) ? q.journey : {}, idj = clean(j.id_journey || ''), p = isObj(q.pricing) ? q.pricing : {}, dt = isObj(q.dates) ? q.dates : {};
      if (!/^\d{3,10}$/.test(id) || !/^\d{5,10}$/.test(idj)) return null;
      const montants = { carburant: montant(p.gas_fee), peage: montant(p.toll_fee), taxi: montant(p.taxi_fee), transport: montant(p.extra_transport_fee), hebergement: montant(p.accommodation_fee), exceptionnels: montant(p.exceptional_fee) };
      return { id_quotation: id, id_journey: idj, statut: clean(q.status || '').toLowerCase().slice(0, 30), prestation: montant(p.conveyor_remuneration),
        frais: Object.fromEntries(Object.entries(montants).filter(([, v]) => v != null)), total: montant(p.total_conveyor_fee),
        remise_a_niveau: clean(p.gas_level_instruction || '').slice(0, 30), maj: dateSouple(dt.updated) || dateSouple(dt.created) };
    }).filter(Boolean);
  }

  // ---------- V96 : « Mes factures » RÉEL de Hiflow (getConveyorBill, constaté le 01/10/2026) ----------
  // { response: { total_conveyor_bills, bills: [ { id_conveyor_bill, ids_booking "1,2,3,", conveyor { … iban, bic … },
  // bill { status (posted = payée), conveyor_bill_number, convey_amount_in_euros (prestation), convey_expenses_in_euros (frais),
  // date_creation, created_at, posted_at "AAAAMMJJHHmm", payment_id, total_bill_amount, vat_rate… }, bookings [ … ] } ] } }.
  // JAMAIS repris : ton identité, IBAN, BIC, e-mail, référence de paiement, immatriculations, commentaires.
  // V103 (choix de Laurent du 02/10/2026) : immatriculation des véhicules des factures VALIDÉES / PAYÉES, uniquement pour la
  // ligne de la facture Abby. Gardée sur l'ordinateur, jamais envoyée au serveur ni au téléphone. { n° de réservation → plaque }.
  const PLAQUE = /^[A-Z]{2}-?\d{3}-?[A-Z]{2}$|^\d{1,4} ?[A-Z]{1,3} ?\d{2,3}$|^W-?\d{3}-?[A-Z]{2}$/;
  function plaquesFacture(bookings) {
    const o = {};
    for (const b of Array.isArray(bookings) ? bookings.slice(0, 300) : []) {
      const id = clean(isObj(b) && isObj(b.booking) ? b.booking.id_booking : ''), p = clean(isObj(b) && isObj(b.vehicle) ? b.vehicle.registration : '').toUpperCase();
      if (/^\d{5,10}$/.test(id) && PLAQUE.test(p)) o[id] = p.replace(/[ -]/g, '');
    }
    return o;
  }
  function facturesHiflow(json) {
    const l = json && isObj(json.response) && Array.isArray(json.response.bills) ? json.response.bills : null;
    if (!l || !l.length || !isObj(l[0]) || l[0].id_conveyor_bill == null) return null;
    const euro = v => { const x = typeof v === 'number' ? v : num(v); return x != null && x >= 0 && x < 1000000 ? Math.round(x * 100) / 100 : null; };
    return l.filter(isObj).map(f => {
      const id = clean(f.id_conveyor_bill), b = isObj(f.bill) ? f.bill : {}; if (!/^\d{1,12}$/.test(id)) return null;
      const statut = clean(b.status || '').toLowerCase().slice(0, 30), payee = /^(posted|paid|payed)$/.test(statut);
      const resa = clean(f.ids_booking || '').split(',').map(x => x.trim()).filter(x => /^\d{5,10}$/.test(x)).slice(0, 200);
      const prestation = euro(b.convey_amount_in_euros), frais = euro(b.convey_expenses_in_euros);
      return { id, numero: clean(b.conveyor_bill_number || '').slice(0, 30), statut, payee, prestation, frais,
        total: euro(b.total_bill_amount) ?? (prestation != null ? Math.round((prestation + (frais || 0)) * 100) / 100 : null),
        emise_le: parisVersIso(clean(b.date_creation || '')) || parisVersIso(clean(b.created_at || '')), payee_le: payee ? parisVersIso(clean(b.posted_at || '')) : null,
        nb_trajets: resa.length || (Array.isArray(f.bookings) ? f.bookings.length : 0), reservations: resa, plaques: plaquesFacture(f.bookings) };
    }).filter(Boolean);
  }

  // ---------- V98 : « Mes factures » → trajets en attente de facture (getJourneyBilling, constaté le 02/10/2026) ----------
  // { response: { journeys: [ { id_journey, booking { id_booking, is_cancelled, cancellation_details { date_cancellation, fees_percentage… },
  // booking_date_start / _end (AAAAMMJJHHmm), validation_status { is_conveyor_validated, is_freecars_validated } }, journey { distance_km, status },
  // station { start { name, zip_code }, end {…} }, brand { brand_name }, pricing { luckyloc_margin { costs { luckyloc_payment_to_driver { price },
  // gas, toll, taxi, extra_transports, accommodation, exceptional } } } } ] } }.
  // Une mission ANNULÉE par le client y figure avec le montant réellement dû (« MONTANT FACTURE (HT) »).
  // Jamais repris : identité du convoyeur, immatriculation, loueur, marge et prix client, assurance, pièces jointes.
  function attenteHiflow(json) {
    const l = json && isObj(json.response) && Array.isArray(json.response.journeys) ? json.response.journeys : null;
    if (!l || !l.length || !isObj(l[0]) || !isObj(l[0].booking) || l[0].booking.id_booking == null) return null;
    const vrai = v => v === true || v === 'true' || v === 1 || v === '1';
    const euro = v => { const x = isObj(v) ? num(v.price) : num(v); return x != null && x >= 0 && x < 100000 ? Math.round(x * 100) / 100 : null; };
    const lieu = s => { const o = isObj(s) ? s : {}, cp = clean(o.zip_code || ''); return { ville: majuscules(o.name || '').slice(0, 120), dep: departementDuCp(/^\d{5}$/.test(cp) ? cp : '') || '' }; };
    return l.filter(isObj).map(x => {
      const b = isObj(x.booking) ? x.booking : {}, id = clean(b.id_booking); if (!/^\d{5,10}$/.test(id)) return null;
      const idj = clean(x.id_journey || ''), j = isObj(x.journey) ? x.journey : {}, st = isObj(x.station) ? x.station : {}, v = isObj(b.validation_status) ? b.validation_status : {};
      const c = isObj(x.pricing) && isObj(x.pricing.luckyloc_margin) && isObj(x.pricing.luckyloc_margin.costs) ? x.pricing.luckyloc_margin.costs : {};
      const prestation = euro(c.luckyloc_payment_to_driver); if (prestation == null) return null;
      const frais = {}; for (const [k, n] of [['gas', 'carburant'], ['toll', 'peage'], ['taxi', 'taxi'], ['extra_transports', 'transport'], ['accommodation', 'hebergement'], ['exceptional', 'exceptionnels']]) { const e = euro(c[k]); if (e != null && e > 0) frais[n] = e; }
      const o = lieu(st.start), d = lieu(st.end), annulee = vrai(b.is_cancelled) || /^cancel/i.test(clean(j.status || ''));
      return { id_booking: id, ...(/^\d{5,10}$/.test(idj) ? { id_journey: idj } : {}), annulee, prestation, frais,
        total: Math.round((prestation + Object.values(frais).reduce((s, y) => s + y, 0)) * 100) / 100,
        etat: vrai(v.is_freecars_validated) || vrai(v.is_conveyor_validated) || vrai(b.is_already_validated) ? 'en_preparation' : 'a_valider',
        debut: parisVersIso(clean(b.booking_date_start || '')), fin: parisVersIso(clean(b.booking_date_end || '')),
        from: o.ville, to: d.ville, from_department: o.dep, to_department: d.dep, distance_km: num(j.distance_km),
        client: societe(isObj(x.brand) ? x.brand.brand_name : ''), vehicule: clean(isObj(x.vehicle) ? (x.vehicle.description || x.vehicle.type || '') : '').replace(/\b[A-Z]{2}-?\d{3}-?[A-Z]{2}\b/g, '').trim().slice(0, 40) };
    }).filter(Boolean);
  }

  // Parcours de tout le JSON : un objet reconnu comme mission n'est pas redécoupé.
  function extractMissions(json, limit = 500) {
    const hf = trajetsHiflow(json) || reservationsHiflow(json); if (hf) return hf.slice(0, limit);   // V87/V88 : formats réels Hiflow d'abord
    if (devisHiflow(json) || facturesHiflow(json) || attenteHiflow(json)) return [];   // V95 / V96 : « Mes devis » et « Mes factures » ne sont pas des listes de missions
    const out = []; let visited = 0;
    (function walk(v, depth, key) {
      if (out.length >= limit || visited > 20000 || depth > 8 || v == null || typeof v !== 'object') return;
      if (key && SENSITIVE.test(key)) return;
      visited++;
      if (Array.isArray(v)) { for (const x of v.slice(0, 1000)) walk(x, depth + 1, ''); return; }
      const m = missionFrom(v); if (m) { out.push(m); return; }
      for (const [k, x] of Object.entries(v)) walk(x, depth + 1, k);
    })(json, 0, '');
    return out;
  }

  // ---------- Apprentissage des structures (noms de champs et types, jamais les valeurs) ----------
  function shape(v, depth = 0) {
    if (depth > 6) return '…';
    if (v === null) return 'null';
    if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), '×' + v.length] : [];
    if (typeof v === 'object') {
      const out = {}; let n = 0;
      for (const [k, x] of Object.entries(v)) {
        if (n++ >= 60) { out['…'] = (Object.keys(v).length - 60) + ' champs'; break; }
        const key = /^\d+$|^[0-9a-f-]{16,}$/i.test(k) ? '{id}' : k;
        out[key] = SENSITIVE.test(k) ? 'masqué' : shape(x, depth + 1);
      }
      return out;
    }
    if (typeof v === 'string') { const t = v.trim(); return ISO_RE.test(t) ? 'date' : /^\d{5}$/.test(t) ? 'code_postal?' : /^\d+([.,]\d+)?$/.test(t) ? 'nombre_texte' : 'texte'; }
    return typeof v === 'number' ? 'nombre' : typeof v === 'boolean' ? 'booleen' : typeof v;
  }
  function endpointPattern(url) {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\/\d+(?=\/|$)/g, '/{n}').replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/{uuid}').replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, '/{jeton}');
      const q = [...u.searchParams.keys()].filter(k => !SENSITIVE.test(k)).sort();
      return u.host + path + (q.length ? '?' + q.join('&') : '');
    } catch (_) { return ''; }
  }
  function skipUrl(url) { return /\/(login|logout|signin|signup|auth|oauth|token|refresh|password|sso|session|register|me\/password|files?|upload|documents?)\b/i.test(String(url)); }

  const api = { PLATFORMS, ACCEPTED_PAGES, platformOf, place, parseAddressString, missionFrom, extractMissions, trajetsHiflow, reservationsHiflow, devisHiflow, facturesHiflow, attenteHiflow, parisVersIso, shape, endpointPattern, skipUrl, SENSITIVE };
  root.CPNet = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
