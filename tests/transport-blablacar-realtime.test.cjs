const {test}=require('node:test'),assert=require('node:assert/strict');
const rt=require('../transport-blablacar-realtime'),tg=require('../transport-tripgo');
const fixture=require('./fixtures/blablacar-siri-2026-10-31.json'),trip=require('./fixtures/tripgo-blablacar-2026-10-31.json');
const future=require('./fixtures/tripgo-annecy-grenoble-2026-10-31.json');
const options={from:{lat:45.9019,lon:6.1218},to:{lat:45.1914,lon:5.7143},when:'2026-10-31T10:00:00+01:00'};
const journey=()=>tg.parse(trip.response,options).itineraries[0],clock=Date.parse(fixture.testNow),copy=()=>JSON.parse(JSON.stringify(fixture.response));
const feed=data=>rt.parse(data||copy(),{now:clock});
const current=(data,leg=journey().legs[1])=>rt.assess(feed(data),leg,{now:clock});
const calls=data=>data.estimatedJourneyVersionFrame[0].estimatedVehicleJourney[0].estimatedCalls.estimatedCall;
test('recorded operator data matches the same day, service, stops and planned times and proves observed operation only',()=>{
 const j=journey();assert.equal(j.legs[1].serviceShortName,'51981');
 const result=rt.assessJourney(feed(),j,options,{now:clock});
 assert.equal(result.updates[0].reference,'51981:2026-10-31');assert.equal(result.updates[0].status,'observed');assert.equal(result.serviceConfirmed,true);
 assert.equal(result.doorArrival,'2026-10-31T10:44:34.000Z');assert.equal(result.status,'fits_prediction');
 assert.equal(result.transportConfirmed,false);assert.equal(result.accessVerified,false);assert.equal(result.realizable,false);
});
test('another date, service, stop or planned time cannot reuse the operator observation',()=>{
 const later=tg.parse(future.response,{...options,when:'2026-11-02T10:00:00+01:00'}).itineraries[0];
 assert.equal(rt.assessJourney(feed(),later,{...options,when:'2026-11-02T10:00:00+01:00'},{now:clock}).updates[0].status,'not_matched');
 for(const change of [{serviceShortName:'51982'},{fromStopCode:'OTHER'},{toStopCode:'OTHER'},{departure:'2026-10-31T09:15:01Z'}])assert.equal(current(copy(),{...journey().legs[1],...change}).status,'not_matched');
});
test('expired, future-dated and unsuccessful feeds never establish current operation',()=>{
 const parsed=feed();assert.equal(rt.assess(parsed,journey().legs[1],{now:parsed.until}).status,'stale');
 assert.equal(rt.assess(feed(),journey().legs[1],{now:clock-60000}).status,'stale');
 const failed=copy();failed.status=false;assert.throws(()=>feed(failed),/invalide/);
});
test('cancellation, no-report and prediction-only states remain distinct',()=>{
 const cancelled=copy();cancelled.estimatedJourneyVersionFrame[0].estimatedVehicleJourney[0].cancellation=true;assert.equal(current(cancelled).status,'cancelled');
 const noReport=copy();calls(noReport).find(c=>c.stopPointRef.value==='XGE').arrivalStatus='NO_REPORT';assert.equal(current(noReport).status,'no_prediction');
 const prediction=copy();prediction.estimatedJourneyVersionFrame[0].estimatedVehicleJourney[0].recordedCalls.recordedCall=[];
 assert.equal(current(prediction).status,'predicted');assert.equal(current(prediction).serviceConfirmed,false);
});
test('operator delays include the final walk before checking the five-minute pickup deadline',()=>{
 const j=journey(),pickup=Date.parse('2026-10-31T10:49:34Z'),deadline=new Date(pickup-5*60000).toISOString();
 const task={...options,latestArrival:deadline};
 assert.equal(rt.assessJourney(feed(),j,task,{now:clock}).status,'fits_prediction');
 const delayed=copy();calls(delayed).find(c=>c.stopPointRef.value==='XGE').expectedArrivalTime='2026-10-31T10:42:01Z';
 assert.equal(rt.assessJourney(feed(delayed),j,task,{now:clock}).status,'arrival_too_late');
 assert.equal(rt.assessJourney(feed(),j,{...options,when:'2026-10-31T09:14:19Z'},{now:clock}).status,'missed_boarding');
});
test('conflicting same-time versions are ambiguous instead of choosing an arbitrary prediction',()=>{
 const data=copy(),second=JSON.parse(JSON.stringify(data.estimatedJourneyVersionFrame[0]));second.estimatedVehicleJourney[0].cancellation=true;data.estimatedJourneyVersionFrame.push(second);
 assert.equal(current(data).status,'ambiguous');
});
test('concurrent operator checks share a download and cancellation preserves remaining consumers',async()=>{
 let count=0,finish,networkSignal;const client=rt.createClient({now:()=>clock,fetcher:async(url,init)=>{
  assert.equal(url,rt.ENDPOINT);assert.equal(init.credentials,'omit');assert.equal(init.referrerPolicy,'no-referrer');assert.equal(init.headers['X-TripGo-Key'],undefined);
  count++;networkSignal=init.signal;return new Promise(resolve=>{finish=()=>resolve(new Response(JSON.stringify(copy())));});
 }});
 const a=new AbortController(),b=new AbortController(),first=client.check(journey(),options,{signal:a.signal}),second=client.check(journey(),options,{signal:b.signal});
 a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(networkSignal.aborted,false);finish();
 assert.equal((await second).serviceConfirmed,true);assert.equal(count,1);
 await client.check(journey(),options);assert.equal(count,1);
});
test('last consumer cancellation aborts the operator request and failures are held for thirty seconds',async()=>{
 let networkSignal;const c=new AbortController(),client=rt.createClient({now:()=>clock,fetcher:async(_,init)=>{networkSignal=init.signal;return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));}});
 const p=client.check(journey(),options,{signal:c.signal});c.abort();await assert.rejects(p,{name:'AbortError'});assert.equal(networkSignal.aborted,true);
 let requests=0;const offline=rt.createClient({now:()=>clock,fetcher:async()=>{requests++;throw Error('CORS unavailable');}});
 await assert.rejects(offline.check(journey(),options));await assert.rejects(offline.check(journey(),options));assert.equal(requests,1);
});
test('expired cached observations lose confirmation and stale responses are not repeatedly downloaded',async()=>{
 let now=clock,count=0;const client=rt.createClient({now:()=>now,fetcher:async()=>{count++;return new Response(JSON.stringify(copy()));}});
 assert.equal((await client.check(journey(),options)).serviceConfirmed,true);
 now=Date.parse(fixture.response.validUntil);
 const expired=await client.check(journey(),options);assert.equal(expired.serviceConfirmed,false);assert.equal(expired.updates[0].status,'stale');assert.equal(count,2);
 await client.check(journey(),options);assert.equal(count,2);
});
test('oversized operator responses are rejected and unsupported providers do not issue HTTP requests',async()=>{
 let count=0;const client=rt.createClient({now:()=>clock,fetcher:async()=>{count++;return new Response('{}',{headers:{'content-length':'2500001'}});}});
 assert.equal((await client.check({legs:[]},options)).status,'unsupported');assert.equal(count,0);
 await assert.rejects(client.check(journey(),options),/trop grand/);assert.equal(count,1);
});
