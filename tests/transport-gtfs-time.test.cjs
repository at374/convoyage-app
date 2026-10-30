const {test}=require('node:test');
const assert=require('node:assert/strict');
const {serviceTimestamp,datedTrips}=require('../transport-gtfs-time.js');
const gtfs=require('../transport-gtfs-index.js');
const iso=(date,clock,zone)=>new Date(serviceTimestamp(date,clock,zone)).toISOString();
test('service clocks use agency timezone independent of host, including fractional offsets',()=>{
 assert.equal(iso('2026-07-01','11:48:00','Europe/Paris'),'2026-07-01T09:48:00.000Z');
 assert.equal(iso('2026-11-02','11:48:00','Europe/Paris'),'2026-11-02T10:48:00.000Z');
 assert.equal(iso('2026-11-02','11:48:00','UTC'),'2026-11-02T11:48:00.000Z');
 assert.equal(iso('2026-11-02','11:48:00','Asia/Kathmandu'),'2026-11-02T06:03:00.000Z');
});
test('DST dates use elapsed time from local noon minus twelve hours, not naive civil midnight',()=>{
 assert.equal(iso('2026-03-29','00:00:00','Europe/Paris'),'2026-03-28T22:00:00.000Z');
 assert.equal(iso('2026-03-29','03:30:00','Europe/Paris'),'2026-03-29T01:30:00.000Z');
 assert.equal(iso('2026-03-29','12:00:00','Europe/Paris'),'2026-03-29T10:00:00.000Z');
 assert.equal(iso('2026-10-25','02:30:00','Europe/Paris'),'2026-10-25T01:30:00.000Z');
 assert.equal(iso('2026-10-25','12:00:00','Europe/Paris'),'2026-10-25T11:00:00.000Z');
});
test('service hours beyond 24 retain the original service date across days and year boundary',()=>{
 assert.equal(iso('2026-11-01','25:00:00','Europe/Paris'),'2026-11-02T00:00:00.000Z');
 assert.equal(iso('2026-12-31','49:00:00','Europe/Paris'),'2027-01-02T00:00:00.000Z');
 assert.equal(iso('2026-03-29','24:10:00','Europe/Paris'),'2026-03-29T22:10:00.000Z');
});
test('reject invalid dates, clocks, zones, and missing civil days',()=>{
 for(const date of ['2026-02-30','2026-1-01','bad'])assert.throws(()=>serviceTimestamp(date,'12:00:00','Europe/Paris'));
 for(const clock of ['11:60:00','24:00','-1:00:00','1000:00:00',null])assert.throws(()=>serviceTimestamp('2026-11-02',clock,'Europe/Paris'));
 for(const zone of ['',null,'not/a-zone'])assert.throws(()=>serviceTimestamp('2026-11-02','12:00:00',zone));
 assert.throws(()=>serviceTimestamp('2011-12-30','12:00:00','Pacific/Apia'),/missing GTFS service noon/);
});
function fixture(){
 const files={
  'agency.txt':'agency_id,agency_timezone\nAgency,Europe/Paris',
  'routes.txt':'route_id,agency_id\nR,Agency',
  'trips.txt':'trip_id,route_id\nT,R'
 };
 const index=gtfs.buildIndex(files);
 const rows=[{tripId:'T',date:'2026-11-02',departure:'10:00:00',arrival:'11:00:00',
  from:'A',to:'B',originStop:{stopId:'A'},destinationStop:{stopId:'B'},priceEUR:999,
  serviceConfirmed:true,accessVerified:true,exactOrigin:true,exactDestination:true}];
 return {files,index,rows};
}
test('Aller filters on arrival minus margin inclusively, without confirming door-to-door travel',()=>{
 const {files,index,rows}=fixture();
 const result=datedTrips(files,index,rows,{latestArrival:'2026-11-02T11:30:00+01:00'});
 assert.equal(result.length,1);assert.equal(result[0].arrival,'2026-11-02T10:00:00.000Z');
 assert.equal(result[0].serviceDate,'2026-11-02');assert.equal(result[0].departureTime,'10:00:00');
 assert.equal(result[0].timetableOnly,true);assert.equal(result[0].marginMinutes,30);
 for(const key of ['serviceConfirmed','accessVerified','exactOrigin','exactDestination','faresVerified'])assert.equal(result[0][key],false);
 assert.equal(result[0].priceEUR,null);
 assert.equal(rows[0].priceEUR,999);
 assert.equal(datedTrips(files,index,rows,{latestArrival:'2026-11-02T11:29:59+01:00'}).length,0);
 assert.equal(datedTrips(files,index,rows,{latestArrival:'2026-11-02T11:15:00+01:00',marginMinutes:15}).length,1);
});
test('Retour and Jonction require departure after delivery, with explicit timezone or epoch',()=>{
 const {files,index,rows}=fixture();
 assert.equal(datedTrips(files,index,rows,{earliestDeparture:'2026-11-02T10:00:00+01:00'}).length,1);
 assert.equal(datedTrips(files,index,rows,{earliestDeparture:'2026-11-02T10:00:01+01:00'}).length,0);
 assert.equal(datedTrips(files,index,rows,{earliestDeparture:Date.parse('2026-11-02T09:00:00Z'),latestArrival:'2026-11-02T10:30:00Z'}).length,1);
 assert.equal(datedTrips(files,index,rows,{earliestDeparture:'2026-11-02T12:00:00Z',latestArrival:'2026-11-02T10:30:00Z'}).length,0);
});
test('mission windows reject host-local, malformed, impossible dates and invalid margins',()=>{
 const {files,index,rows}=fixture();
 assert.throws(()=>datedTrips(files,index,rows),/window/);
 for(const value of [null,'2026-11-02T10:00:00','2026-02-30T10:00:00Z','2026-11-02T24:00:00Z','2026-11-02T10:60:00Z',NaN])
  assert.throws(()=>datedTrips(files,index,rows,{latestArrival:value}));
 for(const margin of [-1,NaN,Infinity,1441])assert.throws(()=>datedTrips(files,index,rows,{latestArrival:'2026-11-02T10:00:00Z',marginMinutes:margin}),/margin/);
});
test('timezone comes from agency and route, and conflicting or missing agency metadata is rejected',()=>{
 const {files,index,rows}=fixture();
 files['stops.txt']='stop_id,stop_timezone\nA,America/New_York';
 assert.equal(datedTrips(files,index,rows,{latestArrival:'2026-11-02T12:00:00Z'})[0].timeZone,'Europe/Paris');
 for(const agency of ['', 'agency_id,agency_timezone\nOther,Europe/Paris',
  'agency_id,agency_timezone\nAgency,Europe/Paris\nOther,UTC']){
  assert.throws(()=>datedTrips({...files,'agency.txt':agency},index,rows,{latestArrival:'2026-11-02T12:00:00Z'}));
 }
});
