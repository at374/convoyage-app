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

const lyon={lat:45.7504,lon:4.829};
const marseille={lat:43.303,lon:5.380};
for(const [slug,bounds,from,to] of [
 ['paris-lyon',[45.55,2.15,49.05,5.45],{lat:48.8443,lon:2.373},lyon],
 ['lyon-marseille',[43.10,3.65,46.15,5.85],lyon,marseille],
 ['paris-marseille',[43.10,2.15,49.05,5.85],{lat:48.8443,lon:2.373},marseille],
 ['marseille-toulouse',[43.05,1.25,44.25,5.65],marseille,{lat:43.611,lon:1.454}],
 ['toulouse-bordeaux',[43.45,-0.85,45.02,1.7],{lat:43.611,lon:1.454},{lat:44.8262,lon:-0.5564}],
 ['bordeaux-nantes',[44.65,-2.0,47.44,0.55],{lat:44.8262,lon:-0.5564},{lat:47.2176,lon:-1.5418}],
 ['nantes-rennes',[47.05,-2.05,48.30,-1.20],{lat:47.2176,lon:-1.5418},{lat:48.1035,lon:-1.6726}]
]){
test(slug+' charge un seul extrait par opérateur et fournit la grille du trajet',async()=>{
 globalThis.CPGTFSLoader=require('../transport-gtfs-loader.js');
 globalThis.CPSibraPlanner=require('../sibra-planner.js');
 const hub=require('../transport-mission-hub.js');
 const task={from,to,earliestDeparture:'2026-11-27T06:00:00+01:00'};
 const suffix='_'+slug.replaceAll('-','_');
 const operators=['sncf','blablacarBus','flixbus'];
 const loads=[];
 const fetcher=async url=>{
  loads.push(url);
  return new Response(fs.readFileSync(path.join(path.dirname(zip),new URL(url).pathname.split('/').pop())));
 };
 const nationalGTFSResources=Object.fromEntries(operators.flatMap(operator=>[
  [operator,{url:'https://example.org/national-'+operator+'-aura.zip',bounds:[44,3.6,46.7,7.4]}],
  [operator+suffix,{operator,url:'https://example.org/national-'+operator+'-'+slug+'.zip',
   bounds}]
 ]));
 const providers=hub.makeProviders({CPNationalGTFSJourneys:journeys},{nationalGTFSResources,fetcher});
 const previousFetch=globalThis.fetch;
 try{
  globalThis.fetch=fetcher;
  for(const operator of operators){
   const aura=providers['national_'+operator],corridor=providers['national_'+operator+suffix];
   assert.equal(aura.enabled(task),false);
   assert.equal(corridor.enabled(task),true);
   assert.equal(corridor.enabled({...task,to:{lat:50.64,lon:3.07}}),false);
   const trips=await corridor.run(task);
   const [trip]=trips;
   assert.ok(trip);
   if(slug==='paris-marseille'){
    const localDay=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short'});
    const crossesMidnight=journey=>localDay.format(new Date(journey.legs[0].departure))!==
     localDay.format(new Date(journey.legs.at(-1).arrival));
    const candidate=trips.find(journey=>crossesMidnight(journey)===(operator!=='sncf'));
    assert.ok(candidate,operator+' : trajet '+(operator==='sncf'?'du jour':'après minuit'));
    const assessed=hub.assess(candidate,task,()=>null);
    assert.equal(assessed.reasons.some(reason=>reason.includes('hors plage de jour')),operator!=='sncf',operator);
    const reverse={...task,from:to,to:from};
    assert.equal(corridor.enabled(reverse),true);
    assert.ok((await corridor.run(reverse)).length>0,operator+' Marseille → Paris');
   }
   if(['marseille-toulouse','toulouse-bordeaux','bordeaux-nantes','nantes-rennes'].includes(slug)){
    const reverse={...task,from:to,to:from};
    assert.equal(corridor.enabled(reverse),true);
    for(const [direction,candidates] of [[task,trips],[reverse,await corridor.run(reverse)]]){
     assert.ok(candidates.some(candidate=>candidate.legs.length===1&&
      !hub.assess(candidate,direction,()=>null).reasons.some(reason=>reason.includes('hors plage de jour'))),operator);
    }
   }
   for(const leg of trip.legs){
    const source=hub.scheduleSourceForLeg(leg);
    assert.ok(source?.networkUrls[0].endsWith('-'+slug+'.zip'));
    const schedule=await hub.dayScheduleForLeg(source);
    const time=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(leg.departure));
    assert.ok(schedule.some(row=>hub.hmFromSeconds(row.departureSeconds)===time));
   }
  }
  assert.ok(loads.every(url=>url.endsWith('-'+slug+'.zip')));
 }finally{globalThis.fetch=previousFetch;}
});
}

