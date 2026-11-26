'use strict';
// 21/11/2026 : bouton « tous les horaires de la ligne » généralisé à toute fiche mission (demande Laurent,
// qui n'existait jusqu'ici que pour Y51 Albertville). Deux volets testés ici :
//  A. Le câblage source (métadonnées posées sur chaque ligne GTFS locale, garde-fous du bouton dans card()).
//  B. Le vrai calcul (dayScheduleForLeg/gtfsTablesForDaySchedule) contre une archive GTFS réelle déjà
//     publiée par le pipeline serveur (data/gtfs/tao-orleans.zip), sans rien inventer côté test.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const hubSrc=fs.readFileSync(path.join(__dirname,'..','transport-mission-hub.js'),'utf8');

test('source : chaque ligne locale GTFS porte networkId/networkUrls/serviceDate pour le bouton horaires du jour',()=>{
 assert.match(hubSrc,/networkId:id,networkUrls:urls,serviceDate:date/);
});
test('source : chaque étape motorisée a un bouton, même sans identifiants GTFS',()=>{
 assert.match(hubSrc,/scheduleSourceForLeg\(l\)/);
 assert.match(hubSrc,/\.catch\(showSource\)/);
 assert.match(hubSrc,/cp-hub-dayline/);
 assert.match(hubSrc,/dayScheduleForLeg\(raw\)/);
});
test('source : datedInterurbanRides de sibra-planner.js réutilisé (pas réinventé) pour la requête générique',()=>{
 assert.match(hubSrc,/pl\.datedInterurbanRides\(tables,raw\.serviceDate,String\(route\),String\(from\),String\(to\)\)/);
});

const gtfsZip=path.join(__dirname,'..','data','gtfs','tao-orleans.zip');
test('réel : dayScheduleForLeg retrouve les vrais départs du jour (TAO Orléans, ligne A)',{skip:!fs.existsSync(gtfsZip)&&'archive TAO Orléans absente (data/gtfs non généré)'},async()=>{
 const previousFetch=globalThis.fetch,previousCPSibra=globalThis.CPSibraPlanner,previousCPIndex=globalThis.CPGTFSIndex,previousCPLoader=globalThis.CPGTFSLoader,previousCache=globalThis.caches;
 try{
  globalThis.CPGTFSIndex=require('../transport-gtfs-index.js');
  globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
  globalThis.CPSibraPlanner=require('../sibra-planner.js');
  const bytes=fs.readFileSync(gtfsZip);
  let network=0,cacheReads=0;
  globalThis.fetch=async()=>{network++;throw Error('archive déjà en cache');};
  globalThis.caches={open:async name=>{
   assert.equal(name,'cp-gtfs-zips');
   return {match:async()=>{cacheReads++;return new Response(bytes,{headers:{'content-type':'application/zip','x-cp-saved':String(Date.now())}});}};
  }};
  delete require.cache[require.resolve('../transport-mission-hub.js')];
  const hub=require('../transport-mission-hub.js');
  // Arrêts et ligne réels, vérifiés directement dans l'archive (trips.txt/stop_times.txt/calendar.txt) :
  // trajet ORLEANS:VehicleJourney:A_A_467_12_A01_7_063500 de la ligne A, actif le 22/11/2026 (dimanche).
  const raw={networkUrls:['https://local.test/data/gtfs/tao-orleans.zip'],routeId:'ORLEANS:Line:A',
   from:'ORLEANS:StopArea:THOPIT1',to:'ORLEANS:StopArea:TFLORA1',serviceDate:'2026-11-22'};
  const rows=await hub.dayScheduleForLeg(raw);
  assert.ok(rows.length>10,'plusieurs dizaines de départs attendus sur une ligne urbaine toute la journée, trouvé '+rows.length);
  assert.ok(rows.every(r=>Number.isFinite(r.departureSeconds)&&Number.isFinite(r.arrivalSeconds)&&r.arrivalSeconds>=r.departureSeconds));
  // Résultat trié par heure croissante, sans doublon (même trip_id + même heure de départ).
  for(let i=1;i<rows.length;i++)assert.ok(rows[i].departureSeconds>=rows[i-1].departureSeconds);
  assert.equal(hub.hmFromSeconds(rows[0].departureSeconds),'06:35');
  // Rejoué : doit réutiliser le cache (réseau+jour), pas re-télécharger ni re-planter.
  const originalIndexer=globalThis.CPGTFSIndex;
  let repeatedScans=0;
  globalThis.CPGTFSIndex={...originalIndexer,directTrips(...args){
   repeatedScans++;
   return originalIndexer.directTrips(...args);
  }};
  const rows2=await hub.dayScheduleForLeg(raw);
  assert.equal(repeatedScans,0);
  const firstDeparture=rows2[0].departureSeconds;
  rows[0].departureSeconds=0;
  assert.equal((await hub.dayScheduleForLeg(raw))[0].departureSeconds,firstDeparture);
  rows[0].departureSeconds=firstDeparture;
  assert.deepEqual(rows2,rows);
  assert.equal(cacheReads,1);
  assert.equal(network,0);
  globalThis.CPGTFSIndex=null;
  const legacy=await hub.dayScheduleForLeg(raw);
  const slots=list=>list.map(({departureSeconds,arrivalSeconds})=>[departureSeconds,arrivalSeconds]);
  assert.deepEqual(slots(rows),slots(legacy));
  globalThis.CPGTFSIndex=require('../transport-gtfs-index.js');
  // Ligne/arrêts absents du flux (ou date hors calendrier) : aucune invention, liste vide.
  const absent=await hub.dayScheduleForLeg({...raw,routeId:'LIGNE-INEXISTANTE'});
  assert.deepEqual(absent,[]);
  // Métadonnées manquantes : la fonction ne tente aucune requête, renvoie immédiatement une liste vide.
  assert.deepEqual(await hub.dayScheduleForLeg(null),[]);
  assert.deepEqual(await hub.dayScheduleForLeg({routeId:'X'}),[]);
 } finally {
  globalThis.fetch=previousFetch;globalThis.CPSibraPlanner=previousCPSibra;
  globalThis.CPGTFSIndex=previousCPIndex;globalThis.CPGTFSLoader=previousCPLoader;globalThis.caches=previousCache;
  delete require.cache[require.resolve('../transport-mission-hub.js')];
 }
});

