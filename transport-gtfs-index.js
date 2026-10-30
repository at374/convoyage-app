/* GTFS static CSV index. Requires already extracted, trusted text files. */
(function(root){
'use strict';
function parseCSV(text){
 if(typeof text!=='string')throw new TypeError('CSV text required');
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
   else if(c==='"')quoted=false;
   else field+=c;
  }else if(c==='"')quoted=true;
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw new Error('Unclosed CSV quote');
 if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
 const [header,...records]=rows;
 if(!header)return [];
 const names=header.map((h,i)=>i===0?h.replace(/^\uFEFF/,''):h);
 return records.filter(r=>r.some(v=>v!=='')).map(r=>Object.fromEntries(names.map((h,i)=>[h,r[i]??''])));
}
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
function buildIndex(files){
 if(!files||typeof files!=='object')throw new TypeError('GTFS files required');
 const stops=parseCSV(files['stops.txt']||'');
 const routes=parseCSV(files['routes.txt']||'');
 const trips=parseCSV(files['trips.txt']||'');
 const times=parseCSV(files['stop_times.txt']||'');
 const stopById=new Map(stops.filter(s=>s.stop_id).map(s=>[s.stop_id,s]));
 const routeById=new Map(routes.filter(r=>r.route_id).map(r=>[r.route_id,r]));
 const tripById=new Map(trips.filter(t=>t.trip_id).map(t=>[t.trip_id,t]));
 const timesByTrip=new Map();
 for(const time of times){
  if(!tripById.has(time.trip_id)||!stopById.has(time.stop_id))continue;
  if(!timesByTrip.has(time.trip_id))timesByTrip.set(time.trip_id,[]);
  timesByTrip.get(time.trip_id).push(time);
 }
 for(const list of timesByTrip.values())list.sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence));
 return {stopById,routeById,tripById,timesByTrip,
   counts:{stops:stopById.size,routes:routeById.size,trips:tripById.size,stopTimes:times.length},
   serviceConfirmed:false};
}
const api={parseCSV,activeServices,buildIndex,scheduledTrips};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSIndex=api;
})(typeof window!=='undefined'?window:globalThis);
