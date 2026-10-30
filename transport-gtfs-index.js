/* GTFS static CSV index. Requires already extracted, trusted text files. */
(function(root){
'use strict';
function* csvRows(text){
 if(typeof text!=='string')throw new TypeError('CSV text required');
 let names=null,row=[],field='',quoted=false;
 const record=values=>{
  if(!names){names=values.map((h,i)=>i===0?h.replace(/^\uFEFF/,''):h);return null;}
  return values.some(v=>v!=='')?Object.fromEntries(names.map((h,i)=>[h,values[i]??''])):null;
 };
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
   else if(c==='"')quoted=false;
   else field+=c;
  }else if(c==='"')quoted=true;
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'){row.push(field.replace(/\r$/,''));const item=record(row);if(item)yield item;row=[];field='';}
  else field+=c;
 }
 if(quoted)throw new Error('Unclosed CSV quote');
 if(field||row.length){row.push(field.replace(/\r$/,''));const item=record(row);if(item)yield item;}
}
function parseCSV(text){return Array.from(csvRows(text));}
function activeServices(files,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||
   new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)
   throw new Error('Invalid service date');
 const compact=date.replace(/-/g,'');
 const weekday=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][
   new Date(date+'T00:00:00Z').getUTCDay()];
 const active=new Set();
 for(const row of parseCSV(files['calendar.txt']||'')){
  if(row.service_id&&row.start_date<=compact&&compact<=row.end_date&&row[weekday]==='1')
   active.add(row.service_id);
 }
 for(const row of parseCSV(files['calendar_dates.txt']||'')){
  if(row.date!==compact||!row.service_id)continue;
  if(row.exception_type==='1')active.add(row.service_id);
  else if(row.exception_type==='2')active.delete(row.service_id);
 }
 return active;
}
function scheduledTrips(files,index,date){
 const services=activeServices(files,date);
 const results=[];
 for(const [tripId,trip] of index.tripById){
  if(!services.has(trip.service_id))continue;
  const times=index.timesByTrip.get(tripId)||[];
  if(times.length<2)continue;
  const route=index.routeById.get(trip.route_id);
  if(!route)continue;
  results.push({
   tripId,serviceId:trip.service_id,routeId:trip.route_id,
   line:route.route_short_name||route.route_long_name||'',
   stops:times.map(t=>({
    stopId:t.stop_id,stopName:index.stopById.get(t.stop_id)?.stop_name||'',
    arrival:t.arrival_time,departure:t.departure_time,sequence:Number(t.stop_sequence)
   })),
   serviceScheduled:true,serviceConfirmed:false
  });
 }
 return results;
}
// Traverse the active trips once, without copying every stop of every trip for
// each origin/destination pair. A loop may visit the origin more than once.
function regularAccess(value){return value===undefined||value===''||value==='0';}
function directCandidates(files,index,date,origins,destinations){
 const services=activeServices(files,date),journeys=[];
 if(!origins.size||!destinations.size)return journeys;
 for(const [tripId,trip] of index.tripById){
  if(!services.has(trip.service_id))continue;
  const route=index.routeById.get(trip.route_id);
  if(!route)continue;
  const times=index.timesByTrip.get(tripId)||[];
  for(let i=0;i<times.length;i++){
   const start=times[i],from=origins.get(start.stop_id);
   if(!from||!regularAccess(start.pickup_type)||minutes(start.departure_time)===null)continue;
   const found=new Set();
   for(let j=i+1;j<times.length;j++){
    const end=times[j],to=destinations.get(end.stop_id);
    if(!to||end.stop_id===start.stop_id||found.has(end.stop_id)||
       !(Number(end.stop_sequence)>Number(start.stop_sequence)))continue;
    found.add(end.stop_id);
    const arrival=minutes(end.arrival_time);
    if(arrival===null||arrival<minutes(start.departure_time)||!regularAccess(end.drop_off_type))continue;
    journeys.push({tripId,line:route.route_short_name||route.route_long_name||'',date,
     from:start.stop_id,to:end.stop_id,departure:start.departure_time,arrival:end.arrival_time,
     serviceScheduled:true,serviceConfirmed:false,
     exactOrigin:false,exactDestination:false,accessVerified:false,priceEUR:null});
   }
  }
 }
 return journeys.sort((a,b)=>minutes(a.departure)-minutes(b.departure));
}
function directTrips(files,index,date,originStopId,destinationStopId){
 if(!index.stopById.has(originStopId)||!index.stopById.has(destinationStopId)||
     originStopId===destinationStopId)return [];
 return directCandidates(files,index,date,new Map([[originStopId,true]]),new Map([[destinationStopId,true]]));
}
function minutes(time){
 if(!/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(time||''))return null;
 const [h,m,sec]=time.split(':').map(Number);
 return h*60+m+sec/60;
}
function nearbyStops(index,lat,lon,radiusMeters=700){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||
   Math.abs(lon)>180||!Number.isFinite(radiusMeters)||radiusMeters<=0)return [];
 const rad=Math.PI/180,earth=6371000,results=[];
 for(const stop of index.stopById.values()){
  const a=Number(stop.stop_lat),b=Number(stop.stop_lon);
  if(!stop.stop_lat||!stop.stop_lon||!Number.isFinite(a)||!Number.isFinite(b)||
    Math.abs(a)>90||Math.abs(b)>180)continue;
  const dLat=(a-lat)*rad,dLon=(b-lon)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(lat*rad)*Math.cos(a*rad)*Math.sin(dLon/2)**2;
  const distanceMeters=2*earth*Math.asin(Math.min(1,Math.sqrt(h)));
  if(distanceMeters<=radiusMeters)results.push({
    stopId:stop.stop_id,name:stop.stop_name||'',lat:a,lon:b,description:stop.stop_desc||null,
    distanceMeters:Math.round(distanceMeters),
    accessVerified:false
  });
 }
 return results.sort((a,b)=>a.distanceMeters-b.distanceMeters);
}
function nearbyDirectTrips(files,index,date,origin,destination,radiusMeters=700){
 if(!origin||!destination)return [];
 const origins=new Map(nearbyStops(index,origin.lat,origin.lon,radiusMeters).map(stop=>[stop.stopId,stop]));
 const destinations=new Map(nearbyStops(index,destination.lat,destination.lon,radiusMeters).map(stop=>[stop.stopId,stop]));
 return directCandidates(files,index,date,origins,destinations).map(trip=>{
  const from=origins.get(trip.from),to=destinations.get(trip.to);
  return {...trip,originStop:{...from},destinationStop:{...to},
   accessDistanceMeters:from.distanceMeters,egressDistanceMeters:to.distanceMeters};
 });
}
function boundaryLegs(files,index,date,origins,destinations,{maxLegs=50000}={}){
 if(!Number.isSafeInteger(maxLegs)||maxLegs<1)throw new Error('Invalid transfer budget');
 const services=activeServices(files,date),firstByStop=new Map(),secondByStop=new Map();
 if(!origins.size&&!destinations.size)return {firstByStop,secondByStop,searchTruncated:false};
 let legCount=0,searchTruncated=false;
 const add=(map,leg)=>{
  if(legCount>=maxLegs){searchTruncated=true;return false;}
  if(!map.has(leg.toTransfer))map.set(leg.toTransfer,[]);
  map.get(leg.toTransfer).push(leg);legCount++;return true;
 };
 // Keep only legs starting near the origin or ending near the destination.
 trips: for(const [tripId,trip] of index.tripById){
  if(!services.has(trip.service_id))continue;
  const route=index.routeById.get(trip.route_id);if(!route)continue;
  const times=index.timesByTrip.get(tripId)||[];
  const targets=times.flatMap((time,position)=>destinations.has(time.stop_id)?[position]:[]);
  for(let i=0;i<times.length;i++){
   const start=times[i],departureMinutes=minutes(start.departure_time);
   if(departureMinutes===null||!regularAccess(start.pickup_type))continue;
   const fromOrigin=origins.has(start.stop_id);
   for(const j of (fromOrigin?times.keys():targets)){
    if(j<=i)continue;
    const end=times[j];
    const arrivalMinutes=minutes(end.arrival_time);
    if(arrivalMinutes===null||arrivalMinutes<departureMinutes||
       !(Number(end.stop_sequence)>Number(start.stop_sequence))||!regularAccess(end.drop_off_type)||start.stop_id===end.stop_id)continue;
    const leg={tripId,routeId:trip.route_id,line:route.route_short_name||route.route_long_name||'',
     from:start.stop_id,to:end.stop_id,departure:start.departure_time,arrival:end.arrival_time,
     departureMinutes,arrivalMinutes,serviceConfirmed:false};
    if(fromOrigin&&!add(firstByStop,{...leg,toTransfer:end.stop_id}))break trips;
    if(destinations.has(end.stop_id)&&!add(secondByStop,{...leg,toTransfer:start.stop_id}))break trips;
   }
  }
 }
 return {firstByStop,secondByStop,searchTruncated};
}
function transferCandidates(files,index,date,origins,destinations,{
 minTransferMinutes=5,maxWaitMinutes=120,maxLegs=50000,maxCandidates=5000,maxExaminedPairs=100000
}={}){
 if(!Number.isFinite(minTransferMinutes)||minTransferMinutes<0||
    !Number.isFinite(maxWaitMinutes)||maxWaitMinutes<minTransferMinutes)throw new Error('Invalid transfer interval');
 for(const limit of [maxLegs,maxCandidates,maxExaminedPairs])if(!Number.isSafeInteger(limit)||limit<1)throw new Error('Invalid transfer budget');
 const {firstByStop,secondByStop,searchTruncated:legTruncated}=boundaryLegs(files,index,date,origins,destinations,{maxLegs});
 const rules=parseCSV(files['transfers.txt']||'');let searchTruncated=legTruncated,examined=0;
 const scope=(ruleStop,id)=>!ruleStop||ruleStop===id||ruleStop===index.stopById.get(id)?.parent_station;
 const rulesByStop=new Map();
 for(const stopId of firstByStop.keys())rulesByStop.set(stopId,rules.filter(r=>scope(r.from_stop_id,stopId)&&scope(r.to_stop_id,stopId)));
 const required=(stopId,a,b)=>{
  let seconds=minTransferMinutes*60;
  for(const rule of rulesByStop.get(stopId)||[]){
   if((rule.from_trip_id&&rule.from_trip_id!==a.tripId)||(rule.to_trip_id&&rule.to_trip_id!==b.tripId)||
      (rule.from_route_id&&rule.from_route_id!==a.routeId)||(rule.to_route_id&&rule.to_route_id!==b.routeId))continue;
   const type=rule.transfer_type||'0';
   // Apply all applicable prohibitions/minima conservatively. Linked vehicle
   // continuations (4/5), conditional access and cross-stop walking are excluded.
   if(!['0','1','2'].includes(type))return null;
   if(type==='2'){
    if(!/^\d+$/.test(rule.min_transfer_time||''))return null;
    seconds=Math.max(seconds,Number(rule.min_transfer_time));
   }
  }
  return seconds;
 };
 const stopInfo=id=>{const stop=index.stopById.get(id);return {stopId:id,name:stop?.stop_name||'',
  lat:stop?.stop_lat?Number(stop.stop_lat):null,lon:stop?.stop_lon?Number(stop.stop_lon):null,
  description:stop?.stop_desc||null,accessVerified:false};};
 const journeys=[];
 pairs: for(const [stopId,first] of firstByStop){
  const second=(secondByStop.get(stopId)||[]).sort((a,b)=>a.departureMinutes-b.departureMinutes);
  for(const a of first){
   let low=0,high=second.length;
   const earliest=Math.round(a.arrivalMinutes*60)+minTransferMinutes*60;
   while(low<high){const mid=(low+high)>>>1;if(Math.round(second[mid].departureMinutes*60)<earliest)low=mid+1;else high=mid;}
   for(let i=low;i<second.length;i++){
    const b=second[i],waitSeconds=Math.round(b.departureMinutes*60)-Math.round(a.arrivalMinutes*60),waitMinutes=waitSeconds/60;
    if(waitSeconds>maxWaitMinutes*60)break;
    if(++examined>maxExaminedPairs){searchTruncated=true;break pairs;}
    if(a.tripId===b.tripId||a.from===b.to)continue;
    const seconds=required(stopId,a,b);
    if(seconds===null||waitSeconds<seconds)continue;
    if(journeys.length>=maxCandidates){searchTruncated=true;break pairs;}
    const from=origins.get(a.from),to=destinations.get(b.to);
    const clean=leg=>{const {toTransfer,...value}=leg;return value;};
    journeys.push({tripId:JSON.stringify([a.tripId,b.tripId]),date,from:a.from,to:b.to,
     legs:[clean(a),clean(b)],line:[a.line,b.line].join(' → '),transferStopId:stopId,
     transferStop:stopInfo(stopId),transferMinutes:waitMinutes,minTransferSeconds:seconds,
     departure:a.departure,arrival:b.arrival,originStop:typeof from==='object'?{...from}:stopInfo(a.from),
     destinationStop:typeof to==='object'?{...to}:stopInfo(b.to),
     accessDistanceMeters:from?.distanceMeters??null,egressDistanceMeters:to?.distanceMeters??null,
     serviceScheduled:true,serviceConfirmed:false,priceEUR:null,
     exactOrigin:false,exactDestination:false,accessVerified:false,transferVerified:false});
   }
  }
 }
 return {journeys:journeys.sort((a,b)=>minutes(a.departure)-minutes(b.departure)),searchTruncated};
}
function transferTrips(files,index,date,originStopId,destinationStopId,minTransferMinutes=5){
 if(!Number.isFinite(minTransferMinutes)||minTransferMinutes<0)return [];
 return transferCandidates(files,index,date,new Map([[originStopId,true]]),new Map([[destinationStopId,true]]),{minTransferMinutes}).journeys;
}
function nearbyTransferTrips(files,index,date,origin,destination,radiusMeters=700,options={}){
 if(!origin||!destination)return {journeys:[],searchTruncated:false};
 const origins=new Map(nearbyStops(index,origin.lat,origin.lon,radiusMeters).map(stop=>[stop.stopId,stop]));
 const destinations=new Map(nearbyStops(index,destination.lat,destination.lon,radiusMeters).map(stop=>[stop.stopId,stop]));
 return transferCandidates(files,index,date,origins,destinations,options);
}
function buildIndex(files,{serviceIds=null}={}){
 if(!files||typeof files!=='object')throw new TypeError('GTFS files required');
 const stopById=new Map(),routeById=new Map(),tripById=new Map(),inactiveTrips=new Set();
 if(serviceIds!==null&&!(serviceIds instanceof Set))throw new TypeError('GTFS service IDs must be a Set');
 for(const stop of csvRows(files['stops.txt']||''))if(stop.stop_id)stopById.set(stop.stop_id,stop);
 for(const route of csvRows(files['routes.txt']||''))if(route.route_id)routeById.set(route.route_id,route);
 for(const trip of csvRows(files['trips.txt']||''))if(trip.trip_id){
  if(serviceIds===null||serviceIds.has(trip.service_id))tripById.set(trip.trip_id,trip);
  else inactiveTrips.add(trip.trip_id);
 }
 const timesByTrip=new Map(),clockValues=new Map(),sequenceValues=new Map();let stopTimes=0,skippedStopTimes=0;
 const intern=(map,value)=>{
  if(map.has(value))return map.get(value);
  if(map.size<100000)map.set(value,value);
  return value;
 };
 for(const time of csvRows(files['stop_times.txt']||'')){
  stopTimes++;
  const trip=tripById.get(time.trip_id),stop=stopById.get(time.stop_id);
  if(!trip&&inactiveTrips.has(time.trip_id)&&stop){skippedStopTimes++;continue;}
  if(!trip||!stop)continue;
  time.trip_id=trip.trip_id;time.stop_id=stop.stop_id;
  for(const column of ['arrival_time','departure_time'])if(typeof time[column]==='string')time[column]=intern(clockValues,time[column]);
  if(typeof time.stop_sequence==='string')time.stop_sequence=intern(sequenceValues,time.stop_sequence);
  if(!timesByTrip.has(time.trip_id))timesByTrip.set(time.trip_id,[]);
  timesByTrip.get(time.trip_id).push(time);
 }
 for(const list of timesByTrip.values())list.sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence));
 return {stopById,routeById,tripById,timesByTrip,skippedStopTimes,sourceTrips:tripById.size+inactiveTrips.size,
   counts:{stops:stopById.size,routes:routeById.size,trips:tripById.size,stopTimes},
   serviceConfirmed:false};
}
const api={parseCSV,csvRows,activeServices,buildIndex,scheduledTrips,directTrips,transferTrips,nearbyStops,nearbyDirectTrips,nearbyTransferTrips,boundaryLegs};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSIndex=api;
})(typeof window!=='undefined'?window:globalThis);
