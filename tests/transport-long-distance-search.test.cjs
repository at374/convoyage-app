const {test}=require('node:test');
const assert=require('node:assert/strict');
const {searchLongDistance}=require('../transport-long-distance-search.js');
test('missing provider connections do not fabricate offers',async()=>{
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'});
 assert.equal(result.offers.length,0);
 assert.deepEqual(result.providers.map(p=>p.status),['not-connected','not-connected','not-connected']);
});
test('external offers remain unverified',async()=>{
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'},{FlixBus:async()=>[{from:'Annecy',to:'Lyon',departure:'2026-11-02T23:50:00+01:00',arrival:'2026-11-03T01:30:00+01:00',priceEUR:5,serviceConfirmed:true}]});
 assert.equal(result.offers.length,1);
 assert.equal(result.offers[0].priceEUR,null);
 assert.equal(result.offers[0].serviceConfirmed,false);
});

test('rejects off-date offers while retaining cross-midnight departures in provider local time',async()=>{
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'},{
  FlixBus:async()=>[
   {from:'Annecy',to:'Lyon',departure:'2026-11-02T23:50:00+01:00',arrival:'2026-11-03T01:30:00+01:00'},
   {from:'Annecy',to:'Lyon',departure:'2026-11-03T00:10:00+01:00',arrival:'2026-11-03T02:00:00+01:00'}
  ]
 });
 assert.equal(result.offers.length,1);
 assert.equal(result.offers[0].departure,'2026-11-02T22:50:00.000Z');
});
