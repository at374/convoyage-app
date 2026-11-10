/* Optional TripGo client. The private key stays on the device and in HTTPS headers.
 * Provider availability and zero-cost walking never certify transit fares or service.
 */
(function(root){
'use strict';
const URL_BASE='https://api.tripgo.com/v1/routing.json',KEY='cp_tripgo_key',cache=new Map();
const point=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon??p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lon??p.lng)<=180;
const coord=p=>({lat:p.lat,lon:p.lon??p.lng});
function time(value){
 if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(value))return NaN;
 const day=Date.parse(value.slice(0,10)+'T12:00:00Z');
 return Number.isFinite(day)&&new Date(day).toISOString().slice(0,10)===value.slice(0,10)?Date.parse(value):NaN;
}
const epoch=value=>Number.isSafeInteger(value)&&value>0&&value<4102444800?value*1000:NaN;
function gap(a,b){const rad=Math.PI/180,x=(b.lat-a.lat)*rad,y=(b.lon-a.lon)*rad;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2)));}
function getKey(){try{return root.localStorage?.getItem(KEY)||'';}catch(_){return '';}}
function setKey(value){const key=String(value||'').trim();if(key&&!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw Error('Clé TripGo invalide');
 if(!root.localStorage)throw Error('Stockage de cet appareil indisponible');
 if(key)root.localStorage.setItem(KEY,key);else root.localStorage.removeItem(KEY);cache.clear();}
function legGeometry(segment,mode){
 const decode=root.CPTransportWalking?.decodePolyline||
  (typeof module==='object'&&module.exports?require('./transport-walking.js').decodePolyline:null);
 const shapes=mode==='wa_wal'?segment.streets:
  Array.isArray(segment.shapes)?segment.shapes.filter(shape=>shape?.travelled===true):null;
 if(!decode||!Array.isArray(shapes)||!shapes.length||shapes.length>100)return null;
 const geometry=[];
 try{
  for(const shape of shapes){
   const text=shape?.encodedWaypoints;
   if(typeof text!=='string'||text.length>15000)return null;
   const points=decode(text,5);
   if(geometry.length&&gap(geometry.at(-1),points[0])>50)return null;
   geometry.push(...points);
   if(geometry.length>5000)return null;
  }
  const endpointTolerance=mode==='wa_wal'?10:50;
  return gap(coord(segment.from),geometry[0])<=endpointTolerance&&gap(geometry.at(-1),coord(segment.to))<=endpointTolerance?geometry:null;
 }catch(_){return null;}
}
function transportType(mode,identifier){
 if(typeof mode!=='string'||!mode.startsWith('pt_pub'))return null;
 // The segment mode is authoritative when specific. A conflicting modeInfo
 // identifier must not silently turn a bus into a train (or the reverse).
 const classify=value=>{
  if(typeof value!=='string')return null;
  const id=value.toLowerCase();
  if(/^pt_pub_(?:train|rail|regionaltrain|intercitytrain|highspeedtrain)(?:_|$)/.test(id))return 'train';
  if(/^pt_pub_(?:bus|coach)(?:_|$)/.test(id))return 'bus';
  if(/^pt_pub_(?:tram|light_rail)(?:_|$)/.test(id))return 'tram';
  if(/^pt_pub_(?:subway|metro)(?:_|$)/.test(id))return 'metro';
  return null;
 };
 return classify(mode)||classify(identifier)||'transport_public_non_classe';
}
function parse(data,{from,to,when,arriveBy=false,latestArrival,receivedAt=new Date().toISOString()}={}){
 if(!point(from)||!point(to)||!Number.isFinite(time(when))||latestArrival!==undefined&&(!Number.isFinite(time(latestArrival))||(!arriveBy&&time(latestArrival)<time(when))||(arriveBy&&time(latestArrival)>time(when))))throw Error('Fenêtre TripGo invalide');
 if(!data||!Array.isArray(data.groups)||data.groups.length>100||!Array.isArray(data.segmentTemplates)||data.segmentTemplates.length>2000)throw Error('Réponse TripGo invalide');
 if(!point(data.query?.from)||!point(data.query?.to)||gap(coord(data.query.from),coord(from))>1||gap(coord(data.query.to),coord(to))>1||
   time(data.query[arriveBy?'arrive':'depart'])!==time(when))throw Error('Réponse TripGo liée à une autre recherche');
 const templates=new Map();for(const t of data.segmentTemplates){if(!t||typeof t!=='object'||!Number.isInteger(t.hashCode)||templates.has(t.hashCode))throw Error('Modèle TripGo invalide');templates.set(t.hashCode,t);}
 const found=[],seen=new Set();let inspected=0,unsupportedModeTrips=0;
 for(const group of data.groups){
  if(!group||typeof group!=='object'||!Array.isArray(group.trips)||group.trips.length>100)throw Error('Groupe TripGo invalide');
  for(const trip of group.trips){
   if(++inspected>500)throw Error('Trop de trajets TripGo');
   if(!trip||typeof trip!=='object')continue;
   const departure=epoch(trip.depart),arrival=epoch(trip.arrive);
   if(!Number.isFinite(departure)||!Number.isFinite(arrival)||arrival<=departure||arrival-departure>172800000||
    trip.availability!=='AVAILABLE'||trip.cancelled===true||trip.canceled===true||trip.hideExactTimes===true||!Array.isArray(trip.segments)||!trip.segments.length||trip.segments.length>50||
    (arriveBy?arrival>time(when):departure<time(when))||latestArrival!==undefined&&arrival>time(latestArrival))continue;
   const legs=[];let valid=true,previous=departure;
   for(const ref of trip.segments){
    const template=ref&&typeof ref==='object'?templates.get(ref.segmentTemplateHashCode):null;if(!template){valid=false;break;}
    const s={...template,...ref},mode=s.modeIdentifier,start=epoch(s.startTime),end=epoch(s.endTime);
    if(typeof mode!=='string'||!point(s.from)||!point(s.to)||!Number.isFinite(start)||!Number.isFinite(end)||start<previous||end<start||end>arrival||
     (mode?.startsWith('pt_pub')&&end===start)||
     (mode?.startsWith('stationary_')&&gap(coord(s.from),coord(s.to))>10)||
     (s.availability&&s.availability!=='AVAILABLE')||s.cancelled===true||s.canceled===true||
     (legs.length&&gap(legs.at(-1).toPoint,coord(s.from))>50)||
     (mode==='wa_wal'&&Math.max(Number.isFinite(s.metres)&&s.metres>=0?s.metres:0,gap(coord(s.from),coord(s.to)))>10&&
      (end===start||Math.max(Number.isFinite(s.metres)&&s.metres>=0?s.metres:0,gap(coord(s.from),coord(s.to)))/((end-start)/1000)>4))||
     !/^(wa_wal|pt_pub(?:_[a-z0-9-]+)*|stationary_(?:transfer|wait))$/.test(mode||'')||/ferry|boat|air/i.test([mode,s.modeInfo?.identifier].filter(Boolean).join(' '))) {
     if(typeof mode==='string'&&!/^(wa_wal|pt_pub(?:_[a-z0-9-]+)*|stationary_(?:transfer|wait))$/.test(mode))unsupportedModeTrips++;
     valid=false;break;}
    previous=end;
    legs.push({mode,transportType:transportType(mode,s.modeInfo?.identifier||mode),provider:s.externalData?.operatorName||null,serviceTripId:s.serviceTripID||null,serviceShortName:s.serviceShortName||null,routeId:s.routeId||s.routeID||null,fromStopCode:s.from.stopCode||null,toStopCode:s.to.stopCode||null,ticketWebsiteURL:typeof s.ticketWebsiteURL==='string'?s.ticketWebsiteURL:null,line:s.serviceNumber||s.serviceName||null,from:s.from.name||s.from.address||'',to:s.to.name||s.to.address||'',
     fromPoint:coord(s.from),toPoint:coord(s.to),departure:new Date(start).toISOString(),arrival:new Date(end).toISOString(),
     geometry:legGeometry(s,mode),distanceMeters:Number.isFinite(s.metres)&&s.metres>=0?s.metres:null,realtimeReported:s.realTime===true,
     alerts:Array.isArray(s.alerts)?s.alerts.map(a=>String(a?.title||a?.text||'Alerte fournisseur')).slice(0,10):[],serviceConfirmed:false});
   }
   if(!valid||!legs.length||Date.parse(legs[0].departure)!==departure||Date.parse(legs.at(-1).arrival)!==arrival||!legs.some(l=>l.mode.startsWith('pt_pub')))continue;
   const signature=JSON.stringify(legs.map(l=>[l.mode,l.provider,l.serviceTripId,l.line,l.departure,l.arrival,l.fromPoint,l.toPoint]));if(seen.has(signature))continue;seen.add(signature);
   const startGapMeters=gap(coord(from),legs[0].fromPoint),endGapMeters=gap(coord(to),legs.at(-1).toPoint);
   if(startGapMeters>50||endGapMeters>50)continue;
   const realtimeReported=legs.filter(l=>l.mode.startsWith('pt_pub')).every(l=>l.realtimeReported);
   found.push({departure:new Date(departure).toISOString(),arrival:new Date(arrival).toISOString(),legs,priceEUR:null,
    source:'TripGo',receivedAt,transportConfirmed:false,serviceConfirmed:false,accessVerified:false,
    alerts:[...new Set([...legs.flatMap(l=>l.alerts),...(Array.isArray(trip.alerts)?trip.alerts:[]),...(Array.isArray(data.alerts)?data.alerts:[])].map(a=>typeof a==='string'?a:String(a?.title||a?.text||'Alerte fournisseur')))].slice(0,20),
    evidence:{scheduleProvided:true,endpointCoordinatesMatched:startGapMeters<=10&&endGapMeters<=10,startGapMeters,endGapMeters,
     walkingProvided:legs.some(l=>l.mode==='wa_wal'),realtimeReported,fareVerified:false,
     missing:['circulation à la date du trajet','perturbations éventuelles','accès physique au point GPS exact','prix du transport']}});
  }
 }
 const providers=[...new Set(found.flatMap(itinerary=>itinerary.legs.filter(leg=>leg.mode.startsWith('pt_pub'))
  .map(leg=>leg.provider).filter(Boolean)))].sort();
 const blablacarBusFound=providers.some(provider=>/^blablacar bus$/i.test(provider));
 const transportTypes=[...new Set(found.flatMap(itinerary=>itinerary.legs.map(leg=>leg.transportType).filter(Boolean)))].sort();
 const pedestrianLegs=found.flatMap(itinerary=>itinerary.legs.filter(leg=>leg.mode==='wa_wal'));
 const pedestrianGeometryAvailable=pedestrianLegs.filter(leg=>Array.isArray(leg.geometry)&&leg.geometry.length>=2).length;
 const pedestrianGeometryMissing=pedestrianLegs.length-pedestrianGeometryAvailable;
 return {source:'TripGo',receivedAt,coverage:{publicTransportOnly:true,
  blablacarBusFound,blablacarRideshareVerified:false,unsupportedModeTrips,providers,transportTypes,pedestrianGeometryAvailable,pedestrianGeometryMissing},
  itineraries:found.sort((a,b)=>arriveBy?Date.parse(b.departure)-Date.parse(a.departure):Date.parse(a.departure)-Date.parse(b.departure))};
}
async function readJSON(response,signal){
 const declared=Number(response.headers?.get?.('content-length'));if(declared>2000000)throw Error('Réponse TripGo trop grande');
 const reader=response.body?.getReader();if(!reader)throw Error('Réponse TripGo non lisible');
 const chunks=[];let size=0;const cancel=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{while(true){if(signal.aborted)throw new DOMException('Annulé','AbortError');const {done,value}=await reader.read();if(signal.aborted)throw new DOMException('Annulé','AbortError');if(done)break;
   size+=value.byteLength;if(size>2000000)throw Error('Réponse TripGo trop grande');chunks.push(value);}
 }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
async function plan(options){
 if(!options||typeof options!=='object')throw Error('Requête TripGo invalide');
 const fetcher=options.fetcher||root.fetch;
 if(!point(options.from)||!point(options.to)||!Number.isFinite(time(options.when))||(options.latestArrival!==undefined&&!Number.isFinite(time(options.latestArrival)))||(options.latestArrival!==undefined&&time(options.latestArrival)<time(options.when)&&!options.arriveBy)||(options.latestArrival!==undefined&&options.arriveBy&&time(options.latestArrival)>time(options.when))||typeof fetcher!=='function')throw Error('Requête TripGo invalide');
 const apiKey=options.apiKey||getKey();
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(apiKey))throw Error('Clé TripGo privée manquante');
 if(options.signal?.aborted)throw new DOMException('Annulé','AbortError');
 const key=JSON.stringify([apiKey,coord(options.from),coord(options.to),options.when,!!options.arriveBy,options.latestArrival]);
 if(!options.refresh&&cache.get(key)?.until>Date.now())return JSON.parse(JSON.stringify(cache.get(key).value));
 const url=new URL(URL_BASE),from=coord(options.from),to=coord(options.to);
 url.searchParams.set('from','('+from.lat+','+from.lon+')');url.searchParams.set('to','('+to.lat+','+to.lon+')');
 url.searchParams.set(options.arriveBy?'arriveBefore':'departAfter',Math.floor(time(options.when)/1000));
 url.searchParams.set('modes','pt_pub');url.searchParams.set('v','11');url.searchParams.set('locale','fr');
 const controller=new AbortController(),cancel=()=>controller.abort();options.signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,15000);
 try{
  const response=await fetcher(url.href,{headers:{Accept:'application/json','X-TripGo-Key':apiKey},credentials:'omit',cache:'no-cache',referrerPolicy:'no-referrer',signal:controller.signal});
  if(!response.ok)throw Error('TripGo indisponible ('+response.status+')');
  const data=await readJSON(response,controller.signal);
  if(controller.signal.aborted)throw new DOMException('Annulé','AbortError');
  const value=parse(data,options);if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,{until:Date.now()+60000,value});return JSON.parse(JSON.stringify(value));
 }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);}
}
// Optional bounded enrichment of missing pedestrian polylines; does not certify access.
async function enrichPedestrianMaps(result,router,{maxRoutes=8,signal}={}){
 if(!result||!Array.isArray(result.itineraries)||!router||typeof router.route!=='function'||
  !Number.isSafeInteger(maxRoutes)||maxRoutes<1||maxRoutes>8)throw Error('Enrichissement piéton invalide');
 const copy={...result,itineraries:result.itineraries.map(itinerary=>({...itinerary,
  legs:itinerary.legs.map(leg=>({...leg}))}))};
 let attempted=0,calculated=0;
 const routes=new Map(),jobs=[];
 for(const itinerary of copy.itineraries){
  for(const leg of itinerary.legs){
   if(leg.mode!=='wa_wal'||Array.isArray(leg.geometry)&&leg.geometry.length>=2)continue;
   if(signal?.aborted){leg.pedestrianMapStatus='cancelled';continue;}
   const a=leg.fromPoint,b=leg.toPoint;
   if(!point(a)||!point(b)){leg.pedestrianMapStatus='invalid_endpoints';continue;}
   const key=JSON.stringify([coord(a),coord(b)]);
   if(!routes.has(key)){
    if(attempted>=maxRoutes){leg.pedestrianMapStatus='not_requested_budget';continue;}
    attempted++;
    routes.set(key,Promise.resolve().then(()=>signal?.aborted?null:router.route(a,b)).catch(()=>null));
   }
   jobs.push({leg,promise:routes.get(key)});
  }
 }
 // Queue distinct requests together: the router itself applies rate limits.
 await Promise.all(jobs.map(async({leg,promise})=>{
  const route=await promise;
  if(signal?.aborted){leg.pedestrianMapStatus='cancelled';return;}
  if(route?.status==='calculated'&&route.endpointsMatched===true&&
   Array.isArray(route.geometry)&&route.geometry.length>=2&&route.geometry.length<=5000&&
   route.geometry.every(point)&&gap(coord(leg.fromPoint),coord(route.geometry[0]))<=10&&
   gap(coord(leg.toPoint),coord(route.geometry.at(-1)))<=10){
   leg.geometry=route.geometry;leg.pedestrianMapStatus='calculated_valhalla';calculated++;
   // A valid path is not necessarily walkable within TripGo's allotted time.
   const allotted=(Date.parse(leg.arrival)-Date.parse(leg.departure))/1000;
   if(Number.isFinite(allotted)&&allotted>=0&&Number.isFinite(route.durationSeconds)&&route.durationSeconds>=0){
    leg.pedestrianRouteSeconds=route.durationSeconds;
    leg.pedestrianScheduleFits=route.durationSeconds<=allotted;
   }
  }else leg.pedestrianMapStatus=route?'not_verified':'unavailable';
 }));
 copy.coverage={...copy.coverage,pedestrianGeometryAvailable:copy.itineraries.flatMap(t=>t.legs)
  .filter(leg=>leg.mode==='wa_wal'&&Array.isArray(leg.geometry)&&leg.geometry.length>=2).length,
  pedestrianGeometryMissing:copy.itineraries.flatMap(t=>t.legs)
  .filter(leg=>leg.mode==='wa_wal'&&(!Array.isArray(leg.geometry)||leg.geometry.length<2)).length,
  pedestrianValhallaAttempted:attempted,pedestrianValhallaCalculated:calculated,
  pedestrianScheduleConflicts:copy.itineraries.flatMap(t=>t.legs).filter(leg=>leg.pedestrianScheduleFits===false).length};
 return copy;
}
// Identifiers from the operators’ public city and route pages.
const FLIX_CITIES={
 annecy:'40dfe930-8646-11e6-9066-549f350fcb0c',
 annemasse:'614968b8-2605-416b-969a-a13fe44d8f3d',
 chambery:'40df5fc1-8646-11e6-9066-549f350fcb0c',
 geneve:'40df585b-8646-11e6-9066-549f350fcb0c',
 grenoble:'40dfef30-8646-11e6-9066-549f350fcb0c',
 lyon:'40df89c1-8646-11e6-9066-549f350fcb0c'
};
const BLABLA_CITIES={annecy:'annecy-2',annemasse:'annemasse-2',chambery:'chambery-2',
 geneve:'geneve-1',grenoble:'grenoble-2',lausanne:'lausanne-2',lyon:'lyon-3'};
