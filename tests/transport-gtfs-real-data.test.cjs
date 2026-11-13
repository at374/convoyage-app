// Flux officiels réels publiés par la tâche serveur (data/gtfs) : chargement par le vrai chargeur de l'application.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
globalThis.CPGTFSIndex=require('../transport-gtfs-index.js');
const loader=require('../transport-gtfs-loader.js');
const dir=path.join(__dirname,'..','data','gtfs');
const manifest=fs.existsSync(path.join(dir,'manifest.json'))?JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')):null;
test('manifeste présent, sans erreur, empreintes SHA-256 cohérentes',{skip:!manifest&&'data/gtfs absent'},()=>{
 const crypto=require('crypto');
 assert.deepEqual(manifest.errors,{});
 for(const [id,n] of Object.entries(manifest.networks)){
  const bytes=fs.readFileSync(path.join(dir,n.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),n.sha256,id);
 }
});
for(const [id,n] of Object.entries(manifest?.networks||{})){
 test('flux réel '+id+' : chargé et indexé',async()=>{
  const bytes=fs.readFileSync(path.join(dir,n.file));
  const feed=await loader.loadResource({format:'GTFS',url:'https://local.test/'+n.file,network:n.network},
   {fetcher:async()=>new Response(bytes,{status:200,headers:{'content-type':'application/zip'}}),retainSourceTables:false});
  assert.ok(feed.index.counts.routes>0&&feed.index.counts.stops>0&&feed.index.sourceTrips>0,id);
 });
}
