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
test('official tariff sectors 1–4 only match pinned stops and distinguish zone 10',()=>{
 const cases=[
  [{id:'FR:74128:ZE:75337:HAUTExSAVOIE',lat:46.1634053,lon:6.3531174},'1',4.6,4.9],
  [{id:'FR:74241:ZE:57655:HAUTExSAVOIE',lat:46.138307,lon:6.4579872},'2',6,6.4],
  [{id:'FR:74304:ZE:57657:HAUTExSAVOIE',lat:46.1428742,lon:6.4185632},'2',6,6.4],
  [{id:'FR:74311:ZE:58474:HAUTExSAVOIE',lat:46.1423931,lon:6.4033413},'2',6,6.4],
  [{id:'FR:74042:ZE:58718:HAUTExSAVOIE',lat:46.0708039,lon:6.4249336},'3',6.4,8.1],
  [{id:'FR:74276:ZE:57620:HAUTExSAVOIE',lat:46.1075737,lon:6.5920651},'4',7.5,8.2],
  [{id:'FR:74183:ZE:57651:HAUTExSAVOIE',lat:46.1336799,lon:6.523335},'4',7.5,8.2]
 ];
 for(const [stop,zone,amount,plus] of cases){
  const fare=fares.stopReference({...request,fromStop:stop});assert.equal(fare.zone,zone);assert.equal(fare.amount,amount);
  assert.equal(fares.stopReference({...request,fromStop:stop,product:'parcours_zone10'}).amount,plus);
  assert.equal(fares.stopReference({...request,fromStop:stop,travelDate:'2026-12-13'}),null);
 }
 // Nangy is multizone, so it must not inherit a Parcours sector fare.
 assert.equal(fares.stopReference({...request,fromStop:{id:'FR:74197:ZE:58716:HAUTExSAVOIE',lat:46.1423557,lon:6.3179182}}),null);
 assert.equal(fares.reference({line:'274',fromSector:'__proto__',toSector:'Genève',travelDate:'2026-11-09',product:'parcours',profile:'adult'}),null);
});
