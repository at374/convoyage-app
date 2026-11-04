'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate,rank}=require('../transport-ranking.js');
const journey={
 id:'return',departure:'2026-11-04T09:00:00+01:00',
 arrival:'2026-11-04T10:00:00+01:00',priceEUR:5,
 legs:[{departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T10:00:00+01:00',serviceConfirmed:true}],
 exactOrigin:true,exactDestination:true,accessVerified:true
};
test('malformed supplied deadlines never allow a return recommendation',()=>{
 for(const deadline of ['invalid','2026-11-31T11:00:00+01:00','2026-11-04T25:00:00+01:00','2026-11-04T11:00:00']){
  const options={direction:'return',deadline};
  assert.equal(evaluate(journey,options).feasible,false);
  assert.deepEqual(rank([journey],options),[]);
 }
});
test('missing return deadline still permits an unconfirmed candidate',()=>{
 const result=rank([{...journey,accessVerified:false}],{direction:'return'});
 assert.equal(result.length,1);
 assert.equal(result[0].journey.feasible,false);
});
test('valid return deadline filters late arrivals',()=>{
 assert.deepEqual(rank([journey],{direction:'return',deadline:'2026-11-04T09:59:00+01:00'}),[]);
 assert.equal(rank([journey],{direction:'return',deadline:'2026-11-04T10:00:00+01:00'}).length,1);
});
