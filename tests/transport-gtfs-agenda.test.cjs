const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const agenda=require('../transport-gtfs-agenda.js');
const point={lat:45.9,lon:6.1};
const task={label:'Retour',from:point,to:{lat:45.67,lon:6.39},earliestDeparture:'2026-11-02T11:00:00+01:00'};
class Element{
 constructor(doc){this.ownerDocument=doc;this.children=[];this.value='';this.isConnected=true;}
 set textContent(value){this.value=value;this.children=[];}
 get textContent(){return this.value+this.children.map(c=>c.textContent).join('');}
 appendChild(child){this.children.push(child);return child;}
 setAttribute(name,value){this[name]=value;}
 closest(){return null;}
}
function panel(){const doc={createElement(){return new Element(doc);}};doc.documentElement=new Element(doc);return new Element(doc);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const summary={source:{loadedAt:'2026-10-30T16:00:00Z'},counts:{stops:1641}};
function row(extra={}){return {tripId:'T',from:'A',to:'B',line:'Y51',timeZone:'Europe/Paris',
 departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T12:00:00Z',
 originStop:{name:'École <script>',lat:45.67,lon:6.39},destinationStop:{name:'Annecy',lat:45.9,lon:6.1},accessDistanceMeters:10,egressDistanceMeters:20,...extra};}
test('geographic selection is a bounded heuristic and requires two valid points and HTTPS GTFS',()=>{
 const resource=agenda.DEFAULT_RESOURCES[0];
 assert.equal(agenda.selected(resource,task),true);
 assert.equal(agenda.selected(resource,{...task,to:null}),false);
 assert.equal(agenda.selected(resource,{...task,to:{lat:48.8,lon:2.3}}),false);
 assert.equal(agenda.selected(resource,{...task,from:{lat:'45.9',lon:6.1}}),false);
 assert.equal(agenda.selected({...resource,url:'http://example.org'},task),false);
});
test('time windows include previous service days, explicit horizon, margin and midnight crossing',()=>{
 const w=agenda.searchWindow(task);
 assert.equal(w.marginMinutes,0);
 assert.deepEqual(agenda.serviceDates(w,'Europe/Paris'),['2026-11-01','2026-11-02','2026-11-03']);
 const outbound=agenda.searchWindow({latestArrival:'2026-11-02T12:00:00+01:00',marginMinutes:15});
 assert.equal(outbound.marginMinutes,15);
 assert.equal(Date.parse(outbound.latestArrival)-Date.parse(outbound.earliestDeparture),86400000);
 const long=agenda.searchWindow({...task,latestArrival:'2026-11-09T12:00:00+01:00'});
 assert.equal(Date.parse(long.latestArrival)-Date.parse(long.earliestDeparture),48*3600000);
 assert.throws(()=>agenda.searchWindow({}),/Missing/);
 for(const latestArrival of ['2026-02-30T12:00:00Z','2026-11-02T24:00:00Z'])assert.throws(()=>agenda.searchWindow({latestArrival}),/timestamp/);
 assert.throws(()=>agenda.searchWindow({...task,latestArrival:'2026-11-02T12:00:00'}),/timestamp/);
 assert.throws(()=>agenda.searchWindow({...task,latestArrival:'2026-11-01T12:00:00Z'}),/Inverted/);
});
test('mount shares one load across tasks, deduplicates rows, uses text nodes and reports limits',async()=>{
 const target=panel(),calls=[];let loads=0,disposed=0;
 const client={async load(){loads++;return summary;},async query(query){calls.push(query);return {rows:[row(),row()],truncated:true};},dispose(){disposed++;}};
 const session=agenda.mount(target,{tasks:[task,{...task,label:'Aller',earliestDeparture:undefined,latestArrival:'2026-11-02T13:00:00Z'}],clientFactory:()=>client});
 await session.done;
 assert.equal(loads,1);assert.ok(calls.length>=4);
 assert.equal(calls[0].method,'missionJourneys');assert.equal(calls[0].radiusMeters,700);
 assert.equal(calls[0].order,'earliestDeparture');assert.ok(calls.some(q=>q.order==='latestDeparture'));
 assert.deepEqual(calls[0].connectionDates,agenda.serviceDates(agenda.searchWindow(task),'Europe/Paris'));
 assert.match(target.textContent,/voir l’arrêt/);
 assert.match(target.textContent,/Retour : 1 horaire/);assert.match(target.textContent,/Aller : 1 horaire/);
 assert.match(target.textContent,/École <script>/);assert.match(target.textContent,/vol d’oiseau/);
 assert.match(target.textContent,/date de mise à jour du producteur non fournie/);
 assert.match(target.textContent,/Affichage limité/);assert.match(target.textContent,/Transport non confirmé/);
 session.dispose();session.dispose();assert.equal(disposed,1);
});
test('disposing during load or query prevents stale results and terminates retained client',async()=>{
 for(const stage of ['load','query']){
  const target=panel(),gate=deferred();let disposed=0;
  const client={load:()=>stage==='load'?gate.promise:Promise.resolve(summary),query:()=>gate.promise,dispose(){disposed++;}};
  const session=agenda.mount(target,{tasks:[task],clientFactory:()=>client});
  await Promise.resolve();session.dispose();
  const before=target.textContent;gate.resolve(stage==='load'?summary:{rows:[row()],truncated:false});
  await session.done;assert.equal(target.textContent,before);assert.equal(disposed,1);
 }
});
test('source and per-task errors are visible and do not abort other task searches',async()=>{
 const target=panel();let queries=0;
 const session=agenda.mount(target,{tasks:[task,{...task,label:'Aller'}],clientFactory:()=>({
  load:async()=>summary,query:async()=>{if(!queries++)throw new Error('fail');return {rows:[],truncated:false};},dispose(){}})});
 await session.done;assert.match(target.textContent,/Retour : recherche indisponible/);
 assert.match(target.textContent,/Aller : aucun trajet direct/);session.dispose();
 const unavailable=panel();let terminated=0;
 await agenda.mount(unavailable,{tasks:[task],clientFactory:()=>({load:async()=>{throw new Error('CORS');},dispose(){terminated++;}})}).done;
 assert.match(unavailable.textContent,/Flux officiel indisponible/);assert.equal(terminated,1);
});
test('no eligible resource means no download or extra UI',async()=>{
 const target=panel();let created=0;
 await agenda.mount(target,{tasks:[{...task,to:null}],clientFactory:()=>{created++;}}).done;
 assert.equal(created,0);assert.equal(target.children.length,0);
});
test('geocoding endpoints run independently and identical pending addresses share requests',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const code=source.slice(source.indexOf('  const transportPointRequests ='),source.indexOf('  function adresse('));
 const origin=deferred(),destination=deferred(),calls=[],notified=[];
 const context={G:{POINTS:{},cleAdresse:(m,side)=>side,chercherPoint:async(m,side)=>{calls.push(side);return (side==='origin'?origin:destination).promise;}},gpsMem:{pts:{}},ecrireLocal(){},fetch(){}};
 vm.runInNewContext(code+';this.run=pointsMission;',context);
 const a=context.run({},side=>notified.push(side)),b=context.run({});
 await Promise.resolve();destination.resolve({trouve:true,point:{lat:1,lng:2}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls.sort(),['destination','origin']);assert.deepEqual(notified,['destination']);
 origin.reject(new Error('missing address'));
 assert.equal(await a,true);assert.equal(await b,true);
 assert.equal(context.G.POINTS.origin,undefined);assert.ok(context.G.POINTS.destination);
});
test('actual Agenda call passes mission windows and triggers regional refresh when coordinates arrive',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const code=source.slice(source.indexOf('      // GTFS candidate search:'),source.indexOf('      // Swiss public transport connections for an accepted mission junction.'));
 const calls=[],callbacks=[];let stopped=0,removed=0,regionalRefreshes=0;
 const button={cpRefreshRegional(){regionalRefreshes++;}},sheet={hidden:false},panel={isConnected:true,hidden:false,querySelector:()=>({remove(){removed++;}})};
 const current={o:{lat:45.9,lng:6.1,precision:'adresse'},d:{lat:45.67,lng:6.39,precision:'gps'}};
 const next={o:{lat:45.8,lng:6.2,precision:'ville'},pickup_start:'2026-11-02T15:00:00+01:00'};
 const context={window:{CPGTFSAgenda:{mount:(panel,options)=>{calls.push(options);return {dispose(){}};}},CPGTFSWorker:{}},
  panel,bt:button,m:current,next,etat:{reglages:{domicile_lat:45.9,domicile_lng:6.1}},
  G:{coordonnees:(m,side)=>m[side==='origin'?'o':'d']},
  transportAddressPoint:p=>p&&['adresse','gps'].includes(p.precision),
  pickupDate:'2026-11-02T10:00:00+01:00',deliveryDate:'2026-11-02T13:00:00+01:00',securityMarginMin:30,
  stopGTFSTransports(){stopped++;},$:(id)=>id==='feuille'?sheet:button,pointsMission:(m,cb)=>callbacks.push(cb),gtfsAgendaSession:null};
 vm.runInNewContext(code,context);
 assert.equal(calls.length,1);assert.deepEqual(Array.from(calls[0].tasks,t=>t.label),['Aller','Retour','Jonction']);
 assert.equal(calls[0].tasks[0].latestArrival,context.pickupDate);
 assert.equal(calls[0].tasks[1].earliestDeparture,context.deliveryDate);
 assert.equal(calls[0].tasks[2].latestArrival,next.pickup_start);assert.equal(calls[0].tasks[2].to,null);
 next.o.precision='adresse';callbacks[0]();
 assert.equal(calls.length,2);assert.equal(calls[1].tasks[2].to.lat,45.8);assert.equal(regionalRefreshes,1);
 assert.equal(stopped,2);assert.equal(removed,2);
 callbacks[0]();button.cpRefreshGTFS();
 next.d={lat:46,lon:6.5,precision:'adresse'};callbacks[0]();
 next.o.description='Nouveau libellé';callbacks[0]();
 assert.equal(calls.length,2);assert.equal(stopped,2);assert.equal(removed,2);
 // Changed coordinates restart the actual search, even when precision is unchanged.
 next.o.lat=45.81;callbacks[0]();assert.equal(calls.length,3);
 assert.equal(calls[2].tasks[2].to.lat,45.81);
 context.etat.reglages.domicile_lat=45.91;button.cpRefreshGTFS();
 assert.equal(calls.length,4);assert.equal(calls[3].tasks[0].from.lat,45.91);
 current.o.precision='ville';button.cpRefreshGTFS();
 assert.equal(calls.length,5);assert.equal(calls[4].tasks[0].to,null);
 assert.equal(stopped,5);assert.equal(removed,5);
 sheet.hidden=true;next.o.lat=45.82;callbacks[0]();assert.equal(calls.length,5);
 sheet.hidden=false;
 // Reopening / explicit refresh constructs a new session even with identical tasks.
 vm.runInNewContext(code,context);assert.equal(calls.length,6);
});

