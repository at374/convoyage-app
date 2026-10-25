// Convoyage Ultra — moteur rapide de consultation des transports.
// Une source doit fournir des trajets datés et vérifiables ; aucun tarif inventé.
(function (root) {
  'use strict';
  const cache = new Map(), enCours = new Map(), idsFournisseurs = new WeakMap();
  let prochainId = 1;
  const idFournisseur = f => { if (!idsFournisseurs.has(f)) idsFournisseurs.set(f, prochainId++); return idsFournisseurs.get(f); };
  const DUREE_CACHE = 3 * 60 * 1000, MAX_CACHE = 120;
  const propre = v => String(v == null ? '' : v).trim();
  const dateValide = v => Number.isFinite(Date.parse(v));
  const cle = q => JSON.stringify([propre(q.depart).toLowerCase(), propre(q.arrivee).toLowerCase(), propre(q.date), propre(q.heure), propre(q.reduction)]);
  function valider(trajet) {
    if (!trajet || !dateValide(trajet.departAt) || !dateValide(trajet.arriveeAt) ||
      Date.parse(trajet.arriveeAt) <= Date.parse(trajet.departAt)) return null;
    const prix = trajet.prixEUR == null ? null : Number(trajet.prixEUR);
    if (prix !== null && (!Number.isFinite(prix) || prix < 0)) return null;
    return { ...trajet, prixEUR: prix, confirme: trajet.confirme === true,
      source: propre(trajet.source), verifieLe: propre(trajet.verifieLe) };
  }
  async function rechercher(q, fournisseurs, options = {}) {
    if (!q || !propre(q.depart) || !propre(q.arrivee) || !dateValide(q.date)) throw new Error('Trajet ou date invalide');
    const sources = Array.isArray(fournisseurs) ? fournisseurs.filter(f => f && typeof f.rechercher === 'function') : [];
    const key = JSON.stringify([cle(q), sources.map(idFournisseur)]), maintenant = Date.now();
    const precedent = cache.get(key);
    if (!options.rafraichir && precedent && precedent.expire > maintenant) return { ...precedent.valeur, cache: true };
    if (enCours.has(key)) return enCours.get(key);
    const timeoutMs = Math.max(250, Math.min(15000, Number(options.timeoutMs) || 3500));
    const action = (async () => {
      const resultats = await Promise.all(sources.map(async f => {
        let minuterie;
        try {
          const lignes = await Promise.race([
            Promise.resolve().then(() => f.rechercher(q)),
            new Promise((_, reject) => { minuterie = setTimeout(() => reject(new Error('délai dépassé')), timeoutMs); })
          ]);
          return { fournisseur: propre(f.nom), lignes: Array.isArray(lignes) ? lignes.map(valider).filter(Boolean) : [], erreur: null };
        } catch (e) { return { fournisseur: propre(f.nom), lignes: [], erreur: e && e.message || 'indisponible' }; }
        finally { clearTimeout(minuterie); }
      }));
      const trajets = resultats.flatMap(r => r.lignes.map(t => ({ ...t, fournisseur: r.fournisseur })))
        .sort((a, b) => Date.parse(a.departAt) - Date.parse(b.departAt));
      const valeur = { trajets, sources: resultats.map(({ fournisseur, erreur }) => ({ fournisseur, erreur })), cache: false,
        avertissement: 'Horaires et prix non confirmés tant qu’une source fiable ne les a pas vérifiés.' };
      if (sources.length && resultats.every(r => !r.erreur)) {
        if (cache.size >= MAX_CACHE) cache.clear();
        cache.set(key, { valeur, expire: Date.now() + DUREE_CACHE });
      }
      return valeur;
    })();
    enCours.set(key, action);
    try { return await action; } finally { enCours.delete(key); }
  }
  const api = { rechercher, valider, viderCache: () => cache.clear() };
  root.CPTransportRapide = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
