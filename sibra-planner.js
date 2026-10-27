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

  function gtfsDateParts(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const date = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return null;
    const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return { compact: day.replace(/-/g, ''), weekday: weekdayNames[date.getUTCDay()] };
  }

  /**
   * Returns service IDs active on a date according to GTFS calendar.txt and
   * calendar_dates.txt. Inputs are arrays of parsed GTFS rows.
   */
  function activeServiceIds(calendarRows, exceptionRows, day) {
    const parts = gtfsDateParts(day);
    if (!parts || !Array.isArray(calendarRows) || !Array.isArray(exceptionRows)) return new Set();
    const active = new Set();

    for (const row of calendarRows) {
      if (!row || row.service_id == null || !row.start_date || !row.end_date) continue;
      const start = String(row.start_date).replace(/-/g, '');
      const end = String(row.end_date).replace(/-/g, '');
      if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end) ||
          start > end || parts.compact < start || parts.compact > end) continue;
      if (String(row[parts.weekday]) === '1') active.add(String(row.service_id));
    }

    for (const row of exceptionRows) {
      if (!row || row.service_id == null || String(row.date).replace(/-/g, '') !== parts.compact) continue;
      if (String(row.exception_type) === '1') active.add(String(row.service_id));
      else if (String(row.exception_type) === '2') active.delete(String(row.service_id));
    }
    return active;
  }

  function activeTripIdsForDate(trips, activeServices) {
    if (!Array.isArray(trips) || !activeServices || typeof activeServices.has !== 'function') return new Set();
    return new Set(trips.filter(row =>
      row && row.trip_id != null && row.service_id != null &&
      activeServices.has(String(row.service_id))
    ).map(row => String(row.trip_id)));
  }

  function parseGtfsTime(value) {
    if (typeof value !== 'string' || !/^(\d{1,3}):([0-5]\d):([0-5]\d)$/.test(value)) return null;
    const [hours, minutes, seconds] = value.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Finds direct rides on the same active GTFS trip between two stops.
   * Caller must pass stop_times rows for the requested service date and the
   * trip IDs already filtered with activeTripIdsForDate().
   */
  function directRides(stopTimes, fromStopId, toStopId, notBeforeSeconds, activeTripIds) {
    if (!Array.isArray(stopTimes) || typeof fromStopId !== 'string' ||
        typeof toStopId !== 'string' || fromStopId === toStopId ||
        !Number.isFinite(notBeforeSeconds) || !activeTripIds || typeof activeTripIds.has !== 'function') return [];

    const byTrip = new Map();
    for (const row of stopTimes) {
      if (!row || row.trip_id == null || row.stop_id == null ||
          !activeTripIds.has(String(row.trip_id))) continue;
      const seq = Number(row.stop_sequence);
      if (!Number.isFinite(seq)) continue;
      const key = String(row.trip_id);
      if (!byTrip.has(key)) byTrip.set(key, []);
      byTrip.get(key).push({ ...row, _seq: seq });
    }

    const results = [];
    for (const [tripId, rows] of byTrip) {
      rows.sort((a, b) => a._seq - b._seq);
      for (let i = 0; i < rows.length; i++) {
        const origin = rows[i];
        if (String(origin.stop_id) !== fromStopId) continue;
        const departure = parseGtfsTime(String(origin.departure_time || ''));
        if (departure === null || departure < notBeforeSeconds) continue;
        const destination = rows.slice(i + 1).find(row => String(row.stop_id) === toStopId);
        if (!destination) continue;
        const arrival = parseGtfsTime(String(destination.arrival_time || destination.departure_time || ''));
        if (arrival === null || arrival < departure) continue;
        results.push({
          trip_id: tripId,
          from_stop_id: fromStopId,
          to_stop_id: toStopId,
          departure_time: origin.departure_time,
          arrival_time: destination.arrival_time || destination.departure_time,
          departureSeconds: departure,
          arrivalSeconds: arrival,
          fromStopSequence: origin._seq,
          toStopSequence: destination._seq
        });
        break;
      }
    }
    return results.sort((a, b) => a.departureSeconds - b.departureSeconds || a.arrivalSeconds - b.arrivalSeconds);
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

  /**
   * Combines direct rides into one-transfer options. Caller supplies rides
   * already filtered for the same service date; this does not infer walking
   * links or guarantee real-time operation.
   */
  function oneTransferJourneys(rides, fromStopId, toStopId, notBeforeSeconds, options) {
    if (!Array.isArray(rides) || typeof fromStopId !== 'string' ||
        typeof toStopId !== 'string' || !Number.isFinite(notBeforeSeconds)) return [];
    const opts = options || {};
    const minTransfer = Number.isFinite(opts.minTransferSeconds) ? Math.max(0, opts.minTransferSeconds) : 300;
    const maxWait = Number.isFinite(opts.maxWaitSeconds) ? Math.max(minTransfer, opts.maxWaitSeconds) : 3600;
    const firstLegs = rides.filter(r => r && r.from_stop_id === fromStopId &&
      r.to_stop_id !== toStopId && Number.isFinite(r.departureSeconds) &&
      Number.isFinite(r.arrivalSeconds) && r.departureSeconds >= notBeforeSeconds);
    const results = [];
    for (const first of firstLegs) {
      for (const second of rides) {
        if (!second || second.from_stop_id !== first.to_stop_id || second.to_stop_id !== toStopId ||
            second.trip_id === first.trip_id || !Number.isFinite(second.departureSeconds) ||
            !Number.isFinite(second.arrivalSeconds)) continue;
        const wait = second.departureSeconds - first.arrivalSeconds;
        if (wait < minTransfer || wait > maxWait || second.arrivalSeconds < second.departureSeconds) continue;
        results.push({
          from_stop_id: fromStopId,
          transfer_stop_id: first.to_stop_id,
          to_stop_id: toStopId,
          firstLeg: first,
          secondLeg: second,
          transferWaitSeconds: wait,
          departureSeconds: first.departureSeconds,
          arrivalSeconds: second.arrivalSeconds,
          totalSeconds: second.arrivalSeconds - first.departureSeconds
        });
      }
    }
    return results.sort((a, b) => a.arrivalSeconds - b.arrivalSeconds || a.totalSeconds - b.totalSeconds);
  }

  return Object.freeze({ validCoordinate, distanceKm, nearbyStops, gtfsDateParts, activeServiceIds, activeTripIdsForDate, parseGtfsTime, departuresAtStop, directRides, oneTransferJourneys });
});
