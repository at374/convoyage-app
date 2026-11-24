'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

test('Forbus réel : courses françaises actives conservées, ligne transfrontalière exclue',
 {skip:!fs.existsSync(path.join(__dirname,'..','data','gtfs','forbus-forbach.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'},async()=>{
 const root=path.join(__dirname,'..','data','gtfs');
 const archive=path.join(root,'forbus-forbach.zip');
 assert.ok(fs.existsSync(archive),'REQUIRE_REAL_GTFS=1 exige le GTFS Forbus filtré');
 const bytes=fs.readFileSync(archive);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 const entry=manifest.networks?.['forbus-forbach'];
 assert.ok(entry,'Forbus doit figurer dans le manifeste');
 assert.ok(entry.trips>0,'Forbus doit conserver des courses');
 const dates=Array.from({length:7},(_,offset)=>{
  const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
 });
 const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/forbus-forbach.zip'},
  {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
 const routes=indexer.parseCSV(feed.files['routes.txt']);
 assert.ok(routes.length>0,'Forbus doit conserver des lignes');
 assert.ok(routes.every(r=>!/schoeneck/i.test([r.route_id,r.route_short_name,r.route_long_name].join(' '))),
  'la ligne vers Schoeneck en Allemagne doit être exclue');
 let sample=null;
 for(const date of dates){
  for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){
   for(let i=0;i<trip.stops.length&&!sample;i++)for(let j=i+1;j<trip.stops.length;j++){
    const from=trip.stops[i].stopId,to=trip.stops[j].stopId;
    if(!from||!to||from===to)continue;
    const journeys=indexer.directTrips(feed.files,feed.index,date,from,to);
    if(journeys.length){sample={date,journey:journeys[0]};break;}
   }
   if(sample)break;
  }
  if(sample)break;
 }
 assert.ok(sample,'aucun trajet direct actif trouvé sur les sept prochains jours');
 assert.ok(sample.journey.departure&&sample.journey.arrival,'candidat sans horaires exacts');
 assert.equal(sample.journey.date,sample.date);
});
