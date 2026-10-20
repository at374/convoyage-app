// Convoyage Ultra — moteur tarifaire de péage VERSIONNÉ (V1).
// Pur (aucun réseau, aucune écriture) : il s'utilise dans l'appli (navigateur) comme dans les tests (Node).
// Règles : un montant n'existe que s'il vient d'un tarif sourcé (PROUVE / CROISE) ou d'un secours explicitement validé ;
// jamais de montant au km ; pas de double facturation ; la date de référence décide de la version applicable.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.CPPeage = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ENGINE_VERSION = '1.0.0';
  const RANG = { PROUVE: 3, CROISE: 2, ESTIME_PROVISOIRE: 1, INCONNU: 0 };
  const pire = (a, b) => (RANG[a] <= RANG[b] ? a : b);
  const r2 = x => Math.round(x * 100) / 100;
  const jour = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

  // Contexte tarifaire : saison « JJ/MM-JJ/MM » (peut chevaucher le nouvel an). Sans période = toujours applicable.
  function contexteApplique(ctx, date) {
    if (!ctx || !ctx.periode) return true;
    const m = /^(\d{2})\/(\d{2})-(\d{2})\/(\d{2})$/.exec(ctx.periode);
    if (!m) return false;
    const d = jour(date), mmdd = d.slice(5, 7) + d.slice(8, 10);
    const a = m[2] + m[1], b = m[4] + m[3];
    return a <= b ? mmdd >= a && mmdd <= b : mmdd >= a || mmdd <= b;
  }
  const enVigueur = (v, date) => v.effective_from <= date && (!v.effective_to || v.effective_to >= date) && contexteApplique(v.tariff_context, date);
  const meilleure = (liste, date) => liste.filter(v => enVigueur(v, date))
    .sort((a, b) => (b.effective_from > a.effective_from ? 1 : b.effective_from < a.effective_from ? -1 : RANG[b.status] - RANG[a.status]))[0] || null;

  function creerMoteur(opt) {
    const o = opt || {};
    const versions = (o.versions || []).slice();
    const parBarriere = new Map();
    for (const v of versions) {
      if (v.barrier_station_id) { const k = v.barrier_station_id + '|' + v.vehicle_class; (parBarriere.get(k) || parBarriere.set(k, []).get(k)).push(v); }
    }
    const inconnu = (raison, extra) => Object.assign({ status: 'INCONNU', amount: null, reason: raison }, extra || {});
    function barriere(id, classe, date) {
      const d = jour(date);
      const v = meilleure(parBarriere.get(id + '|' + classe) || [], d);
      if (v && v.amount_eur != null) return { status: v.status, amount: Number(v.amount_eur), source: v.source_url, version_id: v.id, effective_from: v.effective_from, origin: 'version' };
      return inconnu('aucun tarif officiel exact pour cette barrière et cette classe');
    }
    // Trajet : passages = suite de { type:'barriere', station, group, passage }. Un même franchissement n'est compté qu'une fois.
    function trajet(passages, classe, date) {
      const lignes = [], vus = new Set();
      for (const p of passages.filter(x => x.type === 'barriere')) {
        const g = p.group || p.station;
        const cle = (p.passage != null ? 'p' + p.passage : 'g' + g) + '|' + g;
        if (vus.has(cle)) continue; vus.add(cle);
        lignes.push({ kind: 'barriere', label: g, ...barriere(g, classe, date) });
      }
      let total = 0, pireStatut = 'PROUVE', complet = true;
      for (const l of lignes) {
        pireStatut = pire(pireStatut, l.status);
        if (l.amount == null) complet = false; else total += l.amount;
      }
      return { lignes, total: complet ? r2(total) : null, complet, status: lignes.length ? pireStatut : 'PROUVE', classe, date: jour(date), engine_version: ENGINE_VERSION };
    }
    return { barriere, trajet, version: ENGINE_VERSION };
  }
  return { creerMoteur, contexteApplique, ENGINE_VERSION };
});
