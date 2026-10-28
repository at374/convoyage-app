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
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
      let response;
      try {
        response = await fetchImpl(base + '/sibra-' + day + '.json',
          controller ? {signal: controller.signal} : undefined);
        if (!response || !response.ok) {
          return { usable: false, status: 'horaires_jour_absents', transportConfirmed: false };
        }
        var data = await response.json();
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
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

  // Deduplicate concurrent requests, but refresh successful day files periodically.
  // This cache only concerns SIBRA data, never platform mission synchronization.
  const dayRequests = new Map();
  const DAY_CACHE_TTL_MS = 15 * 60 * 1000;
  async function loadDayCached(day, fetchImpl, basePath) {
    if (!isISODate(day) || typeof fetchImpl !== 'function') {
      return { usable: false, status: 'parametres_invalides', transportConfirmed: false };
    }
    const key = (typeof basePath === 'string' ? basePath : 'data/sibra') + '/' + day;
    const cached = dayRequests.get(key);
    if (cached && (cached.pending || Date.now() - cached.loadedAt < DAY_CACHE_TTL_MS))
      return cached.promise;
    const entry = { pending: true, loadedAt: 0, promise: loadDay(day, fetchImpl, basePath) };
    dayRequests.set(key, entry);
    entry.promise.then(result => {
      if (dayRequests.get(key) !== entry) return;
      if (!result.usable) dayRequests.delete(key);
      else { entry.pending = false; entry.loadedAt = Date.now(); }
    }, () => { if (dayRequests.get(key) === entry) dayRequests.delete(key); });
    return entry.promise;
  }

  // Convert compact day arrays to GTFS objects consumed by CPSibraPlanner.
  // Validate referential integrity before exposing rows to route search.
  const normalizedDayCache = new WeakMap();
  function normalizeDay(data) {
    if (data && typeof data === 'object' && normalizedDayCache.has(data))
      return normalizedDayCache.get(data);
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
    const normalized = { stops, trips, stop_times: stopTimes };
    normalizedDayCache.set(data, normalized);
    return normalized;
  }

  // Shared across direct and transfer searches for the same validated GTFS day.
  const tripIndexCache = new WeakMap();
  function indexedTrips(tables) {
    if (tripIndexCache.has(tables)) return tripIndexCache.get(tables);
    const byTrip = new Map();
    for (const row of tables.stop_times) {
      if (!byTrip.has(row.trip_id)) byTrip.set(row.trip_id, []);
      byTrip.get(row.trip_id).push(row);
    }
    for (const rows of byTrip.values()) rows.sort((a, b) => a.stop_sequence - b.stop_sequence);
    tripIndexCache.set(tables, byTrip);
    return byTrip;
  }

  // Exact-stop, same-vehicle connections using only the selected day's trips.
  // Does not claim a verified pedestrian approach or realtime circulation.
  function directDayJourneys(dayData, fromStopId, toStopId, earliestDepartureSeconds, limit = 8) {
    const tables = normalizeDay(dayData);
    if (!tables || fromStopId === toStopId || !Number.isFinite(earliestDepartureSeconds)) return [];
    const byTrip = indexedTrips(tables);
    const toSeconds = value => {
      const parts = value.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    };
    const found = [];
    for (const [tripId, rows] of byTrip) {
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

  // Candidate bus journeys between two coordinate pairs; straight-line proximity is
  // not a walking route. Never labels a journey feasible or confirmed.
  function coordinateDayJourneys(dayData, fromLat, fromLon, toLat, toLon,
    earliestDepartureSeconds, options = {}) {
    if (!Number.isFinite(earliestDepartureSeconds)) return [];
    const radius = Number.isFinite(options.radiusMeters) ? options.radiusMeters : 600;
    const origins = nearbyDayStops(dayData, fromLat, fromLon, radius, 5);
    const destinations = nearbyDayStops(dayData, toLat, toLon, radius, 5);
    if (!origins.length || !destinations.length) return [];
    const result = [];
    for (const origin of origins) {
      for (const destination of destinations) {
        if (origin.stopId === destination.stopId) continue;
        for (const ride of directDayJourneys(dayData, origin.stopId, destination.stopId,
          earliestDepartureSeconds, 6)) {
          result.push({ ...ride, originStop: origin, destinationStop: destination,
            approachVerified: false, transportConfirmed: false, realtime: false,
            status: 'horaire_theorique_approche_non_verifiee' });
        }
      }
    }
    result.sort((a, b) => a.departureSeconds - b.departureSeconds ||
      a.arrivalSeconds - b.arrivalSeconds);
    return result.slice(0, 10);
  }

  // One-transfer candidates from the same date-scoped feed. The transfer is at
  // the identical stop_id: no unverified walking connection is assumed.
  function oneTransferDayJourneys(dayData, fromStopId, toStopId, earliestDepartureSeconds, options = {}) {
    const tables = normalizeDay(dayData);
    if (!tables || typeof fromStopId !== 'string' || typeof toStopId !== 'string' ||
        fromStopId === toStopId || !Number.isFinite(earliestDepartureSeconds)) return [];
    const minWait = Number.isFinite(options.minTransferSeconds) ? Math.max(0, options.minTransferSeconds) : 300;
    const maxWait = Number.isFinite(options.maxWaitSeconds) ? Math.max(minWait, options.maxWaitSeconds) : 3600;
    const byTrip = new Map();
    for (const row of tables.stop_times) {
      if (!byTrip.has(row.trip_id)) byTrip.set(row.trip_id, []);
      byTrip.get(row.trip_id).push(row);
    }
    const toSeconds = time => {
      const p = time.split(':').map(Number);
      return p[0] * 3600 + p[1] * 60 + p[2];
    };
    const firstLegs = [], secondLegs = [];
    for (const [tripId, rows] of byTrip) {
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const departureSeconds = toSeconds(rows[i].departure_time);
          const arrivalSeconds = toSeconds(rows[j].arrival_time);
          if (arrivalSeconds < departureSeconds) continue;
          if (rows[i].stop_id === fromStopId && departureSeconds >= earliestDepartureSeconds)
            firstLegs.push({ tripId, fromStopId, toStopId: rows[j].stop_id, departureSeconds, arrivalSeconds });
          if (rows[j].stop_id === toStopId)
            secondLegs.push({ tripId, fromStopId: rows[i].stop_id, toStopId, departureSeconds, arrivalSeconds });
        }
      }
    }
    // Index second legs by transfer stop to avoid comparing unrelated routes.
    const secondByStop = new Map();
    for (const leg of secondLegs) {
      if (!secondByStop.has(leg.fromStopId)) secondByStop.set(leg.fromStopId, []);
      secondByStop.get(leg.fromStopId).push(leg);
    }
    const found = [];
    for (const first of firstLegs) for (const second of (secondByStop.get(first.toStopId) || [])) {
      if (first.tripId === second.tripId) continue;
      const waitSeconds = second.departureSeconds - first.arrivalSeconds;
      if (waitSeconds < minWait || waitSeconds > maxWait) continue;
      found.push({ firstLeg: first, secondLeg: second, transferStopId: first.toStopId,
        transferWaitSeconds: waitSeconds, departureSeconds: first.departureSeconds,
        arrivalSeconds: second.arrivalSeconds, transportConfirmed: false,
        realtime: false, walkingVerified: false, status: 'correspondance_theorique' });
    }
    found.sort((a, b) => a.arrivalSeconds - b.arrivalSeconds || a.departureSeconds - b.departureSeconds);
    return found.slice(0, Number.isInteger(options.limit) && options.limit > 0 ? Math.min(50, options.limit) : 10);
  }

  // Coordinate-based one-transfer candidates; approach and realtime remain unverified.
  function coordinateOneTransferDayJourneys(dayData, fromLat, fromLon, toLat, toLon,
    earliestDepartureSeconds, options = {}) {
    if (!Number.isFinite(earliestDepartureSeconds)) return [];
    const radius = Number.isFinite(options.radiusMeters) ? options.radiusMeters : 600;
    const origins = nearbyDayStops(dayData, fromLat, fromLon, radius, 5);
    const destinations = nearbyDayStops(dayData, toLat, toLon, radius, 5);
    const result = [];
    for (const origin of origins) for (const destination of destinations) {
      if (origin.stopId === destination.stopId) continue;
      for (const journey of oneTransferDayJourneys(dayData, origin.stopId,
        destination.stopId, earliestDepartureSeconds, { ...options, limit: 6 })) {
        result.push({ ...journey, originStop: origin, destinationStop: destination,
          approachVerified: false, transportConfirmed: false, realtime: false });
      }
    }
    result.sort((a, b) => a.arrivalSeconds - b.arrivalSeconds || a.departureSeconds - b.departureSeconds);
    return result.slice(0, 10);
  }

  return Object.freeze({ isISODate, assessDate, loadDay, loadDayCached, normalizeDay, directDayJourneys, nearbyDayStops, coordinateDayJourneys, oneTransferDayJourneys, coordinateOneTransferDayJourneys });
});
