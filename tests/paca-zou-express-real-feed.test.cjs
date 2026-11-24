'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

const DATA=process.env.GTFS_TEST_DATA_DIR||path.join(__dirname,'..','data','gtfs');
test('ZOU Express réel : cars régionaux actifs, sans trains ni dessertes frontalières', {
 skip:!fs.existsSync(path.join(DATA,'zou-express-paca.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'
},async()=>{
 const archive=path.join(DATA,'zou-express-paca.zip');
 assert.ok(fs.existsSync(archive),'REQUIRE_REAL_GTFS=1 exige le ZIP ZOU Express collecté');
 const manifest=JSON.parse(fs.readFileSync(path.join(DATA,'manifest.json'),'utf8'));
 const entry=manifest.networks?.['zou-express-paca'];
 assert.ok(entry&&entry.license==='Licence Ouverte 2.0','entrée/licence absente du manifeste');
 assert.ok(Array.isArray(entry.bounds)&&entry.bounds.length===4,'emprise réelle absente');
 const bytes=fs.readFileSync(archive);
 assert.ok(bytes.length<12*1024*1024,'archive dépasse le plafond mobile');
 const dates=Array.from({length:7},(_,offset)=>{
  const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
 });
 let found=null;
 for(const date of dates){
  const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/zou-express-paca.zip'},
   {fetcher:async()=>new Response(bytes),indexServiceDates:[date],retainSourceTables:true});
  assert.ok(feed.index.counts.routes>0&&feed.index.counts.stops>0,'index ZOU vide');
  const routes=indexer.parseCSV(feed.files['routes.txt']||'');
  assert.ok(routes.length>0&&routes.every(row=>String(row.route_type)==='3'),'un train est présent ou les cars sont absents');
  assert.doesNotMatch(JSON.stringify(routes),/oulx|vintimiglia|vintimille|menton|monaco|monte.?carlo/i,
   'une ligne explicitement frontalière reste proposée');
  for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){
   if(trip.stops.length<2)continue;
   const a=trip.stops[0],b=trip.stops.at(-1);
   if(!a.departure||!b.arrival)continue;
   const from=feed.index.stopById.get(a.stopId),to=feed.index.stopById.get(b.stopId);
   if(!from||!to)continue;
   const coords=[from,to].map(s=>[Number(s.stop_lat),Number(s.stop_lon)]);
   if(coords.flat().some(v=>!Number.isFinite(v)))continue;
   if(coords.some(([lat,lon])=>lat<42.5||lat>51.5||lon< -5.5||lon>8.5))continue;
   const direct=indexer.directTrips(feed.files,feed.index,date,a.stopId,b.stopId).find(row=>row.tripId===trip.tripId);
   if(direct){found={feed,direct,coords,entry,date};break;}
  }
  if(found)break;
 }
 assert.ok(found,'aucun trajet direct de car actif trouvé dans les sept jours');
 assert.match(found.direct.departure,/^\d{1,3}:[0-5]\d:[0-5]\d$/);
 assert.match(found.direct.arrival,/^\d{1,3}:[0-5]\d:[0-5]\d$/);
 for(const [lat,lon] of found.coords){
  assert.ok(lat>=found.entry.bounds[0]&&lat<=found.entry.bounds[2]&&lon>=found.entry.bounds[1]&&lon<=found.entry.bounds[3],
   'arrêt du trajet hors emprise du manifeste');
 }
});