test('Agenda displays both legs, transfer stop and theoretical interval without a feasibility badge',async()=>{
 const target=panel();
 const transferred=row({transferStopId:'X',transferStop:{name:'Change',lat:45.8,lon:6.2},transferMinutes:8,
  legs:[{line:'One',departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T11:20:00Z'},
   {line:'Two',departure:'2026-11-02T11:28:00Z',arrival:'2026-11-02T12:00:00Z'}]});
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({load:async()=>summary,
  query:async()=>({rows:[transferred],truncated:false}),dispose(){}})});
 await session.done;
 assert.match(target.textContent,/correspondance à Change/);assert.match(target.textContent,/intervalle théorique 8 min/);
 assert.match(target.textContent,/One :/);assert.match(target.textContent,/Two :/);
 assert.match(target.textContent,/Correspondance : voir l’arrêt/);assert.doesNotMatch(target.textContent,/Réalisable/);
 session.dispose();
});

test('alternative transfer stops are retained when trip pair and overall times are identical',async()=>{
 const target=panel(),legs=[{tripId:'First',line:'One',from:'A',to:'X',departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T11:20:00Z'},
  {tripId:'Second',line:'Two',from:'X',to:'B',departure:'2026-11-02T11:28:00Z',arrival:'2026-11-02T12:00:00Z'}];
 const rows=['X','Y'].map(id=>row({transferStopId:id,transferStop:{name:id},transferMinutes:8,legs}));
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({load:async()=>summary,
  query:async()=>({rows,truncated:false}),dispose(){}})});
 await session.done;assert.match(target.textContent,/Retour : 2 horaire/);
 assert.match(target.textContent,/correspondance à X/);assert.match(target.textContent,/correspondance à Y/);session.dispose();
});
test('Agenda loads scoped partners and renders a cross-network change without inventing walking time',async()=>{
 const target=panel(),calls=[];
 const crossed=row({networkId:'A-B',interNetwork:true,transferStop:{name:'Descente',lat:45.8,lon:6.2},
  transferDestinationStop:{name:'Montée',lat:45.8005,lon:6.2},transferDistanceMeters:56,transferMinutes:10,
  legs:[{network:'Sibra',line:'One',departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T11:20:00Z'},
   {network:'Cars',line:'Two',departure:'2026-11-02T11:30:00Z',arrival:'2026-11-02T12:00:00Z'}]});
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  loadNetworks:async(resources,options)=>{calls.push({resources,options});return {networks:[summary,{...summary,source:{...summary.source,network:'Sibra',updatedAt:'2026-10-01'}}],partial:false};},
  query:async()=>({rows:[crossed],truncated:false}),dispose(){}})});
 await session.done;assert.equal(calls[0].resources.length,2);
 assert.ok(calls[0].options.indexServiceDates.includes('2026-11-01'));
 assert.match(target.textContent,/changement de réseau : Descente → Montée/);
 assert.match(target.textContent,/séparation à vol d’oiseau 56 m, marche non vérifiée/);
 assert.match(target.textContent,/mise à jour producteur : 2026-10-01/);
 assert.match(target.textContent,/Montée après changement : voir l’arrêt/);
 session.dispose();
});
test('partial multi-network load remains visible while the surviving source is queried',async()=>{
 const target=panel();let queries=0;
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  loadNetworks:async()=>({networks:[summary,{error:{network:'Sibra',message:'offline'}}],partial:true}),
  query:async()=>{queries++;return {rows:[],truncated:false};},dispose(){}})});
 await session.done;assert.match(target.textContent,/Recherche partielle/);assert.match(target.textContent,/Sibra : flux indisponible/);
 assert.ok(queries>0);session.dispose();
});
test('walking refinement displays calculated paths and unmatched endpoints while retaining transit warnings',async()=>{
 const previous=global.CPTransportWalking;let disposed=0;
 global.CPTransportWalking={checkJourney:async()=>({status:'partial',walks:{
  access:{status:'calculated',durationSeconds:180.539,distanceMeters:260,endpointsMatched:false,startGapMeters:4,endGapMeters:21},
  transfer:{status:'not_required'},egress:{status:'unavailable'}}})};
 try{
  const target=panel(),session=agenda.mount(target,{tasks:[task],clientFactory:()=>({load:async()=>summary,
   query:async()=>({rows:[row()],truncated:false}),dispose(){}}),walkingRouterFactory:()=>({dispose(){disposed++;}})});
  await session.done;assert.match(target.textContent,/Approche : ≈ 3 min, 260 m à pied/);
  assert.match(target.textContent,/extrémités à vérifier/);assert.match(target.textContent,/Sortie : service piéton indisponible/);
  assert.match(target.textContent,/Calcul piéton partiel/);assert.match(target.textContent,/© OpenStreetMap/);
  assert.match(target.textContent,/Transport non confirmé/);assert.doesNotMatch(target.textContent,/Réalisable/);
  session.dispose();assert.equal(disposed,1);
 }finally{global.CPTransportWalking=previous;}
});
test('late walking responses cannot update a disposed panel',async()=>{
 const previous=global.CPTransportWalking,gate=deferred();let started=false,disposed=0;
 global.CPTransportWalking={checkJourney:()=>{started=true;return gate.promise;}};
 try{
  const target=panel(),session=agenda.mount(target,{tasks:[task],clientFactory:()=>({load:async()=>summary,
   query:async()=>({rows:[row()],truncated:false}),dispose(){}}),walkingRouterFactory:()=>({dispose(){disposed++;}})});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(started,true);
  session.dispose();const before=target.textContent;
  gate.resolve({status:'fits_calculated_walks',walks:{}});await session.done;
  assert.equal(target.textContent,before);assert.equal(disposed,1);
 }finally{global.CPTransportWalking=previous;}
});
test('walking checks prioritise inter-network changes before direct candidates',async()=>{
 const previous=global.CPTransportWalking,calls=[];
 global.CPTransportWalking={checkJourney:async(router,row)=>{calls.push(row.tripId);return {status:'partial',walks:{}};}};
 try{
  const target=panel(),session=agenda.mount(target,{tasks:[task],clientFactory:()=>({load:async()=>summary,
   query:async()=>({rows:[row({tripId:'direct'}),row({tripId:'cross',interNetwork:true,transferStop:{name:'Exit'},transferDestinationStop:{name:'Board'},transferMinutes:10,transferDistanceMeters:50})],truncated:false}),dispose(){}}),walkingRouterFactory:()=>({dispose(){}})});
  await session.done;assert.deepEqual(calls,['cross','direct']);session.dispose();
 }finally{global.CPTransportWalking=previous;}
});

