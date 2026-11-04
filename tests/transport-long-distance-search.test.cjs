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

test('SNCF/TER and long-distance candidates share ranking without inventing verified service',async()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'},{
  FlixBus:async()=>[{from:'Annecy',to:'Lyon',departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T09:00:00+01:00',priceEUR:5}]
 });
 const regional=[{id:'ter',provider:'SNCF',departure:'2026-11-02T07:30:00+01:00',arrival:'2026-11-02T08:30:00+01:00',
  priceEUR:null,exactOrigin:false,exactDestination:false,accessVerified:false,legs:[]}];
 const compared=compareWithRegional(regional,result,{deadline:'2026-11-02T10:00:00+01:00'});
 assert.equal(compared.candidates.length,2);
 assert.equal(compared.allSourcesConnected,false);
 assert.ok(compared.choices.some(choice=>choice.journey.provider==='SNCF'));
 assert.ok(compared.choices.every(choice=>choice.journey.feasible===false));
 assert.ok(compared.choices.every(choice=>choice.journey.displayStatus.includes('non confirmé')));
});

test('provider responses cannot mix unrelated origins or destinations',async()=>{
 const base={from:'Annecy',to:'Lyon',departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T10:00:00+01:00'};
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'},{
  FlixBus:async()=>[base,{...base,from:'Grenoble'},{...base,to:'Paris'},
   {...base,from:'ANNECY',to:'LYON'}]
 });
 assert.equal(result.offers.length,2);
 assert.ok(result.offers.every(o=>o.provider==='FlixBus'));
});

test('duplicate offers are collapsed and large provider results are bounded',async()=>{
 const base={from:'Annecy',to:'Lyon',departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T10:00:00+01:00'};
 const offers=Array.from({length:110},(_,i)=>({...base,line:'Service '+i}));
 offers.push({...base,line:'Service 0'});
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'},{
  FlixBus:async()=>offers
 });
 assert.equal(result.offers.length,100);
 assert.equal(result.providers[0].truncated,true);
 assert.equal(new Set(result.offers.map(o=>o.legs[0].line)).size,100);
});

test('mission windows exclude services departing too early or arriving too late',async()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'},{
  FlixBus:async()=>[
   {from:'Annecy',to:'Lyon',departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T08:00:00+01:00'},
   {from:'Annecy',to:'Lyon',departure:'2026-11-02T09:00:00+01:00',arrival:'2026-11-02T10:00:00+01:00'},
   {from:'Annecy',to:'Lyon',departure:'2026-11-02T11:00:00+01:00',arrival:'2026-11-02T13:00:00+01:00'}
  ]
 });
 const compared=compareWithRegional([],result,{earliestDeparture:'2026-11-02T08:30:00+01:00',
  latestArrival:'2026-11-02T10:30:00+01:00',deadline:'2026-11-02T10:30:00+01:00'});
 assert.equal(compared.candidates.length,1);
 assert.equal(compared.candidates[0].departure,'2026-11-02T08:00:00.000Z');
 assert.ok(compared.choices.every(c=>c.journey.feasible===false));
});

test('pickup margin rejects a bus arriving only five minutes before the mission',async()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const base={from:'Annecy',to:'Lyon',departure:'2026-11-02T08:00:00+01:00'};
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'},{
  FlixBus:async()=>[
   {...base,arrival:'2026-11-02T09:55:00+01:00',line:'Too late'},
   {...base,arrival:'2026-11-02T09:40:00+01:00',line:'Safe margin'}
  ]
 });
 const compared=compareWithRegional([],result,{latestArrival:'2026-11-02T10:00:00+01:00'});
 assert.equal(compared.candidates.length,1);
 assert.equal(compared.candidates[0].legs[0].line,'Safe margin');
 assert.equal(compared.candidates[0].serviceConfirmed,false);
});

