const {test}=require('node:test'),assert=require('node:assert/strict'),fares=require('../transport-y22-fares.js');
const fromStop={id:'FR:74010:ZE:57539:HAUTExSAVOIE',lat:45.9016985,lon:6.1201612};
const toStop={id:'FR:01033:ZE:57833:HAUTExSAVOIE',lat:46.109695,lon:5.824159};
const q={networkId:'oura-haute-savoie',line:'Y22',fromStop,toStop,travelDate:'2026-11-09',profile:'adult'};
test('Y22 Annecy-Valserhône has a bounded official adult reference in both directions',()=>{
 const fare=fares.stopReference(q);assert.equal(fare.amount,6.6);assert.equal(fare.zone,'3');
 assert.equal(fare.fareVerified,false);assert.equal(fare.serviceConfirmed,false);assert.equal(fare.travelDateValidityKnown,false);
 assert.equal(fares.stopReference({...q,fromStop:toStop,toStop:fromStop}).amount,6.6);
});
test('unverified lines, dates, stops and profiles cannot receive the reference',()=>{
 for(const change of [{line:'Y21'},{networkId:'other'},{profile:'child'},{travelDate:'2026-12-07'},{travelDate:'2026-11-31'},
  {fromStop:{...fromStop,lat:46}},{toStop:{...toStop,id:'other'}},{toStop:fromStop}])assert.equal(fares.stopReference({...q,...change}),null);
});
