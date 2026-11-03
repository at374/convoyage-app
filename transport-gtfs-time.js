/* GTFS service clocks are elapsed time from local noon minus twelve hours. */
(function(root){
'use strict';
const cache=new Map();
function validDate(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid GTFS service date');
 const value=Date.parse(date+'T12:00:00Z');
 if(!Number.isFinite(value)||new Date(value).toISOString().slice(0,10)!==date)throw new Error('Invalid GTFS service date');
 return value;
}
function serviceBase(date,timeZone){
 const noon=validDate(date),key=JSON.stringify([date,timeZone]);
 if(cache.has(key))return cache.get(key);
 if(typeof timeZone!=='string'||!timeZone.trim())throw new Error('Missing GTFS agency timezone');
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const civil=ms=>{
  const values=Object.fromEntries(formatter.formatToParts(ms).map(p=>[p.type,p.value]));
  return Date.parse(`${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}Z`);
 };
 // Enumerate surrounding offsets and require one unambiguous local noon.
 const candidates=new Set();
 for(let hours=-36;hours<=36;hours+=6){
  const sample=noon+hours*3600000,offset=civil(sample)-sample,candidate=noon-offset;
  if(civil(candidate)===noon)candidates.add(candidate);
 }
 if(candidates.size!==1)throw new Error('Ambiguous or missing GTFS service noon');
 const base=[...candidates][0]-12*3600000;
 if(cache.size>=128)cache.delete(cache.keys().next().value);
 cache.set(key,base);return base;
}
function serviceTimestamp(date,time,timeZone){
 if(typeof time!=='string'||!/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(time))throw new Error('Invalid GTFS clock');
 const [hours,minutes,seconds]=time.split(':').map(Number);
 return serviceBase(date,timeZone)+(hours*3600+minutes*60+seconds)*1000;
}
function instant(value){
 if(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=8640000000000000)return value;
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)){
  validDate(value.slice(0,10));
  const clock=value.slice(11,19).split(/[Z+.-]/)[0].split(':').map(Number);
  if(clock[0]>23||clock[1]>59||(clock[2]??0)>59)throw new Error('Invalid mission clock');
  const parsed=Date.parse(value);if(Number.isFinite(parsed))return parsed;
 }
 throw new Error('Mission timestamp must include an explicit timezone');
}
function missionBounds({earliestDeparture,latestArrival,marginMinutes=5}={}){
 if(earliestDeparture===undefined&&latestArrival===undefined)throw new Error('A mission time window is required');
 if(!Number.isFinite(marginMinutes)||marginMinutes<0||marginMinutes>1440)throw new Error('Invalid mission safety margin');
 const first=earliestDeparture===undefined?-Infinity:instant(earliestDeparture);
 const last=latestArrival===undefined?Infinity:instant(latestArrival)-marginMinutes*60000;
 return {first,last,marginMinutes,latestArrival};
}
function agencyData(files){
 const gtfs=root.CPGTFSIndex||(typeof module==='object'&&module.exports?require('./transport-gtfs-index.js'):null);
 const agencies=gtfs.parseCSV(files['agency.txt']||'');
 if(!agencies.length||agencies.some(a=>!a.agency_timezone))throw new Error('Missing GTFS agency timezone');
 if(new Set(agencies.map(a=>a.agency_timezone)).size!==1)throw new Error('Ambiguous GTFS agency timezone');
 return {agencies,timeZone:agencies[0].agency_timezone};
}
function serviceWindow(files,date,window){
 const {first,last}=missionBounds(window),{timeZone}=agencyData(files);
 const base=serviceTimestamp(date,'00:00:00',timeZone);
 return {minDepartureSeconds:(first-base)/1000,maxArrivalSeconds:(last-base)/1000};
}
function datedTrips(files,index,rows,window){
 const {first,last,marginMinutes,latestArrival}=missionBounds(window),{agencies}=agencyData(files);
 const results=[];
 for(const row of rows){
  const trip=index.tripById.get(row.tripId),route=index.routeById.get(trip?.route_id);
  if(!route)throw new Error('Missing GTFS route for dated trip');
  const matching=route.agency_id?agencies.filter(a=>a.agency_id===route.agency_id):agencies;
  const zones=new Set(matching.map(a=>a.agency_timezone));
  if(!matching.length||zones.size!==1)throw new Error('Ambiguous GTFS route timezone');
  const timeZone=[...zones][0];
  const departure=serviceTimestamp(row.date,row.departure,timeZone),arrival=serviceTimestamp(row.date,row.arrival,timeZone);
  if(arrival<departure||departure<first||arrival>last)continue;
  results.push({...row,serviceDate:row.date,timeZone,departureTime:row.departure,arrivalTime:row.arrival,
   departure:new Date(departure).toISOString(),arrival:new Date(arrival).toISOString(),
   timetableOnly:true,marginMinutes:latestArrival===undefined?null:marginMinutes,
   exactOrigin:false,exactDestination:false,accessVerified:false,serviceConfirmed:false,
   faresVerified:false,priceEUR:null});
 }
 return results.sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
}
function datedTransferTrips(files,index,rows,window){
 const flat=rows.flatMap((row,group)=>row.legs.map((leg,position)=>({...leg,date:row.date,group,position})));
 const converted=datedTrips(files,index,flat,window),groups=new Map();
 for(const leg of converted){
  if(!groups.has(leg.group))groups.set(leg.group,[]);
  groups.get(leg.group).push(leg);
 }
 const results=[];
 for(const [group,legs] of groups){
  if(legs.length!==2)continue;
  legs.sort((a,b)=>a.position-b.position);
  const [a,b]=legs,row=rows[group];
  if(a.timeZone!==b.timeZone||Date.parse(a.arrival)>Date.parse(b.departure))continue;
  const clean=leg=>{const {group,position,...value}=leg;return value;};
  results.push({...row,legs:legs.map(clean),serviceDate:row.date,timeZone:a.timeZone,
   departureTime:row.departure,arrivalTime:row.arrival,departure:a.departure,arrival:b.arrival,
   timetableOnly:true,marginMinutes:b.marginMinutes,exactOrigin:false,exactDestination:false,
   accessVerified:false,transferVerified:false,serviceConfirmed:false,faresVerified:false,priceEUR:null});
 }
 return results.sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
}
const api={serviceTimestamp,serviceWindow,datedTrips,datedTransferTrips};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSTime=api;
})(typeof window!=='undefined'?window:globalThis);
