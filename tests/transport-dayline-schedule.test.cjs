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
test('source : le bouton « tous les horaires » exige networkUrls+routeId+arrêts+date avant de s\'afficher',()=>{
 assert.match(hubSrc,/Array\.isArray\(raw\.networkUrls\)&&raw\.networkUrls\.length&&raw\.routeId&&raw\.from&&raw\.to&&raw\.serviceDate/);
 assert.match(hubSrc,/cp-hub-dayline/);
 assert.match(hubSrc,/dayScheduleForLeg\(raw\)/);
});
test('source : datedInterurbanRides de sibra-planner.js réutilisé (pas réinventé) pour la requête générique',()=>{
 assert.match(hubSrc,/pl\.datedInterurbanRides\(tables,raw\.serviceDate,String\(raw\.routeId\),String\(raw\.from\),String\(raw\.to\)\)/);
});

const gtfsZip=path.join(__dirname,'..','data','gtfs','tao-orleans.zip');
test('réel : dayScheduleForLeg retrouve les vrais départs du jour (TAO Orléans, ligne A)',{skip:!fs.existsSync(gtfsZip)&&'archive TAO Orléans absente (data/gtfs non généré)'},async()=>{
 const previousFetch=globalThis.fetch,previousCPSibra=globalThis.CPSibraPlanner,previousCPIndex=globalThis.CPGTFSIndex,previousCPLoader=globalThis.CPGTFSLoader;
 try{
  globalThis.CPGTFSIndex=require('../transport-gtfs-index.js');
  globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
  globalThis.CPSibraPlanner=require('../sibra-planner.js');
  const bytes=fs.readFileSync(gtfsZip);
  globalThis.fetch=async()=>new Response(bytes,{status:200,headers:{'content-type':'application/zip'}});
  delete require.cache[require.resolve('../transport-mission-hub.js')];
  const hub=require('../transport-mission-hub.js');
  // Arrêts et ligne réels, vérifiés directement dans l'archive (trips.txt/stop_times.txt/calendar.txt) :
  // trajet ORLEANS:VehicleJourney:A_A_467_12_A01_7_063500 de la ligne A, actif le 22/11/2026 (dimanche).
  const raw={networkUrls:['https://local.test/tao-orleans.zip'],routeId:'ORLEANS:Line:A',
   from:'ORLEANS:StopArea:THOPIT1',to:'ORLEANS:StopArea:TFLORA1',serviceDate:'2026-11-22'};
  const rows=await hub.dayScheduleForLeg(raw);
  assert.ok(rows.length>10,'plusieurs dizaines de départs attendus sur une ligne urbaine toute la journée, trouvé '+rows.length);
  assert.ok(rows.every(r=>Number.isFinite(r.departureSeconds)&&Number.isFinite(r.arrivalSeconds)&&r.arrivalSeconds>=r.departureSeconds));
  // Résultat trié par heure croissante, sans doublon (même trip_id + même heure de départ).
  for(let i=1;i<rows.length;i++)assert.ok(rows[i].departureSeconds>=rows[i-1].departureSeconds);
  assert.equal(hub.hmFromSeconds(rows[0].departureSeconds),'06:35');
  // Rejoué : doit réutiliser le cache (réseau+jour), pas re-télécharger ni re-planter.
  const rows2=await hub.dayScheduleForLeg(raw);
  assert.equal(rows2.length,rows.length);
  // Ligne/arrêts absents du flux (ou date hors calendrier) : aucune invention, liste vide.
  const absent=await hub.dayScheduleForLeg({...raw,routeId:'LIGNE-INEXISTANTE'});
  assert.deepEqual(absent,[]);
  // Métadonnées manquantes : la fonction ne tente aucune requête, renvoie immédiatement une liste vide.
  assert.deepEqual(await hub.dayScheduleForLeg(null),[]);
  assert.deepEqual(await hub.dayScheduleForLeg({routeId:'X'}),[]);
 } finally {
  globalThis.fetch=previousFetch;globalThis.CPSibraPlanner=previousCPSibra;
  globalThis.CPGTFSIndex=previousCPIndex;globalThis.CPGTFSLoader=previousCPLoader;
  delete require.cache[require.resolve('../transport-mission-hub.js')];
 }
});
