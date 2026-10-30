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
