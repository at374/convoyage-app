// Convoyage Ultra V78 — moteur de retours (fonctions pures). Pour une mission (acceptée ou envisagée),
// cherche parmi les missions disponibles de TOUTES les plateformes celles qui partent près du lieu de
// livraison, assez tard pour y arriver (liaison + marge de sécurité), sans chevaucher l'agenda.
// Tout est estimé (distances, durées, coûts) et présenté comme tel. Aucune mission n'est acceptée.
(function (root) {
  'use strict';
  const G = root.CPGeo || (typeof require === 'function' ? require('./geo.js') : null);
  const C = root.CPCalc || (typeof require === 'function' ? require('./calc.js') : null);
  const n = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const H = 3600000;
  const DEFAUTS = { marge_minutes: 60, rayon_retour_km: 60, attente_max_h: 24 };
  const cle = m => m.platform + '|' + m.external_id;
  const jourParis = t => { try { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)); } catch (_) { return new Date(t).toISOString().slice(0, 10); } };

  function debut(m) { const t = Date.parse(m.pickup_start || ''); return Number.isFinite(t) ? t : null; }
  // Fin de mission : heure de livraison fournie, sinon prise en charge + durée estimée (signalée).
  function fin(m) {
    const t = Date.parse(m.delivery_end || m.delivery_start || ''); if (Number.isFinite(t)) return { t, estimee: false };
    const d = debut(m), h = C.dureeEstimee(m).heures; if (d != null && h) return { t: d + h * H, estimee: true };
    return null;
  }
  function domicile(reglages) {
    const r = reglages || {}; const lat = n(r.domicile_lat), lng = n(r.domicile_lng);
    return lat != null && lng != null ? { lat, lng, precision: 'ville' } : null;
  }
  const PRECISIONS = ['gps', 'ville', 'departement'];
  const pire = (...p) => p.reduce((a, b) => PRECISIONS.indexOf(b) > PRECISIONS.indexOf(a) ? b : a, 'gps');

  // Intervalles occupés par l'agenda (missions acceptées), pour éviter les chevauchements.
  function occupe(acceptees, sauf) {
    return (acceptees || []).filter(m => (!sauf || cle(m) !== cle(sauf)) && m.status !== 'annulee' && m.status !== 'terminee').map(m => ({ m, a: debut(m), f: fin(m) })).filter(x => x.a != null && x.f).map(x => ({ m: x.m, a: x.a, b: x.f.t }));
  }

  function retours(source, disponibles, reglages, options = {}) {
    const r = { ...DEFAUTS, ...(reglages || {}) };
    const marge = (n(r.marge_minutes) ?? DEFAUTS.marge_minutes) * 60000, rayon = n(r.rayon_retour_km) ?? DEFAUTS.rayon_retour_km, attenteMax = (n(r.attente_max_h) ?? DEFAUTS.attente_max_h) * H;
    const res = { source, compatibles: [], dateInconnue: [], autreJour: 0, conflits: 0, horsZone: 0, tropTot: 0, tropTard: 0, passees: 0, nonLocalisees: 0, finSource: fin(source), arriveeSource: G.coordonnees(source, 'destination') };
    const dest = res.arriveeSource, finS = res.finSource, dom = domicile(r);
    if (!dest) { res.raison = 'lieu_arrivee_inconnu'; return res; }
    const agenda = occupe(options.acceptees, source);
    const retourDirectKm = dom ? G.routeKm(dest, dom) : null;
    const maintenant = options.maintenant ?? Date.now();   // V90 : missions dont la prise en charge est dépassée jamais proposées
    for (const c of disponibles || []) {
      if (cle(c) === cle(source) || c.kind === 'acceptee' || (c.status && c.status !== 'disponible')) continue;
      { const lim = Date.parse(c.pickup_end || c.pickup_start || ''), lf = Date.parse(c.delivery_end || ''); if ((Number.isFinite(lim) && lim < maintenant) || (Number.isFinite(lf) && lf < maintenant)) { res.passees++; continue; } }   // V95 : livraison dépassée aussi
      const o = G.coordonnees(c, 'origin'); if (!o) { res.nonLocalisees++; continue; }
      const km = G.routeKm(dest, o); if (km > rayon) { res.horsZone++; continue; }
      const cDest = G.coordonnees(c, 'destination');
      const retourKm = dom && cDest ? G.routeKm(cDest, dom) : null;
      let lien = C.liaisonMoinsChere(km, r);
      const item = { mission: c, liaison: lien, rentabilite: null, precision: pire(dest.precision, o.precision), 
        rapprocheKm: retourDirectKm != null && retourKm != null ? retourDirectKm - retourKm : null, retourDomicileKm: retourKm, estimations: [] };
      if (dest.precision !== 'gps' || o.precision !== 'gps') item.estimations.push('lieux localisés à la ' + (item.precision === 'departement' ? 'préfecture du département' : 'ville'));
      if (finS && finS.estimee) item.estimations.push('heure de livraison estimée');
      const limite = Date.parse(c.pickup_end || c.pickup_start || ''), dc = debut(c);
      if (!finS || !Number.isFinite(limite)) { lien = C.liaisonMoinsChere(km, r); item.liaison = lien; item.rentabilite = C.rentabiliteComplete(c, r, { approcheKm: km, retourKm, approcheLiaison: lien }); res.dateInconnue.push(item); continue; }
      // V115 : même jour que l'arrivée de la mission de départ (créneaux de plusieurs jours : le jour d'arrivée doit en faire partie)
      { const j0 = jourParis(finS.t), d0 = Date.parse(c.pickup_start || c.pickup_end || ''), jd = jourParis(Number.isFinite(d0) ? d0 : limite), jf = jourParis(limite); if (j0 < jd || j0 > jf) { res.autreJour++; continue; } }
      // le moyen de transport le MOINS CHER qui arrive avant la fin du créneau de prise en charge (marge comprise)
      lien = C.liaisonMoinsChere(km, r, (limite - finS.t - marge) / H);
      if (!lien) { res.tropTot++; continue; }
      item.liaison = lien; item.rentabilite = C.rentabiliteComplete(c, r, { approcheKm: km, retourKm, approcheLiaison: lien });
      const arrivee = finS.t + lien.heures * H + marge;
      const attente = dc != null ? Math.max(0, dc - arrivee) : 0;
      if (attente > attenteMax) { res.tropTard++; continue; }
      const fc = fin(c); const a = Math.max(dc ?? arrivee, arrivee), b = fc ? Math.max(fc.t, a) : a;
      if (agenda.some(x => a < x.b && b > x.a)) { res.conflits++; continue; }
      Object.assign(item, { arrivee, attenteH: Math.round(attente / H * 10) / 10, statut: 'compatible' });
      res.compatibles.push(item);
    }
    const tri = (x, y) => (y.rentabilite.parHeure ?? -1e9) - (x.rentabilite.parHeure ?? -1e9) || (y.rentabilite.net ?? -1e9) - (x.rentabilite.net ?? -1e9);
    res.compatibles.sort(tri); res.dateInconnue.sort(tri);
    return res;
  }
  // Nombre de retours compatibles pour chaque mission acceptée (affichage Agenda).
  function resumeAgenda(missions, reglages) {
    const acceptees = (missions || []).filter(m => m.kind === 'acceptee' && m.status !== 'annulee' && m.status !== 'terminee'), dispo = (missions || []).filter(m => m.kind === 'disponible');
    const out = {}; for (const m of acceptees) out[cle(m)] = retours(m, dispo, reglages, { acceptees }).compatibles.length;
    return out;
  }
  const api = { retours, resumeAgenda, fin, debut, domicile, DEFAUTS, cle };
  root.CPRetours = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
