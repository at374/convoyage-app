const {test}=require('node:test'),assert=require('node:assert/strict');
const api=require('../transport-tripgo'),f=require('./fixtures/tripgo-annecy-grenoble-2026-10-31.json');
const options={from:{lat:45.9019,lon:6.1218},to:{lat:45.1914,lon:5.7143},when:'2026-11-02T10:00:00+01:00'};
const clone=()=>JSON.parse(JSON.stringify(f.response));
test('recorded TripGo response finds BlaBlaCar Bus and FlixBus, excludes past departures and preserves missing evidence',()=>{
 const r=api.parse(clone(),options);assert.equal(r.itineraries.length,2);
 assert.equal(r.itineraries[0].legs[1].line,'BlaBlaCar Bus');assert.equal(r.itineraries[1].legs[1].line,'FlixBus 1789');
 assert.equal(r.itineraries[0].legs[1].serviceTripId,'1298787731');
 assert.equal(r.coverage.blablacarBusFound,true);
 assert.equal(r.coverage.blablacarRideshareVerified,false);
 assert.equal(r.coverage.publicTransportOnly,true);
 assert.equal(r.coverage.providers.includes('BlaBlaCar Bus'),true);
 assert.deepEqual(r.coverage.transportTypes,['bus']);
 assert.equal(r.coverage.pedestrianGeometryAvailable+r.coverage.pedestrianGeometryMissing,
  r.itineraries.flatMap(t=>t.legs).filter(leg=>leg.mode==='wa_wal').length);
 assert.equal(r.itineraries[0].legs[1].transportType,'bus');assert.equal(r.itineraries[0].legs[1].provider,'BlaBlaCar Bus');
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
 await assert.rejects(api.plan({apiKey:'invalid',when:'invalid'}),/Requête TripGo invalide/);
});

test('Return transport cannot depart before vehicle delivery is completed',()=>{
 const delivery='2026-11-02T10:00:00+01:00';
 const journeys=api.parse(clone(),{...options,when:delivery}).itineraries;
 assert.ok(journeys.length>0);
 assert.ok(journeys.every(it=>Date.parse(it.departure)>=Date.parse(delivery)));
 const lateDelivery='2026-11-02T15:00:00+01:00';
 const lateResponse=clone();lateResponse.query.depart=lateDelivery;
 const afterLastDeparture=api.parse(lateResponse,{...options,when:lateDelivery});
 assert.equal(afterLastDeparture.itineraries.length,0,'no service should be suggested when every recorded departure has already passed');
});

test('TripGo rejects an arrive-by pickup deadline later than the requested arrival before contacting provider',async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;return new Response(JSON.stringify(clone()));};
 await assert.rejects(api.plan({...options,arriveBy:true,latestArrival:'2026-11-02T10:00:01+01:00',apiKey:'f'.repeat(32),fetcher}),/Requête TripGo invalide/);
 assert.equal(calls,0);
});

test('TripGo excludes itineraries with unsafe transfer times and disconnected stops',()=>{
 const overlap=clone();
 const trip=overlap.groups[0].trips.find(t=>t.depart*1000>=Date.parse(options.when)&&t.segments.length>1);
 assert.ok(trip,'a future itinerary must be selected to exercise the regression');
 trip.segments[1].startTime=trip.segments[0].endTime-1;
 const overlapping=api.parse(overlap,options);
 assert.equal(overlapping.itineraries.length,1,'the altered eligible trip is removed while the independent future service remains');
 assert.equal(overlapping.itineraries[0].legs[1].line,'FlixBus 1789','the independent later bus must remain available');
 const disconnected=clone();
 disconnected.segmentTemplates.forEach(t=>{if(t.type==='scheduled'&&t.from)t.from.lat+=0.01;});
 assert.equal(api.parse(disconnected,options).itineraries.length,0);
 const missingTransfer=clone();
 missingTransfer.groups[0].trips.forEach(t=>{if(t.depart*1000>=Date.parse(options.when))t.segments[1].startTime=t.segments[0].endTime-60;});
 assert.equal(api.parse(missingTransfer,options).itineraries.length,0,'all eligible journeys with overlapping boarding transfers must be rejected');
});

test('TripGo parser refuses contradictory mission windows even for cached or fixture responses',()=>{
 assert.throws(()=>api.parse(clone(),{...options,latestArrival:'2026-11-02T09:59:59+01:00'}),/Fenêtre TripGo invalide/);
 assert.throws(()=>api.parse(clone(),{...options,arriveBy:true,latestArrival:'2026-11-02T10:00:01+01:00'}),/Fenêtre TripGo invalide/);
});