test('Agenda shows address-level times with conservative minute rounding and keeps stop times',async()=>{
 const previous=global.CPTransportWalking;
 global.CPTransportWalking={checkJourney:async()=>({status:'fits_calculated_walks',
  doorDeparture:'2026-11-02T10:58:29.500Z',doorArrival:'2026-11-02T12:02:01.250Z',walks:{}})};
 try{
  const target=panel(),session=agenda.mount(target,{tasks:[task],clientFactory:()=>({load:async()=>summary,
   query:async()=>({rows:[row()],truncated:false}),dispose(){}}),walkingRouterFactory:()=>({dispose(){}})});
  await session.done;
  assert.match(target.textContent,/Départ estimé à l’adresse : ≈ 02\/11\/2026 11:58/);
  assert.match(target.textContent,/Arrivée estimée à l’adresse : ≈ 02\/11\/2026 13:03/);
  assert.match(target.textContent,/02\/11\/2026 12:00 → 02\/11\/2026 13:00/);
  assert.match(target.textContent,/Transport non confirmé/);assert.doesNotMatch(target.textContent,/Réalisable/);
  session.dispose();
 }finally{global.CPTransportWalking=previous;}
});
test('a rejected or throwing pedestrian prefetch preserves source status and transit results',async()=>{
 const previous=global.CPTransportWalking;
 global.CPTransportWalking={checkJourney:async()=>({status:'partial',walks:{}})};
 try{
  for(const route of [()=>Promise.reject(new Error('offline')),()=>{throw new Error('offline');}]){
   const target=panel(),cross=row({interNetwork:true,transferStop:{name:'Exit'},transferDestinationStop:{name:'Board'},transferMinutes:10,transferDistanceMeters:50});
   const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({load:async()=>summary,
    query:async()=>({rows:[cross],truncated:false}),dispose(){}}),walkingRouterFactory:()=>({route,dispose(){}})});
   await session.done;
   assert.match(target.textContent,/Retour : 1 horaire/);assert.match(target.textContent,/1641 arrêts/);
   assert.match(target.textContent,/Calcul piéton partiel/);assert.doesNotMatch(target.textContent,/Flux officiel indisponible/);
   session.dispose();
  }
 }finally{global.CPTransportWalking=previous;}
});

