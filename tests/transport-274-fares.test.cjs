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
test('Findrol uses the multizone ticket rather than a Parcours ticket',()=>{
 const findrol={id:'FR:74197:ZE:58716:HAUTExSAVOIE',lat:46.1423557,lon:6.3179182};
 const input={...request,fromStop:findrol};
 assert.equal(fares.stopReference(input),null);
 assert.equal(fares.stopReference({...input,product:'parcours_zone10'}),null);
 const ref=fares.stopReference({...input,product:'multizones_10_210'});
 assert.equal(ref.amount,4.9);assert.equal(ref.zone,'10+210');assert.equal(ref.fareVerified,false);assert.equal(ref.serviceConfirmed,false);
 assert.equal(fares.stopReference({...input,product:'multizones_10_210',travelDate:'2026-12-13'}),null);
 assert.equal(fares.stopReference({...request,product:'multizones_10_210'}),null);
 global.CP274Fares=fares;
 try{
  const stop=s=>({stopId:s.id,lat:s.lat,lon:s.lon});
  const row={networkId:'oura-haute-savoie',line:'274',departure:'2026-11-09T11:00:00+01:00',originStop:stop(findrol),destinationStop:stop(toStop)};
  const card=require('../transport-direct-fare-reference.js').reference(row);
  assert.equal(card.amount,4.9);assert.equal(card.product,'multizones_10_210');assert.equal(card.fareVerified,false);
  assert.equal(require('../transport-direct-fare-reference.js').reference({...row,line:'272'}),null);
  assert.equal(require('../transport-direct-fare-reference.js').reference({...row,legs:[{},{}]}),null);
 }finally{delete global.CP274Fares;}
});
test('France-only matrix applies only the official identified pairs and correct fare zones',()=>{
 const franceStops=[
  {id:'FR:74197:ZE:58716:HAUTExSAVOIE',lat:46.1423557,lon:6.3179182},
  {id:'FR:74042:ZE:58718:HAUTExSAVOIE',lat:46.0708039,lon:6.4249336},
  {id:'FR:74256:ZE:58792:HAUTExSAVOIE',lat:45.9618912,lon:6.6302667}
 ];
 for(const [a,b,amount,zone] of [[0,1,3.8,'2'],[1,2,11.3,'5'],[0,2,8.6,'4']]){
  const input={...request,fromStop:franceStops[a],toStop:franceStops[b],product:'france'};
  const fare=fares.stopReference(input);assert.equal(fare.amount,amount);assert.equal(fare.zone,zone);assert.equal(fare.source,fares.FRANCE_SOURCE);
  assert.equal(fare.fareVerified,false);assert.equal(fare.serviceConfirmed,false);
  assert.equal(fares.stopReference({...input,fromStop:input.toStop,toStop:input.fromStop}).amount,amount);
  assert.equal(fares.stopReference({...input,travelDate:'2026-12-13'}),null);
 }
 assert.equal(fares.stopReference({...request,product:'france'}),null);
 global.CP274Fares=fares;
 try{
  const stop=s=>({stopId:s.id,lat:s.lat,lon:s.lon});
  const row={networkId:'oura-haute-savoie',line:'274',departure:'2026-11-09T11:00:00+01:00',originStop:stop(franceStops[0]),destinationStop:stop(franceStops[1])};
  const card=require('../transport-direct-fare-reference.js').reference(row);
  assert.equal(card.amount,3.8);assert.equal(card.product,'france');assert.equal(card.fareVerified,false);
 }finally{delete global.CP274Fares;}
});
