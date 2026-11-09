/* Convoyage Ultra — Swiss public transport API adapter.
 * Timetable source: opentransportdata.swiss, via transport.opendata.ch.
 * Read-only; never changes missions, settings or platform synchronization.
 */
(function(root) {
  'use strict';
  const ENDPOINT = 'https://transport.opendata.ch/v1/connections';
  function point(value) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (!value || value.lat == null || (value.lon == null && value.lng == null)) return null;
    const lat = Number(value.lat), lon = Number(value.lon == null ? value.lng : value.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180 || (lat===0 && lon===0)) return null;
    return lat+','+lon;
  }
  function supports(from,to) {
    const inside=(value,minLat,minLon,maxLat,maxLon)=>{
      if(!value||!point(value)||typeof value==='string')return false;
      const lat=Number(value.lat),lon=Number(value.lon??value.lng);
      return lat>=minLat&&lat<=maxLat&&lon>=minLon&&lon<=maxLon;
    };
    // Search envelope only, including nearby French approaches to Geneva.
    const region=value=>inside(value,45.8,5.65,46.65,6.85);
    const corridor=value=>inside(value,46.12,5.95,46.62,6.78);
    return region(from)&&region(to)&&(corridor(from)||corridor(to));
  }
  function buildUrl(options) {
    const from=point(options.from), to=point(options.to);
    if (!from || !to) throw new Error('Coordonnées ou arrêts manquants');
    const when=new Date(options.when);
    if (!Number.isFinite(when.getTime())) throw new Error('Date de trajet invalide');
    const p=new URLSearchParams({from,to,date:(() => { const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(when).map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day; })(),time:new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(when),limit:String(Math.min(16,Math.max(1,Number(options.limit)||6)))});
    if(options.arriveBy) p.set('isArrivalTime','1');
    // transport.opendata.ch expects the Swiss transport categories in transportations[].
    // Include S-Bahn and regional trains, in addition to intercity trains, trams and buses.
    ['train','tram','bus'].forEach(mode=>p.append('transportations[]',mode));
    return ENDPOINT+'?'+p.toString();
  }
  async function plan(options) {
    const url=buildUrl(options);
    const diagnostic = {checkedAt:new Date().toISOString(),received:0,valid:0,status:'pending'};
    root.CPSwissTransport.lastCheck = diagnostic;
    const fetcher=options.fetcher || root.fetch;
    if(typeof fetcher!=='function') {
      diagnostic.status = 'error';
      throw new Error('Réseau indisponible');
    }
    const controller = new AbortController();
    const cancel=()=>controller.abort(options.signal.reason);
    options.signal?.addEventListener('abort',cancel,{once:true});
    if(options.signal?.aborted)cancel();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let data;
    try {
      if(controller.signal.aborted)throw controller.signal.reason;
      const response = await fetcher(url, {signal:controller.signal, cache:'no-store'});
      if (!response.ok) throw new Error('API suisse indisponible ('+response.status+')');
      data = await response.json();
    } catch (error) {
      diagnostic.status = 'error';
      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort',cancel);
    }
    if(!data || !Array.isArray(data.connections)) {
      diagnostic.status = 'invalid_response';
      throw new Error('Réponse API suisse invalide');
    }
    // Diagnostic is local to the browser and never includes user GPS or addresses.
    diagnostic.received = data.connections.length;
    // Bound client-side processing even if the upstream API ignores the requested limit.
    const validConnections = data.connections.slice(0, 100).filter(c => c && c.from && c.to && Number.isFinite(Date.parse(c.from.departure)) && Number.isFinite(Date.parse(c.to.arrival)) && Date.parse(c.to.arrival) >= Date.parse(c.from.departure));
    diagnostic.valid = validConnections.length;
    diagnostic.status = 'success';
    const results = validConnections.map(c=>({
      departure:c.from && c.from.departure || null,
      arrival:c.to && c.to.arrival || null,
      sections:Array.isArray(c.sections)?c.sections.map(s=>({
        mode:s.walk?'WALK':s.journey && s.journey.category || 'UNKNOWN',
        line:s.journey && s.journey.number || null,
        from:s.departure && s.departure.station && s.departure.station.name || null,
        to:s.arrival && s.arrival.station && s.arrival.station.name || null,
        departure:s.departure && s.departure.departure || null,
        arrival:s.arrival && s.arrival.arrival || null,
        walkSeconds:s.walk && Number.isFinite(Number(s.walk.duration)) ? Number(s.walk.duration) : null
      })):[],
      price:null, fareStatus:'non_communique', source:'transport.opendata.ch', confirmed:false
    }));
    results.diagnostic = {...diagnostic};
    return results;
  }
  root.CPSwissTransport={point,supports,buildUrl,plan};
  if(typeof module!=='undefined' && module.exports) module.exports=root.CPSwissTransport;
})(typeof window!=='undefined'?window:globalThis);
