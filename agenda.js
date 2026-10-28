// Convoyage Ultra V79 — analyse de l'Agenda (fonctions pures) : état de chaque mission acceptée,
// conflits horaires entre missions (chevauchement, enchaînement impossible avec la liaison + la marge),
// journal des modifications lisible. Durées et liaisons estimées (voir geo.js / calc.js).
(function (root) {
  'use strict';
  const G = root.CPGeo || (typeof require === 'function' ? require('./geo.js') : null);
  const C = root.CPCalc || (typeof require === 'function' ? require('./calc.js') : null);
  const R = root.CPRetours || (typeof require === 'function' ? require('./retours.js') : null);
  const n = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const H = 3600000, MIN = 60000;

  function etat(m, maintenant) {
    if (m.status === 'annulee') return 'annulee';
    if (m.status === 'terminee') return 'terminee';
    const d = R.debut(m), f = R.fin(m);
    if (f && f.t < maintenant) return 'passee';
    if (d != null && d <= maintenant) return 'en_cours';
    if (d == null) return 'date_inconnue';
    return 'a_venir';
  }

  // Conflit entre a (plus tôt) et b : chevauchement ou temps insuffisant pour aller de l'arrivée de a au départ de b.
  function conflitEntre(a, b, reglages) {
    const fa = R.fin(a), db = R.debut(b); if (!fa || db == null) return null;
    const limite = Date.parse(b.pickup_end || '') || db;   // créneau de prise en charge : heure limite
    const marge = (n((reglages || {}).marge_minutes) ?? 60) * MIN;
    const pa = G.coordonnees(a, 'destination'), pb = G.coordonnees(b, 'origin');
    const km = pa && pb ? G.routeKm(pa, pb) : null;
    // Une ville ou un département ne représente pas une adresse de correspondance.
    const lieuxPrecis = !!(pa && pb && ['gps', 'adresse'].includes(pa.precision) && ['gps', 'adresse'].includes(pb.precision));
    const lien = lieuxPrecis && km != null ? C.liaison(km, reglages) : null;
    const besoin = (lien ? lien.heures * H : 0) + marge;
    const ecart = limite - fa.t;
    const base = { a, b, km, liaisonMin: lien ? Math.round(lien.heures * 60) : null, ecartMin: Math.round(ecart / MIN), besoinMin: Math.round(besoin / MIN), finEstimee: fa.estimee, lieuxConnus: !!lien };
    if (db < fa.t) return { ...base, type: 'chevauchement' };
    // Sans localisation exploitable, ne pas transformer une estimation en conflit de transport.
    // L'interface conserve son avertissement « Transport non confirmé ».
    if (!lien) return null;
    if (ecart < besoin) return { ...base, type: 'trop_juste' };
    return null;
  }

  function analyser(missions, reglages, maintenant = Date.now()) {
    const acc = (missions || []).filter(m => m.kind === 'acceptee');
    const items = acc.map(m => ({ mission: m, cle: R.cle(m), debut: R.debut(m), fin: R.fin(m), etat: etat(m, maintenant), conflits: [] }));
    const actifs = items.filter(x => (x.etat === 'a_venir' || x.etat === 'en_cours') && x.debut != null).sort((x, y) => x.debut - y.debut);
    const conflits = [];
    for (let i = 0; i < actifs.length; i++) for (let j = i + 1; j < actifs.length; j++) {
      const x = actifs[i], y = actifs[j];
      if (x.fin && y.debut > x.fin.t + 24 * H) break;   // au-delà d'une journée d'écart : pas de conflit possible
      const c = conflitEntre(x.mission, y.mission, reglages);
      if (c) { conflits.push(c); x.conflits.push({ avec: y.cle, ...c }); y.conflits.push({ avec: x.cle, ...c }); }
    }
    const ordre = { en_cours: 0, a_venir: 1, date_inconnue: 2, annulee: 3, passee: 4, terminee: 5 };
    items.sort((x, y) => (x.debut ?? 9e15) - (y.debut ?? 9e15) || ordre[x.etat] - ordre[y.etat]);
    return { items, conflits, parCle: Object.fromEntries(items.map(x => [x.cle, x])) };
  }

  const CHAMPS = { prise_en_charge: 'Prise en charge', livraison: 'Livraison', depart: 'Départ', arrivee: 'Arrivée', adresse_depart: 'Adresse de départ', adresse_arrivee: 'Adresse d’arrivée', prix: 'Prix', statut: 'Statut' };
  const STATUTS = { acceptee: 'acceptée', annulee: 'annulée', terminee: 'terminée' };
  function valeur(champ, v) {
    if (champ === 'prise_en_charge' || champ === 'livraison') { const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }); }
    if (champ === 'prix') return Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    if (champ === 'statut') return STATUTS[v] || String(v);
    return String(v);
  }
  function libelleModification(x) { return (CHAMPS[x.champ] || x.champ) + ' : ' + valeur(x.champ, x.de) + ' → ' + valeur(x.champ, x.a); }
  function libelleConflit(c) {
    const trajet = m => (m.from_city || '?') + ' → ' + (m.to_city || '?');
    if (c.type === 'chevauchement') return 'Chevauchement : ' + trajet(c.b) + ' commence avant la fin estimée de ' + trajet(c.a);
    return 'Enchaînement trop juste entre ' + trajet(c.a) + ' et ' + trajet(c.b) + ' : ' + Math.max(0, c.ecartMin) + ' min disponibles pour ' + c.besoinMin + ' min nécessaires' +
      (c.lieuxConnus ? ' (liaison ≈ ' + c.km + ' km, ' + c.liaisonMin + ' min + marge)' : ' (marge seule : lieux non localisés)');
  }
  const api = { analyser, conflitEntre, etat, libelleModification, libelleConflit };
  root.CPAgenda = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
