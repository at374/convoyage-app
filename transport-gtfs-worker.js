/* Classic browser worker: keep GTFS sources and indexes off the UI thread. */
'use strict';
importScripts('transport-catalogue.js','transport-gtfs-index.js','transport-gtfs-loader.js');
let feedPromise=null;
self.onmessage=async({data})=>{
 const {id,type,resource,options={},query={}}=data||{};
 try{
  let result;
  if(type==='load'){
   if(feedPromise)throw new Error('A network is already loading; replace the worker to reload');
   feedPromise=CPGTFSLoader.loadResource(resource,options);
   const feed=await feedPromise;
   result={source:feed.source,counts:feed.index.counts,archiveBytes:feed.archiveBytes,
    expandedBytes:feed.expandedBytes,indexedStopTimes:feed.indexedStopTimes,
    rejectedStopTimes:feed.rejectedStopTimes,
    serviceConfirmed:false,faresVerified:false,accessVerified:false};
  }else if(type==='query'){
   if(!feedPromise)throw new Error('Load a network before querying');
   const feed=await feedPromise;
   const limit=query.limit??100;
   if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Invalid GTFS result limit');
   let rows;
   if(query.method==='directTrips'){
    rows=CPGTFSIndex.directTrips(feed.files,feed.index,query.date,query.from,query.to);
   }else if(query.method==='nearbyDirectTrips'){
    const radius=query.radiusMeters??700;
    if(!Number.isFinite(radius)||radius<=0||radius>5000)throw new Error('Invalid GTFS search radius');
    rows=CPGTFSIndex.nearbyDirectTrips(feed.files,feed.index,query.date,query.origin,query.destination,radius);
   }else if(query.method==='nearbyStops'){
    rows=CPGTFSIndex.nearbyStops(feed.index,query.lat,query.lon,query.radiusMeters??700);
   }else throw new Error('Unsupported GTFS worker query');
   result={rows:rows.slice(0,limit),truncated:rows.length>limit,
    serviceConfirmed:false,faresVerified:false,accessVerified:false};
  }else throw new Error('Unsupported GTFS worker operation');
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:{name:error.name||'Error',message:error.message||String(error)}});}
};
