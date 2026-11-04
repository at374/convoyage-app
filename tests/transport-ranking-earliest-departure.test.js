'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {rank,evaluate}=require('../transport-ranking.js');
const base={
 departure:'2026-11-04T09:00:00+01:00',
 arrival:'2026-11-04T10:00:00+01:00',
 priceEUR:5,
 legs:[{departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T10:00:00+01:00',serviceConfirmed:true}],
 exactOrigin:true,exactDestination:true,accessVerified:true
};
test('return departure before mission delivery is excluded',()=>{
 const opts={direction:'return',earliestDeparture:'2026-11-04T09:30:00+01:00'};
 assert.equal(evaluate(base,opts).feasible,false);
 assert.deepEqual(rank([base],opts),[]);
});
test('return departing at or after delivery remains eligible',()=>{
 const opts={direction:'return',earliestDeparture:'2026-11-04T09:00:00+01:00'};
 assert.equal(rank([base],opts).length,1);
});
test('malformed delivery time fails closed',()=>{
 for(const earliestDeparture of ['invalid','2026-11-31T09:00:00+01:00','2026-11-04T09:00:00']){
  const opts={direction:'return',earliestDeparture};
  assert.equal(evaluate(base,opts).feasible,false);
  assert.deepEqual(rank([base],opts),[]);
 }
});
test('junction respects both delivery time and next pickup deadline',()=>{
 const options={earliestDeparture:'2026-11-04T08:30:00+01:00',deadline:'2026-11-04T10:20:00+01:00',marginMinutes:15};
 assert.equal(rank([base],options).length,1);
 assert.equal(rank([base],{...options,earliestDeparture:'2026-11-04T09:30:00+01:00'}).length,0);
 assert.equal(rank([base],{...options,deadline:'2026-11-04T10:10:00+01:00'}).length,0);
});
