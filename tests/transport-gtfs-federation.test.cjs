const {test}=require('node:test');
const assert=require('node:assert/strict');
const g=require('../transport-gtfs-index.js');
const {crossNetworkTrips}=require('../transport-gtfs-federation.js');
function feed(network,side,{date='20261102',pickup='0',offset=0}={}){
 const files={
  'agency.txt':'agency_id,agency_name,agency_timezone\nAgency,Fixture,Europe/Paris',
  'stops.txt':side==='first'?'stop_id,stop_name,stop_lat,stop_lon\nA,Origin,45.9,6.1\nX,Exit,45.8,6.2':
   'stop_id,stop_name,stop_lat,stop_lon\nX,Board,45.8005,'+(6.2+offset)+'\nB,Destination,45.7,6.3',
  'routes.txt':'route_id,agency_id,route_short_name\nR,Agency,'+network,
  'trips.txt':'trip_id,route_id,service_id\nT,R,S',
  'stop_times.txt':side==='first'?
   'trip_id,stop_id,stop_sequence,arrival_time,departure_time,pickup_type\nT,A,1,09:00:00,09:00:00,'+pickup+'\nT,X,2,10:00:00,10:00:00,0':
   'trip_id,stop_id,stop_sequence,arrival_time,departure_time,pickup_type\nT,X,1,10:10:00,10:10:00,'+pickup+'\nT,B,2,11:00:00,11:00:00,0',
  'calendar_dates.txt':'service_id,date,exception_type\nS,'+date+',1'
 };
 return {files,index:g.buildIndex(files),source:{datasetId:network,network}};
}
const origin={lat:45.9,lon:6.1},destination={lat:45.7,lon:6.3};
const window={earliestDeparture:'2026-11-02T09:00:00+01:00',latestArrival:'2026-11-02T11:30:00+01:00'};
const search=(feeds,options={})=>crossNetworkTrips(feeds,'2026-11-02',origin,destination,window,options);
test('namespaces identical trip/stop IDs, joins nearby stops and never invents walking time',()=>{
 const result=search([feed('Sibra','first'),feed('Cars','second')]);
 assert.equal(result.journeys.length,1);assert.equal(result.searchTruncated,false);
 const row=result.journeys[0];assert.equal(row.interNetwork,true);assert.equal(row.transferKind,'nearby-stops');
 assert.equal(row.legs[0].tripId,row.legs[1].tripId);assert.notEqual(row.legs[0].networkId,row.legs[1].networkId);
 assert.equal(row.departure,'2026-11-02T08:00:00.000Z');assert.equal(row.arrival,'2026-11-02T10:00:00.000Z');
 assert.equal(row.transferMinutes,10);assert.ok(row.transferDistanceMeters>0&&row.transferDistanceMeters<150);
 assert.equal(row.walkingDurationSeconds,null);assert.equal(row.transferVerified,false);assert.equal(row.accessVerified,false);
 assert.equal(row.serviceConfirmed,false);assert.equal(row.priceEUR,null);
});
test('input order does not determine travel direction or collapse network namespaces',()=>{
 const a=feed('Sibra','first'),b=feed('Cars','second');
 assert.equal(search([b,a]).journeys[0].legs[0].network,'Sibra');
 assert.throws(()=>search([a,a]),/Distinct/);assert.throws(()=>search([a]),/Exactly two/);
});
test('rejects distant or conditional interchange legs and inactive service dates',()=>{
 assert.equal(search([feed('A','first'),feed('B','second',{offset:0.01})]).journeys.length,0);
 assert.equal(search([feed('A','first'),feed('B','second',{pickup:'2'})]).journeys.length,0);
 assert.equal(search([feed('A','first',{pickup:'1'}),feed('B','second')]).journeys.length,0);
 assert.equal(search([feed('A','first'),feed('B','second',{date:'20261103'})]).journeys.length,0);
});
test('checks absolute mission bounds, minimum interval, maximum wait and index scope',()=>{
 const a=feed('A','first'),b=feed('B','second');
 assert.equal(search([a,b],{minTransferMinutes:11}).journeys.length,0);
 assert.equal(search([a,b],{maxWaitMinutes:9}).journeys.length,0);
 assert.equal(crossNetworkTrips([a,b],'2026-11-02',origin,destination,{...window,latestArrival:'2026-11-02T11:29:59+01:00'}).journeys.length,0);
 a.indexServiceDates=['2026-11-03'];assert.throws(()=>search([a,b]),/scope/);
});
test('marks resource budgets as incomplete and rejects invalid budgets/radii',()=>{
 const a=feed('A','first'),b=feed('B','second');
 a.files['trips.txt']+='\nT2,R,S';
 a.files['stop_times.txt']+='\nT2,A,1,09:30:00,09:30:00,0\nT2,X,2,10:30:00,10:30:00,0';
 a.index=g.buildIndex(a.files);
 assert.equal(search([a,b],{maxLegs:1}).searchTruncated,true);
 for(const options of [{maxLegs:0},{maxPairs:0},{transferRadiusMeters:501},{radiusMeters:5001}])assert.throws(()=>search([a,b],options));
});
test('date-scoped indexing distinguishes inactive rows from broken references',()=>{
 const full=feed('A','first');full.files['trips.txt']+='\nInactive,R,OFF';
 full.files['stop_times.txt']+='\nInactive,A,1,12:00:00,12:00:00,0\nUnknown,A,1,13:00:00,13:00:00,0';
 const index=g.buildIndex(full.files,{serviceIds:new Set(['S'])});
 assert.equal(index.tripById.size,1);assert.equal(index.counts.stopTimes,4);assert.equal(index.skippedStopTimes,1);
 assert.equal([...index.timesByTrip.values()].flat().length,2);
 assert.equal(g.buildIndex(full.files,{serviceIds:new Set()}).tripById.size,0);
});

