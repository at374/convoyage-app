const {test}=require('node:test'),assert=require('node:assert/strict'),fares=require('../transport-y21-fares.js');
const fromStop={id:'FR:74010:ZE:57539:HAUTExSAVOIE',lat:45.9016985,lon:6.1201612};
const toStop={id:'FR:74269:ZE:57777:HAUTExSAVOIE',lat:45.9578116,lon:5.8369357};
const q={networkId:'oura-haute-savoie',line:'Y21',fromStop,toStop,travelDate:'2026-11-09',profile:'adult'};
test('Y21 intermediate sectors use their own fare zone and exclude local Sibra cells',()=>{
 const clermont={id:'FR:74078:ZE:57782:HAUTExSAVOIE',lat:45.9722894,lon:5.9069194};
 const chilly={id:'FR:74075:ZE:57786:HAUTExSAVOIE',lat:45.9832886,lon:5.9387231};
 const sillingy={id:'FR:74272:ZE:57800:HAUTExSAVOIE',lat:45.9446802,lon:6.052833};
 assert.equal(fares.stopReference({...q,toStop:clermont}).amount,1.7);
 assert.equal(fares.stopReference({...q,fromStop:chilly,toStop}).amount,1.7);
 assert.equal(fares.stopReference({...q,fromStop:sillingy,toStop}).amount,4);
 assert.equal(fares.stopReference({...q,toStop:sillingy}),null);
 assert.equal(fares.stopReference({...q,toStop:{...clermont,lat:46.3}}),null);
});
test('Y21 Annecy-Seyssel has a bounded official adult reference in both directions',()=>{
 const fare=fares.stopReference(q);assert.equal(fare.amount,4);assert.equal(fare.zone,'2');
 assert.equal(fare.fareVerified,false);assert.equal(fare.serviceConfirmed,false);assert.equal(fare.travelDateValidityKnown,false);
 assert.equal(fares.stopReference({...q,fromStop:toStop,toStop:fromStop}).amount,4);
});
test('unverified lines, dates, stops and profiles cannot receive the reference',()=>{
 for(const change of [{line:'Y22'},{networkId:'other'},{profile:'child'},{travelDate:'2026-12-07'},{travelDate:'2026-11-31'},
  {fromStop:{...fromStop,lat:46}},{toStop:{...toStop,id:'other'}},{toStop:fromStop}])assert.equal(fares.stopReference({...q,...change}),null);
});
