// Activation explicite du fournisseur de trajets du serveur Convoyage Ultra.
// Ne fait aucune requête au chargement et reste désactivé sans configuration.
(function (root) {
  'use strict';
  root.CPFournisseursTransports = Array.isArray(root.CPFournisseursTransports)
    ? root.CPFournisseursTransports : [];
  if (root.CPTransportBackendActive !== true || !root.CPTransportServeur) return;
  try {
    const fournisseur = root.CPTransportServeur.creer({
      chemin: root.CPTransportBackendPath || '/api/transports/rechercher'
    });
    if (!root.CPFournisseursTransports.some(f => f && f.nom === fournisseur.nom)) {
      root.CPFournisseursTransports.push(fournisseur);
    }
  } catch (e) {
    // Ne pas bloquer l'application si la configuration est invalide.
    root.CPTransportBackendErreur = e.message || 'Configuration transport invalide';
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
