const {test}=require('node:test'),assert=require('node:assert/strict');
const api=require('../transport-tripgo'),f=require('./fixtures/tripgo-annecy-grenoble-2026-10-31.json');
const options={from:{lat:45.9019,lon:6.1218},to:{lat:45.1914,lon:5.7143},when:'2026-11-02T10:00:00+01:00'};
const clone=()=>JSON.parse(JSON.stringify(f.response));
test('recorded TripGo response finds BlaBlaCar Bus and FlixBus, excludes past departures and preserves missing evidence',()=>{
 const r=api.parse(clone(),options);assert.equal(r.itineraries.length,2);
 assert.equal(r.itineraries[0].legs[1].line,'BlaBlaCar Bus');assert.equal(r.itineraries[1].legs[1].line,'FlixBus 1789');
 assert.equal(r.itineraries[0].legs[1].serviceTripId,'1298787731');assert.equal(r.itineraries[0].legs[1].provider,'BlaBlaCar Bus');
 for(const t of r.itineraries){assert.equal(t.priceEUR,null);assert.equal(t.transportConfirmed,false);assert.equal(t.accessVerified,false);assert.equal(t.evidence.realtimeReported,false);assert.equal(t.evidence.walkingProvided,true);assert.equal(t.evidence.endpointCoordinatesMatched,true);assert.equal(t.evidence.missing.length,4);}
});
test('TripGo rejects a mismatched query, missing template, unavailable trip and overlapping segments',()=>{
 const other=clone();other.query.from.lat+=0.01;assert.throws(()=>api.parse(other,options),/autre recherche/);
 for(const change of [d=>d.segmentTemplates=[],d=>d.groups[0].trips.forEach(t=>t.availability='UNAVAILABLE'),d=>d.groups[0].trips.forEach(t=>t.segments[1].startTime=t.depart-1),d=>d.segmentTemplates.filter(t=>t.type==='scheduled').forEach(t=>t.from.lat+=0.01)]){
  const data=clone();change(data);assert.equal(api.parse(data,options).itineraries.length,0);
 }
});
test('TripGo keeps mission deadline, endpoint gaps and transport mode restrictions conservative',()=>{
 assert.equal(api.parse(clone(),{...options,latestArrival:'2026-11-02T11:42:33+01:00'}).itineraries.length,0);
 assert.equal(api.parse(clone(),{...options,latestArrival:'2026-11-02T11:42:34+01:00'}).itineraries.length,1);
 const shifted=clone();shifted.segmentTemplates.forEach(t=>{if(t.to?.class==='Location')t.to.lat+=0.01;});assert.equal(api.parse(shifted,options).itineraries.length,0);
 const ferries=clone();ferries.segmentTemplates.forEach(t=>{if(t.type==='scheduled')t.modeInfo.identifier='pt_pub_ferry';});assert.equal(api.parse(ferries,options).itineraries.length,0);
});
test('TripGo sends its key only to the official HTTPS endpoint in a header and caches the response for the same query',async()=>{
 let calls=0;const key='a'.repeat(32),fetcher=async(url,init)=>{calls++;const u=new URL(url);assert.equal(u.origin,'https://api.tripgo.com');assert.equal(url.includes(key),false);assert.equal(init.headers['X-TripGo-Key'],key);assert.equal(init.credentials,'omit');assert.equal(init.referrerPolicy,'no-referrer');return new Response(JSON.stringify(clone()));};
 const r=await api.plan({...options,apiKey:key,fetcher});assert.equal(r.itineraries.length,2);
 await api.plan({...options,apiKey:key,fetcher});assert.equal(calls,1);
 await api.plan({...options,apiKey:key,fetcher,refresh:true});assert.equal(calls,2);
});
test('cancelled and failed TripGo searches never become cached successes',async()=>{
 const key='b'.repeat(32),c=new AbortController();let finish,calls=0;
 const fetcher=async()=>{calls++;return new Promise(resolve=>{finish=()=>resolve(new Response(JSON.stringify(clone())));});};
 const p=api.plan({...options,apiKey:key,fetcher,signal:c.signal});c.abort();finish();await assert.rejects(p,{name:'AbortError'});
 const next=api.plan({...options,apiKey:key,fetcher});finish();await next;assert.equal(calls,2);
 const signal=new AbortController();signal.abort();await assert.rejects(api.plan({...options,apiKey:key,fetcher,signal:signal.signal}),{name:'AbortError'});
 await assert.rejects(api.plan({...options,apiKey:'invalid',fetcher}),/Clé/);
});

