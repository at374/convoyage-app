// Convoyage Ultra V96 — filtres des missions par client (société), véhicule, distance et durée ; totaux des factures par mois.
// Fonctions pures (testées sous Node), utilisées par l'application téléphone.
(function (root) {
  'use strict';
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const n = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const jourParis = iso => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date(t)) : ''; };
  const tri = l => [...new Set(l.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  // V99 : libellés bruts de la plateforme → français (missions déjà enregistrées comprises).
  const LIBELLES = { energy: { plugin_hybrid: 'Hybride rechargeable', plug_in_hybrid: 'Hybride rechargeable', hybrid_plugin: 'Hybride rechargeable' }, category: { particular: 'Particulière' } };
  function francais(missions) {
    for (const m of missions || []) { const v = m && m.vehicle; if (!v || typeof v !== 'object') continue;
      for (const k of ['energy', 'category']) { const t = LIBELLES[k][String(v[k] || '').trim().toLowerCase()]; if (t) v[k] = t; } }
    return missions || [];
  }
  // Valeurs proposées dans les listes déroulantes, d'après les missions reçues.
  function options(missions) {
    const l = missions || [];
    return { clients: tri(l.map(m => m.client)), types: tri(l.map(m => m.vehicle && m.vehicle.category)), energies: tri(l.map(m => m.vehicle && m.vehicle.energy)), marques: tri(l.map(m => m.vehicle && m.vehicle.brand)) };
  }
  // f : { client, type, energie, marque, kmMin, kmMax, dureeMax } ; dureeDe(m) → heures (durée de la plateforme, sinon estimée).
  function appliquer(missions, f, dureeDe) {
    f = f || {}; const kmMin = n(f.kmMin), kmMax = n(f.kmMax), dMax = n(f.dureeMax);
    return (missions || []).filter(m => {
      const v = m.vehicle || {};
      if (f.client && norm(m.client) !== norm(f.client)) return false;
      if (f.type && norm(v.category) !== norm(f.type)) return false;
      if (f.energie && norm(v.energy) !== norm(f.energie)) return false;
      if (f.marque && norm(v.brand) !== norm(f.marque)) return false;
      const km = n(m.distance_km);
      if (kmMin != null && (km == null || km < kmMin)) return false;
      if (kmMax != null && (km == null || km > kmMax)) return false;
      if (f.dateDeb) { const j = jourParis(m.pickup_end || m.pickup_start || m.delivery_start); if (!j || j < f.dateDeb) return false; }
      if (f.dateFin) { const j = jourParis(m.delivery_end || m.delivery_start || m.pickup_start); if (!j || j > f.dateFin) return false; }
      if (dMax != null) { const h = n(m.duree_h) ?? (dureeDe ? n(dureeDe(m)) : null); if (h == null || h > dMax) return false; }
      return true;
    });
  }
  const actifs = f => ['client', 'type', 'energie', 'marque', 'kmMin', 'kmMax', 'dureeMax', 'dateDeb', 'dateFin'].filter(k => f && f[k] != null && f[k] !== '').length;

  // ---------- Factures : uniquement les factures VALIDÉES par la plateforme (dont payées) ----------
  // Bénéfice estimé = prestation facturée − cotisations (taux des Réglages) ; les frais sont avancés puis remboursés (effet nul).
  const arr = v => Math.round(v * 100) / 100;
  function moisParis(iso) { try { const p = {}; for (const e of new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso))) p[e.type] = e.value; return p.year + '-' + p.month; } catch (_) { return ''; } }
  function parMois(factures, tauxCotisations) {
    const taux = n(tauxCotisations) ?? 0, mois = new Map();
    for (const f of factures || []) {
      if (!f || n(f.total) == null || !f.emise_le) continue;
      const k = moisParis(f.emise_le); if (!k) continue;
      const g = mois.get(k) || { mois: k, factures: [], prestation: 0, frais: 0, total: 0, paye: 0, enAttente: 0, trajets: 0, trajetsPayes: 0, trajetsEnAttente: 0, prestationPayee: 0, prestationEnAttente: 0 };
      const pr = n(f.prestation) ?? 0, fr = n(f.frais) ?? 0, to = n(f.total);
      g.factures.push(f); g.prestation = arr(g.prestation + pr); g.frais = arr(g.frais + fr); g.total = arr(g.total + to);
      const nt = Math.max(0, Math.round(n(f.nb_trajets) ?? 0)); g.trajets += nt;   // V97 : missions facturées payées / non payées, par mois
      if (f.statut === 'payee') { g.paye = arr(g.paye + to); g.trajetsPayes += nt; g.prestationPayee = arr(g.prestationPayee + pr); } else { g.enAttente = arr(g.enAttente + to); g.trajetsEnAttente += nt; g.prestationEnAttente = arr(g.prestationEnAttente + pr); }
      mois.set(k, g);
    }
    const l = [...mois.values()].sort((a, b) => b.mois.localeCompare(a.mois));
    for (const g of l) { g.cotisations = arr(g.prestation * taux / 100); g.benefice = arr(g.prestation - g.cotisations); g.factures.sort((a, b) => String(b.emise_le).localeCompare(String(a.emise_le))); }
    return l;
  }
  function parAnnee(moisListe) {
    const an = new Map();
    for (const g of moisListe || []) { const a = g.mois.slice(0, 4), x = an.get(a) || { annee: a, prestation: 0, frais: 0, total: 0, paye: 0, enAttente: 0, cotisations: 0, benefice: 0, nb: 0, trajets: 0, trajetsPayes: 0, trajetsEnAttente: 0, prestationPayee: 0, prestationEnAttente: 0 };
      for (const k of ['prestation', 'frais', 'total', 'paye', 'enAttente', 'cotisations', 'benefice', 'trajets', 'trajetsPayes', 'trajetsEnAttente', 'prestationPayee', 'prestationEnAttente']) x[k] = arr(x[k] + g[k]); x.nb += g.factures.length; an.set(a, x); }
    return [...an.values()].sort((a, b) => b.annee.localeCompare(a.annee));
  }
  // V97 : missions acceptées EFFECTUÉES ou ANNULÉES qui ne figurent encore dans aucune facture validée.
  // Une mission annulée au dernier moment reste payée : elle est listée (montant à confirmer par la facture de la plateforme).
  function aFacturer(missions, maintenant) {
    const t0 = maintenant ?? Date.now(), mois = new Map();
    for (const m of missions || []) {
      if (!m || m.kind !== 'acceptee' || (m.fees && (m.fees.facture_id != null || m.fees.facture_sortie))) continue;
      const fin = Date.parse(m.delivery_end || m.delivery_start || ''), deb = Date.parse(m.pickup_start || '');
      const annulee = m.status === 'annulee';
      const faite = m.status === 'terminee' || (Number.isFinite(fin) ? fin < t0 : (Number.isFinite(deb) && deb + 12 * 3600000 < t0));
      if (!annulee && !faite) continue;
      const ref = Number.isFinite(deb) ? deb : (Number.isFinite(fin) ? fin : null);
      const k = ref != null ? moisParis(new Date(ref).toISOString()) : 'inconnu';
      const g = mois.get(k) || { mois: k, lignes: [], prestation: 0, frais: 0, annulees: 0, prestationAnnulees: 0 };
      const pr = n(m.fee) ?? 0, fr = Object.entries(m.fees || {}).filter(([c]) => !/^(devis|facture)_/.test(c)).map(([, v]) => n(v) ?? 0).reduce((s, x) => s + x, 0);
      const etat = n(m.fees && m.fees.facture_attente) || 0, confirme = etat > 0;   // V98 : montant réel lu dans « Mes factures » (1 = à valider par toi, 2 = en cours de préparation)
      g.lignes.push({ mission: m, annulee, prestation: pr, frais: arr(fr), date: ref, etat, confirme });
      if (annulee && !confirme) { g.annulees++; g.prestationAnnulees = arr(g.prestationAnnulees + pr); } else { g.prestation = arr(g.prestation + pr); g.frais = arr(g.frais + fr); }
      mois.set(k, g);
    }
    const l = [...mois.values()].sort((a, b) => b.mois.localeCompare(a.mois));
    for (const g of l) g.lignes.sort((a, b) => (b.date ?? -1) - (a.date ?? -1));
    return l;
  }
  const api = { options, appliquer, actifs, parMois, parAnnee, moisParis, aFacturer, francais };
  root.CPFiltres = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
