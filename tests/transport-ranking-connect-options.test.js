'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {connectJourneys}=require('../transport-ranking.js');
const first={
 id:'regional',departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T09:30:00+01:00',
 legs:[{departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T09:30:00+01:00',toPoint:{lat:45.9,lon:6.1}}]
};
const second={
 id:'rail',departure:'2026-11-04T09:40:00+01:00',arrival:'2026-11-04T10:30:00+01:00',
 legs:[{departure:'2026-11-04T09:40:00+01:00',arrival:'2026-11-04T10:30:00+01:00',fromPoint:{lat:45.9,lon:6.1}}]
};
test('invalid options do not crash composition',()=>{
 for(const options of [null,false,[],1,'invalid']){
  const result=connectJourneys(first,second,options);
  assert.ok(result);
  assert.equal(result.serviceConfirmed,false);
  assert.equal(result.priceEUR,null);
 }
});
test('malformed provider journeys are rejected without throwing',()=>{
 for(const value of [null,false,[],{},'invalid']){
  assert.equal(connectJourneys(value,second,{}),null);
  assert.equal(connectJourneys(first,value,{}),null);
 }
});
test('inter-network connection cannot be declared confirmed',()=>{
 const result=connectJourneys(first,second,{minTransferMinutes:3});
 assert.equal(result.provider,'Multiréseau');
 assert.equal(result.fareVerified,false);
 assert.equal(result.accessVerified,false);
 assert.equal(result.serviceConfirmed,false);
});
