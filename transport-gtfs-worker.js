/* Classic browser worker: bounded GTFS indexes stay off the UI thread. */
'use strict';
importScripts('transport-catalogue.js','transport-gtfs-index.js','transport-gtfs-loader.js','transport-gtfs-time.js','transport-gtfs-federation.js');
let feedsPromise=null;
const summary=feed=>({source:feed.source,counts:feed.index.counts,archiveBytes:feed.archiveBytes,
 expandedBytes:feed.expandedBytes,indexedStopTimes:feed.indexedStopTimes,skippedStopTimes:feed.skippedStopTimes,
 rejectedStopTimes:feed.rejectedStopTimes,indexServiceDates:feed.indexServiceDates,
 serviceConfirmed:false,faresVerified:false,accessVerified:false});
function scope(feed,date){if(date&&feed.indexServiceDates&&!feed.indexServiceDates.includes(date))throw new Error('Date outside GTFS index scope');}
// Bind regional fare scope to the actual, unambiguous GTFS portion. Never use
// endpoints alone: an intermediate stop may leave the eligible territory.
function fareScopePath(feeds,leg){
 const feed=feeds.find(f=>(f.source.datasetId||f.source.resourceId)===leg.networkId);
 if(leg.networkId!=='oura-haute-savoie'||leg.line!=='Y51'||!feed)return null;
 const trip=feed.index.tripById.get(leg.tripId),route=feed.index.routeById.get(trip?.route_id);
 if(route?.route_short_name!=='Y51'||!leg.departureTime||!leg.arrivalTime)return null;
 const times=feed.index.timesByTrip.get(leg.tripId)||[];
 if(times.length>1024)return null;
 const matches=[];
 for(let i=0;i<times.length;i++)if(times[i].stop_id===leg.from&&times[i].departure_time===leg.departureTime){
  for(let j=i+1;j<times.length;j++)if(times[j].stop_id===leg.to&&times[j].arrival_time===leg.arrivalTime){
   if(j-i+1>64||matches.length)return null;matches.push(times.slice(i,j+1));
  }
 }
 if(matches.length!==1)return null;
 const stops=matches[0].map(t=>{
  const s=feed.index.stopById.get(t.stop_id);
  const number=value=>typeof value==='string'&&value.trim()&&Number.isFinite(Number(value))?Number(value):null;
  return {stopId:t.stop_id,name:s?.stop_name||'',lat:number(s?.stop_lat),lon:number(s?.stop_lon)};
 });
 return {networkId:leg.networkId,tripId:leg.tripId,from:leg.from,to:leg.to,
  departure:leg.departure,arrival:leg.arrival,stops};
}
function withFareScope(feeds,row){
 if(Array.isArray(row.legs))return {...row,legs:row.legs.map(leg=>({...leg,fareScopePath:fareScopePath(feeds,leg)}))};
 return {...row,fareScopePath:fareScopePath(feeds,row)};
}
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
   let connectionDates;
   if(query.connectionDates!==undefined){
    if(query.method!=='missionJourneys')throw new Error('Service dates require a mission journey query');
    connectionDates=CPGTFSFederation.connectionServiceDates(query.date,query.connectionDates);
    for(const current of feeds)for(const day of connectionDates)scope(current,day);
   }
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
      const bounds=CPGTFSTime.serviceWindow(current.files,query.date,query.window);
      const transfers=CPGTFSIndex.nearbyTransferTrips(current.files,current.index,query.date,query.origin,query.destination,radius,bounds);
      searchTruncated=searchTruncated||transfers.searchTruncated;
      found.push(...CPGTFSTime.datedTransferTrips(current.files,current.index,transfers.journeys,query.window));
     }
     rows.push(...found.map(row=>({...row,networkId:current.source.datasetId||current.source.resourceId,
      network:current.source.network,legs:row.legs?.map(leg=>({...leg,network:current.source.network,networkId:current.source.datasetId||current.source.resourceId}))})));
    }
    if(query.method==='missionJourneys'&&feeds.length===2){
     const cross=CPGTFSFederation.crossNetworkTrips(feeds,query.date,query.origin,query.destination,query.window,{radiusMeters:radius,
      ...(connectionDates===undefined?{}:{connectionDates})});
     rows.push(...cross.journeys);searchTruncated=searchTruncated||cross.searchTruncated;
    }
    // Apply mission ordering before the result cap, including across networks.
    if(query.method!=='nearbyDirectTrips')rows.sort((a,b)=>(order==='latestDeparture'?-1:1)*(Date.parse(a.departure)-Date.parse(b.departure)));
   }else if(query.method==='nearbyStops')rows=CPGTFSIndex.nearbyStops(feed.index,query.lat,query.lon,query.radiusMeters??700);
   else throw new Error('Unsupported GTFS worker query');
   result={rows:rows.slice(0,limit).map(row=>query.method==='missionJourneys'?withFareScope(feeds,row):row),truncated:searchTruncated||rows.length>limit,searchTruncated,
    serviceConfirmed:false,faresVerified:false,accessVerified:false};
  }else throw new Error('Unsupported GTFS worker operation');
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:{name:error.name||'Error',message:error.message||String(error)}});}
};
