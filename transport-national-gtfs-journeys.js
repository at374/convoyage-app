/* National GTFS itinerary candidates. Static timetable only; no live prices or seat inventory. */
(function(root){
'use strict';
const indexer=typeof module==='object'&&module.exports?require('./transport-gtfs-index.js'):root.CPGTFSIndex;
const OPERATORS=new Set(['sncf','blablacarBus','flixbus']);
function search({operator,files,index,date,from,to,radiusMeters=1200,maxResults=30,earliestDeparture=null}={}){
 if(!OPERATORS.has(operator))throw new Error('Unsupported national operator');
 if(!files||!index)throw new Error('Prebuilt GTFS files and index required');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw new Error('Invalid GTFS date');
 if(![from?.lat,from?.lon,to?.lat,to?.lon].every(Number.isFinite))throw new Error('Exact origin/destination coordinates required');
 if(!Number.isFinite(radiusMeters)||radiusMeters<100||radiusMeters>5000)throw new Error('Invalid walking search radius');
 if(!Number.isSafeInteger(maxResults)||maxResults<1||maxResults>100)throw new Error('Invalid result limit');
 const min=earliestDeparture===null?-Infinity:(typeof earliestDeparture==='string'&&/^\d{1,3}:[0-5]\d(:[0-5]\d)?$/.test(earliestDeparture)?Number(earliestDeparture.split(':')[0])*60+Number(earliestDeparture.split(':')[1]):NaN);
 if(Number.isNaN(min))throw new Error('Invalid departure threshold');
 return indexer.nearbyDirectTrips(files,index,date,from,to,radiusMeters)
  .filter(x=>Number(x.departure.split(':')[0])*60+Number(x.departure.split(':')[1])>=min)
  .slice(0,maxResults).map(x=>({
   operator,tripId:x.tripId,line:x.line,date:x.date,departure:x.departure,arrival:x.arrival,
   fromStopId:x.from,toStopId:x.to,originStop:x.originStop,destinationStop:x.destinationStop,
   accessDistanceMeters:x.accessDistanceMeters,egressDistanceMeters:x.egressDistanceMeters,
   serviceScheduled:true,serviceConfirmed:false,priceEUR:null,priceStatus:'unavailable',
   seatAvailability:'unknown',walkingRouteConfirmed:false,source:'official-gtfs'
  }));
}
const api={search};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPNationalGTFSJourneys=api;
})(typeof window!=='undefined'?window:globalThis);
