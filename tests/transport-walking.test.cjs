const {test}=require('node:test');
const assert=require('node:assert/strict');
const w=require('../transport-walking.js');
const official=require('./fixtures/valhalla-annecy-pedestrian-2026-10-30.json');
const from={lat:45.901,lon:6.121},to={lat:45.902,lon:6.121};
function encode(points){let previous=[0,0],out='';
 for(const p of points){const next=[Math.round(p.lat*1e6),Math.round(p.lon*1e6)];
  for(let i=0;i<2;i++){const delta=next[i]-previous[i];let value=delta<0?-delta*2-1:delta*2;while(value>=32){out+=String.fromCharCode((value%32|32)+63);value=Math.floor(value/32);}out+=String.fromCharCode(value+63);}previous=next;
 }return out;}
function response(a=from,b=to){return {trip:{status:0,units:'kilometers',summary:{time:80,length:0.111,has_ferry:false},legs:[{summary:{time:80,length:0.111,has_ferry:false},shape:encode([a,b]),maneuvers:[{travel_mode:'pedestrian',travel_type:'foot'}]}]}};}
function calculated(a,b,seconds=60,matched=true){return {status:'calculated',from:a,to:b,durationSeconds:seconds,distanceMeters:100,endpointsMatched:matched,startGapMeters:0,endGapMeters:0};}
test('official Annecy response yields a calculated path and preserves the unmatched endpoint gap',()=>{
 const [a,b]=official.request.locations;
 const route=w.validateValhalla(official.response,a,b);
 assert.equal(route.durationSeconds,180.539);assert.equal(route.distanceMeters,260);
 assert.ok(route.geometry.length>2);assert.ok(route.endGapMeters>10&&route.endGapMeters<50);
 assert.equal(route.endpointsMatched,false);assert.equal(route.realWorldAccessConfirmed,false);
});
test('strict pedestrian validation rejects car/ferry routes, missing metrics, shifted and malformed geometry',()=>{
 assert.equal(w.validateValhalla(response(),from,to).endpointsMatched,true);
 const wrongs=[];
 let item=response();item.trip.legs[0].maneuvers[0].travel_mode='drive';wrongs.push(item);
 item=response();item.trip.summary.has_ferry=true;wrongs.push(item);
 item=response();item.trip.summary.time=null;wrongs.push(item);
 item=response();item.trip.units='miles';wrongs.push(item);
 item=response();item.trip.legs[0].shape='~~~~~~~';wrongs.push(item);
 item=response();item.trip.legs[0].shape=encode([{lat:0,lon:0},{lat:0.001,lon:0}]);wrongs.push(item);
 item=response();item.trip.summary.length=0;item.trip.legs[0].summary.length=0;wrongs.push(item);
 item=response();item.trip.summary.time=2;item.trip.legs[0].summary.time=2;wrongs.push(item);
 for(const wrong of wrongs)assert.throws(()=>w.validateValhalla(wrong,from,to));
 for(const shape of ['',null,'?','~~~~~~~~~~~~~~~'])assert.throws(()=>w.decodePolyline(shape));
});
test('deduplicates directed requests and enforces the admitted-request budget',async t=>{
 const urls=[];const router=w.createRouter({intervalMs:0,maxRequests:1,fetcher:async(url,options)=>{
  urls.push(url);assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-cache');
  const body=JSON.parse(new URL(url).searchParams.get('json'));assert.equal(body.costing,'pedestrian');
  assert.deepEqual(body.locations,[from,to]);return new Response(JSON.stringify(response()));
 }});t.after(()=>router.dispose());
 const rows=await Promise.all([router.route({...from,missionId:'private'},{...to,stopId:'public-stop'}),router.route({...from},{...to})]);
 assert.equal(urls.length,1);assert.strictEqual(rows[0],rows[1]);assert.equal(rows[0].status,'calculated');
 assert.equal((await router.route(to,from)).status,'budget_exceeded');
});
test('deadline and circuit breaker return unknown even when fetch ignores cancellation',async t=>{
 const router=w.createRouter({intervalMs:0,timeoutMs:10,maxFailures:1,fetcher:()=>new Promise(()=>{})});t.after(()=>router.dispose());
 assert.equal((await router.route(from,to)).status,'unavailable');
 assert.equal((await router.route(to,from)).status,'unavailable');assert.equal(router.stats().requests,1);
});
test('dispose settles the active and queued routes without issuing another request',async()=>{
 let calls=0;const router=w.createRouter({intervalMs:0,fetcher:()=>{calls++;return new Promise(()=>{});}});
 const first=router.route(from,to),queued=router.route(to,from);router.dispose();
 const rows=await Promise.all([first,queued]);assert.ok(rows.every(r=>r.status==='cancelled'));assert.equal(calls,1);
});
test('serialized requests respect the interval and reject oversized responses',async t=>{
 const starts=[];const router=w.createRouter({intervalMs:20,fetcher:async()=>{
  starts.push(Date.now());return new Response('x',{headers:{'content-length':'9999999'}});
 }});t.after(()=>router.dispose());
 await Promise.all([router.route(from,to),router.route(to,from)]);
 assert.equal(starts.length,2);assert.ok(starts[1]-starts[0]>=15);
 assert.throws(()=>w.createRouter({endpoint:'http://example.org/route'}));
 assert.throws(()=>w.createRouter({endpoint:'https://user:secret@example.org/route'}));
});
function journey(){return {departure:'2026-11-02T10:00:00Z',arrival:'2026-11-02T11:00:00Z',originStop:to,destinationStop:from};}
test('compares access and egress with mission windows without changing confirmation flags',()=>{
 const row=journey(),task={from,to,earliestDeparture:'2026-11-02T09:59:00Z',latestArrival:'2026-11-02T11:31:00Z'};
 const walks={access:calculated(from,to),egress:calculated(from,to),transfer:{status:'not_required'}};
 const fit=w.assessJourney(row,task,walks);assert.equal(fit.status,'fits_calculated_walks');
 assert.equal(fit.realizable,false);assert.equal(fit.serviceConfirmed,false);assert.equal(fit.accessVerified,false);
 assert.equal(w.assessJourney(row,{...task,earliestDeparture:'2026-11-02T09:59:01Z'},walks).status,'departure_too_early');
 assert.equal(w.assessJourney(row,{...task,latestArrival:'2026-11-02T11:30:59Z'},walks).status,'arrival_too_late');
 assert.equal(w.assessJourney(row,{...task,marginMinutes:-1},walks).status,'unknown');
 assert.equal(w.assessJourney(row,{...task,latestArrival:'2026-11-02T11:31:00'},walks).status,'unknown');
});
test('requires endpoint matches, rejects unrelated evidence and includes the interchange buffer',()=>{
 const row={...journey(),interNetwork:true,transferStop:from,transferDestinationStop:to,
  legs:[{departure:'2026-11-02T10:00:00Z',arrival:'2026-11-02T10:10:00Z'},{departure:'2026-11-02T10:16:00Z',arrival:'2026-11-02T11:00:00Z'}]};
 const task={from,to},walks={access:calculated(from,to),egress:calculated(from,to),transfer:calculated(from,to,60)};
 assert.equal(w.assessJourney(row,task,walks).status,'fits_calculated_walks');
 row.legs[1].departure='2026-11-02T10:15:59Z';assert.equal(w.assessJourney(row,task,walks).status,'transfer_too_short');
 row.legs[1].departure='2026-11-02T10:16:00Z';walks.transfer.endpointsMatched=false;
 assert.equal(w.assessJourney(row,task,walks).status,'partial');
 walks.transfer=calculated(to,from);assert.equal(w.assessJourney(row,task,walks).status,'partial');
 row.legs[1].departure='invalid';assert.equal(w.assessJourney(row,task,walks).status,'unknown');
});
test('journey checks request the interchange first and never infer a zero-time same-stop walk',async()=>{
 const calls=[];const router={route:async(a,b)=>{calls.push([a,b]);return calculated(a,b);}};
 const row={...journey(),interNetwork:true,transferStop:from,transferDestinationStop:to,legs:[{departure:'2026-11-02T10:00:00Z',arrival:'2026-11-02T10:10:00Z'},{departure:'2026-11-02T10:30:00Z',arrival:'2026-11-02T11:00:00Z'}]};
 const answer=await w.checkJourney(router,row,{from,to});assert.deepEqual(calls[0],[from,to]);assert.equal(answer.walks.transfer.status,'calculated');
 row.interNetwork=false;const intra=await w.checkJourney(router,row,{from,to});assert.equal(intra.walks.transfer.status,'same_stop_unverified');assert.equal(intra.status,'partial');
});

