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
