const test=require('node:test'),assert=require('node:assert/strict');
const {discover}=require('../scripts/otp-pan-discover.cjs');
const fixture=[{id:12,title:'Transport Sibra Annecy',page_url:'https://transport.data.gouv.fr/datasets/sibra',
 publisher:{name:'Grand Annecy'},licence:'odbl',resources:[
 {id:1,title:'Horaires',format:'GTFS',url:'https://example.org/sibra.zip',is_available:true},
 {id:2,title:'Temps réel',format:'GTFS-RT',url:'https://example.org/realtime'}
 ]},{title:'Réseau éloigné',resources:[{format:'GTFS',url:'https://example.org/other.zip'}]}];
test('PAN : filtre les ressources GTFS AURA et conserve les métadonnées',()=>{
 const results=discover(fixture,['sibra']);
 assert.equal(results.length,1);assert.equal(results[0].datasetId,12);
 assert.equal(results[0].resourceId,1);assert.equal(results[0].license,'odbl');
});
test('PAN : filtre sans sensibilité aux accents',()=>{
 assert.equal(discover([{title:'Réseau de Chambéry',resources:[{format:'GTFS'}]}],['chambery']).length,1);
});
test('PAN : rejette les entrées invalides',()=>{
 assert.throws(()=>discover({}),/invalide/);
 assert.deepEqual(discover([null,{title:'Sibra',resources:null}],['sibra']),[]);
});
test('PAN : ignore les URL non HTTPS',()=>{
 const x=discover([{title:'Sibra',resources:[{format:'GTFS',url:'http://example.org/feed.zip'}]}],['sibra']);
 assert.equal(x[0].url,null);
});
