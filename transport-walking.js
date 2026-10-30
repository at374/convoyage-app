/* Bounded pedestrian routing. Calculated OSM paths never confirm live transit. */
(function(root){
'use strict';
const DEFAULT_ENDPOINT='https://valhalla1.openstreetmap.de/route';
const cooldowns=new Map();
function point(p){return !!p&&typeof p.lat==='number'&&typeof p.lon==='number'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;}
function distance(a,b){const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));}
function decodePolyline(text){
 if(typeof text!=='string'||!text.length||text.length>100000)throw new Error('Invalid pedestrian shape');
 let offset=0,lat=0,lon=0;const points=[];
 function component(){let value=0,factor=1,count=0;
  while(true){
   if(offset>=text.length||++count>7)throw new Error('Truncated pedestrian shape');
   const c=text.charCodeAt(offset++)-63;if(c<0||c>63)throw new Error('Invalid pedestrian shape');
   value+=(c&31)*factor;if(!Number.isSafeInteger(value)||value>4294967295)throw new Error('Pedestrian shape overflow');
   if(c<32)return value%2?-(value+1)/2:value/2;
   factor*=32;
  }
 }
 while(offset<text.length){
  lat+=component();lon+=component();const p={lat:lat/1e6,lon:lon/1e6};
  if(!point(p)||points.length>=20000)throw new Error('Invalid pedestrian coordinates');points.push(p);
 }
 if(points.length<2)throw new Error('Pedestrian geometry missing');return points;
}
function validateValhalla(data,from,to,{endpoint=DEFAULT_ENDPOINT,retrievedAt=new Date().toISOString()}={}){
 if(!point(from)||!point(to))throw new Error('Invalid pedestrian endpoints');
 const trip=data?.trip,leg=trip?.legs?.[0];
 if(trip?.status!==0||trip.units!=='kilometers'||!Array.isArray(trip.legs)||trip.legs.length!==1||!leg||
    !Array.isArray(leg.maneuvers)||!leg.maneuvers.length||
    leg.maneuvers.some(m=>m?.travel_mode!=='pedestrian'||m.travel_type!=='foot')||
    trip.summary?.has_ferry!==false||leg.summary?.has_ferry!==false)throw new Error('Pedestrian mode not established');
 const summary=trip.summary;
 if(!Number.isFinite(summary?.time)||summary.time<0||!Number.isFinite(summary?.length)||summary.length<0||
    !Number.isFinite(leg.summary?.time)||!Number.isFinite(leg.summary?.length)||
    Math.abs(leg.summary.time-summary.time)>1||Math.abs(leg.summary.length-summary.length)>0.002)throw new Error('Invalid pedestrian duration or distance');
 const geometry=decodePolyline(leg.shape),startGap=distance(from,geometry[0]),endGap=distance(to,geometry.at(-1));
 if(startGap>50||endGap>50)throw new Error('Pedestrian geometry does not match requested endpoints');
 const distanceMeters=summary.length*1000,durationSeconds=summary.time;
 if(distanceMeters>50000||durationSeconds>86400)throw new Error('Pedestrian route outside local routing limits');
 let geometryMeters=0;for(let i=1;i<geometry.length;i++)geometryMeters+=distance(geometry[i-1],geometry[i]);
 if(Math.abs(geometryMeters-distanceMeters)>Math.max(30,geometryMeters*0.25)||
    (durationSeconds===0&&distanceMeters>1)||
    (distanceMeters>10&&(distanceMeters/durationSeconds>4||distanceMeters/durationSeconds<0.1)))throw new Error('Inconsistent pedestrian route');
 return {status:'calculated',provider:'Valhalla pedestrian / OpenStreetMap',endpoint,retrievedAt,
  from:{...from},to:{...to},durationSeconds,distanceMeters,geometry,
  startGapMeters:startGap,endGapMeters:endGap,endpointsMatched:startGap<=10&&endGap<=10,
  realWorldAccessConfirmed:false,timeSpecific:false};
}
async function readJSON(response,signal,maxBytes=524288){
 if(!response?.ok||!response.body?.getReader){const error=new Error('Pedestrian router unavailable');error.pairUnavailable=[400,422].includes(response?.status);
  if(response?.status===429){const header=response.headers?.get?.('retry-after');const seconds=header===null?NaN:Number(header);
   const duration=Number.isFinite(seconds)&&seconds>=0?seconds*1000:Date.parse(header)-Date.now();
   error.rateLimited=true;error.retryAfterMs=Number.isFinite(duration)&&duration>=0?duration:60000;
  }throw error;}
 const declared=Number(response.headers?.get?.('content-length'));
 if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('Pedestrian response too large');
 const reader=response.body.getReader(),chunks=[];let length=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{
  while(true){
   if(signal.aborted)throw new Error('Pedestrian request cancelled');
   const {done,value}=await reader.read();if(signal.aborted)throw new Error('Pedestrian request cancelled');if(done)break;
   length+=value.byteLength;if(length>maxBytes)throw new Error('Pedestrian response too large');chunks.push(value);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function createRouter({fetcher=root.fetch,endpoint=DEFAULT_ENDPOINT,maxRequests=8,intervalMs=1000,timeoutMs=8000,maxFailures=2}={}){
 const base=new URL(endpoint);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!base.pathname.endsWith('/route')||typeof fetcher!=='function')throw new Error('Invalid pedestrian router');
 for(const n of [maxRequests,timeoutMs,maxFailures])if(!Number.isSafeInteger(n)||n<1)throw new Error('Invalid pedestrian request budget');
 if(!Number.isSafeInteger(intervalMs)||intervalMs<0)throw new Error('Invalid pedestrian request interval');
 let disposed=false,running=false,requests=0,failures=0,lastStarted=0,controller=null,wake=null;
 const cache=new Map(),queue=[];
 const unavailable=status=>({status,provider:'Valhalla pedestrian / OpenStreetMap'});
 async function request(from,to){
  const current=new AbortController();controller=current;let timer,abort;
  const cancellation=new Promise((_,reject)=>{abort=()=>reject(new Error('Pedestrian request cancelled'));current.signal.addEventListener('abort',abort,{once:true});});
  const job=(async()=>{
   const url=new URL(base.href);url.searchParams.set('json',JSON.stringify({locations:[from,to],costing:'pedestrian',
    directions_options:{units:'kilometers',language:'fr-FR'}}));
   const response=await fetcher(url.href,{credentials:'omit',cache:'no-cache',referrerPolicy:'no-referrer',signal:current.signal});
   const data=await readJSON(response,current.signal);if(current.signal.aborted)throw new Error('Pedestrian request cancelled');
   return validateValhalla(data,from,to,{endpoint:base.href});
  })();
  timer=setTimeout(()=>current.abort(),timeoutMs);
  try{return await Promise.race([job,cancellation]);}
  finally{clearTimeout(timer);current.signal.removeEventListener('abort',abort);current.abort();if(controller===current)controller=null;}
 }
 async function pump(){
  if(running)return;running=true;
  try{
   while(queue.length&&!disposed){
    const item=queue.shift();
    if(Date.now()<(cooldowns.get(base.href)||0)){item.resolve(unavailable('rate_limited'));continue;}
    if(failures>=maxFailures){item.resolve(unavailable('unavailable'));continue;}
    const wait=Math.max(0,lastStarted+intervalMs-Date.now());
    if(wait)await new Promise(resolve=>{const timer=setTimeout(()=>{wake=null;resolve();},wait);wake=()=>{clearTimeout(timer);wake=null;resolve();};});
    if(disposed){item.resolve(unavailable('cancelled'));break;}
    lastStarted=Date.now();requests++;
    try{item.resolve(await request(item.from,item.to));}
    catch(error){if(!disposed&&!error.pairUnavailable)failures++;if(error.rateLimited)cooldowns.set(base.href,Date.now()+error.retryAfterMs);
     item.resolve(unavailable(disposed?'cancelled':error.rateLimited?'rate_limited':error.pairUnavailable?'route_unavailable':'unavailable'));}
   }
  }finally{running=false;}
 }
 function route(from,to){
  if(disposed)return Promise.resolve(unavailable('cancelled'));
  if(Date.now()<(cooldowns.get(base.href)||0))return Promise.resolve(unavailable('rate_limited'));
  if(!point(from)||!point(to))return Promise.resolve(unavailable('invalid_coordinates'));
  const key=JSON.stringify([from.lat,from.lon,to.lat,to.lon]);
  if(cache.has(key))return cache.get(key);
  if(cache.size>=maxRequests)return Promise.resolve(unavailable('budget_exceeded'));
  const pending=new Promise(resolve=>queue.push({from:{lat:from.lat,lon:from.lon},to:{lat:to.lat,lon:to.lon},resolve}));
  cache.set(key,pending);pump().catch(()=>{});return pending;
 }
 return {route,dispose:()=>{if(disposed)return;disposed=true;controller?.abort();wake?.();for(const item of queue.splice(0))item.resolve(unavailable('cancelled'));cache.clear();},
  stats:()=>({requests,failures,queued:queue.length,disposed})};
}
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value))return NaN;
 const day=Date.parse(value.slice(0,10)+'T12:00:00Z');
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==value.slice(0,10))return NaN;
 const parts=value.slice(11,19).split(/[Z+.-]/)[0].split(':').map(Number);
 if(parts[0]>23||parts[1]>59||(parts[2]??0)>59)return NaN;
 return Date.parse(value);
}
function assessJourney(row,task,walks){
 const calculated=route=>route?.status==='calculated'&&Number.isFinite(route.durationSeconds)&&route.durationSeconds>=0&&route.durationSeconds<=86400;
 const matches=(route,from,to)=>calculated(route)&&point(route.from)&&point(route.to)&&point(from)&&point(to)&&
  distance(route.from,from)<0.5&&distance(route.to,to)<0.5;
 const base={walks,serviceConfirmed:false,accessVerified:false,transferVerified:false,realizable:false};
 const departure=instant(row.departure),arrival=instant(row.arrival);
 const earliest=task.earliestDeparture===undefined?null:instant(task.earliestDeparture);
 const deadline=task.latestArrival===undefined?null:instant(task.latestArrival)-(task.marginMinutes??30)*60000;
 if(!Number.isFinite(task.marginMinutes??30)||(task.marginMinutes??30)<0||(task.marginMinutes??30)>1440||
    !Number.isFinite(departure)||!Number.isFinite(arrival)||arrival<departure||
    (earliest!==null&&!Number.isFinite(earliest))||(deadline!==null&&!Number.isFinite(deadline)))return {...base,status:'unknown'};
 let transferStart=null,transferEnd=null;
 if(row.interNetwork){
  if(!Array.isArray(row.legs)||row.legs.length!==2)return {...base,status:'unknown'};
  transferStart=instant(row.legs[0].arrival);transferEnd=instant(row.legs[1].departure);
  if(!Number.isFinite(transferStart)||!Number.isFinite(transferEnd)||transferStart<departure||transferEnd<transferStart||transferEnd>arrival||
     instant(row.legs[0].departure)!==departure||instant(row.legs[1].arrival)!==arrival)return {...base,status:'unknown'};
 }
 const access=matches(walks.access,task.from,row.originStop)?walks.access.durationSeconds:null;
 const egress=matches(walks.egress,row.destinationStop,task.to)?walks.egress.durationSeconds:null;
 const transfer=matches(walks.transfer,row.transferStop,row.transferDestinationStop)?walks.transfer.durationSeconds:null;
 let status='partial';
 if(access!==null&&earliest!==null&&earliest+access*1000>departure)status='departure_too_early';
 else if(egress!==null&&deadline!==null&&arrival+egress*1000>deadline)status='arrival_too_late';
 else if(row.interNetwork&&transfer!==null&&Array.isArray(row.legs)&&row.legs.length===2&&
   transferStart+(transfer+300)*1000>transferEnd)status='transfer_too_short';
 else {
  const needed=[access!==null&&walks.access.endpointsMatched,egress!==null&&walks.egress.endpointsMatched];
  if(row.legs?.length===2)needed.push(transfer!==null&&walks.transfer.endpointsMatched);
  if(needed.every(Boolean))status='fits_calculated_walks';
 }
 // An incomplete core path cannot establish an address-level time.
 return {...base,status,doorDeparture:access===null||walks.access.endpointsMatched!==true?null:new Date(departure-access*1000).toISOString(),
  doorArrival:egress===null||walks.egress.endpointsMatched!==true?null:new Date(arrival+egress*1000).toISOString(),
  serviceConfirmed:false,accessVerified:false,transferVerified:false,realizable:false};
}
async function checkJourney(router,row,task){
 // Prioritise the interchange request. No zero-time walk is inferred at a shared stop.
 const transfer=row.interNetwork?router.route(row.transferStop,row.transferDestinationStop):Promise.resolve({status:row.legs?.length===2?'same_stop_unverified':'not_required'});
 const [middle,access,egress]=await Promise.all([transfer,router.route(task.from,row.originStop),router.route(row.destinationStop,task.to)]);
 return assessJourney(row,task,{access,transfer:middle,egress});
}
const api={DEFAULT_ENDPOINT,decodePolyline,validateValhalla,createRouter,assessJourney,checkJourney};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportWalking=api;
})(typeof window!=='undefined'?window:globalThis);
