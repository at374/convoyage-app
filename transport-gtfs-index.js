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
const api={parseCSV,buildIndex};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSIndex=api;
})(typeof window!=='undefined'?window:globalThis);
