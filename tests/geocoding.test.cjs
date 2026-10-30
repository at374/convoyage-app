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
