const assert=require('node:assert/strict');
const {ENDPOINT,normalize,gtfsResources,downloadGTFS,byNetwork,fetchCatalogue}=require('../transport-catalogue.js');
const raw=[{id:42,title:'Réseau SIBRA Grand Annecy',resources:[
 {id:1,format:'gtfs',url:'https://example.org/sibra.zip',updated_at:'2026-10-29'},
 {id:2,format:'gtfs',url:'http://insecure.example.org/feed.zip'}]},
 {id:43,title:'Réseau régional',resources:[]}];
const datasets=normalize(raw);
assert.equal(ENDPOINT,'https://transport.data.gouv.fr/api/datasets');
assert.equal(datasets.length,1);
assert.equal(datasets[0].resources.length,1);
assert.equal(datasets[0].resources[0].format,'GTFS');
const original=normalize([{id:99,title:'TER',page_url:'https://transport.data.gouv.fr/datasets/ter',resources:[{id:8,format:'GTFS',original_url:'https://example.org/ter.zip'}]}]);
assert.equal(original[0].resources[0].url,'https://example.org/ter.zip');
assert.equal(original[0].resources[0].sourcePage,'https://transport.data.gouv.fr/datasets/ter');
assert.equal(byNetwork(datasets,'sibra').length,1);
assert.equal(gtfsResources(datasets).length,1);
assert.equal(gtfsResources(datasets)[0].network,'Réseau SIBRA Grand Annecy');
assert.equal(byNetwork(datasets,'')[0],undefined);
assert.deepEqual(normalize({datasets:raw}),datasets);
assert.deepEqual(normalize(null),[]);
(async()=>{
 const result=await fetchCatalogue(async url=>({ok:url===ENDPOINT,json:async()=>raw}));
 assert.equal(result.length,1);
 await assert.rejects(fetchCatalogue(async()=>({ok:false})),/unavailable/);
 const resource=gtfsResources(datasets)[0];
 const fakeResponse=(bytes)=>({ok:true,headers:{get:()=>null},body:{getReader:()=>({
   read:(()=>{let read=false;return async()=>read?{done:true}:(read=true,{done:false,value:Uint8Array.from(bytes)})})(),
   cancel:async()=>{}
 })}});
 assert.deepEqual(Array.from(await downloadGTFS(resource,async()=>fakeResponse([80,75,3,4,0]),10)),[80,75,3,4,0]);
 await assert.rejects(downloadGTFS(resource,async()=>fakeResponse([1,2,3,4])),/not a ZIP/);
 await assert.rejects(downloadGTFS(resource,async()=>fakeResponse([80,75,3,4,0]),4),/size limit/);
 await assert.rejects(downloadGTFS({...resource,url:'http://example.org/feed.zip'},async()=>fakeResponse([])),/Invalid GTFS/);
 console.log('PAN catalogue: 18 assertions passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