test('return trips use arrival window without subtracting outbound pickup margin',async()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const result=await searchLongDistance({from:'Lyon',to:'Annecy',date:'2026-11-02'},{
  FlixBus:async()=>[{from:'Lyon',to:'Annecy',departure:'2026-11-02T18:00:00+01:00',
   arrival:'2026-11-02T19:55:00+01:00'}]
 });
 const opts={latestArrival:'2026-11-02T20:00:00+01:00'};
 const outbound=compareWithRegional([],result,opts);
 const homeward=compareWithRegional([],result,{...opts,direction:'return'});
 assert.equal(outbound.candidates.length,0);
 assert.equal(homeward.candidates.length,1);
 assert.equal(homeward.choices[0].journey.feasible,false);
});


test('GPS reliability alone cannot reduce the outbound pickup margin',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const base={departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T09:50:00+01:00',legs:[]};
 const deadline='2026-11-02T10:00:00+01:00';
 const options={deadline,marginMinutes:5,exactGPSReliable:true};
 assert.equal(compareWithRegional([{...base,id:'unverified',exactDestination:true,accessVerified:false}],null,options).candidates.length,0);
 assert.equal(compareWithRegional([{...base,id:'verified',exactDestination:true,accessVerified:true}],null,options).candidates.length,1);
 assert.equal(compareWithRegional([{...base,id:'no-destination',exactDestination:false,accessVerified:true}],null,options).candidates.length,0);
});

test('verified GPS five-minute exception survives final ranking',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const journey={id:'gps',departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T09:54:00+01:00',exactDestination:true,accessVerified:true,legs:[]};
 const opts={deadline:'2026-11-02T10:00:00+01:00',marginMinutes:5,exactGPSReliable:true};
 const accepted=compareWithRegional([journey],null,opts);
 assert.equal(accepted.candidates.length,1);
 assert.equal(accepted.choices.length,1);
 assert.equal(accepted.choices[0].journey.id,'gps');
 const rejected=compareWithRegional([{...journey,accessVerified:false}],null,opts);
 assert.equal(rejected.candidates.length,0);
 assert.equal(rejected.choices.length,0);
});

test('distinct provider services and boarding stops are not collapsed at identical times',async()=>{
 const base={from:'Annecy',to:'Lyon',departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T10:00:00+01:00',line:'A'};
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'},{
  FlixBus:async()=>[{...base,serviceTripId:'trip-a',fromStopCode:'stop-1'},
   {...base,serviceTripId:'trip-b',fromStopCode:'stop-1'},
   {...base,serviceTripId:'trip-a',fromStopCode:'stop-2'},
   {...base,serviceTripId:'trip-a',fromStopCode:'stop-1'}]
 });
 assert.equal(result.offers.length,3);
 assert.deepEqual(result.offers.map(x=>[x.legs[0].serviceTripId,x.legs[0].fromStopCode]),
  [['trip-a','stop-1'],['trip-b','stop-1'],['trip-a','stop-2']]);
 assert.ok(result.offers.every(x=>x.priceEUR===null&&x.serviceConfirmed===false));
});

test('regional comparison rejects timezone-ambiguous and invalid schedule dates',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const base={departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T09:00:00+01:00',legs:[]};
 const candidates=[base,{...base,departure:'2026-11-02T08:00:00'},
  {...base,arrival:'2026-11-02T09:00:00'},
  {...base,departure:'2026-02-30T08:00:00+01:00'},
  {...base,arrival:'2026-11-02T09:00:00+14:30'}];
 const result=compareWithRegional(candidates,null,{});
 assert.equal(result.candidates.length,1);
 assert.equal(result.choices.length,1);
});

test('negative requested margin never bypasses the fifteen-minute pickup buffer',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const base={departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T09:50:00+01:00',legs:[]};
 const opts={deadline:'2026-11-02T10:00:00+01:00',marginMinutes:-20};
 const result=compareWithRegional([base],null,opts);
 assert.equal(result.candidates.length,0);
 assert.equal(result.choices.length,0);
});

test('invalid or reversed mission windows never silently widen the comparison',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const journey={departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T09:00:00+01:00',legs:[]};
 for(const options of [
  {deadline:'not-a-date'},
  {latestArrival:'2026-11-02T10:00:00'},
  {earliestDeparture:'2026-02-30T08:00:00+01:00'},
  {earliestDeparture:'2026-11-02T10:00:00+01:00',latestArrival:'2026-11-02T09:00:00+01:00'}
 ]){
  const result=compareWithRegional([journey],null,options);
  assert.equal(result.candidates.length,0,JSON.stringify(options));
  assert.equal(result.choices.length,0,JSON.stringify(options));
 }
});

