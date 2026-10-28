const test = require('node:test');
const assert = require('node:assert/strict');
const routing = require('../regional-routing.js');

const base = {
  endpoint: 'https://routing.example.org/otp/routers/default/index/graphql',
  from: {lat:45.899,lon:6.129},
  to: {lat:45.675,lon:6.393},
  departure: '2026-10-28T09:10:00Z'
};
const itinerary = {
  startTime: 1793179200000,
  endTime: 1793182800000,
  duration: 3600,
  walkDistance: 650,
  numberOfTransfers: 1,
  legs: [{
    mode:'BUS', startTime:1793179200000, endTime:1793182800000,
    from:{name:'Annecy'},to:{name:'Albertville'},
    route:{shortName:'Y51'},distance:42000
  }]
};
test('rejects missing coordinates and insecure routing endpoints', async () => {
  assert.equal(routing.validPoint({lat:null,lon:6.1}),false);
  assert.equal(routing.validPoint({lat:'',lon:6.1}),false);
  assert.equal(routing.validPoint({lat:45.9,lon:6.1}),true);
  await assert.rejects(routing.plan({...base,from:{lat:null,lon:6.1},fetcher:async()=>{}}),
    /Coordonnees/);
  await assert.rejects(routing.plan({...base,endpoint:'http://localhost:8080',fetcher:async()=>{}}),
    /HTTPS/);
});
test('queries OTP with France local date and preserves theoretical status', async () => {
  let sent;
  const result = await routing.plan({...base,fetcher:async (_url,options) => {
    sent=JSON.parse(options.body);
    return {ok:true,json:async()=>({data:{plan:{itineraries:[itinerary]}}})};
  }});
  assert.match(sent.query,/planConnection\\(/);
  assert.match(sent.query,/edges\\s*\\{/);
  assert.equal(sent.variables.date,'2026-10-28');
  assert.equal(sent.variables.time,'10:10');
  assert.equal(result.itineraries.length,1);
  assert.equal(result.itineraries[0].startTime,itinerary.startTime);
  assert.equal(result.itineraries[0].legs[0].route,'Y51');
  assert.equal(result.itineraries[0].transportConfirmed,false);
});
test('accepts seconds timestamps and rejects invalid itineraries', async () => {
  const result = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{plan:{itineraries:[
      {...itinerary,startTime:1793179200,endTime:1793182800},
      {...itinerary,startTime:null,endTime:null}
    ]}}})
  })});
  assert.equal(result.itineraries.length,1);
  assert.equal(result.itineraries[0].startTime,1793179200000);
});
test('reports GraphQL schema errors without claiming an itinerary', async () => {
  await assert.rejects(routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({errors:[{message:'Unknown argument'}]})
  })}),/Schema regional incompatible/);
});

test('ignores stale departures and legs with invalid times', async () => {
  const result = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{plan:{itineraries:[
      {...itinerary,startTime:1793170000000},
      {...itinerary,legs:[{...itinerary.legs[0],endTime:null}]},
      itinerary
    ]}}})
  })});
  assert.equal(result.itineraries.length,1);
  assert.equal(result.itineraries[0].legs[0].route,'Y51');
});
test('accepts edge/node itinerary responses', async () => {
  const result = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{plan:{edges:[{node:itinerary}]}}})
  })});
  assert.equal(result.itineraries.length,1);
});

test('parses planConnection edge nodes', async () => {
  const result = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[{node:itinerary}]}}})
  })});
  assert.equal(result.itineraries.length,1);
  assert.equal(result.itineraries[0].transportConfirmed,false);
});

test('parses ISO 8601 timestamps without fabricating missing leg times', async () => {
  const iso = ms => new Date(ms).toISOString();
  const isoTrip = {...itinerary,
    startTime:iso(itinerary.startTime),endTime:iso(itinerary.endTime),
    legs:itinerary.legs.map(leg=>({...leg,
      startTime:iso(leg.startTime),endTime:iso(leg.endTime)}))
  };
  const result = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[
      {node:isoTrip},
      {node:{...isoTrip,legs:[{...isoTrip.legs[0],startTime:null}]}}
    ]}}})
  })});
  assert.equal(result.itineraries.length,1);
  assert.equal(result.itineraries[0].startTime,itinerary.startTime);
  assert.equal(result.itineraries[0].legs[0].endTime,itinerary.endTime);
});

