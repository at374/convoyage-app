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

  /**
   * Load a generated day-scoped GTFS JSON file. A missing date file is a
   * normal unavailable state, never a reason to invent a journey.
   */
  async function loadDay(day, fetchImpl, basePath) {
    if (!isISODate(day) || typeof fetchImpl !== 'function') {
      return { usable: false, status: 'parametres_invalides', transportConfirmed: false };
    }
    const base = typeof basePath === 'string' ? basePath.replace(/\/$/, '') : 'data/sibra';
    try {
      const response = await fetchImpl(base + '/sibra-' + day + '.json');
      if (!response || !response.ok) {
        return { usable: false, status: 'horaires_jour_absents', transportConfirmed: false };
      }
      const data = await response.json();
      if (!data || data.date !== day || !Array.isArray(data.stops) ||
          !Array.isArray(data.routes) || !Array.isArray(data.trips) ||
          !Array.isArray(data.stop_times) || data.transportConfirmed !== false ||
          data.realtime !== false) {
        return { usable: false, status: 'donnees_gtfs_invalides', transportConfirmed: false };
      }
      return { usable: true, status: 'horaires_theoriques_disponibles', data, transportConfirmed: false };
    } catch (_) {
      return { usable: false, status: 'chargement_gtfs_impossible', transportConfirmed: false };
    }
  }

  return Object.freeze({ isISODate, assessDate, loadDay });
});
