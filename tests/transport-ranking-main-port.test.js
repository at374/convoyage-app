'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {rank,evaluate}=require('../transport-ranking.js');
const trip={
 id:'regional',departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T10:00:00+01:00',
 priceEUR:4.5,exactOrigin:false,exactDestination:false,accessVerified:false,
 legs:[{serviceConfirmed:false}]
};
test('outbound requires fifteen minutes before pickup',()=>{
 assert.equal(rank([trip],{deadline:'2026-11-04T10:10:00+01:00'}).length,0);
 assert.equal(rank([trip],{deadline:'2026-11-04T10:15:00+01:00'}).length,1);
});
test('return has no pickup margin but obeys a deadline',()=>{
 assert.equal(rank([trip],{direction:'return',deadline:'2026-11-04T10:00:00+01:00'}).length,1);
 assert.equal(rank([trip],{direction:'return',deadline:'2026-11-04T09:59:00+01:00'}).length,0);
});
test('journey cannot depart before mission delivery',()=>{
 assert.deepEqual(rank([trip],{direction:'return',earliestDeparture:'2026-11-04T09:01:00+01:00'}),[]);
 assert.equal(rank([trip],{direction:'return',earliestDeparture:'2026-11-04T09:00:00+01:00'}).length,1);
});
test('invalid mission dates fail closed',()=>{
 for(const deadline of ['bad','2026-11-31T10:00:00+01:00']){
  assert.equal(evaluate(trip,{direction:'return',deadline}).feasible,false);
  assert.deepEqual(rank([trip],{direction:'return',deadline}),[]);
 }
});
test('ISO timezone offsets beyond fourteen hours are rejected',()=>{
 for(const invalid of ['2026-11-04T09:00:00+14:01','2026-11-04T09:00:00+15:00','2026-11-04T09:00:00-14:30']){
  assert.equal(evaluate({...trip,departure:invalid},{direction:'return'}).durationMinutes,null);
 }
 assert.notEqual(evaluate({...trip,departure:'2026-11-04T09:00:00+14:00'},{direction:'return'}).durationMinutes,null);
});
test('unverified and fractional-cent prices are not ranked as cheapest',()=>{
 const bad={...trip,priceEUR:1,fareVerified:false};
 const fractional={...trip,id:'fractional',priceEUR:0.001};
 const valid={...trip,id:'valid',priceEUR:2.5};
 assert.equal(rank([bad,fractional,valid],{direction:'return'})[0].journey.id,'valid');
});

