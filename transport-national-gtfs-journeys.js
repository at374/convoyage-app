/* National GTFS itinerary candidates. Static timetable only; no live prices or seat inventory. */
(function(root){
'use strict';
const indexer=typeof module==='object'&&module.exports?require('./transport-gtfs-index.js'):root.CPGTFSIndex;
const loader=typeof module==='object'&&module.exports?require('./transport-gtfs-loader.js'):root.CPGTFSLoader;
const OPERATORS=new Set(['sncf','blablacarBus','flixbus']);
function search({operator,files,index,date,from,to,radiusMeters=1200,maxResults=30,earliestDeparture=null,latestArrival=null}={}){
 if(!OPERATORS.has(operator))throw new Error('Unsupported national operator');
 if(!files||!index)throw new Error('Prebuilt GTFS files and index required');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||
  !Number.isFinite(Date.parse(date+'T00:00:00Z'))||
  new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)
  throw new Error('Invalid GTFS date');
 if(![from?.lat,from?.lon,to?.lat,to?.lon].every(Number.isFinite)||
  Math.abs(from.lat)>90||Math.abs(to.lat)>90||Math.abs(from.lon)>180||Math.abs(to.lon)>180)
  throw new Error('Valid exact origin/destination coordinates required');
 if(!Number.isFinite(radiusMeters)||radiusMeters<100||radiusMeters>5000)throw new Error('Invalid walking search radius');
 if(!Number.isSafeInteger(maxResults)||maxResults<1||maxResults>100)throw new Error('Invalid result limit');
 const min=earliestDeparture===null?-Infinity:(typeof earliestDeparture==='string'&&/^\d{1,3}:[0-5]\d(:[0-5]\d)?$/.test(earliestDeparture)?Number(earliestDeparture.split(':')[0])*60+Number(earliestDeparture.split(':')[1]):NaN);
 if(Number.isNaN(min))throw new Error('Invalid departure threshold');
 const max=latestArrival===null?Infinity:(typeof latestArrival==='string'&&/^\d{1,3}:[0-5]\d(:[0-5]\d)?$/.test(latestArrival)?Number(latestArrival.split(':')[0])*60+Number(latestArrival.split(':')[1]):NaN);
 if(Number.isNaN(max))throw new Error('Invalid arrival threshold');
 return indexer.nearbyDirectTrips(files,index,date,from,to,radiusMeters)
  .filter(x=>Number(x.departure.split(':')[0])*60+Number(x.departure.split(':')[1])>=min&&
    Number(x.arrival.split(':')[0])*60+Number(x.arrival.split(':')[1])<=max)
  .slice(0,maxResults).map(x=>({
   operator,tripId:x.tripId,line:x.line,date:x.date,departure:x.departure,arrival:x.arrival,
   fromStopId:x.from,toStopId:x.to,originStop:x.originStop,destinationStop:x.destinationStop,
   accessDistanceMeters:x.accessDistanceMeters,egressDistanceMeters:x.egressDistanceMeters,
   serviceScheduled:true,serviceConfirmed:false,priceEUR:null,priceStatus:'unavailable',
   seatAvailability:'unknown',walkingRouteConfirmed:false,source:'official-gtfs'
  }));
}
async function loadAndSearch({operator,resource,fetcher,signal,loadOptions={},...searchOptions}={}){
 if(!OPERATORS.has(operator))throw new Error('Unsupported national operator');
 if(!resource||!/^https:\/\//i.test(resource.url||''))throw new Error('HTTPS GTFS resource required');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(searchOptions.date||'')||
  !Number.isFinite(Date.parse(searchOptions.date+'T00:00:00Z'))||
  new Date(searchOptions.date+'T00:00:00Z').toISOString().slice(0,10)!==searchOptions.date)
  throw new Error('Invalid service date before GTFS download');
 if(![searchOptions.from?.lat,searchOptions.from?.lon,searchOptions.to?.lat,searchOptions.to?.lon].every(Number.isFinite))
  throw new Error('Exact coordinates required before GTFS download');
 // Never download unbounded national GTFS archives into a phone; use a server-prepared regional slice.
 const {maxArchiveBytes=20*1024*1024,...rest}=loadOptions;
 if(!Number.isSafeInteger(maxArchiveBytes)||maxArchiveBytes<=0||maxArchiveBytes>20*1024*1024)
  throw new Error('National GTFS archive exceeds safe mobile cap; prepare a server-side slice');
 const feed=await loader.loadResource(resource,{...rest,maxArchiveBytes,fetcher,signal,
  indexServiceDates:[searchOptions.date],retainSourceTables:false});
 return {source:feed.source,counts:feed.index.counts,journeys:search({
  operator,files:feed.files,index:feed.index,...searchOptions
 })};
}
const api={search,loadAndSearch};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPNationalGTFSJourneys=api;
})(typeof window!=='undefined'?window:globalThis);