test('parses ISO 8601 timestamps and discards null leg times', async () => {
  const iso = {
    ...itinerary,
    startTime:'2026-10-28T09:20:00Z',
    endTime:'2026-10-28T10:20:00Z',
    legs:[{...itinerary.legs[0],startTime:'2026-10-28T09:20:00Z',
      endTime:'2026-10-28T10:20:00Z'}]
  };
  const result = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[
      {node:{...iso,legs:[{...iso.legs[0],startTime:null}]}},
      {node:iso}
    ]}}})
  })});
  assert.equal(result.itineraries.length,1);
  assert.equal(result.itineraries[0].startTime,Date.parse(iso.startTime));
});

test('rejects overlapping or out-of-range transport legs', async () => {
  const first = {...itinerary.legs[0],endTime:1793181000000};
  const goodSecond = {...itinerary.legs[0],
    startTime:1793181000000,endTime:1793182800000};
  const overlapping = {...goodSecond,startTime:1793180900000};
  const outOfRange = {...goodSecond,endTime:1793184000000};
  const response = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[
      {node:{...itinerary,legs:[first,overlapping]}},
      {node:{...itinerary,legs:[first,outOfRange]}},
      {node:{...itinerary,legs:[first,goodSecond]}}
    ]}}})
  })});
  assert.equal(response.itineraries.length,1);
  assert.equal(response.itineraries[0].legs.length,2);
  assert.equal(response.itineraries[0].transportConfirmed,false);
});

test('rejects itinerary duration inconsistent with arrival and departure', async () => {
  const response = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[
      {node:{...itinerary,duration:100}},
      {node:{...itinerary,duration:null}},
      {node:itinerary}
    ]}}})
  })});
  assert.equal(response.itineraries.length,1);
  assert.equal(response.itineraries[0].durationSeconds,3600);
});

test('sorts by earliest arrival and removes duplicate routes before limiting results', async () => {
  const later = {...itinerary,startTime:itinerary.startTime+600000,
    endTime:itinerary.endTime+600000,
    legs:itinerary.legs.map(leg=>({...leg,startTime:leg.startTime+600000,
      endTime:leg.endTime+600000}))};
  const response = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[
      {node:later},{node:itinerary},{node:itinerary}
    ]}}})
  })});
  assert.equal(response.itineraries.length,2);
  assert.equal(response.itineraries[0].startTime,itinerary.startTime);
  assert.equal(response.itineraries[1].startTime,later.startTime);
});

test('ignores null itinerary nodes without crashing the Agenda', async () => {
  const response = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[
      {node:null},{node:itinerary},{node:false}
    ]}}})
  })});
  assert.equal(response.itineraries.length,1);
  assert.equal(response.itineraries[0].legs[0].route,'Y51');
});

test('rejects a route containing a null transport leg', async () => {
  const response = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[
      {node:{...itinerary,legs:[null,itinerary.legs[0]]}},
      {node:itinerary}
    ]}}})
  })});
  assert.equal(response.itineraries.length,1);
  assert.equal(response.itineraries[0].legs.length,1);
});

test('preserves distinct boarding stops even when routes and times match', async () => {
  const alternative = {...itinerary,legs:[{
    ...itinerary.legs[0],from:{name:'Annecy Gare Routiere'}
  }]};
  const response = await routing.plan({...base,fetcher:async()=>({
    ok:true,json:async()=>({data:{planConnection:{edges:[
      {node:itinerary},{node:alternative},{node:itinerary}
    ]}}})
  })});
  assert.equal(response.itineraries.length,2);
  assert.deepEqual(response.itineraries.map(x=>x.legs[0].from),
    ['Annecy','Annecy Gare Routiere']);
});