test('TripGo rejects zero-duration scheduled vehicle rides while preserving independent services',()=>{
 const data=clone();
 const eligible=data.groups[0].trips.find(t=>t.depart*1000>=Date.parse(options.when)&&t.segments.length>1);
 assert.ok(eligible);
 eligible.segments[1].endTime=eligible.segments[1].startTime;
 const results=api.parse(data,options).itineraries;
 assert.equal(results.length,1,'an impossible instantaneous vehicle ride must not appear');
 assert.equal(results[0].legs[1].line,'FlixBus 1789');
});

test('TripGo rejects walking teleportation even when the provider omits metres',()=>{
 const data=clone();
 const eligible=data.groups[0].trips.find(t=>t.depart*1000>=Date.parse(options.when)&&t.segments.length>1);
 assert.ok(eligible);
 const walk=eligible.segments[0];
 const template=data.segmentTemplates.find(s=>s.hashCode===walk.segmentTemplateHashCode);
 assert.equal(template.modeIdentifier,'wa_wal');
 delete template.metres;
 walk.endTime=walk.startTime;
 const results=api.parse(data,options).itineraries;
 assert.equal(results.length,1,'a zero-second walk between different coordinates must be excluded');
 assert.equal(results[0].legs[1].line,'FlixBus 1789');
});

test('TripGo rejects stationary transfers that silently teleport between stops',()=>{
 const data=clone();
 const eligible=data.groups[0].trips.find(t=>t.depart*1000>=Date.parse(options.when)&&t.segments.length>1);
 assert.ok(eligible);
 const ref=eligible.segments[0];
 const template=data.segmentTemplates.find(s=>s.hashCode===ref.segmentTemplateHashCode);
 // Replace a valid walking segment with an alleged stationary transfer without changing its geometry.
 template.modeIdentifier='stationary_transfer';
 const results=api.parse(data,options).itineraries;
 assert.equal(results.length,1,'the disconnected stationary transfer must be rejected');
 assert.equal(results[0].legs[1].line,'FlixBus 1789');
});

test('TripGo rejects impossible timezone offsets before provider access',async()=>{
 let calls=0;
 for(const when of ['2026-11-02T10:00:00+25:00','2026-11-02T10:00:00+01:99','2026-11-02T10:00:00-24:00']){
  assert.throws(()=>api.parse(clone(),{...options,when}),/Fenêtre TripGo invalide/);
  await assert.rejects(api.plan({...options,when,apiKey:'g'.repeat(32),fetcher:async()=>{calls++;return new Response(JSON.stringify(clone()));}}),/Requête TripGo invalide/);
 }
 assert.equal(calls,0);
});

test('malformed provider entries do not crash TripGo parsing or hide independent valid services',()=>{
 const invalidTemplate=clone();invalidTemplate.segmentTemplates.push(null);
 assert.throws(()=>api.parse(invalidTemplate,options),/Modèle TripGo invalide/);
 const invalidGroup=clone();invalidGroup.groups.push(null);
 assert.throws(()=>api.parse(invalidGroup,options),/Groupe TripGo invalide/);
 const invalidTrip=clone();invalidTrip.groups[0].trips.unshift(null);
 assert.equal(api.parse(invalidTrip,options).itineraries.length,2);
 const invalidSegment=clone();
 const eligible=invalidSegment.groups[0].trips.find(t=>t.depart*1000>=Date.parse(options.when));
 eligible.segments[0]=null;
 const remaining=api.parse(invalidSegment,options).itineraries;
 assert.equal(remaining.length,1);
 assert.equal(remaining[0].legs[1].line,'FlixBus 1789');
});

test('TripGo never suggests an explicitly cancelled itinerary even if availability remains AVAILABLE',()=>{
 for(const field of ['cancelled','canceled']){
  const data=clone();
  const eligible=data.groups[0].trips.find(t=>t.depart*1000>=Date.parse(options.when)&&t.segments.length>1);
  assert.ok(eligible);
  eligible[field]=true;
  const results=api.parse(data,options).itineraries;
  assert.equal(results.length,1);
  assert.equal(results[0].legs[1].line,'FlixBus 1789');
 }
});

test('TripGo ignores a journey with a non-string mode without hiding other available buses',()=>{
 for(const invalid of [123,{},[],true]){
  const data=clone();
  const eligible=data.groups[0].trips.find(t=>t.depart*1000>=Date.parse(options.when)&&t.segments.length>1);
  assert.ok(eligible);
  const template=data.segmentTemplates.find(s=>s.hashCode===eligible.segments[1].segmentTemplateHashCode);
  assert.ok(template);
  template.modeIdentifier=invalid;
  const results=api.parse(data,options).itineraries;
  assert.equal(results.length,1,'invalid mode must reject only its journey');
  assert.equal(results[0].legs[1].line,'FlixBus 1789');
 }
});