test('different GPS boarding stops are retained even when their names and schedules match',async()=>{
 const base={from:'Annecy',to:'Lyon',departure:'2026-11-02T08:00:00+01:00',arrival:'2026-11-02T10:00:00+01:00'};
 const result=await searchLongDistance({from:'Annecy',to:'Lyon',date:'2026-11-02'}, {
  FlixBus:async()=>[{...base,fromPoint:{lat:45.9,lon:6.1}},
   {...base,fromPoint:{lat:45.91,lng:6.1}},
   {...base,fromPoint:{lat:45.9,lon:6.1}},
   {...base,fromPoint:{lat:999,lon:6.1}}]
 });
 assert.equal(result.offers.length,3);
 assert.deepEqual(result.offers[1].legs[0].fromPoint,{lat:45.91,lon:6.1});
 assert.equal(result.offers[2].legs[0].fromPoint,null);
 assert.ok(result.offers.every(o=>o.exactOrigin===false&&o.accessVerified===false&&o.serviceConfirmed===false));
});

test('comparison includes provisional regional to long-distance same-stop connection',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const point={lat:45.91,lon:6.13};
 const regional={id:'regional',departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
  legs:[{departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
   fromPoint:{lat:45.9,lon:6.12},toPoint:point,serviceConfirmed:false}]};
 const long={id:'long',departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
  legs:[{departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
   fromPoint:point,toPoint:{lat:45.92,lon:6.14},serviceConfirmed:false}]};
 const result=compareWithRegional([regional],{offers:[long],providers:[]},
  {deadline:'2026-11-02T09:00:00+01:00'});
 const joined=result.candidates.find(x=>x.id==='regional+long');
 assert.ok(joined);
 assert.equal(joined.legs.length,2);
 assert.equal(joined.priceEUR,null);
 assert.equal(joined.accessVerified,false);
 assert.equal(joined.serviceConfirmed,false);
 assert.equal(result.choices.every(x=>x.journey.feasible===false),true);
 const disconnected=compareWithRegional([regional],{offers:[{...long,legs:[{...long.legs[0],
  fromPoint:{lat:45.92,lon:6.14}}]}]}, {deadline:'2026-11-02T09:00:00+01:00'});
 assert.equal(disconnected.candidates.some(x=>x.id==='regional+long'),false);
});

test('comparison joins long-distance arrival to a regional onward service',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const point={lat:45.91,lon:6.13};
 const long={id:'coach',departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
  legs:[{departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
   fromPoint:{lat:45.9,lon:6.12},toPoint:point,serviceConfirmed:false}]};
 const regional={id:'regional',departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
  legs:[{departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
   fromPoint:point,toPoint:{lat:45.92,lon:6.14},serviceConfirmed:false}]};
 const result=compareWithRegional([regional],{offers:[long],providers:[]},
  {deadline:'2026-11-02T09:00:00+01:00'});
 const joined=result.candidates.find(x=>x.id==='coach+regional');
 assert.ok(joined,'A coach can feed an onward regional service');
 assert.equal(joined.serviceConfirmed,false);
 assert.equal(joined.priceEUR,null);
});

test('comparison accepts a routed walk between different stop GPS coordinates',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const from={lat:45.91,lon:6.13},to={lat:45.911,lon:6.131};
 const regional={id:'feeder',departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
  legs:[{departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
   fromPoint:{lat:45.9,lon:6.12},toPoint:from}]};
 const coach={id:'coach',departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
  legs:[{departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
   fromPoint:to,toPoint:{lat:45.92,lon:6.14}}]};
 const walk={mode:'wa_wal',routeVerified:true,
  departure:'2026-11-02T07:40:00+01:00',arrival:'2026-11-02T07:43:00+01:00',
  fromPoint:from,toPoint:to,distanceMeters:160};
 const result=compareWithRegional([regional],{offers:[coach]},
  {deadline:'2026-11-02T09:00:00+01:00',walkingConnections:[walk]});
 const joined=result.candidates.find(x=>x.id==='feeder+coach');
 assert.ok(joined);
 assert.equal(joined.legs.length,3);
 assert.equal(joined.legs[1].mode,'wa_wal');
 assert.equal(joined.accessVerified,false);
 const missing=compareWithRegional([regional],{offers:[coach]},
  {deadline:'2026-11-02T09:00:00+01:00',walkingConnections:[]});
 assert.equal(missing.candidates.some(x=>x.id==='feeder+coach'),false);
});

