const {test}=require('node:test'),assert=require('node:assert/strict'),fares=require('../transport-y02-fares.js');
const fromStop={id:'FR:74012:ZE:57669:HAUTExSAVOIE',lat:46.1996235,lon:6.2381237};
const sixt={id:'FR:74273:ZE:57641:HAUTExSAVOIE',lat:46.053759,lon:6.773773};
const samoens={id:'FR:74258:ZE:57644:HAUTExSAVOIE',lat:46.0829415,lon:6.7231899};
const q={networkId:'oura-haute-savoie',line:'Y02',fromStop,toStop:sixt,travelDate:'2026-11-09',profile:'adult'};
test('reviewed intermediate sectors keep zone boundaries and symmetry',()=>{
 const bonne={id:'FR:74040:ZE:57659:HAUTExSAVOIE',lat:46.1680099,lon:6.3201807};
 const bergue={id:'FR:74094:ZE:57661:HAUTExSAVOIE',lat:46.179728,lon:6.300213};
 const stJeoire={id:'FR:74241:ZE:57655:HAUTExSAVOIE',lat:46.138307,lon:6.4579872};
 const mieussy={id:'FR:74183:ZE:57651:HAUTExSAVOIE',lat:46.1336799,lon:6.523335};
 for(const [a,b,amount] of [[bonne,bergue,1.7],[stJeoire,mieussy,1.7],[fromStop,mieussy,4]]){
  assert.equal(fares.stopReference({...q,fromStop:a,toStop:b}).amount,amount);
  assert.equal(fares.stopReference({...q,fromStop:b,toStop:a}).amount,amount);
 }
 assert.equal(fares.stopReference({...q,fromStop:bonne,toStop:{...bonne,lon:6.5}}),null);
});
test('Taninges, Verchaix and Morillon use the correct Y02 zones',()=>{
 const stops=[{id:'FR:74276:ZE:57620:HAUTExSAVOIE',lat:46.1075737,lon:6.5920651},
  {id:'FR:74294:ZE:57650:HAUTExSAVOIE',lat:46.0893605,lon:6.6789572},
  {id:'FR:74190:ZE:57645:HAUTExSAVOIE',lat:46.0818162,lon:6.6808251}];
 for(const stop of stops){
  assert.equal(fares.stopReference({...q,toStop:stop}).amount,4);
  assert.equal(fares.stopReference({...q,fromStop:stop,toStop:sixt}).amount,1.7);
  assert.equal(fares.stopReference({...q,fromStop:sixt,toStop:stop}).amount,1.7);
 }
});
test('Y02 applies the reviewed zone 2 reference to both verified endpoints and directions',()=>{
 for(const toStop of [sixt,samoens]){
  const value=fares.stopReference({...q,toStop});assert.equal(value.amount,4);assert.equal(value.zone,'2');
  assert.equal(value.fareVerified,false);assert.equal(value.serviceConfirmed,false);assert.equal(value.travelDateValidityKnown,false);
  assert.equal(fares.stopReference({...q,fromStop:toStop,toStop:fromStop}).amount,4);
 }
});
test('unknown stops, routes, dates and profiles do not inherit the tariff',()=>{
 for(const c of [{line:'Y03'},{networkId:'other'},{profile:'child'},{travelDate:'2026-12-07'},{travelDate:'2026-11-31'},
  {fromStop:{...fromStop,lat:46}},{toStop:{...sixt,id:'unknown'}},{toStop:fromStop}])assert.equal(fares.stopReference({...q,...c}),null);
});
