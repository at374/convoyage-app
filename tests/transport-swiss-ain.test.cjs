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

const single=buildIndex({
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nS,Shared envelope,46.205,6.145\n',
 'routes.txt':'route_id,route_short_name\nR,One stop\n',
 'trips.txt':'route_id,service_id,trip_id\nR,WK,T\n',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,08:00:00,08:00:00,S,1\n'
});
assert.equal(crossBorderRoutes(single).routes.length,0);

const {verifiedBorderRoutes}=require('../transport-swiss-ain.js');
const verified=verifiedBorderRoutes(index,new Map([['G','CH'],['A','FR'],['O','CH']]));
assert.equal(verified.routes.length,1);
assert.equal(verified.routes[0].line,'Border');
assert.equal(verified.countryEvidence,'verified-stop-map');
assert.equal(verified.serviceConfirmed,false);
assert.equal(verifiedBorderRoutes(index,new Map([['G','CH'],['A','CH']])).routes.length,0);
assert.equal(verifiedBorderRoutes(index,new Map()).routes.length,0);
assert.throws(()=>verifiedBorderRoutes(index,{}),/map required/);
assert.equal(verifiedBorderRoutes(index,new Map([['G','CH'],['A','FR']]),{maxTrips:1}).truncated,true);

const {borderSegments}=require('../transport-swiss-ain.js');
const border=borderSegments(index,new Map([['G','CH'],['A','FR']]));
assert.equal(border.segments.length,1);
assert.equal(border.segments[0].fromStopId,'G');
assert.equal(border.segments[0].toStopId,'A');
assert.equal(border.segments[0].serviceConfirmed,false);
assert.equal(borderSegments(index,new Map([['G','CH'],['A','CH']])).segments.length,0);
assert.equal(borderSegments(index,new Map()).segments.length,0);
assert.throws(()=>borderSegments(index,new Map(),{maxSegments:0}),/limit/);

assert.equal(border.segments[0].serviceDateVerified,false);
const unordered=buildIndex({
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nG,Geneve,46.205,6.145\nA,Ain,46.256,6.110\n',
 'routes.txt':'route_id,route_short_name\nR,Border\n',
 'trips.txt':'route_id,service_id,trip_id\nR,WK,T\n',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,08:00:00,08:00:00,G,1\nT,08:20:00,08:20:00,A,1\n'
});
assert.equal(borderSegments(unordered,new Map([['G','CH'],['A','FR']])).segments.length,0);

const {datedBorderSegments}=require('../transport-swiss-ain.js');
const calendar={
 'calendar.txt':'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20261001,20261031\n',
 'calendar_dates.txt':'service_id,date,exception_type\nWK,20261030,2\n'
};
const activeBorder=datedBorderSegments(calendar,index,new Map([['G','CH'],['A','FR']]),'2026-10-29');
assert.equal(activeBorder.segments.length,1);
assert.equal(activeBorder.segments[0].serviceDateVerified,true);
assert.equal(activeBorder.serviceConfirmed,false);
assert.equal(datedBorderSegments(calendar,index,new Map([['G','CH'],['A','FR']]),'2026-10-30').segments.length,0);
assert.throws(()=>datedBorderSegments(calendar,index,new Map(),'2026-02-30'),/Invalid service date/);

const {missionBorderSegments}=require('../transport-swiss-ain.js');
const mission=missionBorderSegments(calendar,index,new Map([['G','CH'],['A','FR']]),'2026-10-29',
 {earliestDeparture:'07:55:00',latestArrival:'08:30:00'});
assert.equal(mission.segments.length,1);
assert.equal(mission.missionWindowChecked,true);
assert.equal(mission.serviceConfirmed,false);
assert.equal(missionBorderSegments(calendar,index,new Map([['G','CH'],['A','FR']]),'2026-10-29',
 {earliestDeparture:'08:05:00',latestArrival:'08:30:00'}).segments.length,0);