test('les fenêtres SNCF réutilisent les directs du même jour et filtrent chacune leurs horaires',async()=>{
 const loader=require('../transport-gtfs-loader.js');
 const indexer=require('../transport-gtfs-index.js');
 const resource={url:'https://example.org/national-sncf-aura.zip',format:'GTFS'};
 const date='2026-11-27';
 const {files,index}=await loader.loadResource(resource,{fetcher,indexServiceDates:[date],retainSourceTables:false});
 const base={operator:'sncf',files,date,from:{lat:45.7606,lon:4.8593},to:{lat:45.1914,lon:5.7143},
  radiusMeters:3000,maxResults:20,includeTransfers:false};
 const windows=[{latestArrival:'10:00:00'},{earliestDeparture:'13:00:00'},{latestArrival:'16:00:00'}];
 const expected=windows.map(window=>journeys.search({...base,...window,index:{...index}}));
 const original=indexer.nearbyDirectTrips;
 let scans=0;
 try{
  indexer.nearbyDirectTrips=(...args)=>{scans++;return original(...args);};
  const actual=windows.map(window=>journeys.search({...base,...window,index}));
  assert.deepEqual(actual,expected);
  assert.ok(actual.every(rows=>rows.length>0));
  assert.equal(scans,1);
  journeys.search({...base,index,radiusMeters:4000});
  assert.equal(scans,2);
 }finally{indexer.nearbyDirectTrips=original;}
});

test('le repli national à 5 km réutilise l’archive indexée à 3 km',async()=>{
 let downloads=0;
 const options={operator:'sncf',resource:{url:'https://example.org/national-sncf-aura.zip',format:'GTFS'},
  fetcher:async()=>{downloads++;return fetcher();},feedByDate:new Map(),date:'2026-11-27',
  from:{lat:45.7606,lon:4.8593},to:{lat:45.1914,lon:5.7143}};
 for(const radiusMeters of [3000,5000]){
  const result=await journeys.loadAndSearch({...options,radiusMeters});
  assert.ok(result.journeys.length);
 }
 assert.equal(downloads,1);
 await journeys.loadAndSearch({...options,date:'2026-11-28'});
 assert.equal(downloads,2);
});

test('deux créneaux sans worker partagent le chargement même si le premier est annulé',async()=>{
 const hub=require('../transport-mission-hub.js');
 const controller=new AbortController();
 let downloads=0,release;
 const gate=new Promise(resolve=>{release=resolve;});
 const providers=hub.makeProviders({CPNationalGTFSJourneys:journeys},{
  fetcher:async()=>{downloads++;await gate;return fetcher();},
  nationalGTFSResources:{sncf:{url:'https://example.org/national-sncf-aura.zip'}}
 });
 const task={from:{lat:45.7606,lon:4.8593},to:{lat:45.1914,lon:5.7143},earliestDeparture:'2026-11-27T08:00:00+01:00'};
 try{
  const first=providers.national_sncf.run(task,controller.signal);
  const second=providers.national_sncf.run({...task,earliestDeparture:'2026-11-27T13:00:00+01:00'});
  controller.abort();
  await assert.rejects(first,{name:'AbortError'});
  release();
  assert.ok((await second).length);
  assert.equal(downloads,1);
 }finally{release();providers.dispose();}
});
