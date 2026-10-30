const assert=require('node:assert/strict');
const {parseCSV,activeServices,buildIndex,scheduledTrips,directTrips,transferTrips,nearbyStops}=require('../transport-gtfs-index.js');
assert.deepEqual(parseCSV('id,name\n1,"Annecy, Gare"\n2,"Stop ""A"""\n'),[
 {id:'1',name:'Annecy, Gare'},{id:'2',name:'Stop "A"'}]);
assert.deepEqual(parseCSV(''),[]);
assert.throws(()=>parseCSV('a\n"unfinished'),/Unclosed/);
const index=buildIndex({
 'stops.txt':'stop_id,stop_name\nS1,Annecy\nS2,Albertville\n',
 'routes.txt':'route_id,route_short_name\nR1,Y51\n',
 'trips.txt':'route_id,service_id,trip_id\nR1,WK,T1\n',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,11:48:00,11:48:00,S2,2\nT1,10:30:00,10:30:00,S1,1\n'
});
assert.equal(index.counts.stops,2);
assert.equal(index.counts.routes,1);
assert.equal(index.counts.trips,1);
assert.equal(index.timesByTrip.get('T1')[0].stop_id,'S1');
assert.equal(index.timesByTrip.get('T1')[1].stop_id,'S2');
assert.equal(index.serviceConfirmed,false);
const calendar={
 'calendar.txt':'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20261001,20261031\n',
 'calendar_dates.txt':'service_id,date,exception_type\nWK,20261030,2\nSPECIAL,20261031,1\n'
};
assert.equal(activeServices(calendar,'2026-10-29').has('WK'),true);
assert.equal(activeServices(calendar,'2026-10-30').has('WK'),false);
assert.equal(activeServices(calendar,'2026-10-31').has('SPECIAL'),true);
assert.equal(activeServices(calendar,'2026-11-02').has('WK'),false);
assert.throws(()=>activeServices(calendar,'2026-02-30'),/Invalid service date/);
const dated=scheduledTrips(calendar,index,'2026-10-29');
assert.equal(dated.length,1);
assert.equal(dated[0].line,'Y51');
assert.equal(dated[0].stops[1].arrival,'11:48:00');
assert.equal(dated[0].serviceConfirmed,false);
assert.equal(scheduledTrips(calendar,index,'2026-10-30').length,0);
const direct=directTrips(calendar,index,'2026-10-29','S1','S2');
assert.equal(direct.length,1);
assert.equal(direct[0].departure,'10:30:00');
assert.equal(direct[0].arrival,'11:48:00');
assert.equal(direct[0].serviceConfirmed,false);
assert.equal(direct[0].priceEUR,null);
assert.equal(directTrips(calendar,index,'2026-10-29','S2','S1').length,0);
assert.equal(directTrips(calendar,index,'2026-10-30','S1','S2').length,0);
const connectionFiles={
 'stops.txt':'stop_id,stop_name\nA,Annecy\nB,Chambery\nC,Grenoble\n',
 'routes.txt':'route_id,route_short_name\nR1,L1\nR2,L2\n',
 'trips.txt':'route_id,service_id,trip_id\nR1,WK,T1\nR2,WK,T2\n',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,09:00:00,09:00:00,A,1\nT1,10:00:00,10:00:00,B,2\nT2,10:08:00,10:08:00,B,1\nT2,11:00:00,11:00:00,C,2\n'
};
const transfers=transferTrips(calendar,buildIndex(connectionFiles),'2026-10-29','A','C',5);
assert.equal(transfers.length,1);
assert.equal(transfers[0].transferStopId,'B');
assert.equal(transfers[0].legs.length,2);
assert.equal(transfers[0].serviceConfirmed,false);
assert.equal(transferTrips(calendar,buildIndex(connectionFiles),'2026-10-29','A','C',10).length,0);
assert.equal(transferTrips(calendar,buildIndex(connectionFiles),'2026-10-30','A','C',5).length,0);
const geo=buildIndex({
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nA,Annecy Gare,45.901,6.122\nB,Loin,46.500,6.900\n',
 'routes.txt':'route_id,route_short_name\n',
 'trips.txt':'trip_id,route_id\n',
 'stop_times.txt':'trip_id,stop_id,stop_sequence\n'
});
const close=nearbyStops(geo,45.901,6.122,500);
assert.equal(close.length,1);
assert.equal(close[0].stopId,'A');
assert.equal(close[0].distanceMeters,0);
assert.equal(close[0].accessVerified,false);
assert.equal(nearbyStops(geo,999,6.122).length,0);
console.log('GTFS index: 37 assertions passed');
