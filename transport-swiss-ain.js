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
const api={GENEVA,AIN,inside,crossBorderRoutes};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPSwissAinGTFS=api;
})(typeof window!=='undefined'?window:globalThis);
