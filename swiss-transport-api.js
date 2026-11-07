/* Convoyage Ultra — Swiss public transport API adapter.
 * Timetable source: opentransportdata.swiss, via transport.opendata.ch.
 * Read-only; never changes missions, settings or platform synchronization.
 */
(function(root) {
  'use strict';
  const ENDPOINT = 'https://transport.opendata.ch/v1/connections';
  function stationPoint(station) {
    const coordinate=station?.coordinate;
    if(!coordinate||coordinate.type!=='WGS84'||coordinate.x==null||coordinate.y==null||coordinate.x===''||coordinate.y==='')return undefined;
    const lat=Number(coordinate.x),lon=Number(coordinate.y);
    return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=85&&Math.abs(lon)<=180&&!(lat===0&&lon===0)?{lat,lon}:undefined;
  }
  function point(value) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (!value || value.lat == null || (value.lon == null && value.lng == null)) return null;
    const lat = Number(value.lat), lon = Number(value.lon == null ? value.lng : value.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180 || (lat===0 && lon===0)) return null;
    return lat+','+lon;
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
    const cancel=()=>controller.abort();
    if(options.signal?.aborted)throw new DOMException('Recherche suisse annulée','AbortError');
    options.signal?.addEventListener('abort',cancel,{once:true});
    const timeout = setTimeout(() => controller.abort(), 12000);
    let data;
    try {
      const response = await fetcher(url, {signal:controller.signal, cache:'no-store'});
      if(controller.signal.aborted)throw new DOMException('Recherche suisse annulée','AbortError');
      if (!response.ok) throw new Error('API suisse indisponible ('+response.status+')');
      data = await response.json();
      if(controller.signal.aborted)throw new DOMException('Recherche suisse annulée','AbortError');
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
      sections:Array.isArray(c.sections)?c.sections.slice(0,100).filter(s=>s&&typeof s==='object'&&!Array.isArray(s)).map(s=>({
        mode:s.walk?'WALK':s.journey && s.journey.category || 'UNKNOWN',
        line:s.journey && s.journey.number || null,
        from:s.departure && s.departure.station && s.departure.station.name || null,
        to:s.arrival && s.arrival.station && s.arrival.station.name || null,
        fromPoint:stationPoint(s.departure?.station),toPoint:stationPoint(s.arrival?.station),
        departure:s.departure && s.departure.departure || null,
        arrival:s.arrival && s.arrival.arrival || null,
        walkSeconds:s.walk && Number.isFinite(Number(s.walk.duration)) ? Number(s.walk.duration) : null
      })):[],
      detailsIncomplete:!Array.isArray(c.sections)||c.sections.length>100||c.sections.some(s=>!s||typeof s!=='object'||Array.isArray(s)),
      price:null, fareStatus:'non_communique', source:'transport.opendata.ch', confirmed:false
    }));
    results.diagnostic = {...diagnostic};
    return results;
  }
  root.CPSwissTransport={point,buildUrl,plan};
  if(typeof module!=='undefined' && module.exports) module.exports=root.CPSwissTransport;
})(typeof window!=='undefined'?window:globalThis);
