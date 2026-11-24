'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

const DATA=process.env.GTFS_TEST_DATA_DIR||path.join(__dirname,'..','data','gtfs');
test('liO interurbain Occitanie réel : fragments chargés, courses actives et emprise française', {
 skip:!fs.existsSync(path.join(DATA,'manifest.json'))&&process.env.REQUIRE_REAL_GTFS!=='1'
},async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(DATA,'manifest.json'),'utf8'));
 const entry=manifest.networks?.['lio-interurbain-occitanie'];
 assert.ok(entry,'REQUIRE_REAL_GTFS=1 exige le réseau liO dans le manifeste');
 const files=entry.files||[entry.file];
 assert.ok(files.length>1,'le gros GTFS liO doit être livré en fragments pour respecter le plafond mobile');
 assert.ok(entry.sharded,'le manifeste doit signaler le découpage');
 const dates=Array.from({length:30},(_,offset)=>{
  const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
 });
 const seenTrips=new Set();
 let activeSample=null,routeCount=0,stopCount=0,stopTimeCount=0;
 for(const name of files){
  const archive=path.join(DATA,name);
  assert.ok(fs.existsSync(archive),`fragment manquant : ${name}`);
  const bytes=fs.readFileSync(archive);
  assert.ok(bytes.length<12*1024*1024,`fragment ${name} dépasse le plafond mobile`);
  const feed=await loader.loadResource({format:'GTFS',url:`https://example.org/${name}`},
   {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
  assert.ok(feed.index.counts.trips>0,`fragment vide : ${name}`);
  routeCount+=feed.index.counts.routes;stopCount+=feed.index.counts.stops;
  const tripText=feed.files['trips.txt']||'';
  const tripLines=tripText.trim().split(/\r?\n/);
  const tripHeader=tripLines.shift().split(',');
  const tripIdColumn=tripHeader.indexOf('trip_id');
  assert.ok(tripIdColumn>=0,'colonne trip_id absente');
  for(const row of tripLines){
   const id=row.split(',')[tripIdColumn];
   assert.ok(id&&!seenTrips.has(id),`course dupliquée entre fragments : ${id}`);
   seenTrips.add(id);
  }
  stopTimeCount+=feed.index.counts.stopTimes||0;
  if(!activeSample){
   for(const date of dates){
    const trip=indexer.scheduledTrips(feed.files,feed.index,date).find(t=>t.stops.length>=2&&t.stops[0].departure&&t.stops.at(-1).arrival);
    if(!trip)continue;
    const start=feed.index.stopById.get(trip.stops[0].stopId),end=feed.index.stopById.get(trip.stops.at(-1).stopId);
    if(start&&end&&[start,end].every(s=>Number.isFinite(Number(s.stop_lat))&&Number.isFinite(Number(s.stop_lon)))){
     activeSample={date,trip,start,end};break;
    }
   }
  }
 }
 assert.ok(seenTrips.size>0,'aucune course reconstruite');
 assert.equal(seenTrips.size,entry.trips,'total de courses différent du manifeste');
 assert.ok(routeCount>0&&stopCount>0,'lignes ou arrêts absents des fragments chargés');
 assert.ok(activeSample,'aucune course active avec horaires et arrêts GPS dans les 30 jours');
 for(const s of [activeSample.start,activeSample.end]){
  const lat=Number(s.stop_lat),lon=Number(s.stop_lon);
  assert.ok(lat>=41&&lat<=52&&lon>=-6&&lon<=10,'coordonnées actives hors de France métropolitaine');
 }
});
