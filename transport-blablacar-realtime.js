/* Public BlaBlaCar Bus SIRI-LITE. Match absolute planned times and stop IDs.
 * A fresh prediction or an observed vehicle never certifies physical pickup access.
 */
(function(root){
'use strict';
const ENDPOINT='https://open-data.bus.blablacar.com/api/siri-lite/estimated-timetable';
const ref=v=>typeof v?.value==='string'?v.value:null;
function instant(value){
 if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(value))return NaN;
 const day=Date.parse(value.slice(0,10)+'T12:00:00Z');
 return Number.isFinite(day)&&new Date(day).toISOString().slice(0,10)===value.slice(0,10)?Date.parse(value):NaN;
}
function eligible(leg){return leg?.provider==='BlaBlaCar Bus'&&typeof leg.serviceShortName==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(leg.serviceShortName)&&
 typeof leg.fromStopCode==='string'&&typeof leg.toStopCode==='string'&&Number.isFinite(instant(leg.departure))&&Number.isFinite(instant(leg.arrival));}
function parse(data,{now=Date.now()}={}){
 const timestamp=instant(data?.responseTimestamp),until=instant(data?.validUntil);
 if(data?.status!==true||!Number.isFinite(now)||!Number.isFinite(timestamp)||!Number.isFinite(until)||until<=timestamp||until-timestamp>300000||
  !Array.isArray(data.estimatedJourneyVersionFrame)||data.estimatedJourneyVersionFrame.length>10000)throw Error('Flux SIRI invalide');
 const stale=timestamp>now+30000||now-timestamp>180000||now>=until;
 const journeys=[];let calls=0;
 for(const frame of data.estimatedJourneyVersionFrame){
  const recorded=instant(frame?.recordedAtTime);
  if(!Number.isFinite(recorded)||recorded>timestamp+30000||!Array.isArray(frame.estimatedVehicleJourney))throw Error('Version SIRI invalide');
  for(const journey of frame.estimatedVehicleJourney){
   const estimated=journey.estimatedCalls?.estimatedCall||[],observed=journey.recordedCalls?.recordedCall||[];
   if(!ref(journey.datedVehicleJourneyRef)||!Array.isArray(estimated)||!Array.isArray(observed)||estimated.length>1000||observed.length>1000||
    journeys.length>=5000||(calls+=estimated.length+observed.length)>50000)throw Error('Limites SIRI dépassées');
   journeys.push({reference:ref(journey.datedVehicleJourneyRef),recorded,journey});
  }
 }
 return {timestamp,until,stale,journeys};
}
function assess(feed,leg,{now=Date.now()}={}){
 const base={source:ENDPOINT,sourceTimestamp:new Date(feed.timestamp).toISOString(),validUntil:new Date(feed.until).toISOString(),serviceConfirmed:false};
 if(feed.stale||now>=feed.until||now-feed.timestamp>180000||feed.timestamp>now+30000)return {...base,status:'stale'};
 if(!eligible(leg))return {...base,status:'unsupported'};
 const matches=[];
 for(const entry of feed.journeys){
  if(!entry.reference.startsWith(leg.serviceShortName+':')||now-entry.recorded>180000||entry.recorded>now+30000)continue;
  const j=entry.journey,estimated=j.estimatedCalls?.estimatedCall||[];
  for(const from of estimated){
   if(ref(from.stopPointRef)!==leg.fromStopCode||instant(from.aimedDepartureTime)!==instant(leg.departure)||!Number.isInteger(from.order))continue;
   for(const to of estimated){
    if(ref(to.stopPointRef)!==leg.toStopCode||instant(to.aimedArrivalTime)!==instant(leg.arrival)||!Number.isInteger(to.order)||to.order<=from.order)continue;
    matches.push({entry,from,to});
   }
  }
 }
 if(!matches.length)return {...base,status:'not_matched'};
 const newest=Math.max(...matches.map(m=>m.entry.recorded));
 const distinct=new Map(matches.filter(m=>m.entry.recorded===newest).map(m=>[JSON.stringify([m.entry.journey,m.from,m.to]),m]));
 if(distinct.size!==1)return {...base,status:'ambiguous'};
 const {entry,from,to}=distinct.values().next().value,j=entry.journey,details={...base,reference:entry.reference};
 if(j.cancellation===true||from.cancellation===true||to.cancellation===true)return {...details,status:'cancelled'};
 if(j.cancellation!==false||from.cancellation!==false||to.cancellation!==false)return {...details,status:'no_prediction'};
 const departure=instant(from.expectedDepartureTime),arrival=instant(to.expectedArrivalTime);
 const statuses=new Set(['ON_TIME','DELAYED','EARLY']);
 if(!statuses.has(from.departureStatus)||!statuses.has(to.arrivalStatus)||!Number.isFinite(departure)||!Number.isFinite(arrival)||arrival<departure)return {...details,status:'no_prediction'};
 const observed=(j.recordedCalls?.recordedCall||[]).some(c=>c.cancellation===false&&Number.isInteger(c.order)&&c.order<from.order&&
  Number.isFinite(instant(c.actualDepartureTime))&&instant(c.actualDepartureTime)<=entry.recorded&&instant(c.actualDepartureTime)<=now&&instant(c.actualDepartureTime)>=instant(leg.departure)-172800000);
 return {...details,status:observed?'observed':'predicted',serviceConfirmed:observed,
  expectedDeparture:new Date(departure).toISOString(),expectedArrival:new Date(arrival).toISOString()};
}
function assessJourney(feed,journey,task={},options={}){
 const transit=(Array.isArray(journey?.legs)?journey.legs:[]).filter(l=>typeof l?.mode==='string'&&l.mode.startsWith('pt_pub'));
 const updates=transit.filter(eligible).map(l=>assess(feed,l,options));
 const base={updates,transportConfirmed:false,serviceConfirmed:false,accessVerified:false,realizable:false};
 if(updates.some(u=>u.status==='cancelled'))return {...base,status:'cancelled'};
 if(transit.length!==1||updates.length!==1||!['observed','predicted'].includes(updates[0].status))return {...base,status:'partial'};
 const legs=journey.legs,busIndex=legs.indexOf(transit[0]),before=legs.slice(0,busIndex),after=legs.slice(busIndex+1);
 const walk=legs=>legs.every(l=>l?.mode==='wa_wal'&&Number.isFinite(instant(l.departure))&&Number.isFinite(instant(l.arrival))&&instant(l.arrival)>=instant(l.departure))?
  legs.reduce((n,l)=>n+instant(l.arrival)-instant(l.departure),0):null;
 const access=walk(before),egress=walk(after);
 if(access===null||egress===null)return {...base,status:'partial'};
 const update=updates[0],doorDeparture=instant(update.expectedDeparture)-access,doorArrival=instant(update.expectedArrival)+egress;
 const latest=task.latestArrival??(task.arriveBy?task.when:undefined),deadline=latest===undefined?null:instant(latest);
 const earliest=task.arriveBy?(options.now??Date.now()):Math.max(options.now??Date.now(),instant(task.when));
 let status='fits_prediction';
 if(latest!==undefined&&!Number.isFinite(deadline)||earliest!==null&&!Number.isFinite(earliest))status='unknown_window';
 else if(earliest!==null&&doorDeparture<earliest)status='missed_boarding';
 else if(deadline!==null&&doorArrival>deadline)status='arrival_too_late';
 return {...base,status,doorDeparture:new Date(doorDeparture).toISOString(),doorArrival:new Date(doorArrival).toISOString(),
  serviceConfirmed:update.serviceConfirmed,validUntil:update.validUntil};
}
function createClient({fetcher=root.fetch,now=()=>Date.now(),endpoint=ENDPOINT,timeoutMs=endpoint===ENDPOINT?8000:10000}={}){
 const url=new URL(endpoint),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&local)||
  (url.href!==ENDPOINT&&(url.pathname!=='/transport-realtime/blablacar'||(!local&&url.port!==''))))throw Error('Relais SIRI invalide');
 if(typeof fetcher!=='function'||typeof now!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>30000)throw Error('Client SIRI invalide');
 let cached=null,cachedUntil=0,pending=null,unavailableUntil=0;
 async function download(signal){
  const response=await fetcher(url.href,{signal,cache:'no-cache',credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});
  if(!response.ok||!response.body?.getReader)throw Error('Flux SIRI indisponible');
  if(Number(response.headers?.get?.('content-length'))>2500000)throw Error('Flux SIRI trop grand');
  const reader=response.body.getReader(),chunks=[];let length=0;const cancel=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  try{while(true){if(signal.aborted)throw new DOMException('Annulé','AbortError');const r=await reader.read();if(signal.aborted)throw new DOMException('Annulé','AbortError');if(r.done)break;
    length+=r.value.byteLength;if(length>2500000)throw Error('Flux SIRI trop grand');chunks.push(r.value);}
  }catch(e){await reader.cancel().catch(()=>{});throw e;}finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  const feed=parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),{now:now()});if(!signal.aborted){cached=feed;cachedUntil=feed.stale?now()+30000:Math.min(feed.until,now()+30000);}return feed;
 }
 async function load(signal){
  if(signal?.aborted)throw new DOMException('Annulé','AbortError');
  if(cached&&now()<cachedUntil)return cached;
  if(now()<unavailableUntil)throw Error('Flux SIRI temporairement indisponible');
  if(!pending||pending.controller.signal.aborted){
   const entry={controller:new AbortController(),users:new Set(),settled:false};pending=entry;
   const timer=setTimeout(()=>entry.controller.abort(),timeoutMs);
   entry.promise=download(entry.controller.signal).catch(e=>{if(!entry.controller.signal.aborted||entry.users.size)unavailableUntil=now()+30000;throw e;}).finally(()=>{clearTimeout(timer);entry.settled=true;if(pending===entry)pending=null;});
  }
  const entry=pending;
  return new Promise((resolve,reject)=>{
   const token={};let done=false;entry.users.add(token);
   const cleanup=()=>{entry.users.delete(token);signal?.removeEventListener('abort',cancel);if(!entry.settled&&!entry.users.size){entry.controller.abort();if(pending===entry)pending=null;}};
   const cancel=()=>{if(done)return;done=true;cleanup();reject(new DOMException('Annulé','AbortError'));};
   signal?.addEventListener('abort',cancel,{once:true});entry.promise.then(v=>{if(done)return;done=true;cleanup();resolve(v);},e=>{if(done)return;done=true;cleanup();reject(e);});if(signal?.aborted)cancel();
  });
 }
 return {check:async(journey,task,{signal}={})=>{if(!(Array.isArray(journey?.legs)?journey.legs:[]).some(eligible))return {status:'unsupported',updates:[],transportConfirmed:false,serviceConfirmed:false,accessVerified:false,realizable:false};
  return {...assessJourney(await load(signal),journey,task,{now:now()}),transportEndpoint:url.href};}};
}
const api={ENDPOINT,eligible,parse,assess,assessJourney,createClient};root.CPBlaBlaRealtime=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
