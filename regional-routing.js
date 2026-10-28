/* Convoyage Ultra — optional regional multimodal routing adapter.
 * An OpenTripPlanner 2.x GraphQL endpoint must be deployed separately.
 * No credentials, mission synchronization or settings are changed here.
 */
(function (root) {
  'use strict';
  const MAX_RESULTS = 12;
  function validPoint(point) {
    return point && point.lat !== null && point.lon !== null &&
      point.lat !== '' && point.lon !== '' &&
      Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)) &&
      Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lon)) <= 180;
  }
  function epochMilliseconds(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return NaN;
    return n < 100000000000 ? n * 1000 : n;
  }
  function parseLeg(leg) {
    return {
      mode: String(leg.mode || ''),
      from: leg.from && leg.from.name || '',
      to: leg.to && leg.to.name || '',
      startTime: epochMilliseconds(leg.startTime),
      endTime: epochMilliseconds(leg.endTime),
      distanceMeters: Number(leg.distance) || 0,
      route: leg.route && (leg.route.shortName || leg.route.longName) || ''
    };
  }
  function parseItinerary(itinerary) {
    const legs = Array.isArray(itinerary.legs) ? itinerary.legs.map(parseLeg) : [];
    return {
      startTime: epochMilliseconds(itinerary.startTime),
      endTime: epochMilliseconds(itinerary.endTime),
      durationSeconds: Number(itinerary.duration),
      walkMeters: Number(itinerary.walkDistance) || 0,
      transfers: Number(itinerary.numberOfTransfers) || 0,
      legs,
      transportConfirmed: false,
      realtime: false,
      status: 'horaire_theorique_a_verifier'
    };
  }
  async function plan({ endpoint, from, to, departure, fetcher, timeoutMs = 12000 }) {
    if (!validPoint(from) || !validPoint(to)) throw new Error('Coordonnees GPS requises');
    if (!Number.isFinite(new Date(departure).getTime())) throw new Error('Date invalide');
    if (!/^https:\/\//.test(String(endpoint || ''))) throw new Error('Endpoint HTTPS requis');
    if (typeof fetcher !== 'function') throw new Error('Fetch indisponible');
    const date = new Date(departure);
    const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit'
    }).formatToParts(date).filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]));
    const localDate = dateParts.year + '-' + dateParts.month + '-' + dateParts.day;
    const localTime = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Paris',
      hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(date);
    const query = `query RegionalRoute($from: Location!, $to: Location!, $date: Date!, $time: Time!) {
      plan(from: $from, to: $to, date: $date, time: $time,
        numItineraries: 12, transportModes: [{mode: WALK},{mode: TRANSIT}]) {
        itineraries {
          startTime endTime duration walkDistance numberOfTransfers
          legs { mode startTime endTime distance
            from { name } to { name } route { shortName longName } }
        }
      }
    }`;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller && typeof setTimeout === 'function' ?
      setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetcher(endpoint, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ query, variables: {
          from: {coordinates: {latitude:Number(from.lat), longitude:Number(from.lon)}},
          to: {coordinates: {latitude:Number(to.lat), longitude:Number(to.lon)}},
          date:localDate, time:localTime
        }}),
        ...(controller ? {signal:controller.signal} : {})
      });
      if (!response.ok) throw new Error('Service itineraires indisponible ('+response.status+')');
      const payload = await response.json();
      if (payload.errors && payload.errors.length) {
        throw new Error('Schema regional incompatible : '+String(payload.errors[0].message || 'GraphQL'));
      }
      const itineraries = payload.data && payload.data.plan && payload.data.plan.itineraries;
      if (!Array.isArray(itineraries)) throw new Error('Reponse itineraires invalide');
      const validItineraries = itineraries.slice(0,MAX_RESULTS).map(parseItinerary)
        .filter(it => Number.isFinite(it.startTime) &&
          Number.isFinite(it.endTime) && it.endTime >= it.startTime);
      return {source:'OpenTripPlanner', date:localDate, updatedAt:new Date().toISOString(),
        itineraries:validItineraries,
        transportConfirmed:false, realtime:false};
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }
  const api = {plan, parseItinerary, validPoint};
  root.CPRegionalRouting = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
