/* Read-only detection of cross-border Swiss GTFS services for Geneva and Ain.
 * Static schedules only: never claim realtime service, walking access or fares.
 */
(function(root){
'use strict';
const GENEVA=[46.10,5.90,46.40,6.35];
const AIN=[45.75,5.15,46.55,6.20];
function inside(stop,bounds){
 const lat=Number(stop?.stop_lat),lon=Number(stop?.stop_lon);
 return stop&&String(stop.stop_lat??'').trim()!==''&&String(stop.stop_lon??'').trim()!==''&&
  Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=bounds[0]&&lat<=bounds[2]&&lon>=bounds[1]&&lon<=bounds[3];
}
function crossBorderRoutes(index,{genevaBounds=GENEVA,ainBounds=AIN,maxTrips=100000}={}){
 if(!index?.stopById||!index?.tripById||!index?.timesByTrip||!index?.routeById)throw new Error('GTFS index required');
 if(!Number.isSafeInteger(maxTrips)||maxTrips<1)throw new Error('Invalid GTFS scan limit');
 const found=new Map();let scanned=0,truncated=false;
 for(const [tripId,trip] of index.tripById){
  if(scanned++>=maxTrips){truncated=true;break;}
  const times=index.timesByTrip.get(tripId)||[];
  const genevaStops=new Set(),ainStops=new Set();
  for(const t of times){
   const stop=index.stopById.get(t.stop_id);
   // The overlapping envelopes are candidate areas, not a national border.
   if(inside(stop,genevaBounds))genevaStops.add(t.stop_id);
   if(inside(stop,ainBounds))ainStops.add(t.stop_id);
  }
  // Distinct stops are required; a single stop in the overlapping envelopes
  // is not evidence of a cross-border journey.
  if(![...genevaStops].some(id=>[...ainStops].some(other=>other!==id)))continue;
  const route=index.routeById.get(trip.route_id);
  if(!route)continue;
  const key=String(trip.route_id);
  if(!found.has(key))found.set(key,{routeId:key,line:route.route_short_name||route.route_long_name||key,tripCount:0});
  found.get(key).tripCount++;
 }
 return {routes:[...found.values()],truncated,scannedTrips:Math.min(scanned,maxTrips),
  timetableOnly:true,serviceConfirmed:false};
}
// Normalize an externally verified country manifest without guessing from names
// or coordinates. Conflicting duplicate stop IDs are rejected rather than
// silently assigning a country to the wrong platform.
function verifiedCountryMap(rows){
 if(!Array.isArray(rows))throw new Error('Verified country manifest required');
 const result=new Map();
 for(const row of rows){
  const id=typeof row?.stopId==='string'?row.stopId.trim():'';
  const country=row?.country;
  if(!id||!['CH','FR'].includes(country)||row?.verified!==true)
   throw new Error('Unverified GTFS stop country');
  if(result.has(id)&&result.get(id)!==country)throw new Error('Conflicting GTFS stop country');
  result.set(id,country);
 }
 return result;
}
// Country codes must come from a separately verified stop-to-country dataset.
// GTFS stop coordinates and names alone cannot establish a national border.
// A route must actually contain consecutive boarding points on opposite sides.
// The returned legs are timetable candidates, not verified current services.
function borderSegments(index,countryByStop,{maxTrips=100000,maxSegments=10000}={}){
 if(!index?.tripById||!index?.timesByTrip||!index?.routeById||!index?.stopById)throw new Error('GTFS index required');
 if(!(countryByStop instanceof Map))throw new Error('Verified stop-country map required');
 if(![maxTrips,maxSegments].every(n=>Number.isSafeInteger(n)&&n>0))throw new Error('Invalid scan limit');
 const segments=[];let scanned=0,truncated=false;
 for(const [tripId,trip] of index.tripById){
  if(scanned>=maxTrips){truncated=true;break;}scanned++;
  const times=index.timesByTrip.get(tripId)||[];
  for(let i=1;i<times.length;i++){
   const a=times[i-1],b=times[i],fromCountry=countryByStop.get(a.stop_id),toCountry=countryByStop.get(b.stop_id);
   if(!a.stop_id||!b.stop_id||a.stop_id===b.stop_id||
      !(Number(b.stop_sequence)>Number(a.stop_sequence))||
      (a.pickup_type!==undefined&&a.pickup_type!==''&&a.pickup_type!=='0')||
      (b.drop_off_type!==undefined&&b.drop_off_type!==''&&b.drop_off_type!=='0')||
      gtfsMinutes(a.departure_time)===null||gtfsMinutes(b.arrival_time)===null||
      gtfsMinutes(b.arrival_time)<gtfsMinutes(a.departure_time))continue;
   if(!((fromCountry==='CH'&&toCountry==='FR')||(fromCountry==='FR'&&toCountry==='CH')))continue;
   if(segments.length>=maxSegments){truncated=true;break;}
   const route=index.routeById.get(trip.route_id);
   if(!route)continue;
   segments.push({tripId,routeId:String(trip.route_id),line:route.route_short_name||route.route_long_name||String(trip.route_id),
    fromStopId:a.stop_id,toStopId:b.stop_id,fromCountry,toCountry,
    fromStopName:index.stopById.get(a.stop_id)?.stop_name||'',toStopName:index.stopById.get(b.stop_id)?.stop_name||'',
    departure:a.departure_time,arrival:b.arrival_time,serviceConfirmed:false,timetableOnly:true,
    serviceDateVerified:false});
  }
  if(truncated)break;
 }
 return {segments,scannedTrips:scanned,truncated,countryEvidence:'verified-stop-map'};
}
function verifiedBorderRoutes(index,countryByStop,{maxTrips=100000}={}){
 // A route is only a border candidate if an actual trip has a usable
 // consecutive CH/FR stop pair, not merely two countries somewhere in its stops.
 const result=borderSegments(index,countryByStop,{maxTrips,maxSegments:100000});
 const routes=new Map(),tripsByRoute=new Map();
 for(const segment of result.segments){
  const key=segment.routeId;
  if(!routes.has(key))routes.set(key,{routeId:key,line:segment.line,tripCount:0});
  if(!tripsByRoute.has(key))tripsByRoute.set(key,new Set());
  tripsByRoute.get(key).add(segment.tripId);
 }
 for(const [key,route] of routes)route.tripCount=tripsByRoute.get(key).size;
 return {routes:[...routes.values()],scannedTrips:result.scannedTrips,
  truncated:result.truncated,countryEvidence:'verified-stop-map',timetableOnly:true,serviceConfirmed:false};
}
// Restrict crossing candidates to trips actually scheduled on the mission date.
// The date is checked against GTFS calendars, not live vehicle operation.
function datedBorderSegments(files,index,countryByStop,date,options={}){
 const gtfs=typeof require==='function'?require('./transport-gtfs-index.js'):root.CPGTFSIndex;
 if(!gtfs?.activeServices)throw new Error('GTFS calendar reader unavailable');
 const active=gtfs.activeServices(files,date);
 const scheduled=new Map([...index.tripById].filter(([,trip])=>active.has(trip.service_id)));
 const result=borderSegments({...index,tripById:scheduled},countryByStop,options);
 return {...result,date,segments:result.segments.map(s=>({...s,serviceDateVerified:true})),
  timetableOnly:true,serviceConfirmed:false};
}
// Match timetable candidates to the mission's local service-day clock.
// GTFS permits times beyond 24:00 for services continuing after midnight.
function gtfsMinutes(value){
 if(typeof value!=='string'||!/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(value))return null;
 const [h,m,s]=value.split(':').map(Number);
 return h<=72?h*60+m+s/60:null;
}
// An explicit pre-pickup buffer is required when the candidate is used to
// reach the next mission; GTFS arrival alone is not a punctuality guarantee.
function missionPickupCandidates(files,index,countryByStop,date,{earliestDeparture,pickupTime,bufferMinutes=15,accessMinutes,...limits}={}){
 if(!Number.isInteger(bufferMinutes)||bufferMinutes<15||bufferMinutes>180)throw new Error('Invalid pickup buffer');
 const pickup=gtfsMinutes(pickupTime);
 if(pickup===null||pickup<bufferMinutes)throw new Error('Invalid pickup time');
 // A GTFS stop is not the mission address. When the walking access time is
 // known, subtract it before filtering the scheduled arrival at the stop.
 // Unknown access is never represented as verified.
 if(accessMinutes!==undefined&&(!Number.isFinite(accessMinutes)||accessMinutes<0||accessMinutes>240))
  throw new Error('Invalid mission stop access duration');
 const access=accessMinutes===undefined?0:Math.ceil(accessMinutes);
 const latestArrival=Math.floor(pickup-bufferMinutes-access);
 if(latestArrival<0)throw new Error('Mission pickup window too short');
 const clock=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')+':00';
 const result=missionBorderSegments(files,index,countryByStop,date,{
  ...limits,earliestDeparture,latestArrival:clock(latestArrival)});
 return {...result,pickupBufferMinutes:bufferMinutes,pickupTime,
  accessVerified:false,accessDurationProvided:accessMinutes!==undefined,accessMinutes:accessMinutes??null,
  transportConfirmed:false,confirmationBlockers:[
   ...(result.segments.length?[]:['no-scheduled-border-candidate']),
   accessMinutes===undefined?'walking-access-unknown':'walking-route-unverified',
   'realtime-service-unverified'],serviceConfirmed:false};
}
function missionBorderSegments(files,index,countryByStop,date,{earliestDeparture,latestArrival,...limits}={}){
 const start=gtfsMinutes(earliestDeparture),end=gtfsMinutes(latestArrival);
 if(start===null||end===null||end<start)throw new Error('Invalid mission GTFS time window');
 const result=datedBorderSegments(files,index,countryByStop,date,limits);
 return {...result,segments:result.segments.filter(segment=>{
  const departure=gtfsMinutes(segment.departure),arrival=gtfsMinutes(segment.arrival);
  return departure!==null&&arrival!==null&&departure>=start&&arrival<=end&&arrival>=departure;
 }),missionWindowChecked:true,serviceConfirmed:false};
}
const api={GENEVA,AIN,inside,crossBorderRoutes,verifiedBorderRoutes,borderSegments,datedBorderSegments,missionBorderSegments,missionPickupCandidates,verifiedCountryMap};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPSwissAinGTFS=api;
})(typeof window!=='undefined'?window:globalThis);
