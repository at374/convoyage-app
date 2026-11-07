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
test('unknown stops, dates, reductions and other services cannot inherit this tariff',()=>{
 for(const update of [{line:'271'},{line:'274'},{fromSector:'Annecy Pringy Gare'},{toSector:'Genève-Aéroport'},
  {travelDate:'2026-11-06'},{travelDate:'2026-12-13'},{travelDate:'2026-11-31'},{travelDate:null},
  {product:'day'},{product:'__proto__'},{profile:'young'},{profile:null}])assert.equal(fares.reference({...request,...update}),null);
});
