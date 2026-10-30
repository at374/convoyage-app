const {test}=require('node:test');
const assert=require('node:assert/strict');
const gtfs=require('../transport-gtfs-index.js');
function fixture(){
 return {
  'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nA,First,45.9,6.1\nB,Second,45.9001,6.1001\nC,Third,45.91,6.11\nD,Far,46,7',
  'routes.txt':'route_id,route_short_name\nR,Line',
  'trips.txt':'route_id,service_id,trip_id\nR,S,Loop\nR,S,Night\nR,S,Broken',
  'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'+
   'Loop,10:00:00,10:00:00,A,1\nLoop,10:10:00,10:10:00,B,2\n'+
   'Loop,10:20:00,10:20:00,A,3\nLoop,10:30:00,10:30:00,C,4\n'+
   'Night,24:10:00,24:10:00,B,1\nNight,25:00:00,25:00:00,C,2\n'+
   'Broken,12:00:00,12:00:00,A,1\nBroken,11:00:00,11:00:00,C,2',
  'calendar_dates.txt':'service_id,date,exception_type\nS,20261102,1'
 };
}
const origin={lat:45.9,lon:6.1},destination={lat:45.91,lon:6.11};
test('nearby search matches an independent pairwise timetable reference, including loops and >24h',()=>{
 const files=fixture(),index=gtfs.buildIndex(files),radius=2000;
 const expected=[];
 const mins=t=>t.split(':').reduce((n,v,i)=>n+Number(v)*[60,1,1/60][i],0);
 for(const a of gtfs.nearbyStops(index,origin.lat,origin.lon,radius))
  for(const b of gtfs.nearbyStops(index,destination.lat,destination.lon,radius)){
   if(a.stopId===b.stopId)continue;
   for(const trip of gtfs.scheduledTrips(files,index,'2026-11-02'))
    for(const start of trip.stops.filter(s=>s.stopId===a.stopId)){
     const end=trip.stops.find(s=>s.stopId===b.stopId&&s.sequence>start.sequence);
     if(end&&mins(end.arrival)>=mins(start.departure))
      expected.push([trip.tripId,a.stopId,b.stopId,start.departure,end.arrival].join('|'));
    }
  }
 const rows=gtfs.nearbyDirectTrips(files,index,'2026-11-02',origin,destination,radius);
 assert.deepEqual(rows.map(r=>[r.tripId,r.from,r.to,r.departure,r.arrival].join('|')).sort(),expected.sort());
 assert.equal(rows.filter(r=>r.tripId==='Loop'&&r.from==='A'&&r.to==='C').length,2);
 assert.equal(rows.some(r=>r.arrival==='25:00:00'),true);
 assert.equal(rows.some(r=>r.tripId==='Broken'),false);
 assert.equal(rows.some(r=>r.from===r.to),false);
 for(const row of rows){
  assert.equal(row.accessVerified,false);assert.equal(row.serviceConfirmed,false);
  assert.equal(row.exactOrigin,false);assert.equal(row.exactDestination,false);
  assert.equal(row.priceEUR,null);assert.ok(Number.isFinite(row.accessDistanceMeters));
 }
});
test('calendar is read once per coordinate search even with many stop pairs',()=>{
 const files=fixture(),index=gtfs.buildIndex(files);let reads=0;
 const observed=new Proxy(files,{get(target,key){if(key==='calendar_dates.txt')reads++;return target[key];}});
 gtfs.nearbyDirectTrips(observed,index,'2026-11-02',origin,destination,2000);
 assert.equal(reads,1);
});
test('missing points, empty coverage, inactive dates and invalid dates do not fabricate journeys',()=>{
 const files=fixture(),index=gtfs.buildIndex(files);
 assert.deepEqual(gtfs.nearbyDirectTrips(files,index,'2026-11-02',null,destination),[]);
 assert.deepEqual(gtfs.nearbyDirectTrips(files,index,'2026-11-02',{lat:0,lon:0},destination),[]);
 assert.deepEqual(gtfs.nearbyDirectTrips(files,index,'2026-11-03',origin,destination,2000),[]);
 assert.throws(()=>gtfs.nearbyDirectTrips(files,index,'2026-02-30',origin,destination),/Invalid service date/);
});
test('single-pair direct search rejects inverted clocks and retains repeated visits',()=>{
 const files=fixture(),index=gtfs.buildIndex(files);
 assert.deepEqual(gtfs.directTrips(files,index,'2026-11-02','A','C').map(r=>r.departure),['10:00:00','10:20:00']);
 assert.equal(gtfs.directTrips(files,index,'2026-11-02','B','C').at(-1).arrival,'25:00:00');
});

test('non-numeric or equal stop sequences never establish a forward journey',()=>{
 const files=fixture();
 files['stop_times.txt']='trip_id,arrival_time,departure_time,stop_id,stop_sequence\nLoop,10:00:00,10:00:00,A,unknown\nLoop,10:10:00,10:10:00,C,2';
 assert.deepEqual(gtfs.directTrips(files,gtfs.buildIndex(files),'2026-11-02','A','C'),[]);
 files['stop_times.txt']=files['stop_times.txt'].replace('unknown','2');
 assert.deepEqual(gtfs.directTrips(files,gtfs.buildIndex(files),'2026-11-02','A','C'),[]);
});
