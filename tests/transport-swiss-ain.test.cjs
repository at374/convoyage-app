const assert=require('node:assert/strict');
const {buildIndex}=require('../transport-gtfs-index.js');
const {crossBorderRoutes,inside}=require('../transport-swiss-ain.js');
const index=buildIndex({
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nG,Geneve,46.205,6.145\nA,Ferney,46.256,6.110\nO,Other,47.5,8.5\n',
 'routes.txt':'route_id,route_short_name\nR1,Border\nR2,Remote\n',
 'trips.txt':'route_id,service_id,trip_id\nR1,WK,T1\nR2,WK,T2\n',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,G,1\nT1,08:20:00,08:20:00,A,2\nT2,09:00:00,09:00:00,O,1\n'
});
const result=crossBorderRoutes(index);
assert.equal(result.routes.length,1);
assert.equal(result.routes[0].line,'Border');
assert.equal(result.timetableOnly,true);
assert.equal(result.serviceConfirmed,false);
assert.equal(inside({stop_lat:'',stop_lon:'6.1'},[46,6,47,7]),false);
assert.equal(crossBorderRoutes(index,{maxTrips:1}).truncated,true);
assert.throws(()=>crossBorderRoutes(index,{maxTrips:0}),/limit/);
