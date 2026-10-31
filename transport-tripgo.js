/* Optional TripGo client. The private key stays on the device and in HTTPS headers.
 * Provider availability and zero-cost walking never certify transit fares or service.
 */
(function(root){
'use strict';
const URL_BASE='https://api.tripgo.com/v1/routing.json',KEY='cp_tripgo_key',cache=new Map();
const point=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon??p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lon??p.lng)<=180;
const coord=p=>({lat:p.lat,lon:p.lon??p.lng});
function time(value){
 if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/i.test(value))return NaN;
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
function parse(data,{from,to,when,arriveBy=false,latestArrival,receivedAt=new Date().toISOString()}={}){
 if(!point(from)||!point(to)||!Number.isFinite(time(when))||latestArrival!==undefined&&!Number.isFinite(time(latestArrival)))throw Error('Fenêtre TripGo invalide');
 if(!data||!Array.isArray(data.groups)||data.groups.length>100||!Array.isArray(data.segmentTemplates)||data.segmentTemplates.length>2000)throw Error('Réponse TripGo invalide');
 if(!point(data.query?.from)||!point(data.query?.to)||gap(coord(data.query.from),coord(from))>1||gap(coord(data.query.to),coord(to))>1||
   time(data.query[arriveBy?'arrive':'depart'])!==time(when))throw Error('Réponse TripGo liée à une autre recherche');
 const templates=new Map();for(const t of data.segmentTemplates){if(!Number.isInteger(t.hashCode)||templates.has(t.hashCode))throw Error('Modèle TripGo invalide');templates.set(t.hashCode,t);}
 const found=[],seen=new Set();let inspected=0;
 for(const group of data.groups){
  if(!Array.isArray(group.trips)||group.trips.length>100)throw Error('Groupe TripGo invalide');
  for(const trip of group.trips){
   if(++inspected>500)throw Error('Trop de trajets TripGo');
   const departure=epoch(trip.depart),arrival=epoch(trip.arrive);
   if(!Number.isFinite(departure)||!Number.isFinite(arrival)||arrival<=departure||arrival-departure>172800000||
    trip.availability!=='AVAILABLE'||trip.hideExactTimes===true||!Array.isArray(trip.segments)||!trip.segments.length||trip.segments.length>50||
    (arriveBy?arrival>time(when):departure<time(when))||latestArrival!==undefined&&arrival>time(latestArrival))continue;
   const legs=[];let valid=true,previous=departure;
   for(const ref of trip.segments){
    const template=templates.get(ref.segmentTemplateHashCode);if(!template){valid=false;break;}
    const s={...template,...ref},mode=s.modeIdentifier,start=epoch(s.startTime),end=epoch(s.endTime);
    if(!point(s.from)||!point(s.to)||!Number.isFinite(start)||!Number.isFinite(end)||start<previous||end<start||end>arrival||
     (s.availability&&s.availability!=='AVAILABLE')||s.cancelled===true||s.canceled===true||
     (legs.length&&gap(legs.at(-1).toPoint,coord(s.from))>50)||
     (mode==='wa_wal'&&Number.isFinite(s.metres)&&s.metres>10&&(end===start||s.metres/((end-start)/1000)>4))||
     !/^(wa_wal|pt_pub(?:_[a-z0-9-]+)*|stationary_(?:transfer|wait))$/.test(mode||'')||/ferry|boat|air/i.test(s.modeInfo?.identifier||'')) {valid=false;break;}
    previous=end;
    legs.push({mode,provider:s.externalData?.operatorName||null,serviceTripId:s.serviceTripID||null,serviceShortName:s.serviceShortName||null,routeId:s.routeId||s.routeID||null,fromStopCode:s.from.stopCode||null,toStopCode:s.to.stopCode||null,ticketWebsiteURL:typeof s.ticketWebsiteURL==='string'?s.ticketWebsiteURL:null,line:s.serviceNumber||s.serviceName||null,from:s.from.name||s.from.address||'',to:s.to.name||s.to.address||'',
     fromPoint:coord(s.from),toPoint:coord(s.to),departure:new Date(start).toISOString(),arrival:new Date(end).toISOString(),
     distanceMeters:Number.isFinite(s.metres)&&s.metres>=0?s.metres:null,realtimeReported:s.realTime===true,
     alerts:Array.isArray(s.alerts)?s.alerts.map(a=>String(a?.title||a?.text||'Alerte fournisseur')).slice(0,10):[],serviceConfirmed:false});
   }
   if(!valid||!legs.length||Date.parse(legs[0].departure)!==departure||Date.parse(legs.at(-1).arrival)!==arrival||!legs.some(l=>l.mode.startsWith('pt_pub')))continue;
   const signature=JSON.stringify(legs.map(l=>[l.mode,l.line,l.departure,l.arrival,l.fromPoint,l.toPoint]));if(seen.has(signature))continue;seen.add(signature);
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
 return {source:'TripGo',receivedAt,itineraries:found.sort((a,b)=>arriveBy?Date.parse(b.departure)-Date.parse(a.departure):Date.parse(a.departure)-Date.parse(b.departure)).slice(0,10)};
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
 const apiKey=options.apiKey||getKey(),fetcher=options.fetcher||root.fetch;
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(apiKey))throw Error('Clé TripGo privée manquante');
 if(!point(options.from)||!point(options.to)||!Number.isFinite(time(options.when))||(options.latestArrival!==undefined&&!Number.isFinite(time(options.latestArrival)))||(options.latestArrival!==undefined&&time(options.latestArrival)<time(options.when)&&!options.arriveBy)||typeof fetcher!=='function')throw Error('Requête TripGo invalide');
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
const api={parse,plan,getKey,setKey};root.CPTripGo=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
