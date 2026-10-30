/* Classic browser worker: bounded GTFS indexes stay off the UI thread. */
'use strict';
importScripts('transport-catalogue.js','transport-gtfs-index.js','transport-gtfs-loader.js','transport-gtfs-time.js','transport-gtfs-federation.js');
let feedsPromise=null;
const summary=feed=>({source:feed.source,counts:feed.index.counts,archiveBytes:feed.archiveBytes,
 expandedBytes:feed.expandedBytes,indexedStopTimes:feed.indexedStopTimes,skippedStopTimes:feed.skippedStopTimes,
 rejectedStopTimes:feed.rejectedStopTimes,indexServiceDates:feed.indexServiceDates,
 serviceConfirmed:false,faresVerified:false,accessVerified:false});
function scope(feed,date){if(date&&feed.indexServiceDates&&!feed.indexServiceDates.includes(date))throw new Error('Date outside GTFS index scope');}
self.onmessage=async({data})=>{
 const {id,type,resource,resources,options={},query={}}=data||{};
 try{
  let result;
  if(type==='load'||type==='loadNetworks'){
   if(feedsPromise)throw new Error('A network is already loading; replace the worker to reload');
   if(type==='loadNetworks'&&(!Array.isArray(options.indexServiceDates)||!options.indexServiceDates.length))throw new Error('Service dates required for multiple GTFS networks');
   const list=type==='load'?[resource]:resources;
   if(!Array.isArray(list)||!list.length||list.length>2)throw new Error('One or two GTFS networks required');
   feedsPromise=(async()=>{
    const entries=[];
    for(const item of list){
     try{entries.push({feed:await CPGTFSLoader.loadResource(item,{...options,retainSourceTables:false})});}
     catch(error){entries.push({error:{network:item?.network||'',message:error.message}});}
    }
    return entries;
   })();
   const entries=await feedsPromise,valid=entries.filter(e=>e.feed);
   if(!valid.length)throw new Error(entries[0].error.message);
   result=type==='load'?summary(valid[0].feed):{networks:entries.map(e=>e.feed?summary(e.feed):e),partial:valid.length!==entries.length};
  }else if(type==='query'){
   if(!feedsPromise)throw new Error('Load a network before querying');
   const feeds=(await feedsPromise).filter(e=>e.feed).map(e=>e.feed),feed=feeds[0];
   if(!feed)throw new Error('No GTFS network loaded');
   const limit=query.limit??100;
   if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Invalid GTFS result limit');
   const order=query.order??'earliestDeparture';
   if(!['earliestDeparture','latestDeparture'].includes(order)||
      (query.order!==undefined&&!['missionDirectTrips','missionJourneys'].includes(query.method)))throw new Error('Invalid GTFS result order');
   let rows,searchTruncated=false;
   scope(feed,query.date);
   if(query.method==='directTrips')rows=CPGTFSIndex.directTrips(feed.files,feed.index,query.date,query.from,query.to);
   else if(['nearbyDirectTrips','missionDirectTrips','missionJourneys'].includes(query.method)){
    const radius=query.radiusMeters??700;
    if(!Number.isFinite(radius)||radius<=0||radius>5000)throw new Error('Invalid GTFS search radius');
    rows=[];
    for(const current of (query.method==='missionJourneys'?feeds:[feed])){
     scope(current,query.date);
     let found=CPGTFSIndex.nearbyDirectTrips(current.files,current.index,query.date,query.origin,query.destination,radius);
     if(query.method!=='nearbyDirectTrips')found=CPGTFSTime.datedTrips(current.files,current.index,found,query.window);
     if(query.method==='missionJourneys'){
      const transfers=CPGTFSIndex.nearbyTransferTrips(current.files,current.index,query.date,query.origin,query.destination,radius);
      searchTruncated=searchTruncated||transfers.searchTruncated;
      found.push(...CPGTFSTime.datedTransferTrips(current.files,current.index,transfers.journeys,query.window));
     }
     rows.push(...found.map(row=>({...row,networkId:current.source.datasetId||current.source.resourceId,
      network:current.source.network,legs:row.legs?.map(leg=>({...leg,network:current.source.network,networkId:current.source.datasetId||current.source.resourceId}))})));
    }
    if(query.method==='missionJourneys'&&feeds.length===2){
     const cross=CPGTFSFederation.crossNetworkTrips(feeds,query.date,query.origin,query.destination,query.window,{radiusMeters:radius});
     rows.push(...cross.journeys);searchTruncated=searchTruncated||cross.searchTruncated;
    }
    // Apply mission ordering before the result cap, including across networks.
    if(query.method!=='nearbyDirectTrips')rows.sort((a,b)=>(order==='latestDeparture'?-1:1)*(Date.parse(a.departure)-Date.parse(b.departure)));
   }else if(query.method==='nearbyStops')rows=CPGTFSIndex.nearbyStops(feed.index,query.lat,query.lon,query.radiusMeters??700);
   else throw new Error('Unsupported GTFS worker query');
   result={rows:rows.slice(0,limit),truncated:searchTruncated||rows.length>limit,searchTruncated,
    serviceConfirmed:false,faresVerified:false,accessVerified:false};
  }else throw new Error('Unsupported GTFS worker operation');
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:{name:error.name||'Error',message:error.message||String(error)}});}
};
