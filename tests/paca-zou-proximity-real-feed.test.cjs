'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

const DATA=process.env.GTFS_TEST_DATA_DIR||path.join(__dirname,'..','data','gtfs');
test('ZOU Proximité réel : bus actif, emprise PACA et marqueurs GTFS TAD', {
 skip:!fs.existsSync(path.join(DATA,'zou-proximite-paca.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'
},async()=>{
 const archive=path.join(DATA,'zou-proximite-paca.zip');
 assert.ok(fs.existsSync(archive),'REQUIRE_REAL_GTFS=1 exige le ZIP ZOU Proximité collecté');
 const manifest=JSON.parse(fs.readFileSync(path.join(DATA,'manifest.json'),'utf8'));
 const entry=manifest.networks?.['zou-proximite-paca'];
 assert.ok(entry&&entry.license==='Licence Ouverte 2.0','entrée/licence absente du manifeste');
 assert.ok(Array.isArray(entry.bounds)&&entry.bounds.length===4,'emprise réelle des arrêts absente');
 const bytes=fs.readFileSync(archive);
 assert.ok(bytes.length<12*1024*1024,'archive dépasse le plafond mobile');
 const dates=Array.from({length:7},(_,offset)=>{
  const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
 });
 const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/zou-proximite-paca.zip'},
  {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
 assert.ok(feed.index.counts.routes>0,'aucune ligne ZOU indexée');
 assert.ok(feed.index.counts.stops>0,'aucun arrêt ZOU indexé');
 const routeText=feed.files['routes.txt']||'';
 assert.doesNotMatch(routeText,/monaco|monte.?carlo|ital(?:ie|y|ia)|ventimiglia|vintimille|san.?remo|bordighera/i,
  'une ligne explicitement transfrontalière apparaît dans le flux');
 const timesText=feed.files['stop_times.txt']||'';
 const header=timesText.split(/\r?\n/,1)[0].split(',');
 assert.ok(header.includes('pickup_type')&&header.includes('drop_off_type'),'marqueurs GTFS de prise en charge/dépose absents');
 let sample=null;
 for(const date of dates){
  for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){
   if(trip.stops.length<2)continue;
   const first=trip.stops[0],last=trip.stops.at(-1);
   if(!first.departure||!last.arrival)continue;
   const start=feed.index.stopById.get(first.stopId),end=feed.index.stopById.get(last.stopId);
   if(!start||!end)continue;
   const coords=[start,end].map(s=>[Number(s.stop_lat),Number(s.stop_lon)]);
   if(coords.flat().some(v=>!Number.isFinite(v)))continue;
   sample={date,trip,coords};break;
  }
  if(sample)break;
 }
 assert.ok(sample,'aucune course ZOU active avec deux arrêts et heures exactes dans les 7 jours');
 for(const [lat,lon] of sample.coords){
  assert.ok(lat>=entry.bounds[0]&&lat<=entry.bounds[2]&&lon>=entry.bounds[1]&&lon<=entry.bounds[3],
   'arrêt du trajet actif hors emprise du manifeste');
  assert.ok(lat>=42.5&&lat<=45.5&&lon>=4.0&&lon<=8.0,'arrêt du trajet actif hors de l’emprise PACA attendue');
 }
});