test('unmatched single walking connection never leaks into a different transfer',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const from={lat:45.91,lon:6.13},to={lat:45.911,lon:6.131};
 const regional={id:'regional',departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
  legs:[{departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
   fromPoint:{lat:45.9,lon:6.12},toPoint:from}]};
 const coach={id:'coach',departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
  legs:[{departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
   fromPoint:to,toPoint:{lat:45.92,lon:6.14}}]};
 const walk={mode:'wa_wal',routeVerified:true,
  departure:'2026-11-02T07:40:00+01:00',arrival:'2026-11-02T07:43:00+01:00',
  fromPoint:from,toPoint:to,distanceMeters:160};
 const result=compareWithRegional([regional],{offers:[coach]},
  {deadline:'2026-11-02T09:00:00+01:00',walkingConnection:walk});
 assert.equal(result.candidates.some(x=>x.id==='regional+coach'),false);
});

test('comparator selects a walk fitting the transfer window, not an earlier stale walk',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const from={lat:45.91,lon:6.13},to={lat:45.911,lon:6.131};
 const regional={id:'regional',departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
  legs:[{departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
   fromPoint:{lat:45.9,lon:6.12},toPoint:from}]};
 const coach={id:'coach',departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
  legs:[{departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
   fromPoint:to,toPoint:{lat:45.92,lon:6.14}}]};
 const walk={mode:'wa_wal',routeVerified:true,
  departure:'2026-11-02T07:40:00+01:00',arrival:'2026-11-02T07:43:00+01:00',
  fromPoint:from,toPoint:to,distanceMeters:160};
 const stale={...walk,departure:'2026-11-02T06:40:00+01:00',
  arrival:'2026-11-02T06:43:00+01:00'};
 const result=compareWithRegional([regional],{offers:[coach]},
  {deadline:'2026-11-02T09:00:00+01:00',walkingConnections:[stale,walk]});
 const joined=result.candidates.find(x=>x.id==='regional+coach');
 assert.ok(joined,'A later valid walk must be selected over an earlier stale one');
 assert.equal(joined.legs[1].departure,walk.departure);
});

test('comparison skips impossible first walk and tries a later valid alternative',()=>{
 const {compareWithRegional}=require('../transport-long-distance-search.js');
 const from={lat:45.91,lon:6.13},to={lat:45.911,lon:6.131};
 const regional={id:'regional',departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
  legs:[{departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:40:00+01:00',
   fromPoint:{lat:45.9,lon:6.12},toPoint:from}]};
 const coach={id:'coach',departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
  legs:[{departure:'2026-11-02T07:45:00+01:00',arrival:'2026-11-02T08:15:00+01:00',
   fromPoint:to,toPoint:{lat:45.92,lon:6.14}}]};
 const valid={mode:'wa_wal',routeVerified:true,
  departure:'2026-11-02T07:40:00+01:00',arrival:'2026-11-02T07:43:00+01:00',
  fromPoint:from,toPoint:to,distanceMeters:160};
 const impossible={...valid,arrival:'2026-11-02T07:42:00+01:00',distanceMeters:1};
 const result=compareWithRegional([regional],{offers:[coach]},
  {deadline:'2026-11-02T09:00:00+01:00',walkingConnections:[impossible,valid]});
 const joined=result.candidates.find(x=>x.id==='regional+coach');
 assert.ok(joined,'Valid alternative should be used');
 assert.equal(joined.legs[1].distanceMeters,160);
});
