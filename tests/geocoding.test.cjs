const {test}=require('node:test');
const assert=require('node:assert/strict');
const geo=require('../geo.js');
const mission={from_city:'Commune Exemple',from_department:'74',origin_address:'12 rue Exemple 74000'};

test('French geocoding uses official IGN endpoint and keeps address precision',async()=>{
  let requested;
  const answer=await geo.chercherPoint(mission,'origin',async url=>{
    requested=new URL(url);
    return {ok:true,json:async()=>({features:[{geometry:{coordinates:[6.1,45.9]},properties:{type:'housenumber',score:0.95}}]})};
  });
  assert.equal(requested.origin,'https://data.geopf.fr');
  assert.equal(requested.pathname,'/geocodage/search');
  assert.equal(requested.searchParams.get('index'),'address');
  assert.equal(requested.searchParams.get('postcode'),'74000');
  assert.deepEqual(answer.point,{lat:45.9,lng:6.1,precision:'adresse'});
});
test('a street or town result cannot acquire address precision',async()=>{
  for(const [type,precision] of [['street','rue'],['municipality','ville']]){
    const answer=await geo.chercherPoint(mission,'origin',async()=>({ok:true,json:async()=>({features:[{geometry:{coordinates:[6.1,45.9]},properties:{type,score:0.9}}]})}));
    assert.equal(answer.point.precision,precision);
  }
});
test('empty or weak results do not fabricate a mission address',async()=>{
  for(const features of [[],[{geometry:{coordinates:[6.1,45.9]},properties:{type:'housenumber',score:0.2}}]]){
    const answer=await geo.chercherPoint(mission,'origin',async()=>({ok:true,json:async()=>({features})}));
    assert.equal(answer.trouve,false);
  }
});
test('Swiss town lookup remains separate and approximate',async()=>{
  const answer=await geo.chercherPoint({from_city:'Genève',from_department:'CH'},'origin',async url=>{
    assert.equal(new URL(url).hostname,'geocoding-api.open-meteo.com');
    return {ok:true,json:async()=>({results:[{country_code:'CH',latitude:46.2,longitude:6.1}]})};
  });
  assert.equal(answer.point.precision,'ville');
});
test('concurrent requests for the same address share one lookup and preserve cancellation options',async()=>{
  let calls=0,complete;
  const fetcher=(url,options)=>{
    calls++;assert.ok(options.signal instanceof AbortSignal);assert.equal(options.credentials,'omit');
    return new Promise(resolve=>{complete=()=>resolve({ok:true,json:async()=>({features:[]})});});
  };
  const a=geo.chercherPoint(mission,'origin',fetcher);
  const b=geo.chercherPoint({...mission},'origin',fetcher);
  assert.equal(calls,1);complete();
  const results=await Promise.all([a,b]);assert.equal(results[0].trouve,false);assert.equal(results[1].trouve,false);
});
test('an unresponsive address service times out and permits a fresh attempt',async()=>{
  let signal;
  await assert.rejects(()=>geo.chercherPoint(mission,'origin',(_,options)=>{
    signal=options.signal;return new Promise(()=>{});
  },{timeoutMs:5}),/trop lente/);
  assert.equal(signal.aborted,true);
  const answer=await geo.chercherPoint(mission,'origin',async()=>({ok:true,json:async()=>({features:[]})}));
  assert.equal(answer.trouve,false);
});
test('the app resolver stores local geocoding and passes only precise points to routing',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const predicate=source.slice(source.indexOf('const transportAddressPoint ='),source.indexOf('const $ ='));
  const resolver=source.slice(source.indexOf('async function pointTransportMission('),source.indexOf('async function pointsMission('));
  assert.ok(predicate.length>0 && resolver.length>0);
  const cle=geo.cleAdresse(mission,'origin');
  try{
    for(const type of ['housenumber','street']){
      delete geo.POINTS[cle];const writes=[];let calls=0;
      const context={G:geo,gpsMem:{pts:{}},ecrireLocal:(name)=>writes.push(name),regionalFetch:async()=>{
        calls++;return {ok:true,json:async()=>({features:[{geometry:{coordinates:[6.1,45.9]},properties:{type,score:0.95}}]})};
      }};
      const resolve=vm.runInNewContext(predicate+resolver+';pointTransportMission',context);
      const precise=await resolve(mission,'origin');
      if(type==='housenumber'){assert.equal(precise.lat,45.9);assert.equal(precise.lon,6.1);}
      else assert.equal(precise,null);
      assert.equal(calls,1);assert.deepEqual(writes,['cp_gps']);
      await resolve({...mission,origin:{lat:45.9,lng:6.1}},'origin');assert.equal(calls,1);
    }
    assert.match(source,/resolvePoint:name=>name==='origin'\?pointTransportMission/);
  }finally{delete geo.POINTS[cle];}
});
