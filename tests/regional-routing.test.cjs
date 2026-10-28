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