function nightFeed(network,side,date,departure,arrival){
 const result=feed(network,side,{date:date.replaceAll('-','')});
 result.files['stop_times.txt']=result.files['stop_times.txt']
  .replaceAll(side==='first'?'09:00:00':'10:10:00',departure)
  .replaceAll(side==='first'?'10:00:00':'11:00:00',arrival);
 result.index=g.buildIndex(result.files);return result;
}
test('joins separately active service dates after midnight without reassigning a trip calendar',()=>{
 const a=nightFeed('A','first','2026-11-02','23:40:00','24:00:00');
 const b=nightFeed('B','second','2026-11-03','00:10:00','00:40:00');
 const w={earliestDeparture:'2026-11-02T23:00:00+01:00',latestArrival:'2026-11-03T01:10:00+01:00'};
 assert.equal(crossNetworkTrips([a,b],'2026-11-02',origin,destination,w).journeys.length,0);
 const options={connectionDates:['2026-11-02','2026-11-03','2026-11-03']};
 const result=crossNetworkTrips([a,b],'2026-11-02',origin,destination,w,options);
 assert.equal(result.journeys.length,1);assert.equal(result.searchTruncated,false);
 const row=result.journeys[0];assert.deepEqual(row.serviceDates,['2026-11-02','2026-11-03']);
 assert.equal(row.legs[0].serviceDate,'2026-11-02');assert.equal(row.legs[1].serviceDate,'2026-11-03');
 assert.equal(row.departure,'2026-11-02T22:40:00.000Z');assert.equal(row.arrival,'2026-11-02T23:40:00.000Z');
 assert.equal(row.transferMinutes,10);assert.equal(row.serviceConfirmed,false);assert.equal(row.walkingDurationSeconds,null);
 const missing=nightFeed('B','second','2026-11-04','00:10:00','00:40:00');
 assert.equal(crossNetworkTrips([a,missing],'2026-11-02',origin,destination,w,options).journeys.length,0);
 assert.equal(crossNetworkTrips([a,b],'2026-11-02',origin,destination,{...w,latestArrival:'2026-11-03T01:09:59+01:00'},options).journeys.length,0);
 assert.equal(crossNetworkTrips([a,b],'2026-11-02',origin,destination,w,{...options,minTransferMinutes:11}).journeys.length,0);
});
test('a second leg may belong to the previous service day when its GTFS clock exceeds 24 hours',()=>{
 const a=nightFeed('A','first','2026-11-03','00:00:00','00:10:00');
 const b=nightFeed('B','second','2026-11-02','24:20:00','25:00:00');
 const result=crossNetworkTrips([a,b],'2026-11-03',origin,destination,
  {earliestDeparture:'2026-11-02T23:00:00Z',latestArrival:'2026-11-03T00:30:00Z'},
  {connectionDates:['2026-11-02','2026-11-03']});
 assert.equal(result.journeys.length,1);assert.equal(result.journeys[0].transferMinutes,10);
 assert.deepEqual(result.journeys[0].serviceDates,['2026-11-03','2026-11-02']);
});
test('different service days use absolute GTFS timestamps across both clock changes',()=>{
 for(const [firstDate,secondDate,departure,expectedArrival] of [
  ['2026-10-24','2026-10-25','00:10:00','2026-10-24T23:40:00.000Z'],
  ['2026-03-28','2026-03-29','02:10:00','2026-03-29T00:40:00.000Z']]){
  const a=nightFeed('A','first',firstDate,'24:00:00','24:50:00');
  const b=nightFeed('B','second',secondDate,departure,departure.replace(':10:',':40:'));
  const result=crossNetworkTrips([a,b],firstDate,origin,destination,
   {earliestDeparture:firstDate+'T00:00:00Z'}, {connectionDates:[firstDate,secondDate]});
  assert.equal(result.journeys.length,1);assert.equal(result.journeys[0].transferMinutes,20);
  assert.equal(result.journeys[0].arrival,expectedArrival);
 }
});
test('multi-date federation validates explicit dates and shares the leg budget across them',()=>{
 const a=nightFeed('A','first','2026-11-02','23:40:00','24:00:00');
 const b=nightFeed('B','second','2026-11-03','00:10:00','00:40:00');
 const w={earliestDeparture:'2026-11-02T22:00:00Z'},dates=['2026-11-02','2026-11-03'];
 for(const connectionDates of [null,[],['2026-11-03'],['2026-11-02','2026-02-30'],Array(6).fill('2026-11-02')]){
  assert.throws(()=>crossNetworkTrips([a,b],'2026-11-02',origin,destination,w,{connectionDates}));
 }
 assert.equal(crossNetworkTrips([a,b],'2026-11-02',origin,destination,w,{connectionDates:dates,maxLegs:1}).searchTruncated,true);
 a.indexServiceDates=['2026-11-02'];
 assert.throws(()=>crossNetworkTrips([a,b],'2026-11-02',origin,destination,w,{connectionDates:dates}),/scope/);
});