test('Agenda retains the latest outbound trips across service dates after worker caps',async()=>{
 const target=panel(),calls=[];
 const session=agenda.mount(target,{tasks:[{...task,label:'Aller',earliestDeparture:undefined,latestArrival:'2026-11-02T13:00:00Z'}],
  clientFactory:()=>({load:async()=>summary,query:async q=>{
   calls.push(q);
   return {rows:[row({tripId:q.date,departure:q.date+'T10:00:00Z',arrival:q.date+'T11:00:00Z'})],truncated:true};
  },dispose(){}})});
 await session.done;
 assert.ok(calls.every(q=>q.order==='latestDeparture'));
 const text=target.textContent;
 assert.ok(text.indexOf('02/11/2026 11:00 →')<text.indexOf('01/11/2026 11:00 →'));
 assert.match(text,/Affichage limité/);assert.match(text,/Transport non confirmé/);session.dispose();
});

test('Grenoble local tasks select only the two official Grenoble resources',async()=>{
 const local={label:'Jonction',from:{lat:45.1905,lon:5.7145},to:{lat:45.28,lon:5.88},
  earliestDeparture:'2026-11-02T10:00:00+01:00',latestArrival:'2026-11-02T13:00:00+01:00'},calls=[];
 const target=panel(),session=agenda.mount(target,{tasks:[local],clientFactory:()=>({
  loadNetworks:async(resources,options)=>{
   calls.push({resources,options});return {networks:resources.map(r=>({...summary,source:{...summary.source,network:r.network,url:r.url}})),partial:false};
  },query:async()=>({rows:[],truncated:false}),dispose(){}})});
 await session.done;
 assert.equal(calls.length,1);assert.equal(calls[0].resources.length,2);
 assert.deepEqual(calls[0].resources.map(r=>r.datasetId),['5af03701b595081c1880a8a4','5eb3510a4efd8f649ffe1b9f']);
 assert.ok(calls[0].resources.every(r=>r.resolveFromCatalogue));
 assert.match(target.textContent,/Métropole grenobloise/);assert.match(target.textContent,/Grésivaudan/);
 assert.doesNotMatch(target.textContent,/Cars Région Haute-Savoie|Sibra/);
 session.dispose();
 const outside={...local,from:point};
 assert.equal(agenda.DEFAULT_RESOURCES.some(r=>agenda.selected(r,outside)),false);
});