const BLABLA_ROUTES={
 annecy:['annemasse','chambery','geneve','grenoble','lausanne','lyon'],
 annemasse:['grenoble','lyon'],
 chambery:['grenoble','lyon'],
 geneve:['grenoble','lyon'],
 grenoble:['annecy','annemasse','chambery','geneve','lausanne','lyon'],
 lausanne:['grenoble','lyon'],
 lyon:['annecy','annemasse','chambery','geneve','grenoble','lausanne']
};
const COACH_DATE=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
function coachCity(stop){
 const name=typeof stop==='string'?stop.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase():'';
 if(/airport|aeroport|saint[- ]exupery/.test(name))return null;
 const city=name.split(/\s|\(/,1)[0];
 return Object.hasOwn(BLABLA_CITIES,city)?city:null;
}
function coachFareSearch(leg){
 if(!String(leg?.mode||'').startsWith('pt_pub'))return null;
 const operator=String(leg.provider||'').trim().toLowerCase();
 const from=coachCity(leg.from),to=coachCity(leg.to);
 if(operator==='flixbus'||operator==='flixbus-eu'){
  const departure=time(leg.departure);
  let url='https://shop.flixbus.fr/';
  if(from&&to&&from!==to&&FLIX_CITIES[from]&&FLIX_CITIES[to]&&Number.isFinite(departure)){
   const rideDate=COACH_DATE.format(departure).replaceAll('/','.');
   url+='search?'+new URLSearchParams({departureCity:FLIX_CITIES[from],arrivalCity:FLIX_CITIES[to],rideDate,adult:'1'});
  }
  return {label:'FlixBus',url};
 }
 if(operator==='blablacar bus'){
  const base='https://www.blablacar.fr/bus';
  const url=from&&to&&BLABLA_ROUTES[from]?.includes(to)?
   base+'/routes/'+BLABLA_CITIES[from]+'/'+BLABLA_CITIES[to]:base;
  return {label:'BlaBlaCar Bus',url};
 }
 return null;
}
const api={parse,plan,enrichPedestrianMaps,getKey,setKey,coachFareSearch};root.CPTripGo=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
