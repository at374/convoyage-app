// Convoyage Ultra — moteur rapide de consultation des transports.
// Une source doit fournir des trajets datés et vérifiables ; aucun tarif inventé.
(function (root) {
  'use strict';
  const cache = new Map(), enCours = new Map(), idsFournisseurs = new WeakMap();
  let prochainId = 1;
  const idFournisseur = f => { if (!idsFournisseurs.has(f)) idsFournisseurs.set(f, prochainId++); return idsFournisseurs.get(f); };
  const DUREE_CACHE = 3 * 60 * 1000, DUREE_CACHE_PARTIEL = 20 * 1000, MAX_CACHE = 120;
  const propre = v => String(v == null ? '' : v).trim();
  const dateValide = v => Number.isFinite(Date.parse(v));
  const jourValide = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  const cle = q => JSON.stringify([propre(q.depart).toLowerCase(), propre(q.arrivee).toLowerCase(), propre(q.date), propre(q.heure), propre(q.reduction), JSON.stringify(q.cartesReduction || []), JSON.stringify(q.cartesExpiration || {}), propre(q.contrainte), propre(q.departAdresse), propre(q.arriveeAdresse), propre(q.margeMinutes), propre(q.limiteMissionAt)]);
  function valider(trajet) {
    if (!trajet || !dateValide(trajet.departAt) || !dateValide(trajet.arriveeAt) ||
      Date.parse(trajet.arriveeAt) <= Date.parse(trajet.departAt)) return null;
    // Ne pas interpréter une chaîne vide comme un tarif gratuit (Number('') === 0).
    const prix = trajet.prixEUR == null || (typeof trajet.prixEUR === 'string' && !trajet.prixEUR.trim())
      ? null : Number(trajet.prixEUR);
    if (prix !== null && (!Number.isFinite(prix) || prix < 0)) return null;
    const source = propre(trajet.source), verifieLe = propre(trajet.verifieLe);
    // Une simple déclaration « confirmé » ne suffit pas : conserver une trace
    // vérifiable de la source et de la date de consultation.
    const ageVerification = Date.now() - Date.parse(verifieLe);
    // Un horaire ancien ou une vérification datée dans le futur ne prouve
    // pas une disponibilité actuelle. Les résultats restent consultables.
    const confirmationRecente = Number.isFinite(ageVerification) &&
      ageVerification >= 0 && ageVerification <= 15 * 60 * 1000;
    const confirme = trajet.confirme === true && !!source && confirmationRecente;
    return { ...trajet, prixEUR: prix, confirme, source, verifieLe };
  }
  async function rechercher(q, fournisseurs, options = {}) {
    if (!q || !propre(q.depart) || !propre(q.arrivee) || !jourValide(q.date)) throw new Error('Trajet ou date invalide');
    const sources = Array.isArray(fournisseurs) ? fournisseurs.filter(f => f && typeof f.rechercher === 'function') : [];
    // Éviter les requêtes redondantes quand un même fournisseur est enregistré
    // plusieurs fois (par exemple lors d'un rechargement de configuration).
    const uniques = [...new Set(sources)];
    const key = JSON.stringify([cle(q), uniques.map(idFournisseur)]), maintenant = Date.now();
    const precedent = cache.get(key);
    if (precedent && precedent.expire <= maintenant) cache.delete(key);
    if (!options.rafraichir && precedent && precedent.expire > maintenant) {
      // Recalculer la fraîcheur au moment de la lecture du cache.
      // Une confirmation devenue ancienne ne doit pas rester « confirmée ».
      const valeur = {
        ...precedent.valeur,
        trajets: precedent.valeur.trajets.map(t => valider(t)).filter(Boolean),
        cache: true
      };
      if (typeof options.surResultat === 'function') {
        // Même en cas de réponse instantanée du cache, alimenter l'interface.
        for (const fournisseur of uniques) {
          const nom = propre(fournisseur.nom);
          try { const statut = valeur.sources.find(s => s.fournisseur === nom); options.surResultat({ fournisseur: nom, trajets: valeur.trajets.filter(t => t.fournisseur === nom), erreur: statut && statut.erreur || null, cache: true }); } catch (_) {}
        }
      }
      return valeur;
    }
    if (enCours.has(key)) {
      // Une recherche simultanée partage le réseau, mais chaque écran doit
      // recevoir les résultats via son propre callback.
      const actif = enCours.get(key);
      if (typeof options.surResultat === 'function') {
        // Rejouer les fournisseurs déjà terminés avant l'abonnement.
        // Les nouveaux résultats sont diffusés à tous les abonnés.
        for (const precedent of actif.diffuses) {
          try { options.surResultat(precedent); } catch (_) {}
        }
        actif.ecouteurs.add(options.surResultat);
      }
      return actif.promesse;
    }
    // Budget global court : chaque fournisseur travaille en parallèle.
    // Un fournisseur lent ne doit pas retarder l'affichage des autres.
    const timeoutMs = Math.max(250, Math.min(15000, Number(options.timeoutMs) || 3500));
    const ecouteurs = new Set(), diffuses = [];
    if (typeof options.surResultat === 'function') ecouteurs.add(options.surResultat);
    const action = (async () => {
      // Aucun fournisseur : retour immédiat et explicite, sans réseau.
      const resultats = await Promise.all(uniques.map(async f => {
        let minuterie;
        try {
          const lignes = await Promise.race([
            Promise.resolve().then(() => f.rechercher(q)),
            new Promise((_, reject) => { minuterie = setTimeout(() => reject(new Error('délai dépassé')), timeoutMs); })
          ]);
          const valides = Array.isArray(lignes) ? lignes.map(valider).filter(Boolean) : [];
          // Afficher immédiatement les résultats de chaque fournisseur rapide,
          // sans attendre les autres. Le résultat final reste consolidé.
          const notification = { fournisseur: propre(f.nom), trajets: valides.map(t=>({...t,fournisseur:propre(f.nom)})) };
          diffuses.push(notification);
          for (const ecouteur of ecouteurs) {
            try { ecouteur(notification); } catch (_) {}
          }
          return { fournisseur: propre(f.nom), lignes: valides, erreur: null };
        } catch (e) {
          const erreur=e && e.message || 'indisponible';
          // Ne pas laisser l'interface attendre la fin des autres sources
          // pour signaler un fournisseur indisponible ou trop lent.
          const notification={ fournisseur: propre(f.nom), trajets: [], erreur };
          diffuses.push(notification);
          for(const ecouteur of ecouteurs){try{ecouteur(notification);}catch(_){}}
          return { fournisseur: propre(f.nom), lignes: [], erreur };
        }
        finally { clearTimeout(minuterie); }
      }));
      const trajets = resultats.flatMap(r => r.lignes.map(t => ({ ...t, fournisseur: r.fournisseur })))
        .sort((a, b) => Date.parse(a.departAt) - Date.parse(b.departAt));
      const valeur = { trajets, sources: resultats.map(({ fournisseur, erreur }) => ({ fournisseur, erreur })), cache: false,
        avertissement: 'Horaires et prix non confirmés tant qu’une source fiable ne les a pas vérifiés.' };
      // Les réponses partielles valides sont réutilisables pendant une courte
      // durée même lorsqu'un fournisseur secondaire échoue.
      if (sources.length && trajets.length && resultats.some(r => !r.erreur)) {
        if (cache.size >= MAX_CACHE) cache.clear();
        cache.set(key, { valeur, expire: Date.now() + (resultats.some(r => r.erreur) ? DUREE_CACHE_PARTIEL : DUREE_CACHE) });
      }
      return valeur;
    })();
    enCours.set(key, { promesse: action, ecouteurs, diffuses });
    try { return await action; } finally { enCours.delete(key); }
  }
  const api = { rechercher, valider, viderCache: () => cache.clear() };
  root.CPTransportRapide = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
