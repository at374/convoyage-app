const {test}=require('node:test');
const assert=require('node:assert/strict');
const fares=require('../transport-lemanpass-fares.js');
const recorded=require('./fixtures/lemanpass-annemasse-geneve-20261106.json');
const query={departure:'Annemasse (LEX)',arrival:'Genève (LEX)'};
test('recorded official calculator response keeps only the requested direct adult second-class fare',()=>{
 const result=fares.parse(recorded,query,{receivedAt:'2026-11-06T05:27:16Z'});
 assert.equal(result.offers.length,1);
 assert.deepEqual(result.offers[0].prices,{EUR:8.3,CHF:7.8});
 assert.equal(result.offers[0].class,'2');
 assert.equal(result.offers[0].fareVerified,false);
 assert.equal(result.offers[0].travelDateValidityKnown,false);
 assert.equal(result.offers[0].serviceConfirmed,false);
 assert.equal(result.ambiguous,false);
});
test('first class stays separate; zone and indirect alternatives are never selected as cheaper direct offers',()=>{
 assert.deepEqual(fares.parse(recorded,{...query,class:'1'}).offers[0].prices,{EUR:14.3,CHF:13.4});
 const alternatives=recorded.rows.filter(r=>r.combination!=='P');
 assert.deepEqual(fares.parse({rows:alternatives,errors:[]},query).offers,[]);
 assert.deepEqual(fares.parse(recorded,{...query,arrival:'Genève, Rive'}).offers,[]);
});
test('missing currency is unknown; invalid amounts are never coerced into free fares',()=>{
 const row=recorded.rows[0];
 for(const value of [null,'','-1','NaN','2.001','0x10','<b>2</b>']){
  const result=fares.parse({rows:[{...row,price_eur:value,price_chf:'7.80'}],errors:[]},query);
  assert.deepEqual(result.offers[0].prices,{EUR:null,CHF:7.8});
 }
 assert.deepEqual(fares.parse({rows:[{...row,price_eur:null,price_chf:null}],errors:[]},query).offers,[]);
});
test('conflicting direct prices are ambiguous; identical duplicates are collapsed',()=>{
 const row=recorded.rows[0];
 assert.equal(fares.parse({rows:[row,{...row,price_eur:'1.00'}],errors:[]},query).ambiguous,true);
 assert.deepEqual(fares.parse({rows:[row,{...row,price_eur:'1.00'}],errors:[]},query).offers,[]);
 assert.equal(fares.parse({rows:[row,row],errors:[]},query).offers.length,1);
});
test('unknown schemas, provider errors and invalid query categories fail explicitly',()=>{
 for(const payload of [{},null,{rows:[],errors:['unavailable']},{rows:new Array(501),errors:[]}])
  assert.throws(()=>fares.parse(payload,query),/response/);
 assert.throws(()=>fares.requestURL({...query,class:'3'}),/query/);
 const url=new URL(fares.requestURL(query));
 assert.equal(url.origin,'https://www.lemanpass.com');
 assert.equal(url.searchParams.get('action'),'leman_get_price');
 assert.equal(url.searchParams.get('product'),'4');
 assert.equal(url.searchParams.get('category'),'1');
});
test('read-only fetching omits credentials and preserves provider failures',async()=>{
 const result=await fares.fetchReference(query,{fetcher:async(url,options)=>{
  assert.equal(url,fares.requestURL(query));
  assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
  return new Response(JSON.stringify(recorded),{headers:{'content-type':'text/html'}});
 }});
 assert.equal(result.offers.length,1);
 await assert.rejects(fares.fetchReference(query,{fetcher:async()=>new Response('unavailable',{status:503})}),/unavailable/);
 await assert.rejects(fares.fetchReference(query,{fetcher:async()=>new Response('<html>error</html>')}),SyntaxError);
});
