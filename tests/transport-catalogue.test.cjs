const assert=require('node:assert/strict');
const {ENDPOINT,normalize,byNetwork,fetchCatalogue}=require('../transport-catalogue.js');
const raw=[{id:42,title:'Réseau SIBRA Grand Annecy',resources:[
 {id:1,format:'gtfs',url:'https://example.org/sibra.zip',updated_at:'2026-10-29'},
 {id:2,format:'gtfs',url:'http://insecure.example.org/feed.zip'}]},
 {id:43,title:'Réseau régional',resources:[]}];
const datasets=normalize(raw);
assert.equal(ENDPOINT,'https://transport.data.gouv.fr/api/datasets');
assert.equal(datasets.length,1);
assert.equal(datasets[0].resources.length,1);
assert.equal(datasets[0].resources[0].format,'GTFS');
assert.equal(byNetwork(datasets,'sibra').length,1);
assert.equal(byNetwork(datasets,'')[0],undefined);
assert.deepEqual(normalize({datasets:raw}),datasets);
assert.deepEqual(normalize(null),[]);
(async()=>{
 const result=await fetchCatalogue(async url=>({ok:url===ENDPOINT,json:async()=>raw}));
 assert.equal(result.length,1);
 await assert.rejects(fetchCatalogue(async()=>({ok:false})),/unavailable/);
 console.log('PAN catalogue: 10 assertions passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
