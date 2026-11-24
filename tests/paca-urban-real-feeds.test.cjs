'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

const DATA=process.env.GTFS_TEST_DATA_DIR||path.join(__dirname,'..','data','gtfs');
const feeds=[
 {id:'lignes-azur-nice',name:"Lignes d'Azur Nice",modes:new Set(['0','3','715'])},
 {id:'mistral-toulon',name:'Réseau Mistral Toulon',modes:new Set(['3'])},
 {id:'mistral-telepherique-faron',name:'Téléphérique du Faron',modes:new Set(['6'])}
];
const dates=Array.from({length:7},(_,offset)=>{
 const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
});

for(const expected of feeds)test(`${expected.name} réel : trajet actif indexé, sans ferry`,{
 skip:!fs.existsSync(path.join(DATA,expected.id+'.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'
},async()=>{
 const archive=path.join(DATA,expected.id+'.zip');
 assert.ok(fs.existsSync(archive),`REQUIRE_REAL_GTFS=1 exige ${expected.id}.zip`);
 const manifest=JSON.parse(fs.readFileSync(path.join(DATA,'manifest.json'),'utf8'));
 const entry=manifest.networks?.[expected.id];
 assert.ok(entry&&Array.isArray(entry.bounds)&&entry.bounds.length===4,`${expected.id}: manifeste/emprise absents`);
 const bytes=fs.readFileSync(archive);assert.ok(bytes.length<12*1024*1024,`${expected.id}: dépasse le plafond mobile`);
 let found=null;
 for(const date of dates){
  const feed=await loader.loadResource({format:'GTFS',url:`https://example.org/${expected.id}.zip`},
   {fetcher:async()=>new Response(bytes),indexServiceDates:[date],retainSourceTables:true});
  const routes=indexer.parseCSV(feed.files['routes.txt']||'');
  assert.ok(routes.length>0,`${expected.id}: aucun itinéraire`);
  assert.ok(routes.every(r=>expected.modes.has(String(r.route_type))),`${expected.id}: mode inattendu ou ferry présent`);
  for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){
   if(trip.stops.length<2)continue;
   for(let i=0;i<trip.stops.length-1;i++){
    const a=trip.stops[i],b=trip.stops[i+1];
    if(!a.departure||!b.arrival)continue;
    const from=feed.index.stopById.get(a.stopId),to=feed.index.stopById.get(b.stopId);
    if(!from||!to)continue;
    const points=[from,to].map(s=>[Number(s.stop_lat),Number(s.stop_lon)]);
    if(points.flat().some(v=>!Number.isFinite(v)))continue;
    if(points.some(([lat,lon])=>lat<entry.bounds[0]||lat>entry.bounds[2]||lon<entry.bounds[1]||lon>entry.bounds[3]))continue;
    const journey=indexer.directTrips(feed.files,feed.index,date,a.stopId,b.stopId).find(x=>x.tripId===trip.tripId);
    if(journey){found={journey,points};break;}
   }
   if(found)break;
  }
  if(found)break;
 }
 assert.ok(found,`${expected.id}: aucune course directe active dans les sept jours`);
 assert.match(found.journey.departure,/^\d{1,3}:[0-5]\d:[0-5]\d$/);
 assert.match(found.journey.arrival,/^\d{1,3}:[0-5]\d:[0-5]\d$/);
});
