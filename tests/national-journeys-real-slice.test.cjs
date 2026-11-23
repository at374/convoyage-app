'use strict';
// Contrôle sur la tranche SNCF réellement publiée (data/gtfs/national-sncf-aura.zip), sans réseau :
// un même train ne doit plus occuper toutes les places du résultat.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const journeys=require('../transport-national-gtfs-journeys.js');
const zip=path.join(__dirname,'..','data','gtfs','national-sncf-aura.zip');
const fetcher=async()=>new Response(fs.readFileSync(zip),{status:200,headers:{'content-type':'application/zip'}});
const search=(from,to)=>journeys.loadAndSearch({operator:'sncf',resource:{url:'https://example.org/national-sncf-aura.zip',format:'GTFS'},fetcher,
 from,to,date:'2026-11-16',earliestDeparture:'08:00:00',radiusMeters:3000,maxResults:20,includeTransfers:true});

test('Thonon → Genève : plusieurs départs distincts, un seul résultat direct par train',{skip:!fs.existsSync(zip)},async t=>{
 const {journeys:rows}=await search({lat:46.3688,lon:6.4816},{lat:46.2102,lon:6.1424});
 if(!rows.length)return t.skip('tranche publiée ne couvrant plus le 16/11/2026');
 const directs=rows.filter(r=>!r.legs);
 assert.equal(new Set(directs.map(r=>r.tripId+'|'+r.departure)).size,directs.length,'un direct par véhicule');
 assert.ok(new Set(rows.map(r=>r.departure)).size>=4,'au moins 4 heures de départ différentes : '+[...new Set(rows.map(r=>r.departure))].join(','));
 for(const t of rows.filter(r=>r.legs))assert.ok(!directs.some(d=>d.departure>=t.departure&&d.arrival<=t.arrival),'correspondance dominée par un direct');
});

test('Lyon Part-Dieu → Grenoble : pas de correspondance Perrache → Part-Dieu quand le direct existe',{skip:!fs.existsSync(zip)},async t=>{
 const {journeys:rows}=await search({lat:45.7606,lon:4.8593},{lat:45.1914,lon:5.7143});
 if(!rows.length)return t.skip('tranche publiée ne couvrant plus le 16/11/2026');
 assert.ok(rows.filter(r=>!r.legs).length>=5);
 assert.ok(!rows.some(r=>r.legs&&/Perrache/.test(r.originStop?.name||r.originStop?.stop_name||'')));
});

test('coordonnées GPS hors bornes : aucun téléchargement national lancé',async()=>{
 let requests=0;
 const badFetch=async()=>{requests++;throw Error('download should not start');};
 await assert.rejects(journeys.loadAndSearch({
  operator:'sncf',resource:{url:'https://example.org/national-sncf-aura.zip',format:'GTFS'},
  fetcher:badFetch,date:'2026-11-16',from:{lat:91,lon:6.1},to:{lat:46.2,lon:6.2}
 }),/Valid exact coordinates/);
 assert.equal(requests,0);
});

test('fenêtre horaire impossible : aucune recherche nationale coûteuse',()=>{
 const indexer=require('../transport-gtfs-index.js');
 const original=indexer.nearbyDirectTrips;
 let calls=0;
 indexer.nearbyDirectTrips=()=>{calls++;throw Error('should not scan');};
 try{
  const rows=journeys.search({operator:'sncf',files:{},index:{},date:'2026-11-30',
   from:{lat:45.9,lon:6.12},to:{lat:45.76,lon:4.86},
   earliestDeparture:'12:00:00',latestArrival:'11:00:00',includeTransfers:true});
  assert.deepEqual(rows,[]);
  assert.equal(calls,0);
 }finally{indexer.nearbyDirectTrips=original;}
});

test('paramètres de recherche invalides : aucun téléchargement national',async()=>{
 let requests=0;
 const fetcher=async()=>{requests++;throw Error('unexpected download');};
 const base={operator:'sncf',resource:{url:'https://example.org/gtfs.zip',format:'GTFS'},
  fetcher,date:'2026-11-30',from:{lat:45.9,lon:6.12},to:{lat:45.76,lon:4.86}};
 for(const options of [
  {radiusMeters:9000},{maxResults:0},{maxResults:101},
  {earliestDeparture:'08:xx'},{latestArrival:'24:99'}
 ]){
  await assert.rejects(journeys.loadAndSearch({...base,...options}),/before GTFS download/);
 }
 assert.equal(requests,0);
});

test('fenêtre impossible : téléchargement national évité et aucun trajet',async()=>{
 let requests=0;
 const result=await journeys.loadAndSearch({
  operator:'sncf',resource:{url:'https://example.org/gtfs.zip',format:'GTFS'},
  fetcher:async()=>{requests++;throw Error('download should not start');},
  date:'2026-11-30',from:{lat:45.9,lon:6.12},to:{lat:45.76,lon:4.86},
  earliestDeparture:'13:00',latestArrival:'12:59:59'
 });
 assert.equal(requests,0);
 assert.deepEqual(result.journeys,[]);
 assert.equal(result.skippedDownload,'impossible-time-window');
 assert.equal(result.counts.stops,0);
 assert.equal(result.counts.routes,0);
 assert.equal(result.counts.trips,0);
});
