'use strict';
// Contrôle sur la tranche SNCF réellement publiée (data/gtfs/national-sncf-aura.zip), sans réseau :
// un même train ne doit plus occuper toutes les places du résultat.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const journeys=require('../transport-national-gtfs-journeys.js');
const zip=path.join(__dirname,'..','data','gtfs','national-sncf-aura.zip');
const fetcher=async()=>new Response(fs.readFileSync(zip),{status:200,headers:{'content-type':'application/zip'}});
const search=(from,to)=>journeys.loadAndSearch({operator:'sncf',resource:{url:'https://example.org/national-sncf-aura.zip',format:'GTFS'},fetcher,
 from,to,date:'2026-11-27',earliestDeparture:'08:00:00',radiusMeters:3000,maxResults:20,includeTransfers:true});

test('Thonon → Genève : plusieurs départs distincts, un seul résultat direct par train',{skip:!fs.existsSync(zip)},async t=>{
 const {journeys:rows}=await search({lat:46.3688,lon:6.4816},{lat:46.2102,lon:6.1424});
 if(!rows.length)return t.skip('tranche publiée ne couvrant plus le 27/11/2026');
 const directs=rows.filter(r=>!r.legs);
 assert.equal(new Set(directs.map(r=>r.tripId+'|'+r.departure)).size,directs.length,'un direct par véhicule');
 assert.ok(new Set(rows.map(r=>r.departure)).size>=4,'au moins 4 heures de départ différentes : '+[...new Set(rows.map(r=>r.departure))].join(','));
 for(const t of rows.filter(r=>r.legs))assert.ok(!directs.some(d=>d.departure>=t.departure&&d.arrival<=t.arrival),'correspondance dominée par un direct');
});

test('Lyon Part-Dieu → Grenoble : pas de correspondance Perrache → Part-Dieu quand le direct existe',{skip:!fs.existsSync(zip)},async t=>{
 const {journeys:rows}=await search({lat:45.7606,lon:4.8593},{lat:45.1914,lon:5.7143});
 if(!rows.length)return t.skip('tranche publiée ne couvrant plus le 27/11/2026');
 assert.ok(rows.filter(r=>!r.legs).length>=5);
 assert.ok(!rows.some(r=>r.legs&&/Perrache/.test(r.originStop?.name||r.originStop?.stop_name||'')));
});

test('SNCF : la fiche retrouve la grille de la ligne même sans configuration globale',async()=>{
 globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
 globalThis.CPSibraPlanner=require('../sibra-planner.js');
 const hub=require('../transport-mission-hub.js');
 const resource={url:'https://example.org/national-sncf-aura.zip',format:'GTFS'};
 const {journeys:rows}=await search({lat:45.7606,lon:4.8593},{lat:45.1914,lon:5.7143});
 const direct=rows.find(row=>!row.legs);
 assert.ok(direct?.routeId);
 const [result]=hub.fromNationalGTFS([direct],'sncf',resource);
 const source=hub.scheduleSourceForLeg(result.legs[0]);
 assert.equal(source.from,direct.fromStopId);
 assert.equal(source.to,direct.toStopId);
 const previousFetch=globalThis.fetch;
 try{
  globalThis.fetch=fetcher;
  const schedule=await hub.dayScheduleForLeg(source);
  assert.ok(schedule.length>1);
  assert.ok(schedule.some(row=>hub.hmFromSeconds(row.departureSeconds)===direct.departure.slice(0,5)));
 }finally{globalThis.fetch=previousFetch;}
});

for(const operator of ['blablacarBus','flixbus']){
 test(operator+' : le bouton charge les départs du jour depuis le flux utilisé par la recherche',async()=>{
  globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
  globalThis.CPSibraPlanner=require('../sibra-planner.js');
  const hub=require('../transport-mission-hub.js');
  const file='national-'+operator+'-aura.zip';
  const resource={url:'https://example.org/'+file,format:'GTFS'};
  const fetcher=async()=>new Response(fs.readFileSync(path.join(path.dirname(zip),file)));
  const {journeys:rows}=await journeys.loadAndSearch({operator,resource,fetcher,date:'2026-11-27',
   from:{lat:45.748,lon:4.826},to:{lat:45.1914,lon:5.7143},radiusMeters:5000});
  const direct=rows.find(row=>!row.legs);
  assert.ok(direct?.routeId);
  const [result]=hub.fromNationalGTFS([direct],operator,resource);
  const previousFetch=globalThis.fetch;
  try{
   globalThis.fetch=fetcher;
   const schedule=await hub.dayScheduleForLeg(hub.scheduleSourceForLeg(result.legs[0]));
   assert.ok(schedule.some(row=>hub.hmFromSeconds(row.departureSeconds)===direct.departure.slice(0,5)));
  }finally{globalThis.fetch=previousFetch;}
 });
}

test('Paris–Lyon charge un seul extrait par opérateur et fournit la grille du trajet',async()=>{
 globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
 globalThis.CPSibraPlanner=require('../sibra-planner.js');
 const hub=require('../transport-mission-hub.js');
 const lyon={lat:45.7504,lon:4.829};
 const task={from:{lat:48.8443,lon:2.373},to:lyon,earliestDeparture:'2026-11-27T06:00:00+01:00'};
 const operators=['sncf','blablacarBus','flixbus'];
 const loads=[];
 const fetcher=async url=>{
  loads.push(url);
  return new Response(fs.readFileSync(path.join(path.dirname(zip),new URL(url).pathname.split('/').pop())));
 };
 const nationalGTFSResources=Object.fromEntries(operators.flatMap(operator=>[
  [operator,{url:'https://example.org/national-'+operator+'-aura.zip',bounds:[44,3.6,46.7,7.4]}],
  [operator+'_paris_lyon',{operator,url:'https://example.org/national-'+operator+'-paris-lyon.zip',
   bounds:[45.55,2.15,49.05,5.45]}]
 ]));
 const providers=hub.makeProviders({CPNationalGTFSJourneys:journeys},{nationalGTFSResources,fetcher});
 const previousFetch=globalThis.fetch;
 try{
  globalThis.fetch=fetcher;
  for(const operator of operators){
   const aura=providers['national_'+operator],corridor=providers['national_'+operator+'_paris_lyon'];
   assert.equal(aura.enabled(task),false);
   assert.equal(corridor.enabled(task),true);
   assert.equal(corridor.enabled({...task,to:{lat:43.30,lon:5.38}}),false);
   const [trip]=await corridor.run(task);
   assert.ok(trip);
   for(const leg of trip.legs){
    const source=hub.scheduleSourceForLeg(leg);
    assert.ok(source?.networkUrls[0].endsWith('-paris-lyon.zip'));
    const schedule=await hub.dayScheduleForLeg(source);
    const time=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(leg.departure));
    assert.ok(schedule.some(row=>hub.hmFromSeconds(row.departureSeconds)===time));
   }
  }
  assert.ok(loads.every(url=>url.endsWith('-paris-lyon.zip')));
 }finally{globalThis.fetch=previousFetch;}
});
