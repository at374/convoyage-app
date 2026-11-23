'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fareFor}=require('../transport-fare-grids.js');
const leg=line=>({kind:'transit',mode:'Bus',provider:'Ondéa Aix-les-Bains',line,departure:'2026-11-30T08:00:00+01:00'});
test('Ondea 102 and 419 use the onboard fare, not the QR/M-ticket product',()=>{
 for(const line of ['102','419']){
  const fare=fareFor(leg(line));
  assert.equal(fare?.amount,1.70);
  assert.match(fare.product||fare.source,/conducteur/i);
 }
});
test('no automatic onboard fare on unverified school lines',()=>{
 assert.equal(fareFor(leg('418')),null);
 assert.equal(fareFor(leg('103')),null);
});
test('no onboard school fare outside validity dates or on unrelated operator',()=>{
 assert.equal(fareFor({...leg('419'),departure:'2026-06-30T08:00:00+02:00'}),null);
 assert.equal(fareFor({...leg('419'),provider:'Autre réseau'}),null);
});