test('TripGo preserves provider alerts, rejects impossible dates and bounds declared response sizes',async()=>{
 const data=clone();data.alerts=[{title:'Perturbation publiée'}];
 assert.equal(api.parse(data,options).itineraries[0].alerts[0],'Perturbation publiée');
 assert.throws(()=>api.parse(data,{...options,when:'2026-02-30T10:00:00Z'}),/Fenêtre/);
 await assert.rejects(api.plan({...options,apiKey:'c'.repeat(32),fetcher:async()=>new Response('{}',{headers:{'content-length':'2000001'}})}),/trop grande/);
});

test('Agenda pickup requires a five-minute arrival buffer at the exact destination',()=>{
 const pickup=Date.parse('2026-11-02T11:47:34+01:00');
 const deadline=new Date(pickup-5*60000).toISOString();
 const onTime=api.parse(clone(),{...options,latestArrival:deadline});
 assert.equal(onTime.itineraries.length,1,'arrival exactly five minutes before pickup is permitted');
 const earlierPickup=new Date(pickup-1000);
 const tooLate=api.parse(clone(),{...options,latestArrival:new Date(earlierPickup-5*60000).toISOString()});
 assert.equal(tooLate.itineraries.length,0,'arrival with less than five minutes is rejected');
});

test('TripGo transport legs are chronological and bounded by the displayed itinerary',()=>{
 const journeys=api.parse(clone(),options).itineraries;
 assert.ok(journeys.length>0);
 for(const journey of journeys){
  assert.equal(journey.legs[0].departure,journey.departure);
  assert.equal(journey.legs.at(-1).arrival,journey.arrival);
  for(let i=0;i<journey.legs.length;i++){
   const leg=journey.legs[i];
   assert.ok(Date.parse(leg.arrival)>=Date.parse(leg.departure));
   if(i>0)assert.ok(Date.parse(leg.departure)>=Date.parse(journey.legs[i-1].arrival));
  }
 }
});

test('TripGo rejects impossible connection windows without contacting the provider',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;return new Response(JSON.stringify(clone()));};
 await assert.rejects(api.plan({...options,apiKey:'d'.repeat(32),fetcher,latestArrival:'2026-11-02T09:59:59+01:00'}),/Requête TripGo invalide/);
 await assert.rejects(api.plan({...options,apiKey:'d'.repeat(32),fetcher,latestArrival:'not-a-date'}),/Requête TripGo invalide/);
 await assert.rejects(api.plan({...options,apiKey:'d'.repeat(32),fetcher,arriveBy:true,latestArrival:'2026-11-02T10:00:01+01:00'}),/Requête TripGo invalide/);
 assert.equal(calls,0);
});

test('Arrive-by pickup search may specify an earlier arrival deadline',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;return new Response(JSON.stringify(clone()));};
 const when='2026-11-02T11:47:34+01:00';
 const latestArrival='2026-11-02T11:42:34+01:00';
 const response=clone();response.query.arrive=when;delete response.query.depart;
 const matched=await api.plan({...options,apiKey:'e'.repeat(32),fetcher:async()=>{calls++;return new Response(JSON.stringify(response));},arriveBy:true,when,latestArrival});
 assert.equal(calls,1,'valid arrive-by windows must reach TripGo even when deadline precedes pickup');
 assert.equal(matched.itineraries.length,2);
 assert.ok(matched.itineraries.every(it=>Date.parse(it.arrival)<=Date.parse(latestArrival)));
});

test('TripGo missing request options return a controlled validation error',async()=>{
 await assert.rejects(api.plan(),/Requête TripGo invalide/);
 await assert.rejects(api.plan(null),/Requête TripGo invalide/);
 await assert.rejects(api.plan('invalid'),/Requête TripGo invalide/);
});
