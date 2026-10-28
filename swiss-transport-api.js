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
  function buildUrl(options) {
    const from=point(options.from), to=point(options.to);
    if (!from || !to) throw new Error('Coordonnées ou arrêts manquants');
    const when=new Date(options.when);
    if (!Number.isFinite(when.getTime())) throw new Error('Date de trajet invalide');
    const p=new URLSearchParams({from,to,date:(() => { const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(when).map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day; })(),time:new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(when),limit:String(Math.min(16,Math.max(1,Number(options.limit)||6)))});
    if(options.arriveBy) p.set('isArrivalTime','1');
    ['train','tram','bus'].forEach(mode=>p.append('transportations[]',mode));
    return ENDPOINT+'?'+p.toString();
  }
  async function plan(options) {
    const url=buildUrl(options);
    const fetcher=options.fetcher || root.fetch;
    if(typeof fetcher!=='function') throw new Error('Réseau indisponible');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let data;
    try {
      const response = await fetcher(url, {signal:controller.signal, cache:'no-store'});
      if (!response.ok) throw new Error('API suisse indisponible ('+response.status+')');
      data = await response.json();
    } finally {
      clearTimeout(timeout);
    }
    if(!data || !Array.isArray(data.connections)) throw new Error('Réponse API suisse invalide');
    return data.connections.filter(c => c && c.from && c.to && Number.isFinite(Date.parse(c.from.departure)) && Number.isFinite(Date.parse(c.to.arrival)) && Date.parse(c.to.arrival) >= Date.parse(c.from.departure)).map(c=>({
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
  }
  root.CPSwissTransport={point,buildUrl,plan};
  if(typeof module!=='undefined' && module.exports) module.exports=root.CPSwissTransport;
})(typeof window!=='undefined'?window:globalThis);