test('Voiron : horaires du bus 31 même sans identifiants GTFS dans la fiche',async()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'..','data','gtfs','mreso-voironnais.zip'));
 const previous=[globalThis.fetch,globalThis.CPGTFSLoader,globalThis.CPSibraPlanner];
 try{
  globalThis.fetch=async()=>new Response(bytes);
  globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
  globalThis.CPSibraPlanner=require('../sibra-planner.js');
  const hub=require('../transport-mission-hub.js');
  const source=hub.scheduleSourceForLeg({line:'31',departure:'2026-11-25T13:59:00+01:00',
   fromPoint:{lat:45.364034,lon:5.594959},toPoint:{lat:45.38283,lon:5.57852}});
  assert.ok(source?.networkUrls[0].endsWith('mreso-voironnais.zip'));
  const rows=await hub.dayScheduleForLeg(source);
  assert.ok(rows.length>1);
  assert.ok(rows.some(row=>hub.hmFromSeconds(row.departureSeconds)==='13:59'));
 }finally{
  [globalThis.fetch,globalThis.CPGTFSLoader,globalThis.CPSibraPlanner]=previous;
 }
});

test('Sibra : la fiche sans identifiants GTFS retrouve les 20 horaires entre Mairie Épagny et Hôpital',async()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'..','data','gtfs','sibra-annecy.zip'));
 const previous=[globalThis.fetch,globalThis.CPGTFSLoader,globalThis.CPSibraPlanner];
 try{
  let downloads=0,scans=0;
  globalThis.fetch=async url=>{
   downloads++;
   assert.ok(url.endsWith('/sibra-annecy.zip'));
   return new Response(bytes);
  };
  globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
  const planner=require('../sibra-planner.js');
  globalThis.CPSibraPlanner={...planner,datedInterurbanRides(...args){
   scans++;
   return planner.datedInterurbanRides(...args);
  }};
  const hub=require('../transport-mission-hub.js');
  const source=hub.scheduleSourceForLeg({provider:'SIBRA',line:'25',from:'Mairie Épagny',to:'Hôpital',
   departure:'2026-11-27T05:56:00+01:00'});
  const [rows,duplicate]=await Promise.all([hub.dayScheduleForLeg(source),hub.dayScheduleForLeg(source)]);
  assert.deepEqual(duplicate,rows);
  assert.equal(downloads,1);
  assert.ok(scans>0);
  const initialScans=scans;
  assert.deepEqual(await hub.dayScheduleForLeg(source),rows);
  assert.equal(scans,initialScans);
  const now=Date.now;
  try{
   const expired=now()+12*3600*1000;
   Date.now=()=>expired;
   assert.deepEqual(await hub.dayScheduleForLeg(source),rows);
   assert.equal(downloads,2);
   assert.equal(scans,2*initialScans);
  }finally{
   Date.now=now;
  }
  const clocks=rows.map(row=>[hub.hmFromSeconds(row.departureSeconds),hub.hmFromSeconds(row.arrivalSeconds)]);
  assert.equal(clocks.length,20);
  assert.deepEqual(clocks[0],['05:56','06:07']);
  assert.deepEqual(clocks.at(-1),['19:53','20:03']);
 }finally{
  [globalThis.fetch,globalThis.CPGTFSLoader,globalThis.CPSibraPlanner]=previous;
 }
});

