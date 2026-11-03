const {test}=require('node:test'),assert=require('node:assert/strict');
const fares=require('../transport-y51-fares.js'),data=require('./fixtures/y51-tariff-reference-2026-10-31.json');
function pin(area,second=false){const rows=data.stops.filter(s=>s[3]===area);const s=rows[second?1:0];return {stopId:s[0],lat:s[1],lon:s[2],name:s[4]};}
function leg(from,to){const start=pin(from),end=pin(to,from===to);const item={networkId:'oura-haute-savoie',line:'Y51',tripId:'synthetic-tariff-example',from:start.stopId,to:end.stopId,departure:'2026-11-02T10:00:00+01:00',arrival:'2026-11-02T11:30:00+01:00'};item.fareScopePath={...item,stops:[start,end]};return item;}
test('official reference examples distinguish regional, Arly and SIBRA fares',()=>{
 for(const [a,b,amount,zone] of [[0,14,8.9,'4'],[0,9,4,'2'],[3,4,1.7,'1'],[8,14,4,'2'],[12,14,1.4,'A'],[0,3,2.5,'S']]){
  const quote=fares.reference(leg(a,b)).portions[0];assert.equal(quote.amountEUR,amount);assert.equal(quote.zone,zone);
  assert.equal(quote.confirmedCurrentFare,false);assert.equal(quote.source,data.source);
 }
 const local=fares.reference(leg(0,3)).portions[0];assert.equal(local.digitalAlternativeEUR,2);
 assert.match(fares.describe(fares.reference(leg(0,14))),/8,90 €.*plein tarif.*hors abonnement/);
 assert.match(fares.describe(fares.reference(leg(0,14))),/à revérifier avant achat/);
});
test('all 225 published cells match the audited fixture and both directions',()=>{
 assert.equal(data.stops.length,91);
 for(let a=0;a<15;a++)for(let b=0;b<15;b++){
  const quote=fares.reference(leg(a,b)).portions[0];
  assert.equal(quote.zone,data.matrix[a][b]);assert.equal(quote.amountEUR,data.singleFullFareEUR[data.matrix[a][b]]);
  assert.equal(data.matrix[a][b],data.matrix[b][a]);
 }
});
test('malformed, stale-year, displaced and foreign scope never becomes a fare',()=>{
 for(const mutate of [x=>x.networkId='another',x=>x.line='Y62',x=>x.fareScopePath=null,
  x=>x.fareScopePath.tripId='other-trip',x=>x.fareScopePath.stops[0].lon+=0.01,
  x=>x.fareScopePath.stops[0].stopId='unknown',x=>x.fareScopePath.stops=[],
  x=>x.departure='2026-02-30T10:00:00Z',x=>x.departure='2026-11-02T24:00:00Z',
  x=>{x.departure='2027-01-02T10:00:00Z';x.fareScopePath.departure=x.departure;},
  x=>{x.departure='2026-02-01T10:00:00Z';x.fareScopePath.departure=x.departure;}]){
  const row=leg(0,14);mutate(row);assert.equal(fares.reference(row).portions[0],null);
 }
 assert.equal(fares.describe(fares.reference(null)),'');
});
test('outside detours cannot use a cheaper endpoint cell and transfers are not totalled',()=>{
 const detour=leg(0,3);detour.fareScopePath.stops.splice(1,0,pin(14));assert.equal(fares.reference(detour).portions[0],null);
 const mixed=fares.reference({legs:[leg(0,14),{networkId:'rail',line:'TER'}]});
 assert.equal(mixed.portions[0].amountEUR,8.9);assert.equal(mixed.portions[1],null);
 assert.match(fares.describe(mixed),/prix inconnu.*Total du trajet non calculé/);
 assert.equal(mixed.confirmedCurrentFare,false);
});

const imported=require('../data/interurban/y51-gtfs-source.json');
const planner=require('../sibra-planner.js');
require('../transport-gtfs-time.js');
function recordedRide(){
 return planner.datedInterurbanRides(imported,'2026-11-02',imported.routes[0].route_id,
  'FR:73011:ZE:58901:HAUTExSAVOIE','FR:74010:ZE:57539:HAUTExSAVOIE',11*3600+10*60)[0];
}
test('imported official Y51 course reuses the tariff proof after calendar and sequence verification',()=>{
 const ride=recordedRide();assert.ok(ride);assert.equal(ride.departure_time,'11:48:00');
 const result=fares.fromImportedTables(imported,'2026-11-02',ride);
 assert.equal(result.portions[0].amountEUR,8.9);assert.equal(result.confirmedCurrentFare,false);
});
test('imported station matching uses known identity and coordinates rather than a city word in stop name',()=>{
 const gare=imported.stops.find(s=>s.stop_id==='FR:74010:ZE:57539:HAUTExSAVOIE');
 assert.doesNotMatch(gare.stop_name,/annecy/i);
 assert.equal(fares.importedStopMatches(gare,'Annecy','Gare Routiere'),true);
 assert.equal(fares.importedStopMatches({...gare,stop_id:'other'},'Annecy','Gare Routiere'),false);
 assert.equal(fares.importedStopMatches({...gare,stop_lat:'45'},'Annecy','Gare Routiere'),false);
 assert.equal(fares.importedStopMatches({...gare,stop_lat:''},'Annecy','Gare Routiere'),false);
});
test('foreign exports and altered or inactive imported rides keep fare unknown',()=>{
 const ride=recordedRide();
 for(const changed of [{...ride,trip_id:'unknown'},{...ride,departureSeconds:ride.departureSeconds+1},{...ride,toStopSequence:ride.toStopSequence+1}])
  assert.equal(fares.fromImportedTables(imported,'2026-11-02',changed).portions.length,0);
 assert.equal(fares.fromImportedTables({...imported,source:'https://other.invalid'},'2026-11-02',ride).portions.length,0);
 assert.equal(fares.fromImportedTables({...imported,checked_at_utc:'2099-01-01T00:00:00Z'},'2026-11-02',ride).portions.length,0);
 assert.equal(fares.fromImportedTables(imported,'2026-02-30',ride).portions.length,0);
 const inactive={...imported,calendar:[],calendar_dates:[]};
 assert.equal(fares.fromImportedTables(inactive,'2026-11-02',ride).portions.length,0);
 const saved=global.CPGTFSTime;global.CPGTFSTime=null;
 try{assert.equal(fares.fromImportedTables(imported,'2026-11-02',ride).portions.length,0);}finally{global.CPGTFSTime=saved;}
});


test('Y51 references reject implausible multi-day durations without inventing a fare',()=>{
 const normal=leg(0,14);
 assert.equal(fares.reference(normal).portions[0].amountEUR,8.9);
 const long=leg(0,14);
 long.arrival='2026-11-04T11:30:00+01:00';
 long.fareScopePath.arrival=long.arrival;
 assert.equal(fares.reference(long).portions[0],null);
});
