// Convoyage Ultra — moteur tarifaire de péage VERSIONNÉ (V1).
// Pur (aucun réseau, aucune écriture) : il s'utilise dans l'appli (navigateur) comme dans les tests (Node).
// Règles : un montant n'existe que s'il vient d'un tarif sourcé (PROUVE / CROISE) ou d'un secours explicitement validé ;
// jamais de montant au km ; pas de double facturation ; la date de référence décide de la version applicable.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.CPPeage = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ENGINE_VERSION = '1.1.0';
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

  // --- Horo-saisonnier (V1.1) : tarif qui varie selon le jour de semaine / jour férié / heure de passage. ---
  // Jours fériés fixes + mobiles (calcul de Pâques par l'algorithme de Gauss, déterministe, aucune table codée en dur).
  function pacques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jr = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(annee, mois - 1, jr));
  }
  function ajoursUTC(date, n) { const d = new Date(date.getTime()); d.setUTCDate(d.getUTCDate() + n); return d; }
  function estJourFerie(date) {
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00Z') : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const annee = d.getUTCFullYear(), md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    const fixes = new Set([101, 501, 508, 714, 815, 1101, 1111, 1225]);
    if (fixes.has(md)) return true;
    const pq = pacques(annee);
    const mdOf = dt => (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
    if (md === mdOf(ajoursUTC(pq, 1))) return true; // lundi de Pâques
    if (md === mdOf(ajoursUTC(pq, 39))) return true; // Ascension
    if (md === mdOf(ajoursUTC(pq, 50))) return true; // lundi de Pentecôte
    return false;
  }
  const JOURS_CODE = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  function jourSemaine(date) {
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00Z') : date;
    return JOURS_CODE[d.getUTCDay()];
  }
  // Une fenêtre horaire {jours:[...], ferie:bool, debut:'HH:MM', fin:'HH:MM'} s'applique si :
  //  - la date est un jour férié ET la fenêtre couvre les jours fériés (ferie:true), à l'heure donnée ; sinon
  //  - la date n'est pas un jour férié ET son jour de semaine est dans la liste, à l'heure donnée.
  function fenetreApplique(f, date, heure) {
    if (heure == null) return null; // indéterminé : impossible de trancher sans heure de passage
    const ferie = estJourFerie(date);
    const jourOk = ferie ? !!f.ferie : (f.jours || []).includes(jourSemaine(date));
    if (!jourOk) return false;
    return heure >= f.debut && heure <= f.fin;
  }
  // Renvoie true/false si tranchable, ou null si le contexte dépend de l'heure et qu'aucune heure n'a été fournie.
  function horaireApplique(ctx, date, heure) {
    if (!ctx || !ctx.horaires || !ctx.horaires.length) return true;
    if (heure == null) return null;
    return ctx.horaires.some(f => fenetreApplique(f, date, heure) === true);
  }

  function enVigueur(v, date, heure) {
    if (!(v.effective_from <= date && (!v.effective_to || v.effective_to >= date) && contexteApplique(v.tariff_context, date))) return false;
    const h = horaireApplique(v.tariff_context, date, heure);
    return h === null ? 'INDETERMINE' : h;
  }
  // meilleure() : si une version éligible par période est INDETERMINE (horo-dépendante, pas d'heure fournie),
  // on ne choisit jamais arbitrairement — on le signale via le troisième élément du retour.
  function meilleure(liste, date, heure) {
    let indetermine = false;
    const ok = [];
    for (const v of liste) {
      const e = enVigueur(v, date, heure);
      if (e === true) ok.push(v); else if (e === 'INDETERMINE') indetermine = true;
    }
    const meilleureVersion = ok.sort((a, b) => (b.effective_from > a.effective_from ? 1 : b.effective_from < a.effective_from ? -1 : RANG[b.status] - RANG[a.status]))[0] || null;
    if (!meilleureVersion && indetermine) return 'INDETERMINE';
    return meilleureVersion;
  }

  function creerMoteur(opt) {
    const o = opt || {};
    const versions = (o.versions || []).slice();
    const parBarriere = new Map();
    for (const v of versions) {
      if (v.barrier_station_id) { const k = v.barrier_station_id + '|' + v.vehicle_class; (parBarriere.get(k) || parBarriere.set(k, []).get(k)).push(v); }
    }
    const inconnu = (raison, extra) => Object.assign({ status: 'INCONNU', amount: null, reason: raison }, extra || {});
    // heure (optionnelle) : 'HH:MM' — heure de passage, nécessaire uniquement pour les barrières horo-saisonnières.
    function barriere(id, classe, date, heure) {
      const d = jour(date);
      const v = meilleure(parBarriere.get(id + '|' + classe) || [], d, heure);
      if (v === 'INDETERMINE') return inconnu('tarif variable selon le jour et l\'heure de passage : veuillez indiquer une heure de passage', { origin: 'horaire_indetermine' });
      if (v && v.amount_eur != null) return { status: v.status, amount: Number(v.amount_eur), source: v.source_url, version_id: v.id, effective_from: v.effective_from, origin: 'version' };
      return inconnu('aucun tarif officiel exact pour cette barrière et cette classe');
    }
    // Trajet : passages = suite de { type:'barriere', station, group, passage }. Un même franchissement n'est compté qu'une fois.
    function trajet(passages, classe, date, heure) {
      const lignes = [], vus = new Set();
      for (const p of passages.filter(x => x.type === 'barriere')) {
        const g = p.group || p.station;
        const cle = (p.passage != null ? 'p' + p.passage : 'g' + g) + '|' + g;
        if (vus.has(cle)) continue; vus.add(cle);
        lignes.push({ kind: 'barriere', label: g, ...barriere(g, classe, date, heure) });
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
  return { creerMoteur, contexteApplique, horaireApplique, estJourFerie, jourSemaine, ENGINE_VERSION };
});
