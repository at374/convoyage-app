/* Deterministic browser/Node adapter checks; no live API requests. */
const assert = require('node:assert/strict');
const swiss = require('../swiss-transport-api.js');
assert.equal(swiss.point({lat:46.2044,lon:6.1432}),'46.2044,6.1432');
assert.equal(swiss.point({lat:0,lon:0}),null);
// Official /connections API accepts WGS84 latitude,longitude and can include walking sections.
const gps=new URL(swiss.buildUrl({from:{lat:46.2044,lon:6.1432},to:{lat:46.5168,lng:6.6291},when:'2026-12-01T10:00:00+01:00'}));
assert.equal(gps.searchParams.get('from'),'46.2044,6.1432');
assert.equal(gps.searchParams.get('to'),'46.5168,6.6291');
const winter=swiss.buildUrl({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',arriveBy:true});
const w=new URL(winter);
assert.equal(w.searchParams.get('date'),'2026-12-01');
assert.equal(w.searchParams.get('time'),'10:00');
assert.equal(w.searchParams.get('isArrivalTime'),'1');
assert.deepEqual(w.searchParams.getAll('transportations[]'),['train','tram','bus']);
const summer=new URL(swiss.buildUrl({from:'Genève',to:'Lausanne',when:'2026-07-01T10:00:00+02:00'}));
assert.equal(summer.searchParams.get('date'),'2026-07-01');
assert.equal(summer.searchParams.get('time'),'10:00');
(async()=>{
 const results=await swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>({connections:[{from:{departure:'2026-12-01T10:10:00+01:00'},to:{arrival:'2026-12-01T10:50:00+01:00'},sections:[{journey:{category:'IC',number:'1'},departure:{station:{name:'Genève'}},arrival:{station:{name:'Lausanne'}}}]}]})})});
 assert.equal(results.length,1);
 assert.equal(results[0].confirmed,false);
 assert.equal(results[0].price,null);
 assert.equal(results[0].sections[0].line,'1');
 const walking=await swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>({connections:[{from:{departure:'2026-12-01T10:10:00+01:00'},to:{arrival:'2026-12-01T10:50:00+01:00'},sections:[{walk:{duration:420},departure:{station:{name:'Genève Cornavin'}},arrival:{station:{name:'Quai'}}}]}]})})});
 assert.equal(walking[0].sections[0].mode,'WALK');
 assert.equal(walking[0].sections[0].walkSeconds,420);
 assert.equal(Math.ceil(walking[0].sections[0].walkSeconds/60),7);
 const malformed=await swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>({connections:[null,{from:{departure:'invalid'},to:{arrival:'2026-12-01T10:00:00+01:00'}},{from:{departure:'2026-12-01T11:00:00+01:00'},to:{arrival:'2026-12-01T10:00:00+01:00'}}]})})});
 assert.equal(malformed.length,0);
 assert.equal(malformed.diagnostic.received,3);
 assert.equal(malformed.diagnostic.valid,0);
 assert.equal(malformed.diagnostic.status,'success');
 assert.equal(swiss.lastCheck.received,3);
 assert.equal(swiss.lastCheck.valid,0);
 assert.equal(swiss.lastCheck.status,'success');
 await assert.rejects(()=>swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',fetcher:async()=>({ok:false,status:503})}),/503/);
 assert.equal(swiss.lastCheck.status,'error');
 await assert.rejects(()=>swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>({unexpected:true})})}),/invalide/);
 assert.equal(swiss.lastCheck.status,'invalid_response');
 assert.equal(swiss.lastCheck.received,0);
 assert.equal(swiss.lastCheck.valid,0);
 assert.ok(Number.isFinite(Date.parse(swiss.lastCheck.checkedAt)));
 let resolveFirst;
 const first = swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',fetcher:()=>new Promise(resolve=>{resolveFirst=resolve;})});
 const second = await swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>({connections:[]})})});
 assert.equal(second.diagnostic.received,0);
 resolveFirst({ok:true,json:async()=>({connections:[{from:{departure:'2026-12-01T10:10:00+01:00'},to:{arrival:'2026-12-01T10:50:00+01:00'}}]})});
 const firstResults = await first;
 assert.equal(firstResults.diagnostic.received,1);
 assert.equal(firstResults.diagnostic.valid,1);
 assert.equal(second.diagnostic.received,0);
 const originalFetch=globalThis.fetch;
 try {
   globalThis.fetch=undefined;
   await assert.rejects(()=>swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00'}),/Réseau indisponible/);
   assert.equal(swiss.lastCheck.status,'error');
   assert.equal(swiss.lastCheck.received,0);
 } finally {
   globalThis.fetch=originalFetch;
 }
 const oversized=await swiss.plan({from:'Genève',to:'Lausanne',when:'2026-12-01T10:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>({connections:Array.from({length:120},()=>({from:{departure:'2026-12-01T10:10:00+01:00'},to:{arrival:'2026-12-01T10:50:00+01:00'}}))})})});
 assert.equal(oversized.length,100);
 assert.equal(oversized.diagnostic.received,120);
 assert.equal(oversized.diagnostic.valid,100);
 console.log('Swiss transport adapter: URL, timezones, walking and response assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
