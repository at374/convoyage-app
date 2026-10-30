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
function directTrips(files,index,date,originStopId,destinationStopId){
 if(!index.stopById.has(originStopId)||!index.stopById.has(destinationStopId)||
     originStopId===destinationStopId)return [];
 const journeys=[];
 for(const trip of scheduledTrips(files,index,date)){
  const starts=trip.stops.filter(stop=>stop.stopId===originStopId);
  for(const start of starts){
   const end=trip.stops.find(stop=>stop.stopId===destinationStopId&&
      stop.sequence>start.sequence);
   if(!end||!/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(start.departure||'')||
      !/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(end.arrival||''))continue;
   journeys.push({
    tripId:trip.tripId,line:trip.line,date,
    from:originStopId,to:destinationStopId,
    departure:start.departure,arrival:end.arrival,
    serviceScheduled:true,serviceConfirmed:false,
    exactOrigin:false,exactDestination:false,accessVerified:false,
    priceEUR:null
   });
  }
 }
 return journeys.sort((a,b)=>a.departure.localeCompare(b.departure,undefined,{numeric:true}));
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
    stopId:stop.stop_id,name:stop.stop_name||'',distanceMeters:Math.round(distanceMeters),
    accessVerified:false
  });
 }
 return results.sort((a,b)=>a.distanceMeters-b.distanceMeters);
}
function nearbyDirectTrips(files,index,date,origin,destination,radiusMeters=700){
 if(!origin||!destination)return [];
 const origins=nearbyStops(index,origin.lat,origin.lon,radiusMeters);
 const destinations=nearbyStops(index,destination.lat,destination.lon,radiusMeters);
 const journeys=[];
 for(const from of origins)for(const to of destinations){
  for(const trip of directTrips(files,index,date,from.stopId,to.stopId)){
   journeys.push({...trip,
    originStop:{...from},destinationStop:{...to},
    accessDistanceMeters:from.distanceMeters,
    egressDistanceMeters:to.distanceMeters,
    accessVerified:false,exactOrigin:false,exactDestination:false,
    serviceConfirmed:false,priceEUR:null});
  }
 }
 return journeys.sort((a,b)=>minutes(a.departure)-minutes(b.departure));
}
function transferTrips(files,index,date,originStopId,destinationStopId,minTransferMinutes=5){
 if(!Number.isFinite(minTransferMinutes)||minTransferMinutes<0)return [];
 const trips=scheduledTrips(files,index,date);
 const legs=[];
 for(const trip of trips){
  for(let i=0;i<trip.stops.length;i++){
   const start=trip.stops[i],departureMinutes=minutes(start.departure);
   if(departureMinutes===null)continue;
   for(let j=i+1;j<trip.stops.length;j++){
    const end=trip.stops[j],arrivalMinutes=minutes(end.arrival);
    if(arrivalMinutes===null||arrivalMinutes<departureMinutes)continue;
    legs.push({tripId:trip.tripId,line:trip.line,from:start.stopId,to:end.stopId,
      departure:start.departure,arrival:end.arrival,departureMinutes,arrivalMinutes});
   }
  }
 }
 const first=legs.filter(l=>l.from===originStopId);
 const second=legs.filter(l=>l.to===destinationStopId);
 const journeys=[];
 for(const a of first)for(const b of second){
  if(a.tripId===b.tripId||a.to!==b.from||
     b.departureMinutes-a.arrivalMinutes<minTransferMinutes)continue;
  journeys.push({date,legs:[a,b],transferStopId:a.to,
    departure:a.departure,arrival:b.arrival,
    serviceScheduled:true,serviceConfirmed:false,priceEUR:null,
    exactOrigin:false,exactDestination:false,accessVerified:false});
 }
 return journeys.sort((a,b)=>minutes(a.departure)-minutes(b.departure));
}
function buildIndex(files){
 if(!files||typeof files!=='object')throw new TypeError('GTFS files required');
 const stopById=new Map(),routeById=new Map(),tripById=new Map();
 for(const stop of csvRows(files['stops.txt']||''))if(stop.stop_id)stopById.set(stop.stop_id,stop);
 for(const route of csvRows(files['routes.txt']||''))if(route.route_id)routeById.set(route.route_id,route);
 for(const trip of csvRows(files['trips.txt']||''))if(trip.trip_id)tripById.set(trip.trip_id,trip);
 const timesByTrip=new Map(),clockValues=new Map(),sequenceValues=new Map();let stopTimes=0;
 const intern=(map,value)=>{
  if(map.has(value))return map.get(value);
  if(map.size<100000)map.set(value,value);
  return value;
 };
 for(const time of csvRows(files['stop_times.txt']||'')){
  stopTimes++;
  const trip=tripById.get(time.trip_id),stop=stopById.get(time.stop_id);
  if(!trip||!stop)continue;
  time.trip_id=trip.trip_id;time.stop_id=stop.stop_id;
  for(const column of ['arrival_time','departure_time'])if(typeof time[column]==='string')time[column]=intern(clockValues,time[column]);
  if(typeof time.stop_sequence==='string')time.stop_sequence=intern(sequenceValues,time.stop_sequence);
  if(!timesByTrip.has(time.trip_id))timesByTrip.set(time.trip_id,[]);
  timesByTrip.get(time.trip_id).push(time);
 }
 for(const list of timesByTrip.values())list.sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence));
 return {stopById,routeById,tripById,timesByTrip,
   counts:{stops:stopById.size,routes:routeById.size,trips:tripById.size,stopTimes},
   serviceConfirmed:false};
}
const api={parseCSV,csvRows,activeServices,buildIndex,scheduledTrips,directTrips,transferTrips,nearbyStops,nearbyDirectTrips};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSIndex=api;
})(typeof window!=='undefined'?window:globalThis);
