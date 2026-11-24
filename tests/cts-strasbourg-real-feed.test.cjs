'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

test('CTS Strasbourg réel : horaires actifs indexables dans le flux officiel',
 {skip:!fs.existsSync(path.join(__dirname,'..','data','gtfs','cts-strasbourg.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'},async()=>{
 const archive=path.join(__dirname,'..','data','gtfs','cts-strasbourg.zip');
 assert.ok(fs.existsSync(archive),'REQUIRE_REAL_GTFS=1 exige le GTFS CTS collecté');
 const bytes=fs.readFileSync(archive);
 const dates=Array.from({length:7},(_,offset)=>{
  const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
 });
 const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/cts-strasbourg.zip'},
  {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
 let sample=null;
 for(const date of dates){
  for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){
   for(let i=0;i<trip.stops.length&&!sample;i++)for(let j=i+1;j<trip.stops.length;j++){
    const from=trip.stops[i],to=trip.stops[j];
    if(!from.stopId||!to.stopId||from.stopId===to.stopId)continue;
    if(![from.lat,from.lon,to.lat,to.lon].every(Number.isFinite))continue;
    if(![from,to].every(s=>s.lat>=48.45&&s.lat<=48.70&&s.lon>=7.60&&s.lon<=7.90))continue;
    const journeys=indexer.directTrips(feed.files,feed.index,date,from.stopId,to.stopId);
    if(journeys.length)sample={date,from,to,journey:journeys[0]};
   }
   if(sample)break;
  }
  if(sample)break;
 }
 assert.ok(sample,'aucun trajet actif entre deux arrêts CTS situés dans la zone française de Strasbourg');
 assert.ok(sample.journey.departure&&sample.journey.arrival,'candidat sans horaires exacts');
 assert.equal(sample.journey.date,sample.date);
});
