'use strict';

/**
 * Contrôle de validité temporelle du flux GTFS SIBRA.
 * Ce module ne calcule pas de trajet et ne confirme pas les perturbations temps réel.
 * Utilisable côté navigateur ou Node.js ; aucune dépendance externe.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CPSibraFeed = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function isISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }

  function assessDate(manifest, day) {
    if (!manifest || !manifest.feedValidity ||
        !isISODate(manifest.feedValidity.from) ||
        !isISODate(manifest.feedValidity.through) ||
        !isISODate(day) ||
        manifest.feedValidity.from > manifest.feedValidity.through) {
      return {
        usable: false,
        status: 'date_flux_invalide',
        message: 'Période de validité du flux SIBRA inconnue ou invalide.',
        transportConfirmed: false
      };
    }

    const inRange = day >= manifest.feedValidity.from && day <= manifest.feedValidity.through;
    if (!inRange) {
      return {
        usable: false,
        status: 'hors_periode_gtfs',
        message: 'Horaires SIBRA non confirmés pour cette date : flux hors période de validité.',
        transportConfirmed: false
      };
    }

    return {
      usable: true,
      status: 'flux_dans_periode',
      message: 'Le flux SIBRA couvre cette date ; les services, correspondances, tarifs et perturbations doivent encore être vérifiés.',
      transportConfirmed: false
    };
  }

  return Object.freeze({ isISODate, assessDate });
});
