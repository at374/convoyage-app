// Convoyage Ultra V80 — planning sur plusieurs jours (fonctions pures). À partir de ton domicile et d'une
// période, enchaîne des missions disponibles (et tes missions déjà acceptées, obligatoirement incluses)
// en respectant : liaisons estimées + marge de sécurité, attente maximale, zones de travail, nombre de
// nuits maximal, retour au domicile avant la fin de la période. Bilan global : net des missions (liaisons
// comprises) − frais d'hôtel (en option) − retour. Tout est ESTIMÉ ; rien n'est réservé ni accepté.
(function (root) {
  'use strict';
  const G = root.CPGeo || (typeof require === 'function' ? require('./geo.js') : null);
  const C = root.CPCalc || (typeof require === 'function' ? require('./calc.js') : null);
  const R = root.CPRetours || (typeof require === 'function' ? require('./retours.js') : null);
  const n = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const H = 3600000, MIN = 60000;
  const arr = v => Math.round(v * 100) / 100;
  const DEFAUTS = { nuits_max: 2, budget_hotel: 0, jours: 3, largeur: 60, profondeur: 10 };

  // Jour calendaire à Paris (nombre de jours depuis 1970) : sert à compter les nuits hors du domicile.
  const FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
  const cacheJour = new Map();
  const jourParis = t => { const k = Math.floor(t / 900000); let v = cacheJour.get(k); if (v === undefined) { const [y, m, d] = FMT.format(new Date(k * 900000)).split('-').map(Number); v = Math.round(Date.UTC(y, m - 1, d) / 86400000); if (cacheJour.size > 50000) cacheJour.clear(); cacheJour.set(k, v); } return v; };   // au quart d'heure près
  const FMH = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
  const minutesParis = t => { const [h, m] = FMH.format(new Date(t)).split(':').map(Number); return h * 60 + m; };
  const minuitApres = t => { const j = jourParis(t); let x = t; while (jourParis(x) === j) x += 30 * MIN; let a = x - 30 * MIN; while (jourParis(a + MIN) === j) a += MIN; return a + MIN; };

  function dansZones(m, zones, rayon) {
    if (!zones || !zones.length) return true;
    return zones.some(z => G.correspond(m, z, 'depart', rayon || 0)) && zones.some(z => G.correspond(m, z, 'arrivee', rayon || 0));
  }

  // options : { domicile:{lat,lng,nom}, debut (ms), jours, nuits_max, budget_hotel, zones, rayon, inclureAcceptees, maintenant }
  function planifier(missions, reglages, options = {}) {
    const reg = { ...(reglages || {}) };
    const o = { ...DEFAUTS, ...options };
    const dom = o.domicile || R.domicile(reg);
    const res = { plans: [], ecartees: { sansDate: 0, sansLieu: 0, horsZone: 0, horsPeriode: 0 }, erreurs: [] };
    if (!dom) { res.erreurs.push('domicile'); return res; }
    const debut = n(o.debut); if (debut == null) { res.erreurs.push('date'); return res; }
    // Respecte le nombre de jours calendaires à Paris, même lors des changements d'heure.
    const joursFenetre = Math.max(1, Math.min(28, Math.round(n(o.jours) ?? DEFAUTS.jours)));
    const jourDepart = FMT.format(new Date(debut));
    const [an, mois, quantieme] = jourDepart.split('-').map(Number);
    const dateLimite = new Date(Date.UTC(an, mois - 1, quantieme + joursFenetre));
    const jourLimite = dateLimite.toISOString().slice(0, 10);
    // Recherche par dichotomie du premier instant du jour suivant à Paris.
    let borneBasse = debut, borneHaute = debut + (joursFenetre + 2) * 24 * H;
    while (borneHaute - borneBasse > MIN) {
      const milieu = Math.floor((borneBasse + borneHaute) / (2 * MIN)) * MIN;
      if (FMT.format(new Date(milieu)) < jourLimite) borneBasse = milieu + MIN;
      else borneHaute = milieu;
    }
    const finFenetre = borneHaute;
    const heureMin = o.heureMin === null ? null : (n(o.heureMin) ?? minutesParis(debut));   // par défaut : l'heure de départ choisie, valable chaque jour
    const marge = (n(reg.marge_minutes) ?? 60) * MIN, attenteMax = (n(reg.attente_max_h) ?? 24) * H;
    const nuitsMax = Math.max(0, Math.round(n(o.nuits_max) ?? DEFAUTS.nuits_max)), hotel = Math.max(0, n(o.budget_hotel) ?? DEFAUTS.budget_hotel);

    const repos = new Set((o.joursReposHebdo || []).map(x => String(x).toLowerCase()));
    const joursBloques = new Set((o.joursSansTravail || []).filter(x => typeof x === 'string'));
    const indisponible = (a,b) => {
      if (!joursBloques.size && !repos.size) return false;
      const bloquee = t => joursBloques.has(FMT.format(new Date(t))) || jourRepos(t);
      if (bloquee(a) || bloquee(b)) return true;
      for (let t=a+H;t<b;t+=H) if (bloquee(t)) return true;
      return false;
    };
    const jourRepos = t => repos.has(new Date(t).toLocaleDateString('en-US', {timeZone:'Europe/Paris',weekday:'short'}).toLowerCase());

    const actives = Array.isArray(o.plateformesActives) ? new Set(o.plateformesActives) : null;
    // Missions utilisables (dates, lieux, zone, période).
    const pool = [];
    for (const m of missions || []) {
      const acceptee = m.kind === 'acceptee';
      if (acceptee ? (!o.inclureAcceptees || m.status === 'annulee' || m.status === 'terminee') : (m.kind !== 'disponible' || (m.status && m.status !== 'disponible'))) continue;
      const d = R.debut(m), f = R.fin(m);
      if (!acceptee && actives && !actives.has(m.platform)) continue;
      if (!acceptee && d != null && f && indisponible(d,f.t)) continue;
      if (d == null || !f) { if (!acceptee) res.ecartees.sansDate++; continue; }
      if (d < debut || f.t > finFenetre) { if (!acceptee) res.ecartees.horsPeriode++; continue; }
      const po = G.coordonnees(m, 'origin'), pd = G.coordonnees(m, 'destination');
      if (!po || !pd) { res.ecartees.sansLieu++; continue; }
      if (!acceptee && !dansZones(m, o.zones, o.rayon)) { res.ecartees.horsZone++; continue; }
      pool.push({ m, d, f: f.t, finEstimee: f.estimee, limite: Date.parse(m.pickup_end || '') || d, po, pd, acceptee, cle: R.cle(m) });
    }
    pool.sort((a, b) => a.d - b.d);
    const ancres = pool.filter(x => x.acceptee);

    const etendre = (s, c) => {
      const km = G.routeKm(s.pos, c.po), lien = C.liaison(km, reg);
      const premier = !s.etapes.length;
      const arrivee = s.t + lien.heures * H + (premier && km < 2 ? 0 : marge);   // marge de sécurité entre deux missions, même sur place
      if (!Number.isFinite(lien.heures) || lien.heures < 0 || !Number.isFinite(lien.cout)) return null;
      // Les engagements acceptés ont des horaires fixes : ne jamais les décaler.
      if (c.acceptee && arrivee > c.d) return null;
      if (!premier && c.limite < arrivee) return null;
      const departDom = c.d - lien.heures * H - (km < 2 ? 0 : marge);
      if (premier && (departDom < debut || (heureMin != null && minutesParis(departDom) < heureMin))) return null;   // pas de départ du domicile avant l'heure choisie (chaque jour)
      const attente = premier ? 0 : Math.max(0, c.d - arrivee);
      const decalage = premier ? 0 : Math.max(0, arrivee - c.d);   // arrivée dans le créneau, après son ouverture : mission décalée d'autant
      if (c.acceptee && decalage > 0) return null;
      if (attente > attenteMax) return null;
      // Mission acceptée suivante non encore faite : on ne peut pas partir sur une mission qui commence après elle.
      const prochaine = ancres.find(a => !s.faites.has(a.cle));
      if (prochaine && prochaine !== c && c.d >= prochaine.d) return null;
      const renta = C.rentabiliteComplete(c.m, reg, { approcheKm: km, retourKm: null });
      if (!renta.connu) return null;
      const depart = premier ? departDom : s.depart;
      const etape = { mission: c.m, cle: c.cle, acceptee: c.acceptee, liaison: lien, depuis: s.lieu, attenteH: arr(attente / H), debut: c.d + decalage, fin: c.f + decalage, finEstimee: c.finEstimee, net: renta.net, heures: renta.heures || 0, rentabilite: renta };
      const faites = new Set(s.faites); faites.add(c.cle);
      return { etapes: s.etapes.concat(etape), faites, pos: c.pd, lieu: c.m.to_city || '?', t: c.f + decalage, depart, net: s.net + renta.net, heures: s.heures + (renta.heures || 0), liaisonKm: s.liaisonKm + km, coutLiaisons: s.coutLiaisons + lien.cout };
    };
    const terminer = s => {
      if (!s.etapes.length || ancres.some(a => !s.faites.has(a.cle))) return null;
      const km = G.routeKm(s.pos, dom), lien = C.liaison(km, reg);
      const retour = s.t + lien.heures * H;
      if (retour > finFenetre) return null;
      const nuits = jourParis(retour) - jourParis(s.depart);
      if (nuits > nuitsMax) return null;
      // Nuit à domicile : pas de budget hôtel. En mission à minuit, conserver
      // l'estimation existante (une pause/hébergement peut rester nécessaire).
      let nuitsHotel = 0;
      let instantNuit = s.depart;
      const seuilDomicile = Math.max(0, n(o.seuil_dom) ?? 150);
      for (let i = 0; i < nuits; i++) {
        const minuit = minuitApres(instantNuit);
        const encours = s.etapes.some(e => e.debut < minuit && e.fin > minuit);
        const suivantes = s.etapes.find(e => e.debut >= minuit);
        const terminees = s.etapes.filter(e => e.fin <= minuit);
        const point = suivantes ? G.coordonnees(suivantes.mission, 'origin') :
          terminees.length ? G.coordonnees(terminees[terminees.length - 1].mission, 'destination') : dom;
        let aDomicile = false;
        if (!encours && point && dom) {
          try { const distance = G.routeKm(point, dom); aDomicile = Number.isFinite(distance) && distance < seuilDomicile; } catch (e) {}
        }
        // Une mission en cours à minuit n'est pas une nuit d'hôtel.
        if (!encours && !aDomicile) nuitsHotel++;
        instantNuit = minuit + MIN;
      }
      const coutHotel = arr(nuitsHotel * hotel), coutRetour = lien.cout;
      const net = arr(s.net - coutRetour - coutHotel), heures = arr(s.heures + lien.heures);
      const brut = arr(s.etapes.reduce((x, e) => x + (n(e.mission.fee) || 0), 0));
      return { etapes: s.etapes, depart: s.depart, retour: { km, heures: lien.heures, cout: coutRetour, arrivee: retour }, nuits, coutHotel,
        prestations: brut, netMissions: arr(s.net), net, heures, parHeure: heures > 0 ? arr(net / heures) : null, liaisonKm: s.liaisonKm + km, coutLiaisons: arr(s.coutLiaisons + coutRetour),
        estimations: s.etapes.some(e => e.finEstimee) ? ['heure de fin estimée pour au moins une mission'] : [] };
    };

    let niveau = [{ etapes: [], faites: new Set(), pos: dom, lieu: dom.nom || 'domicile', t: debut, depart: debut, net: 0, heures: 0, liaisonKm: 0, coutLiaisons: 0 }];
    const finis = [];
    for (let prof = 0; prof < o.profondeur && niveau.length; prof++) {
      const suivant = [];
      for (const s of niveau) for (const c of pool) {
        if (s.etapes.length && c.d > s.t + attenteMax + 12 * H) break;   // triées par date : les suivantes sont trop tardives
        if (s.faites.has(c.cle) || c.limite < s.t) continue; const x = etendre(s, c); if (x) { suivant.push(x); const p = terminer(x); if (p) finis.push(p); }
      }
      suivant.sort((a, b) => b.net - a.net);
      // Largeur limitée, en gardant de la diversité sur la dernière mission.
      const vus = new Map(); niveau = [];
      for (const s of suivant) { const k = s.etapes[s.etapes.length - 1].cle; const c = vus.get(k) || 0; if (c >= 6) continue; vus.set(k, c + 1); niveau.push(s); if (niveau.length >= o.largeur) break; }
    }
    const critere = o.tri === 'heure' ? (p => p.parHeure ?? -1e9) : (p => p.net);
    finis.sort((a, b) => critere(b) - critere(a) || b.net - a.net);
    // 3 propositions différentes (première mission différente de préférence).
    const choisis = [], cles = new Set();
    for (const p of finis) { const k = p.etapes[0].cle; if (cles.has(k)) continue; cles.add(k); choisis.push(p); if (choisis.length >= 3) break; }
    for (const p of finis) { if (choisis.length >= 3) break; if (!choisis.includes(p) && !choisis.some(q => q.etapes.map(e => e.cle).join() === p.etapes.map(e => e.cle).join())) choisis.push(p); }
    // Lieu de chaque nuit : destination de la dernière mission terminée avant minuit (calculé pour les plans retenus).
    for (const p of choisis) {
      p.lieuxNuits = []; p.nuitsLiaison = []; let t = p.depart;
      for (let i = 0; i < p.nuits; i++) { const mn = minuitApres(t); const avant = p.etapes.filter(e => e.fin <= mn); const encours = p.etapes.find(e => e.debut < mn && e.fin > mn); // V141 : on dort dans la VILLE DE DÉPART de la mission du lendemain ; le trajet (ville d'arrivée → ville de départ) se fait en soirée.
        const suiv = encours ? null : p.etapes.find(e => e.debut >= mn);
        const seuil = (o.seuil_dom != null ? Number(o.seuil_dom) : 150); const ptN = suiv ? G.coordonnees(suiv.mission, 'origin') : encours ? G.coordonnees(encours.mission, 'destination') : avant.length ? G.coordonnees(avant[avant.length - 1].mission, 'destination') : null; let kmN = null; try { kmN = ptN ? G.routeKm(ptN, dom) : 0; } catch (e) {} (p.nuitsDom = p.nuitsDom || [])[i] = { km: kmN, domicile: kmN != null && kmN < seuil, seuil };
        
        if (suiv && avant.length && suiv.mission.from_city) { const l = suiv.liaison; p.lieuxNuits.push(suiv.mission.from_city); p.nuitsLiaison[i] = { cle: suiv.cle, depuis: avant[avant.length - 1].mission.to_city || '?', km: l.km, heures: l.heures, cout: l.cout }; const ndx = p.nuitsDom[i]; if (ndx && ndx.domicile && dom) { try { const a1 = G.coordonnees(avant[avant.length - 1].mission, 'destination'), b1 = G.coordonnees(suiv.mission, 'origin'); const k1 = G.routeKm(a1, dom), k2 = G.routeKm(dom, b1), l1 = C.liaison(k1, reg), l2 = C.liaison(k2, reg); p.nuitsLiaison[i].soir = { km: k1, heures: l1.heures, cout: l1.cout }; p.nuitsLiaison[i].matin = { km: k2, heures: l2.heures, cout: l2.cout }; } catch (e) {} } }
        else p.lieuxNuits.push(encours ? (encours.mission.to_city || '?') : avant.length ? (avant[avant.length - 1].mission.to_city || '?') : (dom.nom || 'domicile')); t = mn + MIN; }
    }
    res.plans = choisis; res.candidates = pool.length; res.ancres = ancres.length;
    if (ancres.length && !finis.length) res.erreurs.push('acceptees_incompatibles');
    return res;
  }
  // Découpage par jour (heure de Paris) pour l'affichage.
  function parJour(plan) {
    const jours = new Map();
    const push = (t, x) => { const k = jourParis(t); if (!jours.has(k)) jours.set(k, { t, lignes: [] }); jours.get(k).lignes.push(x); };
    push(plan.depart, { type: 'depart', t: plan.depart });
    for (const e of plan.etapes) push(e.debut, { type: 'mission', t: e.debut, etape: e });
    push(plan.retour.arrivee, { type: 'retour', t: plan.retour.arrivee });
    return [...jours.values()];
  }
  // « 2030-10-01 » + « 06:00 » (heure de Paris) → instant (ms).
  function parisVersMs(date, heure, occurrence) {
    const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/), h = String(heure || '00:00').match(/^(\d{1,2}):(\d{2})$/); if (!m || !h) return null;
    const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +h[1], +h[2]);
    const FH = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const dec = t => { const p = {}; for (const x of FH.formatToParts(new Date(t))) p[x.type] = x.value; return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t; };
    let t = utc - dec(utc); t = utc - dec(t);
    // Une heure locale inexistante lors du passage à l'heure d'été ne doit pas être décalée silencieusement.
    const parts = {}; for (const x of FH.formatToParts(new Date(t))) parts[x.type] = x.value;
    if (+parts.year !== +m[1] || +parts.month !== +m[2] || +parts.day !== +m[3] || +parts.hour !== +h[1] || +parts.minute !== +h[2]) return null;
    // L'heure d'hiver répète certaines heures locales : sans décalage explicite,
    // choisir arbitrairement un des deux instants risquerait de décaler une mission.
    const correspondances = [t - 3600000, t, t + 3600000].filter(instant => {
      const q = {}; for (const x of FH.formatToParts(new Date(instant))) q[x.type] = x.value;
      return +q.year === +m[1] && +q.month === +m[2] && +q.day === +m[3] && +q.hour === +h[1] && +q.minute === +h[2];
    }).sort((a, b) => a - b);
    if (correspondances.length > 1) {
      if (occurrence !== 1 && occurrence !== 2) return null;
      return correspondances[occurrence - 1];
    }
    return occurrence == null || occurrence === 1 ? t : null;
  }
  const api = { planifier, parJour, jourParis, minutesParis, parisVersMs, DEFAUTS };
  root.CPPlanning = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
