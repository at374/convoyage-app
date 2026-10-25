// Convoyage Ultra — adaptateur optionnel pour un calculateur d'itinéraires hébergé.
// Aucun service externe, abonnement ou dépense n'est déclenché par ce fichier.
// Le serveur doit renvoyer des trajets datés ; les tarifs inconnus restent null.
(function (root) {
  'use strict';
  function creer(options = {}) {
    const chemin = options.chemin || '/api/transports/rechercher';
    if (!/^\/[a-z0-9/_-]+$/i.test(chemin) || chemin.startsWith('//')) {
      throw new Error('Chemin de transport local invalide');
    }
    const nom = options.nom || 'Calculateur de transports';
    const maxResultats = 500;
    return {
      nom,
      async rechercher(q) {
        const controller = new AbortController();
        const minuterie = setTimeout(() => controller.abort(), 3000);
        try {
          const reponse = await fetch(chemin, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            signal: controller.signal,
            body: JSON.stringify(q)
          });
          if (!reponse.ok) throw new Error('Service transport indisponible (' + reponse.status + ')');
          const donnees = await reponse.json();
          if (!donnees || !Array.isArray(donnees.trajets) || donnees.trajets.length > maxResultats) {
            throw new Error('Réponse transport invalide ou trop volumineuse');
          }
          // Le moteur principal valide ensuite chaque horaire, prix et source.
          return donnees.trajets;
        } finally {
          clearTimeout(minuterie);
        }
      }
    };
  }
  root.CPTransportServeur = { creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = { creer };
})(typeof globalThis !== 'undefined' ? globalThis : this);
