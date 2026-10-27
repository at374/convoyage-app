'use strict';

/**
 * Primitives de calcul pour le futur planificateur SIBRA.
 * Ne constitue pas encore un calculateur d'itinéraire : les courses actives
 * doivent être filtrées par calendrier GTFS et les correspondances validées
 * avant de déclarer un trajet réalisable.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CPSibraPlanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EARTH_KM = 6371.0088;

  function validCoordinate(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function distanceKm(a, b) {
    if (!a || !b || !validCoordinate(a.lat, a.lon) || !validCoordinate(b.lat, b.lon)) return null;
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function nearbyStops(point, stops, maxWalkKm) {
    if (!point || !Array.isArray(stops) || !Number.isFinite(maxWalkKm) || maxWalkKm < 0) return [];
    return stops.map(stop => {
      const km = distanceKm(point, { lat: Number(stop.lat), lon: Number(stop.lon) });
      return km === null ? null : { stop, distanceKm: km };
    }).filter(x => x && x.distanceKm <= maxWalkKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  function parseGtfsTime(value) {
    if (typeof value !== 'string' || !/^(\d{1,3}):([0-5]\d):([0-5]\d)$/.test(value)) return null;
    const [hours, minutes, seconds] = value.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  function departuresAtStop(stopTimes, stopId, notBeforeSeconds, activeTripIds) {
    if (!Array.isArray(stopTimes) || typeof stopId !== 'string' ||
        !Number.isFinite(notBeforeSeconds) || !activeTripIds || typeof activeTripIds.has !== 'function') return [];
    return stopTimes.filter(row =>
      row && String(row.stop_id) === stopId &&
      activeTripIds.has(String(row.trip_id)) &&
      parseGtfsTime(row.departure_time) !== null &&
      parseGtfsTime(row.departure_time) >= notBeforeSeconds
    ).map(row => ({ ...row, departureSeconds: parseGtfsTime(row.departure_time) }))
      .sort((a, b) => a.departureSeconds - b.departureSeconds);
  }

  return Object.freeze({ validCoordinate, distanceKm, nearbyStops, parseGtfsTime, departuresAtStop });
});