test('Agenda collapses equivalent departures from different GTFS trip IDs',async()=>{
 const target=panel();
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,
  query:async()=>({rows:[
   row({tripId:'trip-1',networkId:'network-A'}),
   row({tripId:'trip-2',networkId:'network-A'})
  ],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 1 horaire/);
 assert.equal((target.textContent.match(/tarif inconnu/g)||[]).length,1);
 session.dispose();
});
test('Agenda retains identical schedules from different networks',async()=>{
 const target=panel();
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,
  query:async()=>({rows:[
   row({tripId:'trip-1',networkId:'network-A'}),
   row({tripId:'trip-2',networkId:'network-B'})
  ],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 2 horaire/);
 session.dispose();
});

test('Grenoble to Crolles remains within both metropolitan and Grésivaudan GTFS envelopes',async()=>{
 const grenoble={lat:45.1885,lon:5.7245},crolles={lat:45.276,lon:5.883};
 const trip={label:'Jonction mission',from:grenoble,to:crolles,
  earliestDeparture:'2026-11-02T09:00:00+01:00',latestArrival:'2026-11-02T12:00:00+01:00'};
 const eligible=agenda.DEFAULT_RESOURCES.filter(resource=>agenda.selected(resource,trip));
 assert.deepEqual(eligible.map(resource=>resource.datasetId),
  ['5af03701b595081c1880a8a4','5eb3510a4efd8f649ffe1b9f']);
 const target=panel(),calls=[];
 const session=agenda.mount(target,{tasks:[trip],clientFactory:()=>({
  loadNetworks:async(resources,options)=>{
   calls.push({resources,options});
   return {networks:resources.map(resource=>({
    ...summary,source:{...summary.source,network:resource.network,url:resource.url}
   })),partial:false};
  },
  query:async()=>({rows:[],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].resources.map(resource=>resource.datasetId),eligible.map(resource=>resource.datasetId));
 assert.match(target.textContent,/Grésivaudan/);
 assert.match(target.textContent,/Transport non confirmé|ne prouve pas l’absence de transport/);
 session.dispose();
});
