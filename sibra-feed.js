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
          !Array.isArray(data.stop_times) || !data.stops.length || !data.trips.length ||
          !data.stop_times.length || !data.routes.length ||
          data.transportConfirmed !== false ||
          data.realtime !== false) {
        return { usable: false, status: 'donnees_gtfs_invalides', transportConfirmed: false };
      }
      return { usable: true, status: 'horaires_theoriques_disponibles', data, transportConfirmed: false };
    } catch (_) {
      return { usable: false, status: 'chargement_gtfs_impossible', transportConfirmed: false };
    }
  }

  // Convert compact day arrays to GTFS objects consumed by CPSibraPlanner.
  // Validate referential integrity before exposing rows to route search.
  function normalizeDay(data) {
    if (!data || !Array.isArray(data.stops) || !Array.isArray(data.routes) ||
        !Array.isArray(data.trips) || !Array.isArray(data.stop_times)) return null;
    const stops = data.stops.map(r => Array.isArray(r) && r.length >= 4 ?
      { stop_id: String(r[0]), stop_name: String(r[1]), stop_lat: Number(r[2]), stop_lon: Number(r[3]) } : null);
    const trips = data.trips.map(r => Array.isArray(r) && r.length >= 2 ?
      { trip_id: String(r[0]), route_id: String(r[1]), trip_headsign: String(r[2] || '') } : null);
    const stopTimes = data.stop_times.map(r => Array.isArray(r) && r.length >= 5 ?
      { trip_id: String(r[0]), stop_id: String(r[1]), stop_sequence: Number(r[2]),
        arrival_time: String(r[3]), departure_time: String(r[4]) } : null);
    if (!stops.length || !trips.length || !stopTimes.length ||
        stops.includes(null) || trips.includes(null) || stopTimes.includes(null) ||
        stops.some(s => !s.stop_id || !Number.isFinite(s.stop_lat) || !Number.isFinite(s.stop_lon) ||
          s.stop_lat < -90 || s.stop_lat > 90 || s.stop_lon < -180 || s.stop_lon > 180) ||
        trips.some(t => !t.trip_id || !t.route_id) ||
        stopTimes.some(t => !t.trip_id || !t.stop_id || !Number.isInteger(t.stop_sequence) ||
          t.stop_sequence < 0 || !/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(t.departure_time) ||
          !/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(t.arrival_time))) return null;
    const stopIds = new Set(stops.map(s => s.stop_id));
    const tripIds = new Set(trips.map(t => t.trip_id));
    if (stopTimes.some(t => !stopIds.has(t.stop_id) || !tripIds.has(t.trip_id))) return null;
    return { stops, trips, stop_times: stopTimes };
  }

  return Object.freeze({ isISODate, assessDate, loadDay, normalizeDay });
});
