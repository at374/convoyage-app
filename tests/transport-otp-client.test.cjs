'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {search}=require('../transport-otp-client.js');
const leg={mode:'RAIL',from:{name:'Annecy',lat:45.9,lon:6.12},to:{name:'Genève',lat:46.2,lon:6.14},startTime:1794830400000,endTime:1794834000000,duration:3600,distance:42000};
test('OTP2 client désactivé : aucune requête réseau',async()=>{
 let calls=0;
 await assert.rejects(search({endpoint:'https://otp.example.org/graphql',query:'query { plan { itineraries { legs { mode } } } }',fetch:async()=>{calls++;}}),/désactivé/);
 assert.equal(calls,0);
});
test('OTP2 client : refuse HTTP et URL contenant identifiants',async()=>{
 for(const endpoint of ['http://otp.example.org/graphql','https://user:pass@otp.example.org/graphql']){
  await assert.rejects(search({enabled:true,endpoint,query:'query { plan { itineraries { legs { mode } } } }',fetch:async()=>{throw Error('unexpected')}}));
 }
});
test('OTP2 client : normalise une réponse simulée sans confirmer tarifs ou temps réel',async()=>{
 let calls=0;
 const out=await search({enabled:true,endpoint:'https://otp.example.org/graphql',query:'query Demo { plan { itineraries { legs { mode } } } }',variables:{a:1},
  fetch:async(url,opts)=>{calls++;assert.equal(url,'https://otp.example.org/graphql');assert.equal(opts.method,'POST');assert.equal(JSON.parse(opts.body).variables.a,1);return {ok:true,json:async()=>({data:{plan:{itineraries:[{legs:[leg]}]}}})};}});
 assert.equal(calls,1);assert.equal(out.journeys.length,1);assert.equal(out.realtime,false);assert.equal(out.pricesVerified,false);
});
test('OTP2 client : refuse les erreurs GraphQL',async()=>{
 await assert.rejects(search({enabled:true,endpoint:'https://otp.example.org/graphql',query:'query Demo { plan { itineraries { legs { mode } } } }',fetch:async()=>({ok:true,json:async()=>({errors:[{message:'bad'}]})})}),/GraphQL/);
});

test('OTP2 client : abandonne la requête si la mission est annulée',async()=>{
 const controller=new AbortController();
 let observed;
 const pending=search({enabled:true,endpoint:'https://otp.example.org/graphql',query:'query Demo { plan { itineraries { legs { mode } } } }',signal:controller.signal,
  fetch:async(_url,opts)=>{observed=opts.signal;return new Promise((_resolve,reject)=>{
   opts.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
  });}});
 await new Promise(resolve=>setImmediate(resolve));
 controller.abort();
 await assert.rejects(pending,/interrompue|aborted/);
 assert.equal(observed.aborted,true);
});

test('OTP2 client : requête standard de fiche mission depuis les points GPS, sans saisie',()=>{
 const {buildQuery}=require('../transport-otp-client.js');
 const q=buildQuery({from:{lat:45.9017,lng:6.1219},to:{lat:46.2102,lon:6.1424}},{when:'2026-11-24T07:00:00.000Z',arriveBy:false});
 assert.match(q.query,/planConnection\(origin:\{location:\{coordinate:\{latitude:45\.9017,longitude:6\.1219\}\}\}/);
 assert.match(q.query,/earliestDeparture:"2026-11-24T07:00:00\.000Z"/);
 assert.match(q.query,/legGeometry\{points\}/);
 assert.match(buildQuery({from:{lat:1,lon:2},to:{lat:3,lon:4}},{when:'2026-11-24T07:00:00Z',arriveBy:true}).query,/latestArrival/);
 assert.equal(buildQuery({from:{lat:'x',lon:2},to:{lat:3,lon:4}},{when:'2026-11-24T07:00:00Z'}),null);
 assert.equal(buildQuery({from:{lat:1,lon:2},to:{lat:3,lon:4}},{when:'pas une date'}),null);
 assert.equal(buildQuery({from:{lat:1,lon:2}},{when:'2026-11-24T07:00:00Z'}),null);
});
