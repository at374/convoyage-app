'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate,rank}=require('../transport-ranking.js');
const base={
 departure:'2026-11-04T09:00:00+01:00',
 arrival:'2026-11-04T10:00:00+01:00',
 legs:[{departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T10:00:00+01:00',serviceConfirmed:false}]
};
test('invalid fractional-cent and negative fares are unknown',()=>{
 for(const value of [1.234,0.001,-1,NaN,Infinity,'2.50']){
  assert.equal(evaluate({...base,priceEUR:value}).priceEUR,null);
 }
});
test('zero euro and ordinary cent fares remain available',()=>{
 for(const value of [0,0.01,2.5,8.9]){
  assert.equal(evaluate({...base,priceEUR:value}).priceEUR,value);
 }
});
test('explicitly unverified fare is never the cheapest',()=>{
 const options={direction:'return'};
 const journeys=[
  {...base,id:'unknown',priceEUR:0,fareVerified:false},
  {...base,id:'verified',priceEUR:4.5,fareVerified:true}
 ];
 const results=rank(journeys,options);
 assert.equal(results.find(x=>x.label==='Moins cher').journey.id,'verified');
});
test('fractional-cent fare cannot displace a verified cheap option',()=>{
 const journeys=[
  {...base,id:'fractional',priceEUR:0.001},
  {...base,id:'known',priceEUR:1.25}
 ];
 assert.equal(rank(journeys,{direction:'return'}).find(x=>x.label==='Moins cher').journey.id,'known');
});