test('le rendu rouvre les grilles par identité d’étape et non par position dans la carte',()=>{
 assert.match(hubSrc,/data-ride-key',signature\(\{legs:\[l\]\}\)/);
 assert.match(hubSrc,/\.cp-hub-dayline\[aria-expanded="true"\]/);
 assert.match(hubSrc,/expandedSchedules\.has\(button\.getAttribute\('data-ride-key'\)\)\)button\.click\(\)/);
});

const starZip=path.join(__dirname,'..','data','gtfs','start-thonon.zip');
test('réel : le bus C de la fiche Thonon affiche tous ses départs et leur terminus',
 {skip:!fs.existsSync(starZip)&&'archive Star’t absente'},async t=>{
  const previous={fetch:globalThis.fetch,caches:globalThis.caches,
   CPGTFSIndex:globalThis.CPGTFSIndex,CPGTFSLoader:globalThis.CPGTFSLoader};
  t.after(()=>Object.assign(globalThis,previous));
  globalThis.CPGTFSIndex=require('../transport-gtfs-index.js');
  globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
  globalThis.caches=undefined;
  globalThis.fetch=async url=>{
   assert.match(String(url),/start-thonon\.zip$/);
   return new Response(fs.readFileSync(starZip),{headers:{'content-type':'application/zip'}});
  };
  const hub=require('../transport-mission-hub.js');
  const raw=hub.scheduleSourceForLeg({mode:'Bus',line:'B C (But)',provider:'tpg',
   from:'Thonon-les-Bains, Les Arts',to:'Thonon-les-Bains, Serres Mun.',
   departure:'2026-11-23T08:40:00+01:00'});
  assert.equal(raw.routeId,'C');
  assert.match(raw.sourceUrl,/www\.star-t\.fr/);
  const rows=await hub.dayScheduleForLeg(raw);
  assert.equal(rows.length,21);
  assert.equal(hub.hmFromSeconds(rows[0].departureSeconds),'06:10');
  assert.equal(hub.hmFromSeconds(rows.at(-1).departureSeconds),'19:26');
  const ride=rows.find(row=>hub.hmFromSeconds(row.departureSeconds)==='08:40');
  assert.equal(hub.hmFromSeconds(ride.arrivalSeconds),'08:57');
  assert.match(ride.terminus,/^Saint Disdille campings$/i);
 });

test('BlaBlaCar Bus regroupe tous les départs du segment même si les itinéraires complets diffèrent',async t=>{
 const previous={CPGTFSIndex:globalThis.CPGTFSIndex,CPGTFSLoader:globalThis.CPGTFSLoader};
 t.after(()=>Object.assign(globalThis,previous));
 const primary={agency_id:'0',route_short_name:'BlaBlaCar Bus',route_long_name:'Lyon > Aéroport > Grenoble'};
 const routeById=new Map([
  ['first',primary],['second',{...primary}],
  ['other-pattern',{...primary,route_long_name:'Lyon > Aéroport > Chambéry'}],
  ['other-agency',{...primary,agency_id:'1'}]
 ]);
 globalThis.CPGTFSLoader={loadResource:async()=>({files:{},index:{routeById}})};
 globalThis.CPGTFSIndex={directTrips:()=>[...routeById.keys()].map((routeId,i)=>({
  routeId,tripId:routeId,departure:(10+i)+':00:00',arrival:(10+i)+':30:00',
  terminus:'Grenoble'
 }))};
 const hub=require('../transport-mission-hub.js');
 const rows=await hub.dayScheduleForLeg({networkUrls:['https://local.test/coaches.zip'],
  routeId:'first',from:'XYL',to:'LYS',serviceDate:'2026-11-26'});
 assert.deepEqual(rows.map(row=>[hub.hmFromSeconds(row.departureSeconds),row.terminus]),
  [['10:00','Grenoble'],['11:00','Grenoble'],['12:00','Grenoble']]);
});
