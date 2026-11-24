'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

test('Fluo Grand Est réel : l’archive collectée fournit un candidat direct avec calendrier actif à l’indexeur GTFS',
 {skip:!fs.existsSync(path.join(__dirname,'..','data','gtfs','fluo-grand-est.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'},async()=>{
 const archive=path.join(__dirname,'..','data','gtfs','fluo-grand-est.zip');
 assert.ok(fs.existsSync(archive),'REQUIRE_REAL_GTFS=1 exige l’extrait Fluo Grand Est collecté');
 const bytes=fs.readFileSync(archive);
 const dates=Array.from({length:7},(_,offset)=>{
  const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
 });
 const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/fluo-grand-est.zip'},
  {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
 let sample=null;
 for(const date of dates){
  for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){
   for(let i=0;i<trip.stops.length&&!sample;i++)for(let j=i+1;j<trip.stops.length;j++){
    const from=trip.stops[i].stopId,to=trip.stops[j].stopId;
    if(!from||!to||from===to)continue;
    const journeys=indexer.directTrips(feed.files,feed.index,date,from,to);
    if(journeys.length){sample={date,line:trip.line,from:trip.stops[i].stopName,to:trip.stops[j].stopName,journey:journeys[0]};break;}
   }
   if(sample)break;
  }
  if(sample)break;
 }
 assert.ok(sample,'aucun couple d’arrêts distinct avec horaire actif et accès GTFS régulier trouvé sur les 7 prochains jours');
 assert.ok(sample.journey.departure&&sample.journey.arrival,'candidat sans horaires exacts');
 assert.equal(sample.journey.date,sample.date);
});
