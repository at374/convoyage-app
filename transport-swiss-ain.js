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
   if(!((fromCountry==='CH'&&toCountry==='FR')||(fromCountry==='FR'&&toCountry==='CH')))continue;
   if(segments.length>=maxSegments){truncated=true;break;}
   const route=index.routeById.get(trip.route_id);
   if(!route)continue;
   segments.push({tripId,routeId:String(trip.route_id),line:route.route_short_name||route.route_long_name||String(trip.route_id),
    fromStopId:a.stop_id,toStopId:b.stop_id,fromCountry,toCountry,
    fromStopName:index.stopById.get(a.stop_id)?.stop_name||'',toStopName:index.stopById.get(b.stop_id)?.stop_name||'',
    departure:a.departure_time,arrival:b.arrival_time,serviceConfirmed:false,timetableOnly:true});
  }
  if(truncated)break;
 }
 return {segments,scannedTrips:scanned,truncated,countryEvidence:'verified-stop-map'};
}
function verifiedBorderRoutes(index,countryByStop,{maxTrips=100000}={}){
 if(!index?.tripById||!index?.timesByTrip||!index?.routeById)throw new Error('GTFS index required');
 if(!(countryByStop instanceof Map))throw new Error('Verified stop-country map required');
 if(!Number.isSafeInteger(maxTrips)||maxTrips<1)throw new Error('Invalid GTFS scan limit');
 const routes=new Map();let scanned=0,truncated=false;
 for(const [tripId,trip] of index.tripById){
  if(scanned>=maxTrips){truncated=true;break;}
  scanned++;
  const times=index.timesByTrip.get(tripId)||[];
  const countries=new Set(times.map(t=>countryByStop.get(t.stop_id)).filter(c=>c==='CH'||c==='FR'));
  if(!countries.has('CH')||!countries.has('FR'))continue;
  const route=index.routeById.get(trip.route_id);if(!route)continue;
  const key=String(trip.route_id);
  if(!routes.has(key))routes.set(key,{routeId:key,line:route.route_short_name||route.route_long_name||key,tripCount:0});
  routes.get(key).tripCount++;
 }
 return {routes:[...routes.values()],scannedTrips:scanned,truncated,
  countryEvidence:'verified-stop-map',timetableOnly:true,serviceConfirmed:false};
}
const api={GENEVA,AIN,inside,crossBorderRoutes,verifiedBorderRoutes,borderSegments};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPSwissAinGTFS=api;
})(typeof window!=='undefined'?window:globalThis);
