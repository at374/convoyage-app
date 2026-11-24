'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

const DATA=process.env.GTFS_TEST_DATA_DIR||path.join(__dirname,'..','data','gtfs');
const NETWORKS=['tisseo-toulouse','tam-montpellier','tango-nimes'];
const dates=Array.from({length:14},(_,offset)=>{
 const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
});
for(const id of NETWORKS){
 test(`${id} réel : GTFS indexable et course active avec coordonnées`, {
  skip:!fs.existsSync(path.join(DATA,'manifest.json'))&&process.env.REQUIRE_REAL_GTFS!=='1'
 },async()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(DATA,'manifest.json'),'utf8'));
  const entry=manifest.networks?.[id];
  assert.ok(entry,`REQUIRE_REAL_GTFS=1 exige ${id} collecté`);
  const archive=path.join(DATA,entry.file);
  assert.ok(fs.existsSync(archive),`ZIP absent pour ${id}`);
  const bytes=fs.readFileSync(archive);
  assert.ok(bytes.length<12*1024*1024,`archive ${id} dépasse le plafond mobile`);
  const feed=await loader.loadResource({format:'GTFS',url:`https://example.org/${entry.file}`},
   {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
  assert.ok(feed.index.counts.routes>0,`aucune ligne indexée pour ${id}`);
  assert.ok(feed.index.counts.stops>0,`aucun arrêt indexé pour ${id}`);
  let sample=null;
  for(const date of dates){
   const trip=indexer.scheduledTrips(feed.files,feed.index,date).find(t=>t.stops.length>=2&&t.stops[0].departure&&t.stops.at(-1).arrival);
   if(!trip)continue;
   const first=feed.index.stopById.get(trip.stops[0].stopId);
   const last=feed.index.stopById.get(trip.stops.at(-1).stopId);
   if(first&&last&&[first,last].every(s=>Number.isFinite(Number(s.stop_lat))&&Number.isFinite(Number(s.stop_lon)))){
    sample={trip,first,last};break;
   }
  }
  assert.ok(sample,`aucune course avec heures et GPS dans les 14 jours pour ${id}`);
  for(const s of [sample.first,sample.last]){
   assert.ok(Number(s.stop_lat)>=41&&Number(s.stop_lat)<=52&&Number(s.stop_lon)>=-6&&Number(s.stop_lon)<=10,
    `coordonnée hors de France métropolitaine pour ${id}`);
  }
 });
}
