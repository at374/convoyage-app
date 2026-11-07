const {test}=require('node:test'),assert=require('node:assert/strict');
const fares=require('../transport-272-fares.js');
const request={line:'272',fromSector:'Annecy',toSector:'Genève ou Saint-Julien Douane',travelDate:'2026-11-07',product:'parcours',profile:'adult'};
test('zone 5 reference distinguishes a 272 journey ticket from a Geneva zone ticket',()=>{
 const fare=fares.reference(request);
 assert.equal(fare.amount,11.30);assert.equal(fare.zone,'5');assert.equal(fare.source,fares.SOURCE);
 assert.equal(fare.fareVerified,false);assert.equal(fare.stopMappingVerified,false);assert.equal(fare.serviceConfirmed,false);
 assert.equal(fares.reference({...request,product:'parcours_zone10'}).amount,14.50);
 assert.equal(fares.reference({...request,fromSector:'Annecy Pringy'}).amount,11.30);
 assert.equal(fares.reference({...request,fromSector:request.toSector,toSector:'Annecy Pringy'}).amount,11.30);
 assert.equal(fares.reference({...request,fromSector:request.toSector,toSector:request.fromSector}).amount,11.30);
 assert.equal(fares.reference({...request,travelDate:'2026-12-12'}).amount,11.30);
});
test('only pinned Haute-Savoie stop identities and coordinates map to zone 5',()=>{
 const fromStop={id:'FR:74010:ZE:57539:HAUTExSAVOIE',lat:45.9016985,lon:6.1201612};
 const toStop={id:'FR:6623:ZE:57862:HAUTExSAVOIE',lat:46.230964,lon:6.1096781};
 const journey={networkId:'oura-haute-savoie',line:'272',fromStop,toStop,travelDate:'2026-11-09',product:'parcours',profile:'adult'};
 const result=fares.stopReference(journey);
 assert.equal(result.amount,11.30);assert.equal(result.stopMappingVerified,true);
 assert.equal(result.fareVerified,false);assert.equal(result.serviceConfirmed,false);
 assert.equal(fares.stopReference({...journey,fromStop:toStop,toStop:fromStop}).amount,11.30);
 for(const update of [{networkId:'other'},{line:'274'},{toStop:{...toStop,lat:46.3}},
  {fromStop:{...fromStop,lat:'45.9016985'}},{fromStop:{...fromStop,id:'unknown'}},
  {travelDate:'2026-12-13'}])assert.equal(fares.stopReference({...journey,...update}),null);
});
test('unknown stops, dates, reductions and other services cannot inherit this tariff',()=>{
 for(const update of [{line:'271'},{line:'274'},{fromSector:'Annecy Pringy Gare'},{toSector:'Genève-Aéroport'},
  {travelDate:'2026-11-06'},{travelDate:'2026-12-13'},{travelDate:'2026-11-31'},{travelDate:null},
  {product:'day'},{product:'__proto__'},{profile:'young'},{profile:null}])assert.equal(fares.reference({...request,...update}),null);
});
