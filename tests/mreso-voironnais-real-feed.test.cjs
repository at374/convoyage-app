'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const loader=require('../transport-gtfs-loader.js');
const indexer=require('../transport-gtfs-index.js');

const DATA=process.env.GTFS_TEST_DATA_DIR||path.join(__dirname,'..','data','gtfs');
test('M Réso Voironnais réel : bus 31 de la gare de Voiron à Louis Néel, puis marche vers Rue Louis Armand',{
 skip:!fs.existsSync(path.join(DATA,'mreso-voironnais.zip'))&&process.env.REQUIRE_REAL_GTFS!=='1'
},async()=>{
 const archive=path.join(DATA,'mreso-voironnais.zip');
 assert.ok(fs.existsSync(archive),'REQUIRE_REAL_GTFS=1 exige le GTFS courant M Réso Voironnais');
 const manifest=JSON.parse(fs.readFileSync(path.join(DATA,'manifest.json'),'utf8'));
 const entry=manifest.networks?.['mreso-voironnais'];
 assert.ok(entry&&entry.license==='ODbL 1.0 + conditions particulières PAN','entrée/licence absente du manifeste');
 assert.ok(Array.isArray(entry.bounds)&&entry.bounds.length===4,'emprise réelle absente');
 const bytes=fs.readFileSync(archive);
 assert.ok(bytes.length<12*1024*1024,'archive dépasse le plafond mobile');
 const date='2026-11-25';
 const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/mreso-voironnais.zip'},
  {fetcher:async()=>new Response(bytes),indexServiceDates:[date],retainSourceTables:true});
 assert.ok(feed.index.counts.routes>0&&feed.index.counts.stops>0,'index M Réso Voironnais vide');
 const stations=indexer.nearbyStops(feed.index,45.364034,5.594959,250)
  .filter(stop=>/voiron.*sncf/i.test(stop.name));
 const destinations=indexer.nearbyStops(feed.index,45.381682,5.579257,250)
  .filter(stop=>/voiron.*louis neel/i.test(stop.name));
 assert.ok(stations.length,'arrêt bus à la gare SNCF de Voiron introuvable');
 assert.ok(destinations.length,'arrêt Louis Néel près de Rue Louis Armand introuvable');
 let bus=null,station=null,destination=null;
 searchPairs:for(const from of stations)for(const to of destinations){
  bus=indexer.directTrips(feed.files,feed.index,date,from.stopId,to.stopId).find(row=>row.line==='31');
  if(bus){station=from;destination=to;break searchPairs;}
 }
 assert.ok(bus,'aucun horaire actif de la ligne 31 entre la gare et Louis Néel');
 assert.match(bus.departure,/^\d{1,3}:[0-5]\d:[0-5]\d$/);
 assert.match(bus.arrival,/^\d{1,3}:[0-5]\d:[0-5]\d$/);
 assert.ok(station.distanceMeters<100,'marche de quai jusqu’à l’arrêt à contrôler');
 assert.ok(destination.distanceMeters<250,'marche de Louis Néel à la rue à contrôler');
 assert.ok(indexer.directTrips(feed.files,feed.index,date,station.stopId,destination.stopId).filter(row=>row.line==='31').length>1,
  'la grille de la journée doit exposer plusieurs horaires de la ligne 31');
 for(const stop of [station,destination])
  assert.ok(stop.lat>=entry.bounds[0]&&stop.lat<=entry.bounds[2]&&stop.lon>=entry.bounds[1]&&stop.lon<=entry.bounds[3],
   'arrêt du trajet hors emprise réelle du manifeste');
});
