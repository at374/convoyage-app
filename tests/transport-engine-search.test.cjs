const test=require('node:test');
const assert=require('node:assert/strict');
const {searchEngines,tripGoEngine}=require('../transport-engine-search.js');
const journey={departure:'2026-11-12T09:00:00+01:00',arrival:'2026-11-12T10:00:00+01:00',legs:[{provider:'TER'}]};
test('parallel engine results retain provider and missing price',async()=>{
 const result=await searchEngines([
  {name:'TripGo',search:async()=>[journey]},
  {name:'TPG',search:async()=>[]}
 ],{origin:{lat:45.9,lon:6.1},destination:{lat:46.2,lon:6.1}});
 assert.equal(result.journeys.length,1);
 assert.equal(result.journeys[0].provider,'TripGo');
 assert.equal(result.journeys[0].priceEUR,null);
 assert.equal(result.statuses.length,2);
});
test('one engine failure does not hide others',async()=>{
 const result=await searchEngines([
  {name:'Broken',search:async()=>{throw Error('offline')}},
  {name:'TripGo',search:async()=>[journey]}
 ],{});
 assert.equal(result.journeys.length,1);
 assert.equal(result.statuses[0].status,'unavailable');
});
test('engine timeout is isolated',async()=>{
 const result=await searchEngines([
  {name:'Stalled',search:()=>new Promise(()=>{})},
  {name:'TripGo',search:async()=>[journey]}
 ],{}, {timeoutMs:100});
 assert.equal(result.journeys.length,1);
 assert.equal(result.statuses[0].reason,'timeout');
});
test('malformed engine response is not treated as an empty success',async()=>{
 const result=await searchEngines([{name:'Bad',search:async()=>({trips:[]})}],{});
 assert.equal(result.statuses[0].status,'unavailable');
});

test('existing TripGo planner feeds engine results without inventing fare or service',async()=>{
 const query={from:{lat:45.9,lon:6.1},to:{lat:46.2,lon:6.1},when:'2026-11-12T09:00:00+01:00'};
 let called=false;
 const engine=tripGoEngine({plan:async args=>{
   called=args.from===query.from&&args.to===query.to&&args.when===query.when;
   return {itineraries:[{...journey,evidence:{endpointCoordinatesMatched:true},serviceConfirmed:false}]};
 }});
 const result=await searchEngines([engine],query);
 assert.equal(called,true);
 assert.equal(result.journeys.length,1);
 assert.equal(result.journeys[0].priceEUR,null);
 assert.equal(result.journeys[0].serviceConfirmed,false);
 assert.equal(result.journeys[0].exactOrigin,true);
 assert.equal(result.journeys[0].provider,'TripGo');
});
