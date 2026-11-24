'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

test('STAN Nancy réel : candidat direct actif et horaires exacts avec le chargeur/indexeur standard',
 {skip:!fs.existsSync(path.join(__dirname,'..','data','gtfs','stan-nancy.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'},async()=>{
 const archive=path.join(__dirname,'..','data','gtfs','stan-nancy.zip');
 assert.ok(fs.existsSync(archive),'REQUIRE_REAL_GTFS=1 exige le GTFS STAN Nancy collecté');
 const bytes=fs.readFileSync(archive);
 const dates=Array.from({length:7},(_,offset)=>{
  const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
 });
 const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/stan-nancy.zip'},
  {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
 assert.equal(feed.index.counts.routes,42,'le flux courant STAN doit conserver ses 42 lignes');
 let sample=null;
 for(const date of dates){
  for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){
   for(let i=0;i<trip.stops.length&&!sample;i++)for(let j=i+1;j<trip.stops.length;j++){
    const from=trip.stops[i].stopId,to=trip.stops[j].stopId;
    if(!from||!to||from===to)continue;
    const journeys=indexer.directTrips(feed.files,feed.index,date,from,to);
    if(journeys.length){sample={date,from:trip.stops[i],to:trip.stops[j],journey:journeys[0]};break;}
   }
   if(sample)break;
  }
  if(sample)break;
 }
 assert.ok(sample,'aucun couple d’arrêts distinct avec service actif trouvé sur les 7 prochains jours');
 assert.ok(sample.journey.departure&&sample.journey.arrival,'candidat sans horaires exacts');
 assert.equal(sample.journey.date,sample.date);
 for(const stop of [sample.from,sample.to]){
  const indexed=feed.index.stopById.get(stop.stopId);
  assert.ok(indexed,'arrêt du candidat absent de l’index');
  const lat=Number(indexed.stop_lat),lon=Number(indexed.stop_lon);
  assert.ok(lat>=48.60&&lat<=48.74&&lon>=6.09&&lon<=6.29,
   'le candidat doit rester dans l’emprise mesurée du réseau STAN');
 }
});
