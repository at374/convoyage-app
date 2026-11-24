'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

const ROOT=path.join(__dirname,'..');
const DATA_DIR=process.env.GTFS_TEST_DATA_DIR||path.join(ROOT,'data','gtfs');
const NETWORKS=[
 ['sub-nancy','SUB Nancy'],
 ['trace-colmar','TRACE Colmar'],
 ['imagine-epinal','Imagine Épinal'],
 ['ticea-saint-dizier','Ticéa Saint-Dizier'],
 ['transavold-saint-avold','Transavold Saint-Avold'],
 ['cmonbus-chaumont','Cmonbus Chaumont'],
 ['tub-bar-le-duc','TUB Bar-le-Duc'],
 ['rezo-verdun','Rézo Verdun'],
 ['tcat-troyes','TCAT Troyes'],
];

for(const [id,name] of NETWORKS){
 test(`${name} réel : candidat direct actif, horaires exacts et emprise calculée depuis le GTFS`,
  {skip:!fs.existsSync(path.join(DATA_DIR,`${id}.zip`))&&process.env.REQUIRE_REAL_GTFS!=='1'},async()=>{
   const archive=path.join(DATA_DIR,`${id}.zip`);
   assert.ok(fs.existsSync(archive),`REQUIRE_REAL_GTFS=1 exige data/gtfs/${id}.zip`);
   const bytes=fs.readFileSync(archive);
   const manifest=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'manifest.json'),'utf8'));
   const bounds=manifest.networks?.[id]?.bounds;
   assert.ok(Array.isArray(bounds)&&bounds.length===4,`${id}: emprise absente du manifeste`);
   const dates=Array.from({length:7},(_,offset)=>{
    const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
   });
   const feed=await loader.loadResource({format:'GTFS',url:`https://example.org/${id}.zip`},
    {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
   assert.ok(feed.index.counts.routes>0,`${id}: aucune ligne indexée`);
   let sample=null;
   for(const date of dates){
    for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){
     for(let i=0;i<trip.stops.length&&!sample;i++)for(let j=i+1;j<trip.stops.length;j++){
      const from=trip.stops[i].stopId,to=trip.stops[j].stopId;
      if(!from||!to||from===to)continue;
      const journeys=indexer.directTrips(feed.files,feed.index,date,from,to);
      if(journeys.length){sample={date,from,to,journey:journeys[0]};break;}
     }
     if(sample)break;
    }
    if(sample)break;
   }
   assert.ok(sample,`${id}: aucun trajet direct actif trouvé sur les sept prochains jours`);
   assert.ok(sample.journey.departure&&sample.journey.arrival,`${id}: horaires manquants`);
   assert.equal(sample.journey.date,sample.date);
   for(const stopId of [sample.from,sample.to]){
    const stop=feed.index.stopById.get(stopId);
    assert.ok(stop,`${id}: arrêt candidat absent de l’index`);
    const lat=Number(stop.stop_lat),lon=Number(stop.stop_lon);
    assert.ok(lat>=bounds[0]&&lat<=bounds[2]&&lon>=bounds[1]&&lon<=bounds[3],
     `${id}: l’emprise calculée ne contient pas l’arrêt testé`);
   }
  });
}
