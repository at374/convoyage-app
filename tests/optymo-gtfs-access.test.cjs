'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const hub=require('../transport-mission-hub.js');

test('Optymo remains staged, not motor-connected: every stop time requires coordination with the driver',
 {skip:!fs.existsSync(path.join(__dirname,'..','data','gtfs','optymo-belfort.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'},async()=>{
 const archive=path.join(__dirname,'..','data','gtfs','optymo-belfort.zip');
 assert.ok(fs.existsSync(archive),'REQUIRE_REAL_GTFS=1 exige l’archive Optymo validée');
 const bytes=fs.readFileSync(archive);
 const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/optymo-belfort.zip'},
  {fetcher:async()=>new Response(bytes),retainSourceTables:true});
 const stopTimes=feed.files['stop_times.txt'].trimEnd().split(/\r?\n/);
 assert.ok(stopTimes.length>1,'Optymo doit publier des horaires inspectables');
 const headers=stopTimes[0].replace(/^\uFEFF/,'').split(',');
 const pickup=headers.indexOf('pickup_type'),drop=headers.indexOf('drop_off_type');
 assert.ok(pickup>=0&&drop>=0,'l’archive doit expliciter les règles de montée et descente');
 const values=new Set();
 for(const line of stopTimes.slice(1)){
  const cells=line.split(',');
  values.add(`${cells[pickup]||'0'}/${cells[drop]||'0'}`);
 }
 assert.deepEqual([...values],['3/3'],
  'un changement des droits de montée/descente exige de réévaluer et tester l’intégration Optymo');
 const providers=hub.makeProviders({CPGTFSLoader:loader,CPGTFSIndex:require('../transport-gtfs-index.js')});
 assert.equal(providers.local_optymo,undefined,
  'le moteur ne doit pas proposer une course qui impose une coordination conducteur non confirmée');
});
