const assert=require('node:assert/strict');
const {parseCSV,activeServices,buildIndex}=require('../transport-gtfs-index.js');
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
console.log('GTFS index: 14 assertions passed');
