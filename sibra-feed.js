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

  // Exact-stop, same-vehicle connections using only the selected day's trips.
  // Does not claim a verified pedestrian approach or realtime circulation.
  function directDayJourneys(dayData, fromStopId, toStopId, earliestDepartureSeconds, limit = 8) {
    const tables = normalizeDay(dayData);
    if (!tables || fromStopId === toStopId || !Number.isFinite(earliestDepartureSeconds)) return [];
    const byTrip = new Map();
    for (const t of tables.stop_times) {
      if (!byTrip.has(t.trip_id)) byTrip.set(t.trip_id, []);
      byTrip.get(t.trip_id).push(t);
    }
    const toSeconds = value => {
      const parts = value.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    };
    const found = [];
    for (const [tripId, rows] of byTrip) {
      rows.sort((a, b) => a.stop_sequence - b.stop_sequence);
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].stop_id !== fromStopId) continue;
        const departureSeconds = toSeconds(rows[i].departure_time);
        if (departureSeconds < earliestDepartureSeconds) continue;
        for (let j = i + 1; j < rows.length; j++) {
          if (rows[j].stop_id !== toStopId) continue;
          const arrivalSeconds = toSeconds(rows[j].arrival_time);
          if (arrivalSeconds < departureSeconds) continue;
          found.push({ tripId, fromStopId, toStopId, departureSeconds, arrivalSeconds,
            transportConfirmed: false, realtime: false, walkingVerified: false });
          break;
        }
      }
    }
    found.sort((a, b) => a.departureSeconds - b.departureSeconds ||
      a.arrivalSeconds - b.arrivalSeconds);
    return found.slice(0, Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 8);
  }

  // Browse nearby SIBRA stops without claiming an accessible pedestrian route.
  function nearbyDayStops(dayData, latitude, longitude, radiusMeters = 700, limit = 6) {
    if (!dayData || !Array.isArray(dayData.stops) ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
        !Number.isFinite(radiusMeters) || radiusMeters <= 0) return [];
    const rad = Math.PI / 180;
    const result = [];
    for (const row of dayData.stops) {
      if (!Array.isArray(row) || row.length < 4) continue;
      const lat = Number(row[2]), lon = Number(row[3]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const a = Math.sin((lat - latitude) * rad / 2) ** 2 +
        Math.cos(latitude * rad) * Math.cos(lat * rad) *
        Math.sin((lon - longitude) * rad / 2) ** 2;
      const meters = 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
      if (meters <= radiusMeters) result.push({
        stopId: String(row[0]), name: String(row[1]), latitude: lat, longitude: lon,
        straightLineMeters: Math.round(meters), walkingVerified: false,
        transportConfirmed: false
      });
    }
    result.sort((a, b) => a.straightLineMeters - b.straightLineMeters);
    return result.slice(0, Number.isInteger(limit) && limit > 0 ? Math.min(limit, 30) : 6);
  }

  return Object.freeze({ isISODate, assessDate, loadDay, normalizeDay, directDayJourneys, nearbyDayStops });
});
