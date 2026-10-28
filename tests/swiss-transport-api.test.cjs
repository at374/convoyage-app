/* Deterministic browser/Node adapter checks; no live API requests. */
const assert = require('node:assert/strict');
const swiss = require('../swiss-transport-api.js');
assert.equal(swiss.point({lat:46.2044,lon:6.1432}),'46.2044,6.1432');
assert.equal(swiss.point({lat:0,lon:0}),null);
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
 console.log('Swiss transport adapter: 11 assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
