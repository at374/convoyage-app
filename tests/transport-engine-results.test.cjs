const test=require('node:test');
const assert=require('node:assert/strict');
const {aggregateEngineResponses,sortJourneys}=require('../transport-engine-results.js');
const leg={provider:'TER',tripId:'T1',fromStopId:'A',toStopId:'B'};
const journey=(extra={})=>({id:'t1',departure:'2026-11-12T09:00:00+01:00',arrival:'2026-11-12T10:00:00+01:00',legs:[leg],...extra});
test('engine-only results: no generated price, no invented route',()=>{
 const out=aggregateEngineResponses([{provider:'TripGo',journeys:[journey()]}]);
 assert.equal(out.journeys.length,1);
 assert.equal(out.journeys[0].priceEUR,null);
 assert.equal(out.journeys[0].priceStatus,'unavailable');
 assert.equal(out.journeys[0].serviceConfirmed,false);
 assert.equal(out.source,'live-engine-responses-only');
});
test('unavailable provider does not hide other provider',()=>{
 const out=aggregateEngineResponses([{provider:'TPG',error:'timeout'},{provider:'TripGo',journeys:[journey()]}]);
 assert.equal(out.journeys.length,1);
 assert.equal(out.statuses[0].status,'unavailable');
});
test('same actual trip merges provenance but differing prices stay visible',()=>{
 const out=aggregateEngineResponses([
 {provider:'TripGo',journeys:[journey({priceEUR:12,fareVerified:false})]},
 {provider:'TER',journeys:[journey({priceEUR:12,fareVerified:false})]},
 {provider:'Other',journeys:[journey({priceEUR:10,fareVerified:true})]}]);
 assert.equal(out.journeys.length,2);
 assert.equal(out.journeys[0].provenance.length,2);
 assert.equal(out.journeys[1].priceStatus,'verified');
});
test('do not merge ambiguous equal-time routes',()=>{
 const out=aggregateEngineResponses([{provider:'TripGo',journeys:[
 journey({legs:[{provider:'bus'}]}),journey({id:'t2',legs:[{provider:'tram'}]})]}]);
 assert.equal(out.journeys.length,2);
});
test('reject invalid journey and price, preserve source status',()=>{
 const out=aggregateEngineResponses([{provider:'TripGo',journeys:[
 journey({priceEUR:-5}),journey({departure:'bad'}),{legs:[]}]}]);
 assert.equal(out.journeys.length,1);
 assert.equal(out.journeys[0].priceEUR,null);
 assert.equal(out.statuses[0].accepted,1);
});
test('cheapest and fastest sorts',()=>{
 const a=journey({priceEUR:10,arrival:'2026-11-12T11:00:00+01:00'});
 const b=journey({priceEUR:20,arrival:'2026-11-12T09:30:00+01:00'});
 const out=aggregateEngineResponses([{provider:'TripGo',journeys:[a,b]}]).journeys;
 assert.equal(sortJourneys(out,'cheapest')[0].priceEUR,10);
 assert.equal(sortJourneys(out,'fastest')[0].priceEUR,20);
});

test('compromise balances price and duration instead of repeating cheapest',()=>{
 const out=aggregateEngineResponses([{provider:'TripGo',journeys:[
  journey({id:'slow-cheap',priceEUR:5,arrival:'2026-11-12T12:00:00+01:00'}),
  journey({id:'balanced',priceEUR:12,arrival:'2026-11-12T10:00:00+01:00'}),
  journey({id:'fast-expensive',priceEUR:30,arrival:'2026-11-12T09:30:00+01:00'})
 ]}]).journeys;
 assert.equal(sortJourneys(out,'cheapest')[0].priceEUR,5);
 assert.equal(sortJourneys(out,'compromise')[0].priceEUR,12);
 assert.equal(sortJourneys(out,'fastest')[0].priceEUR,30);
});
test('unknown fares remain visible after priced journeys in compromise',()=>{
 const out=aggregateEngineResponses([{provider:'TripGo',journeys:[
  journey({id:'unknown',arrival:'2026-11-12T09:15:00+01:00'}),
  journey({id:'priced',priceEUR:15,arrival:'2026-11-12T10:00:00+01:00'})
 ]}]).journeys;
 const sorted=sortJourneys(out,'compromise');
 assert.equal(sorted.length,2);
 assert.equal(sorted[0].priceEUR,15);
 assert.equal(sorted[1].priceStatus,'unavailable');
});