test('BlaBlaCar Bus and FlixBus use fixed official price-search links without assigning a fare',()=>{
 const {itineraries}=api.parse(clone(),options);
 const [blabla,flix]=itineraries.map(journey=>journey.legs.find(leg=>api.coachFareSearch(leg)));
 assert.deepEqual(api.coachFareSearch(blabla),{label:'BlaBlaCar Bus',url:'https://www.blablacar.fr/bus/routes/annecy-2/grenoble-2'});
 const link=api.coachFareSearch({...flix,ticketWebsiteURL:'https://untrusted.invalid/'});
 assert.equal(link.label,'FlixBus');
 const search=new URL(link.url);
 assert.equal(search.origin,'https://shop.flixbus.fr');
 assert.equal(search.pathname,'/search');
 assert.equal(search.searchParams.get('rideDate'),'02.11.2026');
 assert.equal(search.searchParams.get('adult'),'1');
 assert.equal(new URL(api.coachFareSearch({...flix,departure:'2026-11-02T23:30:00Z'}).url).searchParams.get('rideDate'),'03.11.2026');
 assert.equal(api.coachFareSearch({...flix,from:'Lyon Saint-Exupéry Aéroport'}).url,'https://shop.flixbus.fr/');
 assert.equal(api.coachFareSearch({...blabla,from:'Gare routière'}).url,'https://www.blablacar.fr/bus');
 assert.equal(api.coachFareSearch({...blabla,provider:'BlaBlaCar'}),null);
 assert.equal(api.coachFareSearch({...flix,mode:'wa_wal'}),null);
 assert.ok(itineraries.every(journey=>journey.priceEUR===null));
});

test('TripGo keeps an operator even when its itinerary falls after the first ten',()=>{
 const data=clone();
 const trips=data.groups.flatMap(group=>group.trips);
 const template=trip=>trip.segments.some(segment=>segment.externalData?.operatorName==='BlaBlaCar Bus');
 const blabla=trips.find(trip=>template(trip)&&trip.depart>=Date.parse(options.when)/1000);
 const flix=trips.find(trip=>trip.segments.some(segment=>segment.externalData?.operatorName==='FlixBus-eu')&&trip.depart>=Date.parse(options.when)/1000);
 assert.ok(blabla&&flix);
 data.groups[0].trips=Array.from({length:12},(_,i)=>{
  const trip=structuredClone(blabla);
  trip.depart+=i;trip.arrive+=i;
  for(const segment of trip.segments){segment.startTime+=i;segment.endTime+=i;}
  return trip;
 }).concat(flix);
 data.groups=data.groups.slice(0,1);
 const found=api.parse(data,options).itineraries;
 assert.equal(found.length,13);
 assert.equal(api.coachFareSearch(found.at(-1).legs.find(leg=>leg.provider==='FlixBus-eu')).label,'FlixBus');
});

test('identical stop times and route labels from distinct carriers stay separate',()=>{
 const data=clone();
 const original=data.groups.flatMap(group=>group.trips).find(trip=>
  trip.segments.some(segment=>segment.externalData?.operatorName==='BlaBlaCar Bus'));
 const another=structuredClone(original);
 another.segments.find(segment=>segment.externalData?.operatorName==='BlaBlaCar Bus').externalData.operatorName='FlixBus-eu';
 data.groups=[{trips:[original,structuredClone(original),another]}];
 const found=api.parse(data,options).itineraries;
 assert.equal(found.length,2);
 assert.deepEqual(found.map(journey=>journey.legs.find(leg=>api.coachFareSearch(leg)).provider),
  ['BlaBlaCar Bus','FlixBus-eu']);
});

test('recorded coach journeys supply separate pedestrian and vehicle geometries',()=>{
 const {itineraries}=api.parse(clone(),options);
 for(const journey of itineraries){
  assert.ok(journey.legs[0].geometry.length>2);
  assert.ok(journey.legs.at(-1).geometry.length>2);
  assert.ok(journey.legs.find(leg=>api.coachFareSearch(leg)).geometry.length>=2);
 }
 const corrupt=clone();
 for(const template of corrupt.segmentTemplates){
  if(template.modeIdentifier==='wa_wal')template.streets=[{encodedWaypoints:'????'}];
 }
 const malformed=api.parse(corrupt,options).itineraries;
 assert.equal(malformed.length,itineraries.length);
 assert.equal(malformed[0].legs[0].geometry,null);
});

test('TripGo reports train only when its actual mode identifier is rail',()=>{
 const rail=clone();
 for(const segment of rail.segmentTemplates)if(segment.modeIdentifier==='pt_pub')
  segment.modeInfo.identifier='pt_pub_train';
 const result=api.parse(rail,options);
 assert.equal(result.itineraries.length,2);
 assert.deepEqual(result.coverage.transportTypes,['train']);
 assert.equal(result.itineraries[0].legs[1].transportType,'train');
 const unknown=clone();
 for(const segment of unknown.segmentTemplates)if(segment.modeIdentifier==='pt_pub')
  segment.modeInfo.identifier='pt_pub_unknown';
 const other=api.parse(unknown,options);
 assert.deepEqual(other.coverage.transportTypes,['transport_public_non_classe']);
});
