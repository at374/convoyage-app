/* Convoyage Ultra — optional regional multimodal routing adapter.
 * Mobilités M public API in the Grenoble area; optional configured OTP elsewhere.
 * No credentials, mission synchronization or settings are changed here.
 */
(function (root) {
  'use strict';
  const MAX_RESULTS = 12;
  function validPoint(point) {
    return point && point.lat !== null && point.lon !== null &&
      point.lat !== '' && point.lon !== '' &&
      Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)) &&
      Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lon)) <= 180 &&
      // A coordinate of (0, 0) is not a usable French mission location.
      !(Number(point.lat) === 0 && Number(point.lon) === 0);
  }
  function epochMilliseconds(value) {
    if (value === null || value === undefined || value === '') return NaN;
    if (typeof value === 'string' && /[Tt]/.test(value)) {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
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
      distanceMeters: leg.distance === null || leg.distance === undefined || leg.distance === '' ? NaN : Number(leg.distance),
      route: leg.route && (leg.route.shortName || leg.route.longName) || ''
    };
  }
  function parseItinerary(itinerary) {
    const legs = Array.isArray(itinerary.legs) ?
      itinerary.legs.map(leg => leg && typeof leg === 'object' ? parseLeg(leg) : null) : [];
    return {
      startTime: epochMilliseconds(itinerary.startTime),
      endTime: epochMilliseconds(itinerary.endTime),
      durationSeconds: Number(itinerary.duration),
      walkMeters: itinerary.walkDistance === null || itinerary.walkDistance === undefined || itinerary.walkDistance === '' ? NaN : Number(itinerary.walkDistance),
      transfers: itinerary.numberOfTransfers === null || itinerary.numberOfTransfers === undefined || itinerary.numberOfTransfers === '' ? NaN : Number(itinerary.numberOfTransfers),
      legs,
      transportConfirmed: false,
      realtime: false,
      status: 'horaire_theorique_a_verifier'
    };
  }
  // Conservative query perimeter, not a claim of complete network coverage.
  function supportsPublic(from, to) {
    return [from, to].every(p => validPoint(p) &&
      Number(p.lat) >= 44.9 && Number(p.lat) <= 45.5 &&
      Number(p.lon) >= 5.3 && Number(p.lon) <= 6.1);
  }
  const abortError = () => new DOMException('Recherche régionale annulée','AbortError');
  function linkCancellation(controller,signal){
    const cancel=()=>controller.abort();
    if(signal?.aborted)throw abortError();
    signal?.addEventListener('abort',cancel,{once:true});
    return ()=>signal?.removeEventListener('abort',cancel);
  }
  async function planPublicM({from, to, departure, arrivalDeadline, fetcher, timeoutMs, signal}) {
    if (!supportsPublic(from,to)) throw new Error('Hors perimetre Mobilites M');
    if (typeof fetcher !== 'function') throw new Error('Fetch indisponible');
    const boundary = new Date(arrivalDeadline || departure);
    if (!Number.isFinite(boundary.getTime())) throw new Error('Date invalide');
    if (!Number.isFinite(Number(timeoutMs)) || Number(timeoutMs) <= 0)
      throw new Error('Delai de requete invalide');
    const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', {
      timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(boundary).map(p => [p.type,p.value]));
    const url = new URL('https://data.mobilites-m.fr/api/routers/default/plan');
    Object.entries({fromPlace:from.lat+','+from.lon,toPlace:to.lat+','+to.lon,
      date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute,
      arriveBy:String(!!arrivalDeadline),mode:'TRANSIT,WALK',numItineraries:'5'
    }).forEach(([key,value]) => url.searchParams.set(key,value));
    const controller = new AbortController();
    const unlink=linkCancellation(controller,signal);
    const timer = setTimeout(() => controller.abort(),Number(timeoutMs));
    try {
      const response = await fetcher(url.href, {signal:controller.signal,
        credentials:'omit',cache:'no-cache',referrerPolicy:'no-referrer'});
      if (!response.ok) throw new Error('Mobilites M indisponible ('+response.status+')');
      const payload = await response.json();
      if (payload.error || !Array.isArray(payload.plan && payload.plan.itineraries))
        throw new Error('Reponse Mobilites M invalide ou trajet indisponible');
      const itineraries = payload.plan.itineraries.slice(0,100).map(it => {
        if (!it || !Array.isArray(it.legs)) return null;
        const converted = parseItinerary({...it,numberOfTransfers:it.transfers,
          legs:it.legs.map(leg => ({...leg,route:{shortName:leg.routeShortName || ''}}))});
        const allowed = ['WALK','BUS','TRAM','SUBWAY','RAIL'];
        if (!Number.isFinite(converted.startTime) || !Number.isFinite(converted.endTime) ||
          converted.endTime < converted.startTime || !converted.legs.length ||
          !Number.isFinite(converted.walkMeters) || converted.walkMeters < 0 ||
          !Number.isInteger(converted.transfers) || converted.transfers < 0 ||
          !Number.isFinite(converted.durationSeconds) || converted.durationSeconds <= 0 ||
          Math.abs((converted.endTime-converted.startTime)/1000-converted.durationSeconds)>120 ||
          (arrivalDeadline ? converted.endTime > boundary.getTime() : converted.startTime < boundary.getTime()) ||
          !converted.legs.some(leg => leg && leg.mode !== 'WALK') ||
          !converted.legs.every((leg,i) => leg && allowed.includes(leg.mode) &&
            Number.isFinite(leg.distanceMeters) && leg.distanceMeters >= 0 &&
            Number.isFinite(leg.startTime) && Number.isFinite(leg.endTime) &&
            leg.endTime >= leg.startTime && leg.startTime >= converted.startTime &&
            leg.endTime <= converted.endTime &&
            (i === 0 || leg.startTime >= converted.legs[i-1].endTime))) return null;
        return converted;
      }).filter(Boolean).slice(0,MAX_RESULTS);
      return {source:'Mobilités M',date:parts.year+'-'+parts.month+'-'+parts.day,
        updatedAt:new Date().toISOString(),itineraries,transportConfirmed:false,realtime:false};
    } finally {clearTimeout(timer);unlink();}
  }
  async function requestPlan({ endpoint, from, to, departure, arrivalDeadline, fetcher, timeoutMs = 12000, signal }) {
    if (!endpoint) return planPublicM({from,to,departure,arrivalDeadline,fetcher,timeoutMs,signal});
    if (!validPoint(from) || !validPoint(to)) throw new Error('Coordonnees GPS requises');
    if (departure === null || departure === undefined ||
        !Number.isFinite(new Date(departure).getTime())) throw new Error('Date invalide');
    let routingUrl;
    try {
      routingUrl = new URL(String(endpoint || ''));
    } catch (_) {
      throw new Error('Endpoint HTTPS requis');
    }
    if (routingUrl.protocol !== 'https:' || !routingUrl.hostname ||
        routingUrl.username || routingUrl.password) {
      throw new Error('Endpoint HTTPS requis');
    }
    if (typeof fetcher !== 'function') throw new Error('Fetch indisponible');
    const date = new Date(departure);
    const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit'
    }).formatToParts(date).filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]));
    const localDate = dateParts.year + '-' + dateParts.month + '-' + dateParts.day;
    const localTime = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Paris',
      hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(date);
    // OpenTripPlanner 2.x uses a planConnection query. The old plan query
    // is retained only for installations exposing the legacy schema.
    const query = `query RegionalRoute($from: Location!, $to: Location!, $date: Date!, $time: Time!) {
      planConnection(origin: $from, destination: $to, dateTime: {date: $date, time: $time},
        first: 12, modes: {transportModes: [{mode: WALK},{mode: TRANSIT}]}) {
        edges { node {
          startTime endTime duration walkDistance numberOfTransfers
          legs { mode startTime endTime distance
            from { name } to { name } route { shortName longName } }
        }}
      }
    }`;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (!Number.isFinite(Number(timeoutMs)) || Number(timeoutMs) <= 0)
      throw new Error('Delai de requete invalide');
    const timer = controller && typeof setTimeout === 'function' ?
      setTimeout(() => controller.abort(), Number(timeoutMs)) : null;
    const unlink=controller?linkCancellation(controller,signal):()=>{};
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
      const planData = payload.data &&
        (payload.data.planConnection || payload.data.plan);
      // OTP 2 installations differ: some expose plan.itineraries, others
      // expose plan.edges[].node. Accept both without inventing departures.
      const itineraries = planData && (Array.isArray(planData.itineraries) ?
        planData.itineraries : Array.isArray(planData.edges) ?
        planData.edges.map(edge => edge && edge.node).filter(Boolean) : null);
      if (!Array.isArray(itineraries)) throw new Error('Reponse itineraires invalide');
      const validItineraries = itineraries.filter(it => it && typeof it === 'object')
        .map(parseItinerary)
        .filter(it => Number.isFinite(it.startTime) &&
          Number.isFinite(it.endTime) && it.endTime >= it.startTime &&
          it.startTime >= date.getTime() - 60000 &&
          Number.isFinite(it.durationSeconds) && it.durationSeconds > 0 &&
          Math.abs((it.endTime - it.startTime) / 1000 - it.durationSeconds) <= 120 &&
          it.legs.length > 0 &&
          Number.isFinite(it.walkMeters) && it.walkMeters >= 0 &&
          Number.isInteger(it.transfers) && it.transfers >= 0 &&
          it.legs.every((leg, index) => leg !== null &&
            String(leg.mode).trim().length > 0 &&
            Number.isFinite(leg.distanceMeters) && leg.distanceMeters >= 0 &&
            Number.isFinite(leg.startTime) &&
            Number.isFinite(leg.endTime) && leg.endTime >= leg.startTime &&
            leg.startTime >= it.startTime - 60000 &&
            leg.endTime <= it.endTime + 60000 &&
            (index === 0 || leg.startTime >= it.legs[index - 1].endTime)))
        .sort((a,b) => a.endTime - b.endTime || a.startTime - b.startTime)
        .filter((it,index,all) => all.findIndex(other =>
          other.startTime === it.startTime && other.endTime === it.endTime &&
          other.legs.length === it.legs.length &&
          other.legs.every((leg, legIndex) => {
            const candidate = it.legs[legIndex];
            return leg.mode === candidate.mode && leg.route === candidate.route &&
              leg.from === candidate.from && leg.to === candidate.to &&
              leg.startTime === candidate.startTime && leg.endTime === candidate.endTime;
          })) === index)
        .slice(0,MAX_RESULTS);
      return {source:'OpenTripPlanner', date:localDate, updatedAt:new Date().toISOString(),
        itineraries:validItineraries,
        transportConfirmed:false, realtime:false};
    } finally {
      if (timer !== null) clearTimeout(timer);
      unlink();
    }
  }
  // Evaluate real routed itineraries against the mission's exact deadline.
  // This never upgrades theoretical timetable data to confirmed transport.
  function feasibleBefore(itineraries, deadline, marginMinutes = 30) {
    const latest = deadline === null || deadline === undefined || deadline === '' ? NaN : new Date(deadline).getTime();
    const margin = Number(marginMinutes);
    if (!Number.isFinite(latest) || !Number.isFinite(margin) || margin < 0)
      return [];
    return (Array.isArray(itineraries) ? itineraries : [])
      .filter(it => it && Number.isFinite(it.startTime) &&
        Number.isFinite(it.endTime) && it.endTime >= it.startTime &&
        it.endTime <= latest - margin * 60000 &&
        Array.isArray(it.legs) && it.legs.length > 0 &&
        it.legs.every(leg => leg && Number.isFinite(leg.startTime) &&
          Number.isFinite(leg.endTime) && leg.endTime >= leg.startTime &&
          Number.isFinite(leg.distanceMeters) && leg.distanceMeters >= 0))
      .sort((a,b) => a.endTime - b.endTime || a.startTime - b.startTime);
  }
  // A journey connecting two missions must depart after the vehicle delivery
  // and arrive before the next pickup, allowing a configurable safety buffer.
  function feasibleBetween(itineraries, deliveryEnd, nextPickup, marginMinutes = 30) {
    const earliest = deliveryEnd === null || deliveryEnd === undefined || deliveryEnd === '' ? NaN : new Date(deliveryEnd).getTime();
    if (!Number.isFinite(earliest)) return [];
    return feasibleBefore(itineraries, nextPickup, marginMinutes)
      .filter(it => it.startTime >= earliest);
  }
  // Memory only: bounded lifetime, no GPS or itinerary persisted to storage.
  const recentPlans = new Map();
  const pendingPlans = new Map();
  const fetcherIds = new WeakMap();
  let nextFetcherId = 0;
  function copyResult(value) { return JSON.parse(JSON.stringify(value)); }
  async function plan(options) {
    if(options.signal?.aborted)throw abortError();
    const fetcher = options.fetcher;
    if (typeof fetcher !== 'function') return requestPlan(options);
    if (!fetcherIds.has(fetcher)) fetcherIds.set(fetcher, ++nextFetcherId);
    const key = JSON.stringify([fetcherIds.get(fetcher), options.endpoint || '',
      options.from, options.to, options.departure, options.arrivalDeadline || '',
      options.timeoutMs === undefined ? 12000 : options.timeoutMs]);
    const now = Date.now();
    for (const [k, entry] of recentPlans) if (entry.expires <= now) recentPlans.delete(k);
    if (options.refresh) recentPlans.delete(key);
    if (!options.refresh && recentPlans.has(key)) return copyResult(recentPlans.get(key).value);
    let entry=pendingPlans.get(key);
    if(!entry||entry.controller.signal.aborted){
      entry={controller:new AbortController(),users:new Set(),settled:false};
      const current=entry;
      current.promise=requestPlan({...options,signal:current.controller.signal}).then(value=>{
        if(!current.controller.signal.aborted){
          if(recentPlans.size>=64)recentPlans.delete(recentPlans.keys().next().value);
          recentPlans.set(key,{expires:Date.now()+60000,value:copyResult(value)});
        }
        return value;
      }).finally(()=>{current.settled=true;if(pendingPlans.get(key)===current)pendingPlans.delete(key);});
      pendingPlans.set(key,current);
    }
    return new Promise((resolve,reject)=>{
      const user={},signal=options.signal;let finished=false;
      entry.users.add(user);
      const cleanup=()=>{
        entry.users.delete(user);signal?.removeEventListener('abort',cancel);
        if(!entry.settled&&!entry.users.size){entry.controller.abort();if(pendingPlans.get(key)===entry)pendingPlans.delete(key);}
      };
      const cancel=()=>{if(finished)return;finished=true;cleanup();reject(abortError());};
      signal?.addEventListener('abort',cancel,{once:true});
      entry.promise.then(value=>{if(finished)return;finished=true;cleanup();resolve(copyResult(value));},
        error=>{if(finished)return;finished=true;cleanup();reject(error);});
      if(signal?.aborted)cancel();
    });
  }
  const api = {plan, parseItinerary, validPoint, feasibleBefore, feasibleBetween, supportsPublic};
  root.CPRegionalRouting = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