test('confirmed multimodal journey rejects a missing timed transfer',()=>{
 const verified={...trip,exactOrigin:true,exactDestination:true,accessVerified:true,
  legs:[
   {departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T09:25:00+01:00',serviceConfirmed:true},
   {serviceConfirmed:true}
  ]};
 assert.equal(evaluate(verified,{deadline:'2026-11-04T10:15:00+01:00'}).feasible,false);
 assert.equal(evaluate(verified,{deadline:'2026-11-04T10:15:00+01:00'}).displayStatus,'Transport non confirmé — vérifiez vous-même');
});
test('confirmed multimodal journey rejects impossible transfer coordinates',()=>{
 const a={lat:45.90,lon:6.12},b={lat:45.91,lon:6.13};
 const verified={...trip,exactOrigin:true,exactDestination:true,accessVerified:true,interNetwork:true,transferVerified:true,
  legs:[
   {departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T09:25:00+01:00',toPoint:a,serviceConfirmed:true},
   {departure:'2026-11-04T09:30:00+01:00',arrival:'2026-11-04T10:00:00+01:00',fromPoint:b,serviceConfirmed:true}
  ]};
 assert.equal(evaluate(verified,{deadline:'2026-11-04T10:15:00+01:00'}).feasible,false);
 assert.equal(evaluate({...verified,legs:[verified.legs[0],{...verified.legs[1],fromPoint:a}]},{deadline:'2026-11-04T10:15:00+01:00'}).feasible,true);
});
test('return cannot be marked confirmed when it starts before delivery',()=>{
 const verified={...trip,exactOrigin:true,exactDestination:true,accessVerified:true,legs:[{serviceConfirmed:true}]};
 assert.equal(evaluate(verified,{direction:'return',earliestDeparture:'2026-11-04T09:05:00+01:00'}).feasible,false);
 assert.equal(evaluate(verified,{direction:'return',earliestDeparture:'2026-11-04T09:00:00+01:00'}).feasible,true);
});

test('verified service alone does not prove door-to-door access or a network transfer',()=>{
 const verified={...trip,exactOrigin:true,exactDestination:true,accessVerified:true,
  legs:[{serviceConfirmed:true}],interNetwork:true};
 const opts={deadline:'2026-11-04T10:15:00+01:00'};
 assert.equal(evaluate(verified,opts).feasible,false);
 assert.equal(evaluate({...verified,transferVerified:true},opts).feasible,true);
 assert.equal(evaluate({...verified,transferVerified:true,accessVerified:false},opts).feasible,false);
 assert.equal(evaluate({...verified,transferVerified:true,exactDestination:false},opts).feasible,false);
});
test('five-minute pickup exception requires verified GPS and destination access',()=>{
 const verified={...trip,exactOrigin:true,exactDestination:true,accessVerified:true,
  legs:[{serviceConfirmed:true}]};
 const opts={deadline:'2026-11-04T10:05:00+01:00'};
 assert.equal(evaluate(verified,opts).feasible,false);
 assert.equal(evaluate(verified,{...opts,exactGPSReliable:true}).feasible,true);
 assert.equal(evaluate({...verified,accessVerified:false},{...opts,exactGPSReliable:true}).feasible,false);
 assert.equal(rank([verified],opts).length,0);
 assert.equal(rank([verified],{...opts,exactGPSReliable:true}).length,1);
});
test('overlapping timed legs never certify a journey',()=>{
 const verified={...trip,exactOrigin:true,exactDestination:true,accessVerified:true,
  legs:[
   {departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T09:40:00+01:00',serviceConfirmed:true},
   {departure:'2026-11-04T09:30:00+01:00',arrival:'2026-11-04T10:00:00+01:00',serviceConfirmed:true}
  ]};
 assert.equal(evaluate(verified,{deadline:'2026-11-04T10:15:00+01:00'}).feasible,false);
});

test('multiple untimed legs cannot certify a multimodal connection',()=>{
 const verified={...trip,exactOrigin:true,exactDestination:true,accessVerified:true,
  legs:[{serviceConfirmed:true},{serviceConfirmed:true}]};
 const opts={deadline:'2026-11-04T10:15:00+01:00'};
 assert.equal(evaluate(verified,opts).feasible,false);
 assert.equal(evaluate(verified,opts).displayStatus,'Transport non confirmé — vérifiez vous-même');
 assert.equal(evaluate({...verified,legs:[{serviceConfirmed:true}]},opts).feasible,true);
});

test('cross-operator timed legs require verified interchange even without interNetwork flag',()=>{
 const verified={...trip,exactOrigin:true,exactDestination:true,accessVerified:true,
  legs:[
   {provider:'SIBRA',departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T09:25:00+01:00',serviceConfirmed:true},
   {provider:'SNCF',departure:'2026-11-04T09:30:00+01:00',arrival:'2026-11-04T10:00:00+01:00',serviceConfirmed:true}
  ]};
 const opts={deadline:'2026-11-04T10:15:00+01:00'};
 assert.equal(evaluate(verified,opts).feasible,false);
 assert.equal(evaluate({...verified,transferVerified:true},opts).feasible,true);
 assert.equal(evaluate({...verified,legs:verified.legs.map(leg=>({...leg,provider:'SIBRA'}))},opts).feasible,true);
});
