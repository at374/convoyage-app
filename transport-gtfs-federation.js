/* Proximity candidates between two distinct feeds. No pedestrian path is inferred. */
(function(root){
'use strict';
const g=root.CPGTFSIndex||(typeof module==='object'&&module.exports?require('./transport-gtfs-index.js'):null);
const clock=root.CPGTFSTime||(typeof module==='object'&&module.exports?require('./transport-gtfs-time.js'):null);
function connectionServiceDates(date,days=[date]){
 if(!Array.isArray(days)||!days.length||days.length>5||!days.includes(date))throw new Error('Invalid federation service dates');
 for(const day of days)clock.serviceTimestamp(day,'12:00:00','UTC');
 return [date,...new Set(days.filter(day=>day!==date))];
}
function crossNetworkTrips(feeds,date,origin,destination,window,{
 radiusMeters=700,transferRadiusMeters=150,minTransferMinutes=5,maxWaitMinutes=120,
 maxLegs=20000,maxPairs=50000,maxJourneys=2000,maxStopLookups=1000,connectionDates=[date]
}={}){
 if(!Array.isArray(feeds)||feeds.length!==2)throw new Error('Exactly two GTFS networks required');
 for(const n of [radiusMeters,transferRadiusMeters,minTransferMinutes,maxWaitMinutes])if(!Number.isFinite(n)||n<=0)throw new Error('Invalid federation interval or radius');
 if(transferRadiusMeters>500||radiusMeters>5000||maxWaitMinutes<minTransferMinutes)throw new Error('Invalid federation interval or radius');
 for(const n of [maxLegs,maxPairs,maxJourneys,maxStopLookups])if(!Number.isSafeInteger(n)||n<1)throw new Error('Invalid federation budget');
 const dates=connectionServiceDates(date,connectionDates);
 const ids=feeds.map(feed=>feed.source.datasetId||feed.source.resourceId);
 if(ids.some(id=>!id)||new Set(ids).size!==2)throw new Error('Distinct GTFS network identifiers required');
 let searchTruncated=false,pairs=0,lookups=0;const journeys=[];
 const prepared=feeds.map((feed,i)=>{
  if(feed.indexServiceDates&&dates.some(day=>!feed.indexServiceDates.includes(day)))throw new Error('Date outside GTFS index scope');
  const origins=new Map(g.nearbyStops(feed.index,origin.lat,origin.lon,radiusMeters).map(stop=>[stop.stopId,stop]));
  const destinations=new Map(g.nearbyStops(feed.index,destination.lat,destination.lon,radiusMeters).map(stop=>[stop.stopId,stop]));
  const rows=[];let remaining=maxLegs;
  for(const day of dates){
   if(!remaining){searchTruncated=true;break;}
   const bounds=clock.serviceWindow(feed.files,day,window);
   const raw=g.boundaryLegs(feed.files,feed.index,day,day===date?origins:new Map(),destinations,{maxLegs:remaining,...bounds});
   searchTruncated=searchTruncated||raw.searchTruncated;
   const legs=[...raw.firstByStop.values()].flat().map(leg=>({...leg,date:day,side:'first'}))
    .concat([...raw.secondByStop.values()].flat().map(leg=>({...leg,date:day,side:'second'})));
   rows.push(...legs);remaining-=legs.length;
  }
  const dated=clock.datedTrips(feed.files,feed.index,rows,window),first=new Map(),second=new Map();
  for(const leg of dated){
   const map=leg.side==='first'?first:second;
   if(!map.has(leg.toTransfer))map.set(leg.toTransfer,[]);
   const {side,toTransfer,...value}=leg;
   map.get(leg.toTransfer).push({...value,networkId:ids[i],network:feed.source.network||ids[i]});
  }
  for(const list of second.values())list.sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
  return {feed,origins,destinations,first,second};
 });
 const stopInfo=(index,id)=>{
  const stop=index.stopById.get(id);
  if(!stop||!stop.stop_lat||!stop.stop_lon)return null;
  const lat=Number(stop.stop_lat),lon=Number(stop.stop_lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
  return {stopId:id,name:stop.stop_name||'',lat,lon,description:stop.stop_desc||null,accessVerified:false};
 };
 directions: for(const [a,b] of [[prepared[0],prepared[1]],[prepared[1],prepared[0]]]){
  if(!a.first.size||!b.second.size)continue;
  for(const [stopId,first] of a.first){
   const stop=stopInfo(a.feed.index,stopId);if(!stop)continue;
   if(++lookups>maxStopLookups){searchTruncated=true;break directions;}
   const nearby=g.nearbyStops(b.feed.index,stop.lat,stop.lon,transferRadiusMeters);
   for(const peer of nearby){
    const second=b.second.get(peer.stopId)||[];
    for(const x of first){
     const minimumWalkMinutes=Math.ceil(peer.distanceMeters/60); // Lower-bound estimate, not a verified walking route.
     const earliest=Date.parse(x.arrival)+Math.max(minTransferMinutes,minimumWalkMinutes)*60000;
     let low=0,high=second.length;
     while(low<high){const mid=(low+high)>>>1;if(Date.parse(second[mid].departure)<earliest)low=mid+1;else high=mid;}
     for(let i=low;i<second.length;i++){
      const y=second[i],interval=Date.parse(y.departure)-Date.parse(x.arrival);
      if(interval>maxWaitMinutes*60000)break;
      if(++pairs>maxPairs||journeys.length>=maxJourneys){searchTruncated=true;break directions;}
      journeys.push({tripId:JSON.stringify([[x.networkId,x.tripId],[y.networkId,y.tripId]]),
       networkId:JSON.stringify([x.networkId,y.networkId]),network:x.network+' → '+y.network,
       date,serviceDate:date,serviceDates:[x.serviceDate,y.serviceDate],timeZone:x.timeZone,from:x.from,to:y.to,legs:[x,y],
       line:x.network+' '+x.line+' → '+y.network+' '+y.line,
       departure:x.departure,arrival:y.arrival,originStop:a.origins.get(x.from),destinationStop:b.destinations.get(y.to),
       accessDistanceMeters:a.origins.get(x.from).distanceMeters,egressDistanceMeters:b.destinations.get(y.to).distanceMeters,
       transferStopId:JSON.stringify([stopId,peer.stopId]),transferStop:stop,transferDestinationStop:peer,
       transferDistanceMeters:peer.distanceMeters,transferMinutes:interval/60000,walkingDurationSeconds:null,
       interNetwork:true,transferKind:'nearby-stops',timetableOnly:true,transferVerified:false,
       accessVerified:false,exactOrigin:false,exactDestination:false,serviceConfirmed:false,faresVerified:false,priceEUR:null});
     }
    }
   }
  }
 }
 return {journeys:journeys.sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure)),searchTruncated};
}
const api={crossNetworkTrips,connectionServiceDates};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSFederation=api;
})(typeof window!=='undefined'?window:globalThis);
