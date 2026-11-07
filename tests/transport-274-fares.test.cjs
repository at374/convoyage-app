const {test}=require('node:test'),assert=require('node:assert/strict');
const fares=require('../transport-274-fares.js');
const fromStop={id:'FR:74256:ZE:58792:HAUTExSAVOIE',lat:45.9618912,lon:6.6302667};
const toStop={id:'FR:6623:ZE:57862:HAUTExSAVOIE',lat:46.230964,lon:6.1096781};
const request={networkId:'oura-haute-savoie',line:'274',fromStop,toStop,travelDate:'2026-11-09',product:'parcours',profile:'adult'};
test('Sallanches–Genève: adult reference and zone 10 option are distinct',()=>{
 const fare=fares.stopReference(request);
 assert.equal(fare.amount,11.4);assert.equal(fare.stopMappingVerified,true);assert.equal(fare.fareVerified,false);assert.equal(fare.serviceConfirmed,false);
 assert.equal(fares.stopReference({...request,product:'parcours_zone10'}).amount,14.6);
 assert.equal(fares.stopReference({...request,fromStop:toStop,toStop:fromStop}).amount,11.4);
 assert.equal(fares.stopReference({...request,travelDate:'2026-12-12'}).amount,11.4);
});
test('unmatched endpoints, date, network, product or profile never inherit the tariff',()=>{
 for(const change of [{line:'272'},{networkId:'other'},{fromStop:{...fromStop,lat:46}},{toStop:{...toStop,id:'unknown'}},{travelDate:'2026-12-13'},{travelDate:'2026-11-06'},{travelDate:'2026-11-31'},{profile:'young'},{product:'__proto__'}])assert.equal(fares.stopReference({...request,...change}),null);
});
test('card reference is not a verified price or a confirmed trip',()=>{
 global.CP274Fares=fares;
 try{
  const row={networkId:request.networkId,line:'274',departure:'2026-11-09T11:00:00+01:00',originStop:{stopId:fromStop.id,lat:fromStop.lat,lon:fromStop.lon},destinationStop:{stopId:toStop.id,lat:toStop.lat,lon:toStop.lon}};
  const ref=require('../transport-direct-fare-reference.js').reference(row);
  assert.equal(ref.amount,11.4);assert.equal(ref.fareVerified,false);assert.equal(ref.serviceConfirmed,false);
  const [journey]=require('../transport-adapters.js').adaptGTFS([{...row,arrival:'2026-11-09T13:00:00+01:00',legs:[{line:'274'}]}],'Réseau local');
  journey.directFareReference=ref;
  const [choice]=require('../transport-ranking.js').rank([journey],{includeAlternatives:true});
  assert.equal(choice.journey.priceEUR,null);assert.equal(choice.journey.feasible,false);
  assert.equal(require('../transport-direct-fare-reference.js').reference({...row,legs:[{},{}]}),null);
 }finally{delete global.CP274Fares;}
});
