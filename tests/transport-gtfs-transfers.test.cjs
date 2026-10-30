const {test}=require('node:test');
const assert=require('node:assert/strict');
const gtfs=require('../transport-gtfs-index.js'),time=require('../transport-gtfs-time.js');
function fixture(){return {
 'agency.txt':'agency_id,agency_name,agency_timezone\nAgency,Fixture,Europe/Paris',
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon,parent_station\nA,Origin,45.9,6.1,\nX,Transfer,45.8,6.2,P\nB,Destination,45.7,6.3,\nP,Station,45.8,6.2,',
 'routes.txt':'route_id,agency_id,route_short_name,route_type\nR1,Agency,One,3\nR2,Agency,Two,3',
 'trips.txt':'trip_id,route_id,service_id\nT1,R1,S\nT2,R2,S',
 'stop_times.txt':'trip_id,stop_id,stop_sequence,arrival_time,departure_time,pickup_type,drop_off_type\nT1,A,1,09:00:00,09:00:00,0,0\nT1,X,2,10:00:00,10:00:00,0,0\nT2,X,1,10:08:00,10:08:00,0,0\nT2,B,2,11:00:00,11:00:00,0,0',
 'calendar_dates.txt':'service_id,date,exception_type\nS,20261102,1'
};}
const origin={lat:45.9,lon:6.1},destination={lat:45.7,lon:6.3};
const search=(files,options={})=>gtfs.nearbyTransferTrips(files,gtfs.buildIndex(files),'2026-11-02',origin,destination,700,options);
test('coordinate transfer search returns two distinct legs, stop, interval and unverified access',()=>{
 const {journeys,searchTruncated}=search(fixture());assert.equal(journeys.length,1);assert.equal(searchTruncated,false);
 const row=journeys[0];assert.deepEqual(row.legs.map(l=>l.tripId),['T1','T2']);
 assert.equal(row.transferStopId,'X');assert.equal(row.transferStop.name,'Transfer');
 assert.equal(row.transferMinutes,8);assert.equal(row.minTransferSeconds,300);
 assert.equal(row.from,'A');assert.equal(row.to,'B');assert.equal(row.accessDistanceMeters,0);
 assert.equal(row.transferVerified,false);assert.equal(row.accessVerified,false);assert.equal(row.priceEUR,null);
 assert.equal(gtfs.transferTrips(fixture(),gtfs.buildIndex(fixture()),'2026-11-02','A','B').length,1);
});
test('GTFS minima, prohibitions, parent station and route/trip scopes are honored conservatively',()=>{
 for(const [rule,expected] of [
  ['X,X,2,480,,,,',1],['X,X,2,481,,,,',0],['X,X,3,,,,,',0],
  ['P,P,3,,,,,',0],['X,X,3,,Other,R2,,',1],['X,X,3,,R1,R2,,',0],
  ['X,X,3,,,,Other,T2',1],['X,X,3,,,,T1,T2',0],
  ['X,X,2,,,,,',0],['X,X,4,,,,T1,T2',0],['X,X,5,,,,T1,T2',0]
 ]){
  const files=fixture();files['transfers.txt']='from_stop_id,to_stop_id,transfer_type,min_transfer_time,from_route_id,to_route_id,from_trip_id,to_trip_id\n'+rule;
  assert.equal(search(files).journeys.length,expected,rule);
 }
});
test('a conflicting generic prohibition is retained rather than inventing precedence',()=>{
 const files=fixture();files['transfers.txt']='from_stop_id,to_stop_id,transfer_type,from_trip_id,to_trip_id\nX,X,3,,\nX,X,0,T1,T2';
 assert.equal(search(files).journeys.length,0);
});
test('does not infer walks between different IDs, even at coincident coordinates',()=>{
 const files=fixture();files['stops.txt']+='\nY,Other platform,45.8,6.2,P';
 files['stop_times.txt']=files['stop_times.txt'].replace('T2,X,1','T2,Y,1');
 files['transfers.txt']='from_stop_id,to_stop_id,transfer_type,min_transfer_time\nX,Y,2,300';
 assert.equal(search(files).journeys.length,0);
});
test('boarding and alighting restrictions exclude prohibited or conditional legs, also for direct trips',()=>{
 for(const [old,replacement] of [
  ['09:00:00,09:00:00,0,0','09:00:00,09:00:00,1,0'],
  ['10:00:00,10:00:00,0,0','10:00:00,10:00:00,0,1'],
  ['10:08:00,10:08:00,0,0','10:08:00,10:08:00,2,0'],
  ['11:00:00,11:00:00,0,0','11:00:00,11:00:00,0,3']
 ]){const files=fixture();files['stop_times.txt']=files['stop_times.txt'].replace(old,replacement);assert.equal(search(files).journeys.length,0);}
 const files=fixture();files['stop_times.txt']=files['stop_times.txt'].replace('09:00:00,09:00:00,0,0','09:00:00,09:00:00,1,0');
 assert.equal(gtfs.directTrips(files,gtfs.buildIndex(files),'2026-11-02','A','X').length,0);
});
test('checks service calendars, intervals and rejects same-trip or non-increasing clocks',()=>{
 const files=fixture();assert.equal(search(files,{maxWaitMinutes:7}).journeys.length,0);
 assert.throws(()=>search(files,{minTransferMinutes:-1}),/interval/);
 assert.throws(()=>search(files,{maxWaitMinutes:3}),/interval/);
 const inactive={...files,'calendar_dates.txt':'service_id,date,exception_type\nS,20261102,2'};
 assert.equal(search(inactive).journeys.length,0);
 const invalid={...files,'stop_times.txt':files['stop_times.txt'].replace('11:00:00,11:00:00','09:00:00,09:00:00')};
 assert.equal(search(invalid).journeys.length,0);
 const single={...files,'trips.txt':'trip_id,route_id,service_id\nT1,R1,S','stop_times.txt':files['stop_times.txt'].replaceAll('T2,','T1,').replace('T1,X,1','T1,X,3').replace('T1,B,2','T1,B,4')};
 assert.equal(search(single).journeys.length,0);
});
test('budgets report incomplete searches instead of silently claiming exhaustive results',()=>{
 const files=fixture();files['trips.txt']+='\nT3,R2,S';
 files['stop_times.txt']+='\nT3,X,1,10:15:00,10:15:00,0,0\nT3,B,2,11:15:00,11:15:00,0,0';
 assert.equal(search(files).journeys.length,2);
 for(const options of [{maxLegs:1},{maxCandidates:1},{maxExaminedPairs:1}])assert.equal(search(files,options).searchTruncated,true);
 assert.throws(()=>search(files,{maxLegs:0}),/budget/);
});
test('dated transfer windows convert both legs, preserve >24h clocks and filter the final arrival',()=>{
 const files=fixture();files['stop_times.txt']=files['stop_times.txt'].replaceAll('09:00:00','23:00:00').replaceAll('10:00:00','24:00:00').replaceAll('10:08:00','24:08:00').replaceAll('11:00:00','25:00:00');
 const index=gtfs.buildIndex(files),rows=search(files).journeys;
 const window={earliestDeparture:'2026-11-02T23:00:00+01:00',latestArrival:'2026-11-03T01:30:00+01:00'};
 const converted=time.datedTransferTrips(files,index,rows,window);
 assert.equal(converted.length,1);assert.equal(converted[0].departure,'2026-11-02T22:00:00.000Z');
 assert.equal(converted[0].arrival,'2026-11-03T00:00:00.000Z');assert.equal(converted[0].serviceDate,'2026-11-02');
 assert.equal(converted[0].legs[1].departure,'2026-11-02T23:08:00.000Z');
 assert.equal(converted[0].transferVerified,false);assert.equal(converted[0].timetableOnly,true);
 assert.equal(converted[0].legs[0].serviceConfirmed,false);assert.equal(converted[0].legs[0].group,undefined);
 assert.equal(time.datedTransferTrips(files,index,rows,{...window,latestArrival:'2026-11-03T01:29:59+01:00'}).length,0);
});
test('indexed matching agrees with an exhaustive timetable reference on multiple connections',()=>{
 const files=fixture();files['trips.txt']+='\nT3,R1,S\nT4,R2,S';
 files['stop_times.txt']+='\nT3,A,1,09:15:00,09:15:00,0,0\nT3,X,2,09:50:00,09:50:00,0,0\nT4,X,1,10:03:00,10:03:00,0,0\nT4,B,2,10:25:00,10:25:00,0,0';
 const index=gtfs.buildIndex(files),trips=gtfs.scheduledTrips(files,index,'2026-11-02'),legs=[];
 const minutes=clock=>clock.split(':').reduce((sum,v,i)=>sum+Number(v)*[60,1,1/60][i],0);
 for(const trip of trips)for(const start of trip.stops)for(const end of trip.stops)
  if(end.sequence>start.sequence&&minutes(end.arrival)>=minutes(start.departure))
   legs.push({tripId:trip.tripId,from:start.stopId,to:end.stopId,departure:start.departure,arrival:end.arrival});
 const expected=[];
 for(const a of legs)for(const b of legs){
  const wait=minutes(b.departure)-minutes(a.arrival);
  if(a.from==='A'&&b.to==='B'&&a.to===b.from&&a.tripId!==b.tripId&&wait>=5&&wait<=120)
   expected.push([a.tripId,b.tripId,a.to,a.departure,b.arrival].join('|'));
 }
 const actual=search(files).journeys.map(j=>[j.legs[0].tripId,j.legs[1].tripId,j.transferStopId,j.departure,j.arrival].join('|'));
 assert.deepEqual(actual.sort(),expected.sort());assert.equal(actual.length,3);
});

test('GTFS minimum-transfer seconds are inclusive without fractional-minute rounding',()=>{
 const files=fixture();files['stop_times.txt']=files['stop_times.txt'].replaceAll('10:00:00','10:00:01').replaceAll('10:08:00','10:08:02');
 files['transfers.txt']='from_stop_id,to_stop_id,transfer_type,min_transfer_time\nX,X,2,481';
 assert.equal(search(files).journeys.length,1);assert.equal(search(files).journeys[0].minTransferSeconds,481);
 files['transfers.txt']=files['transfers.txt'].replace('481','482');assert.equal(search(files).journeys.length,0);
});