assert.throws(()=>missionBorderSegments(calendar,index,new Map(),'2026-10-29',
 {earliestDeparture:'09:00:00',latestArrival:'08:00:00'}),/time window/);

const restricted=buildIndex({
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nG,Geneve,46.205,6.145\nA,Ain,46.256,6.110\n',
 'routes.txt':'route_id,route_short_name\nR,Border\n',
 'trips.txt':'route_id,service_id,trip_id\nR,WK,T\n',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\nT,08:00:00,08:00:00,G,1,1,0\nT,08:20:00,08:20:00,A,2,0,1\n'
});
assert.equal(borderSegments(restricted,new Map([['G','CH'],['A','FR']])).segments.length,0);

const {missionPickupCandidates}=require('../transport-swiss-ain.js');
const pickup=missionPickupCandidates(calendar,index,new Map([['G','CH'],['A','FR']]),'2026-10-29',
 {earliestDeparture:'07:50:00',pickupTime:'08:40:00'});
assert.equal(pickup.segments.length,1);
assert.equal(pickup.pickupBufferMinutes,15);
assert.equal(pickup.accessVerified,false);
assert.equal(missionPickupCandidates(calendar,index,new Map([['G','CH'],['A','FR']]),'2026-10-29',
 {earliestDeparture:'07:50:00',pickupTime:'08:30:00'}).segments.length,0);
assert.throws(()=>missionPickupCandidates(calendar,index,new Map(),'2026-10-29',
 {earliestDeparture:'07:50:00',pickupTime:'08:40:00',bufferMinutes:10}),/pickup buffer/);

const {verifiedCountryMap}=require('../transport-swiss-ain.js');
const countryMap=verifiedCountryMap([{stopId:'G',country:'CH',verified:true},{stopId:'A',country:'FR',verified:true}]);
assert.equal(borderSegments(index,countryMap).segments.length,1);
assert.throws(()=>verifiedCountryMap([{stopId:'G',country:'CH',verified:false}]),/Unverified/);
assert.throws(()=>verifiedCountryMap([{stopId:'G',country:'CH',verified:true},{stopId:'G',country:'FR',verified:true}]),/Conflicting/);
assert.throws(()=>verifiedCountryMap([{stopId:'G',country:'DE',verified:true}]),/Unverified/);

const invalidChronology=buildIndex({
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nG,Geneva,46.2,6.14\nA,Ain,46.25,6.1\n',
 'routes.txt':'route_id,route_short_name\nR,Border\n',
 'trips.txt':'route_id,service_id,trip_id\nR,WK,T\n',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,09:00:00,09:00:00,G,1\nT,08:30:00,08:30:00,A,2\n'
});
assert.equal(borderSegments(invalidChronology,new Map([['G','CH'],['A','FR']])).segments.length,0);

const walkingCandidate=missionPickupCandidates(calendar,index,new Map([['G','CH'],['A','FR']]),'2026-10-29',
 {earliestDeparture:'07:50:00',pickupTime:'08:40:00',accessMinutes:6});
assert.equal(walkingCandidate.segments.length,0);
assert.equal(walkingCandidate.accessDurationProvided,true);
assert.equal(walkingCandidate.accessVerified,false);
assert.equal(walkingCandidate.accessMinutes,6);
assert.throws(()=>missionPickupCandidates(calendar,index,new Map(),'2026-10-29',
 {earliestDeparture:'07:50:00',pickupTime:'08:40:00',accessMinutes:-2}),/access duration/);

assert.equal(pickup.transportConfirmed,false);
assert.deepEqual(pickup.confirmationBlockers,['walking-access-unknown','realtime-service-unverified']);
assert.equal(walkingCandidate.transportConfirmed,false);
assert.deepEqual(walkingCandidate.confirmationBlockers,['no-scheduled-border-candidate','walking-route-unverified','realtime-service-unverified']);
