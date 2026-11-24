'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

const DATA=process.env.GTFS_TEST_DATA_DIR||path.join(__dirname,'..','data','gtfs');
test('Cars Région Nouvelle-Aquitaine réel : courses actives françaises dans les fragments', {
 skip:!fs.existsSync(path.join(DATA,'manifest.json'))&&process.env.REQUIRE_REAL_GTFS!=='1'
},async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(DATA,'manifest.json'),'utf8'));
 const entry=manifest.networks?.['cars-region-nouvelle-aquitaine'];
 assert.ok(entry,'REQUIRE_REAL_GTFS=1 exige les cars régionaux Nouvelle-Aquitaine collectés');
 const files=entry.files||[entry.file];
 assert.ok(entry.sharded,'le flux régional doit être découpé sous les plafonds mobiles');
 const dates=Array.from({length:7},(_,offset)=>{
  const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
 });
 const seenTrips=new Set();let sample=null;
 for(const name of files){
  const archive=path.join(DATA,name);assert.ok(fs.existsSync(archive),`fragment absent : ${name}`);
  const bytes=fs.readFileSync(archive);assert.ok(bytes.length<12*1024*1024,`fragment trop volumineux : ${name}`);
  const feed=await loader.loadResource({format:'GTFS',url:`https://example.org/${name}`},
   {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
  assert.ok(feed.index.counts.routes>0&&feed.index.counts.stops>0,`fragment non indexé : ${name}`);
  const tripText=feed.files['trips.txt']||'',lines=tripText.trim().split(/\r?\n/),header=lines.shift().split(',');
  const idCol=header.indexOf('trip_id');assert.ok(idCol>=0,'trip_id absent');
  for(const row of lines){const id=row.split(',')[idCol];assert.ok(id&&!seenTrips.has(id),`course dupliquée : ${id}`);seenTrips.add(id);}
  const routes=(feed.files['routes.txt']||'').toLowerCase();
  assert.doesNotMatch(routes,/scolaire|scolaires|school|ital(?:ie|y|ia)|espagne|spain|andorre|andorra|portugal|irun|san.?sebastian/,
   'course scolaire ou libellé explicitement étranger dans le réseau');
  if(!sample){
   for(const date of dates){
    const trip=indexer.scheduledTrips(feed.files,feed.index,date).find(t=>t.stops.length>=2&&t.stops[0].departure&&t.stops.at(-1).arrival);
    if(!trip)continue;
    const a=feed.index.stopById.get(trip.stops[0].stopId),b=feed.index.stopById.get(trip.stops.at(-1).stopId);
    if(a&&b&&[a,b].every(s=>Number.isFinite(Number(s.stop_lat))&&Number.isFinite(Number(s.stop_lon)))){sample={trip,a,b};break;}
   }
  }
 }
 assert.ok(seenTrips.size>0,'aucune course dans les fragments');
 assert.equal(seenTrips.size,entry.trips,'total différent du manifeste');
 assert.ok(sample,'aucune course active avec horaires et coordonnées dans les sept jours');
 for(const s of [sample.a,sample.b])assert.ok(Number(s.stop_lat)>=41&&Number(s.stop_lat)<=52&&Number(s.stop_lon)>=-6&&Number(s.stop_lon)<=10,'arrêt hors de France métropolitaine');
});
