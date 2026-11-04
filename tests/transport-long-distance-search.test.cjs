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