test('a route-specific rejection does not block another pedestrian pair',async t=>{
 let calls=0;const router=w.createRouter({intervalMs:0,maxFailures:1,fetcher:async()=>++calls===1?
  new Response('no route',{status:400}):new Response(JSON.stringify(response(to,from)))});t.after(()=>router.dispose());
 assert.equal((await router.route(from,to)).status,'route_unavailable');
 assert.equal((await router.route(to,from)).status,'calculated');assert.equal(router.stats().failures,0);
});

test('a provider rate limit stops queued requests and is retained across router instances',async()=>{
 let calls=0;const options={endpoint:'https://rate-limited.example/route',intervalMs:0,fetcher:async()=>{calls++;return new Response('slow down',{status:429,headers:{'retry-after':'60'}});}};
 const router=w.createRouter(options);const results=await Promise.all([router.route(from,to),router.route(to,from)]);
 assert.ok(results.every(r=>r.status==='rate_limited'));assert.equal(calls,1);router.dispose();
 const next=w.createRouter(options);assert.equal((await next.route(from,to)).status,'rate_limited');assert.equal(calls,1);next.dispose();
});

test('address-level times require a complete coordinate-bound approach or exit path independently',()=>{
 const row=journey(),task={from,to},walks={access:calculated(from,to,90.5),egress:calculated(from,to,121.25)};
 const complete=w.assessJourney(row,task,walks);
 assert.equal(complete.doorDeparture,'2026-11-02T09:58:29.500Z');
 assert.equal(complete.doorArrival,'2026-11-02T11:02:01.250Z');
 walks.access.endpointsMatched=false;
 const missingStart=w.assessJourney(row,task,walks);
 assert.equal(missingStart.doorDeparture,null);assert.equal(missingStart.doorArrival,complete.doorArrival);
 walks.access=calculated(to,from);walks.egress.endpointsMatched=false;
 const incomplete=w.assessJourney(row,task,walks);
 assert.equal(incomplete.doorDeparture,null);assert.equal(incomplete.doorArrival,null);
 assert.equal(incomplete.realizable,false);assert.equal(incomplete.status,'partial');
});
