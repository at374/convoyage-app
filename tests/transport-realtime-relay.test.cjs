const {test}=require('node:test'),assert=require('node:assert/strict');
const {createRelay,PATH}=require('../server/transport-realtime-relay.cjs');
const rt=require('../transport-blablacar-realtime'),tg=require('../transport-tripgo');
const fixture=require('./fixtures/blablacar-siri-2026-10-31.json'),trip=require('./fixtures/tripgo-blablacar-2026-10-31.json');
const origin='https://app.example',clock=Date.parse(fixture.testNow),bytes=JSON.stringify(fixture.response);
const response=()=>new Response(bytes,{headers:{'Content-Type':'application/json'}});
async function setup(t,options={}){
 const server=createRelay({allowedOrigins:[origin],now:()=>clock,...options});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 return 'http://127.0.0.1:'+server.address().port;
}
test('relay enables only allowed origins and exposes a fixed read-only route',async t=>{
 let requests=0;const base=await setup(t,{fetcher:async()=>{requests++;return response();}});
 assert.equal((await fetch(base+'/health')).status,200);assert.equal(requests,0);
 const preflight=await fetch(base+PATH,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET'}});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 for(const [path,options,status] of [[PATH,{headers:{Origin:'https://other.example'}},403],[PATH+'?url=http://169.254.169.254/',{},400],['/other',{},404],[PATH,{method:'POST'},405]])assert.equal((await fetch(base+path,options)).status,status);
 assert.equal(requests,0);
 const result=await fetch(base+PATH,{headers:{Origin:origin}});assert.equal(result.status,200);
 assert.equal(result.headers.get('access-control-allow-origin'),origin);assert.equal(result.headers.get('cache-control'),'no-store');
 assert.match(result.headers.get('vary'),/Origin/);assert.equal(await result.text(),bytes);
});
test('relay shares upstream downloads and never forwards caller keys, cookies or authorization',async t=>{
 let requests=0,finish;
 const base=await setup(t,{fetcher:async(url,init)=>{
  requests++;assert.equal(url,rt.ENDPOINT);assert.equal(init.redirect,'error');assert.deepEqual(init.headers,{Accept:'application/json'});
  assert.equal(init.credentials,'omit');assert.equal(init.referrerPolicy,'no-referrer');
  return new Promise(resolve=>{finish=()=>resolve(response());});
 }});
 const first=fetch(base+PATH,{headers:{Origin:origin,Authorization:'private',Cookie:'private=1','X-TripGo-Key':'private'}}),second=fetch(base+PATH,{headers:{Origin:origin}});
 while(!finish)await new Promise(resolve=>setTimeout(resolve,5));finish();
 const results=await Promise.all([first,second]);assert(results.every(r=>r.status===200));assert.equal(requests,1);
 await fetch(base+PATH);assert.equal(requests,1);
});
test('an expired feed is never served from cache and failures stop repeated upstream calls',async t=>{
 let now=clock,requests=0;const base=await setup(t,{now:()=>now,fetcher:async()=>{requests++;return response();}});
 assert.equal((await fetch(base+PATH)).status,200);
 now=Date.parse(fixture.response.validUntil);assert.equal((await fetch(base+PATH)).status,503);assert.equal(requests,2);
 const unavailable=await fetch(base+PATH);assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('retry-after'),'30');assert.equal(requests,2);
 assert.equal((await unavailable.json()).error,'operator_feed_unavailable');
});
test('malformed, oversized and redirected upstream responses fail closed',async t=>{
 for(const upstream of [()=>new Response('bad',{headers:{'content-type':'application/json'}}),()=>new Response(bytes,{headers:{'content-type':'text/html'}}),()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'2500001'}}),()=>new Response('',{status:302,headers:{Location:'https://other.example'}})]){
  const base=await setup(t,{fetcher:async()=>upstream()});assert.equal((await fetch(base+PATH)).status,503);
 }
});
test('upstream timeout aborts the request without returning an operator confirmation',async t=>{
 let signal;const base=await setup(t,{timeoutMs:30,fetcher:async(_,init)=>{signal=init.signal;return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));}});
 const r=await fetch(base+PATH);assert.equal(r.status,503);assert.equal(signal.aborted,true);
});
test('relay rate limit applies to cached responses too',async t=>{
 const base=await setup(t,{maxRequestsPerMinute:2,fetcher:async()=>response()});
 assert.equal((await fetch(base+PATH)).status,200);assert.equal((await fetch(base+PATH,{method:'HEAD'})).status,200);
 const limited=await fetch(base+PATH);assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
});
test('configured client can verify an operator observation through the actual local HTTP relay',async t=>{
 const base=await setup(t,{fetcher:async()=>response()}),endpoint=base+PATH,client=rt.createClient({endpoint,now:()=>clock});
 const task={from:{lat:45.9019,lon:6.1218},to:{lat:45.1914,lon:5.7143},when:'2026-10-31T10:00:00+01:00'};
 const j=tg.parse(trip.response,task).itineraries[0],result=await client.check(j,task);
 assert.equal(result.transportEndpoint,endpoint);assert.equal(result.serviceConfirmed,true);assert.equal(result.transportConfirmed,false);assert.equal(result.doorArrival,'2026-10-31T10:44:34.000Z');
 for(const invalid of ['http://external.example'+PATH,'https://relay.example/other','https://key@relay.example'+PATH,'https://relay.example'+PATH+'?key=secret'])assert.throws(()=>rt.createClient({endpoint:invalid}),/Relais/);
});

test('public relay endpoint only permits standard HTTPS port',()=>{
 const accepted='https://relay.example'+PATH;
 assert.doesNotThrow(()=>rt.createClient({endpoint:accepted}));
 assert.doesNotThrow(()=>rt.createClient({endpoint:'https://relay.example:443'+PATH}));
 assert.throws(()=>rt.createClient({endpoint:'https://relay.example:8443'+PATH}),/Relais SIRI invalide/);
 assert.throws(()=>rt.createClient({endpoint:'https://relay.example:8080'+PATH}),/Relais SIRI invalide/);
 assert.doesNotThrow(()=>rt.createClient({endpoint:'http://127.0.0.1:18080'+PATH}));
});

test('relay URL validation rejects credentials, fragments and insecure remote schemes',()=>{
 for(const endpoint of [
  'http://relay.example'+PATH,
  'https://relay.example'+PATH+'#fragment',
  'https://relay.example'+PATH+'?token=secret',
  'https://user:password@relay.example'+PATH,
  'https://relay.example:9443'+PATH,
  'https://relay.example/health'
 ])assert.throws(()=>rt.createClient({endpoint}),/Relais SIRI invalide/);
 assert.doesNotThrow(()=>rt.createClient({endpoint:'https://relay.example'+PATH}));
});