test('out-of-window legs do not exhaust the inter-network branch budget',()=>{
 const a=feed('A','first'),b=feed('B','second');
 a.files['trips.txt']=a.files['trips.txt'].replace('T,R,S','Early,R,S\nT,R,S');
 a.files['stop_times.txt']+='\nEarly,A,1,07:00:00,07:00:00,0\nEarly,X,2,08:00:00,08:00:00,0';a.index=g.buildIndex(a.files);
 const result=search([a,b],{maxLegs:1});
 assert.equal(result.journeys.length,1);assert.equal(result.searchTruncated,false);
 assert.equal(result.journeys[0].legs[0].tripId,'T');
});

test('cross-network transfer requires enough time even for straight-line walk',()=>{
 const a=feed('A','first'),b=feed('B','second',{offset:0.001});
 // Stops are roughly 100 m apart; 1 minute is insufficient even for the estimate.
 b.files['stop_times.txt']=b.files['stop_times.txt'].replaceAll('10:10:00','10:01:00');
 b.index=g.buildIndex(b.files);
 assert.equal(search([a,b],{minTransferMinutes:1}).journeys.length,0);
 b.files['stop_times.txt']=b.files['stop_times.txt'].replaceAll('10:01:00','10:10:00');
 b.index=g.buildIndex(b.files);
 const result=search([a,b],{minTransferMinutes:1});
 assert.equal(result.journeys.length,1);
 assert.equal(result.journeys[0].transferVerified,false);
});
