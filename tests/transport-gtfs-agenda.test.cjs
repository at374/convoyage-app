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
test('272 official reference reaches direct GTFS results without becoming a confirmed fare',async()=>{
 global.CP272Fares=require('../transport-272-fares.js');
 try{
  const target=panel(),mission={label:'Retour',from:{lat:45.9017,lon:6.1201},to:{lat:46.231,lon:6.1097},earliestDeparture:'2026-11-09T09:00:00+01:00'};
  const direct=row({networkId:'oura-haute-savoie',line:'272',departure:'2026-11-09T10:00:00+01:00',arrival:'2026-11-09T11:30:00+01:00',
   originStop:{stopId:'FR:74010:ZE:57539:HAUTExSAVOIE',name:'Gare Routière',lat:45.9016985,lon:6.1201612},
   destinationStop:{stopId:'FR:6623:ZE:57862:HAUTExSAVOIE',name:'Aéroport',lat:46.230964,lon:6.1096781}});
  await agenda.mount(target,{tasks:[mission],resources:[agenda.DEFAULT_RESOURCES[0]],clientFactory:()=>({load:async()=>summary,query:async()=>({rows:[direct]}),dispose(){}})}).done;
  assert.match(target.textContent,/Référence car 272 adulte : 11,30 €/);
  assert.match(target.textContent,/Prix et titre à confirmer/);assert.match(target.textContent,/Transport non confirmé/);
  assert.doesNotMatch(target.textContent,/Réalisable/);
 }finally{delete global.CP272Fares;}
});
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
 assert.equal(agenda.searchWindow({latestArrival:'2026-11-02T12:00:00+01:00'}).marginMinutes,15);
 assert.equal(agenda.searchWindow({latestArrival:'2026-11-02T12:00:00+01:00',marginMinutes:5}).marginMinutes,15);
 assert.equal(agenda.searchWindow({latestArrival:'2026-11-02T12:00:00+01:00',marginMinutes:25}).marginMinutes,25);
 for(const invalidMargin of [-1,NaN,Infinity,241,'15'])assert.throws(()=>agenda.searchWindow({latestArrival:'2026-11-02T12:00:00+01:00',marginMinutes:invalidMargin}),/Invalid mission margin/);
 assert.equal(Date.parse(outbound.latestArrival)-Date.parse(outbound.earliestDeparture),86400000);
 const long=agenda.searchWindow({...task,latestArrival:'2026-11-09T12:00:00+01:00'});
 assert.equal(Date.parse(long.latestArrival)-Date.parse(long.earliestDeparture),48*3600000);
 assert.throws(()=>agenda.searchWindow({}),/Missing/);
 for(const latestArrival of ['2026-02-30T12:00:00Z','2026-11-02T24:00:00Z'])assert.throws(()=>agenda.searchWindow({latestArrival}),/timestamp/);
 assert.throws(()=>agenda.searchWindow({...task,latestArrival:'2026-11-02T12:00:00'}),/timestamp/);
 for(const bad of ['2026-11-02T12:00:00+25:00','2026-11-02T12:00:00+01:99','2026-11-02T12:00:00-24:00']){
  assert.throws(()=>agenda.searchWindow({earliestDeparture:bad}),/timestamp/);
  assert.throws(()=>agenda.searchWindow({latestArrival:bad}),/timestamp/);
 }
 assert.equal(agenda.searchWindow({earliestDeparture:'2026-11-02T12:00:00+01:00'}).earliestDeparture,'2026-11-02T11:00:00.000Z');
 assert.throws(()=>agenda.searchWindow({...task,latestArrival:'2026-11-01T12:00:00Z'}),/Inverted/);
});
test('all distinct GTFS lines reach comparison even beyond five with identical departure times',async()=>{
 const target=panel(),received=[];
 const rows=Array.from({length:12},(_,i)=>row({tripId:'T'+i,line:'Y'+i}));
 const session=agenda.mount(target,{tasks:[task],resources:[agenda.DEFAULT_RESOURCES[0]],
  clientFactory:()=>({load:async()=>summary,query:async()=>({rows:[...rows,rows[0]],truncated:false}),dispose(){}}),
  onResults:result=>received.push(result)});
 await session.done;
 assert.equal(received.length,1);
 assert.equal(received[0].itineraries.length,12);
 assert.equal(new Set(received[0].itineraries.map(r=>r.tripId)).size,12);
 assert.match(target.textContent,/Retour : 12 horaire/);
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
 assert.match(target.textContent,/Marge avant mission : 15 min minimum/);
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
 const session=agenda.mount(target,{resources:[agenda.DEFAULT_RESOURCES[0]],tasks:[task,{...task,label:'Aller'}],clientFactory:()=>({
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
  panel,sourcePanel:panel,localCards:{},renderLocalCards:()=>{},bt:button,m:current,next,etat:{reglages:{domicile_lat:45.9,domicile_lng:6.1}},
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
 await session.done;assert.equal(calls[0].resources.length,4);
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
test('loaded Annemasse network displays a current traffic verification link',async()=>{
 const target=panel(),tac=agenda.DEFAULT_RESOURCES.find(r=>r.id==='tac-annemasse');
 const trip={label:'Retour',from:{lat:46.20,lon:6.14},to:{lat:46.19,lon:6.24},earliestDeparture:'2026-11-07T10:00:00+01:00'};
 const session=agenda.mount(target,{resources:[tac],tasks:[trip],clientFactory:()=>({
  load:async()=>({...summary,source:{...summary.source,datasetId:tac.datasetId,network:tac.network}}),
  query:async()=>({rows:[],truncated:false}),dispose(){}})});
 await session.done;assert.match(target.textContent,/arrêts déplacés, déviations et temps réel sont à vérifier/i);
 const section=target.children[0],traffic=section.children.find(x=>x.textContent.includes('Consulter les infos trafic TAC'));
 assert.ok(traffic);assert.equal(traffic.children[0].href,'https://www.tac-mobilites.fr/');session.dispose();
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
 const session=agenda.mount(target,{tasks:[{...task,label:'Aller',earliestDeparture:'2026-11-01T00:00:00Z',latestArrival:'2026-11-02T13:00:00Z'}],
  clientFactory:()=>({load:async()=>summary,query:async q=>{
   calls.push(q);
   const valid=['2026-11-01','2026-11-02'].includes(q.date);
   return {rows:valid?[row({tripId:q.date,departure:q.date+'T10:00:00Z',arrival:q.date+'T11:00:00Z'})]:[],truncated:true};
  },dispose(){}})});
 await session.done;
 assert.ok(calls.every(q=>q.order==='latestDeparture'));
 const text=target.textContent;
 assert.ok(text.indexOf('02/11/2026 11:00 →')<text.indexOf('01/11/2026 11:00 →'));
 assert.match(text,/Affichage limité/);assert.match(text,/Transport non confirmé/);session.dispose();
});

test('Grenoble local tasks retain both Grenoble feeds and nearby regional candidates',async()=>{
 const local={label:'Jonction',from:{lat:45.1905,lon:5.7145},to:{lat:45.28,lon:5.88},
  earliestDeparture:'2026-11-02T10:00:00+01:00',latestArrival:'2026-11-02T13:00:00+01:00'},calls=[];
 const target=panel(),session=agenda.mount(target,{tasks:[local],clientFactory:()=>({
  loadNetworks:async(resources,options)=>{
   calls.push({resources,options});return {networks:resources.map(r=>({...summary,source:{...summary.source,network:r.network,url:r.url}})),partial:false};
  },query:async()=>({rows:[],truncated:false}),dispose(){}})});
 await session.done;
 assert.equal(calls.length,1);assert.equal(calls[0].resources.length,3);
 assert.deepEqual(calls[0].resources.map(r=>r.datasetId),['5af03701b595081c1880a8a4','5eb3510a4efd8f649ffe1b9f','oura-savoie-tourism']);
 assert.ok(calls[0].resources.slice(0,2).every(r=>r.resolveFromCatalogue));
 assert.match(target.textContent,/Métropole grenobloise/);assert.match(target.textContent,/Grésivaudan/);
 assert.doesNotMatch(target.textContent,/Cars Région Haute-Savoie|Sibra/);
 session.dispose();
 const outside={...local,from:point};
 assert.equal(agenda.DEFAULT_RESOURCES.filter(r=>r.network.startsWith('M Réso')).some(r=>agenda.selected(r,outside)),false);
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

test('Grenoble to Crolles keeps metropolitan priority while regional GTFS remains a bounded candidate',async()=>{
 const grenoble={lat:45.1885,lon:5.7245},crolles={lat:45.276,lon:5.883};
 const trip={label:'Jonction mission',from:grenoble,to:crolles,
  earliestDeparture:'2026-11-02T09:00:00+01:00',latestArrival:'2026-11-02T12:00:00+01:00'};
 const eligible=agenda.DEFAULT_RESOURCES.filter(resource=>agenda.selected(resource,trip));
 assert.deepEqual(eligible.map(resource=>resource.datasetId),
  ['5af03701b595081c1880a8a4','5eb3510a4efd8f649ffe1b9f','61b36a0610344080a78cf407','5cdef3698b4c416d21fd76b9','607860847e79b65f245982db','5bb1caa6634f4136693d9053']);
 const localEligible=eligible.filter(resource=>resource.resolveFromCatalogue);
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
 assert.deepEqual(calls[0].resources.map(resource=>resource.datasetId),[...localEligible.map(resource=>resource.datasetId),'oura-savoie-tourism']);
 assert.match(target.textContent,/Grésivaudan/);
 assert.match(target.textContent,/Transport non confirmé|ne prouve pas l’absence de transport/);
 session.dispose();
});

test('Agenda preserves different interchange stops even with identical lines and times',async()=>{
 const target=panel();
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,
  query:async()=>({rows:[
   row({tripId:'connection-1',networkId:'Metro+Gresivaudan',transferStopId:'stop-A'}),
   row({tripId:'connection-2',networkId:'Metro+Gresivaudan',transferStopId:'stop-B'})
  ],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 2 horaire/);
 session.dispose();
});

test('all failed federated GTFS loads display a clear unavailable state without querying',async()=>{
 const target=panel();let queried=0;
 const trip={...task,from:{lat:45.1885,lon:5.7245},to:{lat:45.276,lon:5.883}};
 const session=agenda.mount(target,{tasks:[trip],clientFactory:()=>({
  loadNetworks:async()=>({networks:[
   {error:{network:'M Réso — Métropole grenobloise'}},
   {error:{network:'M Réso — Grésivaudan'}}
  ],partial:true}),
  query:async()=>{queried++;return {rows:[],truncated:false};},
  dispose(){}
 })});
 await session.done;
 assert.equal(queried,0);
 assert.match(target.textContent,/aucun réseau chargé/);
 assert.match(target.textContent,/Transport non confirmé/);
 assert.match(target.textContent,/Retour : horaires indisponibles/);
 session.dispose();
});

test('partial GTFS network failure is disclosed even if worker omits partial flag',async()=>{
 const target=panel();
 const trip={...task,from:{lat:45.1885,lon:5.7245},to:{lat:45.276,lon:5.883}};
 const session=agenda.mount(target,{tasks:[trip],clientFactory:()=>({
  loadNetworks:async()=>({networks:[
   {...summary,source:{...summary.source,network:'M Réso — Métropole grenobloise',url:'https://example.org/metro'}},
   {error:{network:'M Réso — Grésivaudan'}}
  ]}),
  query:async()=>({rows:[],truncated:false}),
  dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Recherche partielle : un réseau est indisponible/);
 assert.match(target.textContent,/Grésivaudan : flux indisponible/);
 assert.match(target.textContent,/aucun trajet dans les résultats partiels ; recherche incomplète/);
 assert.doesNotMatch(target.textContent,/aucun trajet direct ou avec une correspondance/);
 session.dispose();
});

test('malformed secondary GTFS network is treated as unavailable, not rendered as a valid source',async()=>{
 const target=panel();
 const trip={...task,from:{lat:45.1885,lon:5.7245},to:{lat:45.276,lon:5.883}};
 const session=agenda.mount(target,{tasks:[trip],clientFactory:()=>({
  loadNetworks:async()=>({networks:[
   {...summary,source:{...summary.source,network:'M Réso — Métropole grenobloise',url:'https://example.org/metro'}},
   {source:{network:'M Réso — Grésivaudan'},counts:{}}
  ]}),
  query:async()=>({rows:[],truncated:false}),
  dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Recherche partielle : un réseau est indisponible/);
 assert.match(target.textContent,/Grésivaudan : flux indisponible/);
 session.dispose();
});

test('GTFS sources with invalid timestamps or stop counts are rejected without querying',async()=>{
 for(const invalid of [
  {source:{...summary.source,loadedAt:'not-a-date'},counts:{stops:20}},
  {source:{...summary.source},counts:{stops:-1}},
  {source:{...summary.source},counts:{stops:1.5}}
 ]){
  const target=panel();let queries=0;
  const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
   load:async()=>invalid,
   query:async()=>{queries++;return {rows:[],truncated:false};},
   dispose(){}
  })});
  await session.done;
  assert.equal(queries,0);
  assert.match(target.textContent,/aucun réseau chargé/);
  assert.match(target.textContent,/Transport non confirmé/);
  session.dispose();
 }
});

test('malformed GTFS network collections fail safely without running a journey query',async()=>{
 for(const networks of [null,{},'invalid',[]]){
  const target=panel();let queried=0;
  const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
   load:async()=>({networks}),
   query:async()=>{queried++;return {rows:[],truncated:false};},
   dispose(){}
  })});
  await session.done;
  assert.equal(queried,0);
  assert.match(target.textContent,/aucun réseau chargé/);
  session.dispose();
 }
});

test('Agenda preserves distinct GTFS leg combinations sharing transfer stop and timetable',async()=>{
 const target=panel();
 const base={networkId:'Metro+Gresivaudan',interNetwork:true,transferStopId:'same-interchange',transferStop:{name:'Correspondance A'},transferDestinationStop:{name:'Correspondance B'},transferDistanceMeters:45,transferMinutes:12};
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,
  query:async()=>({rows:[
   row({...base,tripId:'connection-A',legs:[{networkId:'Metro',tripId:'M1',line:'A',from:'A',to:'X',departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T11:25:00Z'},{networkId:'Gresivaudan',tripId:'G1',line:'C9',from:'Y',to:'B',departure:'2026-11-02T11:37:00Z',arrival:'2026-11-02T12:00:00Z'}]}),
   row({...base,tripId:'connection-B',legs:[{networkId:'Metro',tripId:'M2',line:'A',from:'A',to:'X',departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T11:25:00Z'},{networkId:'Gresivaudan',tripId:'G2',line:'C9',from:'Y',to:'B',departure:'2026-11-02T11:37:00Z',arrival:'2026-11-02T12:00:00Z'}]})
  ],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 2 horaire/);
 session.dispose();
});

test('null GTFS worker response is reported as unavailable without crashing',async()=>{
 const target=panel();let queries=0;
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>null,
  query:async()=>{queries++;return {rows:[],truncated:false};},
  dispose(){}
 })});
 await session.done;
 assert.equal(queries,0);
 assert.match(target.textContent,/aucun réseau chargé/);
 assert.match(target.textContent,/Transport non confirmé/);
 session.dispose();
});

test('cross-envelope pairing requires two official federated feeds and covered endpoints',()=>{
 const a={format:'GTFS',federate:true,url:'https://example.org/a.gtfs',bounds:[45,5,46,6]};
 const b={format:'GTFS',federate:true,url:'https://example.org/b.gtfs',bounds:[45,6,46,7]};
 const journey={from:{lat:45.5,lon:5.5},to:{lat:45.5,lon:6.5}};
 assert.equal(agenda.selected(a,journey),false);
 assert.equal(agenda.selected(b,journey),false);
 assert.equal(agenda.crossEnvelopePair(a,b,journey),true);
 assert.equal(agenda.crossEnvelopePair(b,a,journey),true);
 assert.equal(agenda.crossEnvelopePair(a,a,journey),false);
 assert.equal(agenda.crossEnvelopePair(a,{...b,federate:false},journey),false);
 assert.equal(agenda.crossEnvelopePair(a,{...b,url:'http://example.org'},journey),false);
 assert.equal(agenda.crossEnvelopePair(a,b,{...journey,to:{lat:48,lon:2}}),false);
});

test('Agenda loads both official GTFS feeds for a journey crossing geographic envelopes',async()=>{
 const first={id:'first',network:'First',format:'GTFS',federate:true,url:'https://example.org/first.gtfs',bounds:[45,5,46,6],timeZone:'Europe/Paris'};
 const second={id:'second',network:'Second',format:'GTFS',federate:true,url:'https://example.org/second.gtfs',bounds:[45,6,46,7],timeZone:'Europe/Paris'};
 const journey={...task,from:{lat:45.5,lon:5.5},to:{lat:45.5,lon:6.5}};
 let loaded=[],queried=0;
 const target=panel(),session=agenda.mount(target,{tasks:[journey],resources:[first,second],clientFactory:()=>({
  loadNetworks:async feeds=>{loaded=feeds;return {networks:[{source:{network:'First',loadedAt:'2026-10-30T16:00:00Z'},counts:{stops:2}},{source:{network:'Second',loadedAt:'2026-10-30T16:00:00Z'},counts:{stops:2}}]};},
  query:async()=>{queried++;return {rows:[],truncated:false};},
  dispose(){}
 })});
 await session.done;
 assert.deepEqual(loaded.map(feed=>feed.id),['first','second']);
 assert.ok(queried>0);
 assert.match(target.textContent,/Transport non confirmé|aucun trajet|horaire/i);
 session.dispose();
});

test('SIBRA pass updates existing portion costs without reloading or querying GTFS',async()=>{
 const previous=global.CPSibraPass;global.CPSibraPass=require('../transport-sibra-pass.js');
 try{
  const target=panel();let pass=null,loads=0,queries=0;
  const sibraRow=row({networkId:global.CPSibraPass.DATASET,line:'4'});
  const session=agenda.mount(target,{tasks:[task],getSibraPass:()=>pass,walkingRouterFactory:()=>null,
   clientFactory:()=>({load:async()=>{loads++;return summary;},query:async()=>{queries++;return {rows:[sibraRow],truncated:false};},dispose(){}})});
  await session.done;assert.doesNotMatch(target.textContent,/Abonnement SIBRA déclaré/);
  const before={loads,queries};pass={active:true,from:'2026-01-01',through:'2026-12-31'};session.refreshFares();
  assert.match(target.textContent,/Coût supplémentaire transport : 0,00 €/);
  assert.match(target.textContent,/sous réserve d’abonnement valide/);assert.match(target.textContent,/Transport non confirmé/);
  assert.deepEqual({loads,queries},before);
  pass=null;session.refreshFares();assert.doesNotMatch(target.textContent,/Abonnement SIBRA déclaré/);
  session.dispose();pass={active:true,from:'2026-01-01',through:'2026-12-31'};session.refreshFares();
  assert.doesNotMatch(target.textContent,/Abonnement SIBRA déclaré/);
 }finally{global.CPSibraPass=previous;}
});

test('dated Y51 references are displayed separately from confirmed fares and provider failures preserve timetables',async()=>{
 const previous=global.CPTY51Fares;
 try{
  global.CPTY51Fares={reference:()=>({}),describe:()=>' · Référence Y51 : 8,90 € hors abonnement ; à revérifier avant achat.',SOURCE:'https://example.org/official.pdf'};
  const target=panel();await agenda.mount(target,{tasks:[task],walkingRouterFactory:()=>null,clientFactory:()=>({load:async()=>summary,query:async()=>({rows:[row()],truncated:false}),dispose(){}})}).done;
  assert.match(target.textContent,/Référence Y51 : 8,90 €/);assert.match(target.textContent,/Transport non confirmé/);
  global.CPTY51Fares.reference=()=>{throw Error('tariff unavailable');};
  const fallback=panel();await agenda.mount(fallback,{tasks:[task],walkingRouterFactory:()=>null,clientFactory:()=>({load:async()=>summary,query:async()=>({rows:[row()],truncated:false}),dispose(){}})}).done;
  assert.match(fallback.textContent,/Retour : 1 horaire/);assert.doesNotMatch(fallback.textContent,/Référence Y51/);
 }finally{global.CPTY51Fares=previous;}
});

test('official Cars Région Ain GTFS is available as an Agenda resource',()=>{
 const ain=agenda.DEFAULT_RESOURCES.find(r=>r.id==='oura-ain');
 assert.ok(ain);
 assert.equal(ain.format,'GTFS');
 assert.equal(ain.federate,true);
 assert.match(ain.url,/^https:\/\/api\.oura3\.cityway\.fr\/dataflow\/offre-tc\/download\?/);
 assert.equal(agenda.selected(ain,{from:{lat:46.25,lon:5.6},to:{lat:46.30,lon:5.8}}),true);
 assert.equal(agenda.selected(ain,{from:{lat:46.25,lon:5.6},to:{lat:47.1,lon:6.5}}),false);
});

test('remaining AURA departmental GTFS resources are official, bounded candidates',()=>{
 const departments=[
  ['oura-allier',{lat:46.18,lon:3.32},'ALLIER'],
  ['oura-ardeche',{lat:44.74,lon:4.6},'ARDECHE'],
  ['oura-cantal',{lat:45.05,lon:2.75},'CAR_REGION_CANTAL'],
  ['oura-drome',{lat:44.72,lon:5.12},'DROME'],
  ['oura-isere',{lat:45.2,lon:5.72},'ISERE'],
  ['oura-loire',{lat:45.55,lon:4.38},'CARS_REGION_LOIRE'],
  ['oura-haute-loire',{lat:45.05,lon:3.88},'HAUTE_LOIRE'],
  ['oura-puy-de-dome',{lat:45.78,lon:3.12},'PUY_DE_DOME']
 ];
 for(const [id,point,provider] of departments){
  const resource=agenda.DEFAULT_RESOURCES.find(r=>r.id===id);
  assert.ok(resource,id);
  assert.equal(resource.format,'GTFS');assert.equal(resource.federate,true);assert.equal(resource.timeZone,'Europe/Paris');
  assert.match(resource.url,new RegExp('provider='+provider+'(?:&|$)'));
  assert.equal(agenda.selected(resource,{from:point,to:{...point}}),true,id+' should be considered only inside its envelope');
  assert.equal(agenda.selected(resource,{from:point,to:{lat:48.85,lon:2.35}}),false,id+' must not claim national coverage');
 }
});

test('Cars Région Express is a separate dated timetable source, never a static fare source',()=>{
 const express=agenda.DEFAULT_RESOURCES.find(r=>r.id==='oura-cars-region-express');
 assert.ok(express);assert.equal(express.datasetId,'61b36a0610344080a78cf407');
 assert.equal(express.format,'GTFS');assert.equal(express.federate,true);
 assert.match(express.url,/provider=CARS_REGION_EXPRESS&/);
 assert.equal(agenda.selected(express,{from:{lat:46.12,lon:5.82},to:{lat:46.19,lon:6.14}}),true);
 assert.equal(agenda.selected(express,{from:{lat:46.12,lon:5.82},to:{lat:48.85,lon:2.35}}),false);
 assert.equal(Object.hasOwn(express,'fareEUR'),false);
});

test('BlaBlaCar Bus GTFS is a long-distance timetable partner, never a fare claim',async()=>{
 const bus=agenda.DEFAULT_RESOURCES.find(r=>r.id==='blablacar-bus');
 assert.ok(bus);assert.equal(bus.datasetId,'5cdef3698b4c416d21fd76b9');assert.equal(bus.federate,true);
 assert.match(bus.url,/fd54f81f-4389-4e73-be75-491133d011c3/);
 const trip={label:'Retour',from:{lat:45.188,lon:5.724},to:{lat:45.764,lon:4.835},earliestDeparture:'2026-11-07T10:00:00+01:00'};
 assert.ok(agenda.airDistanceKm(trip.from,trip.to)>=75);
 assert.equal(agenda.selected(bus,trip),true);assert.equal(Object.hasOwn(bus,'fareEUR'),false);
 const local={id:'local',datasetId:'local',network:'Local',format:'GTFS',federate:true,url:'https://example.org/local.zip',bounds:[44.5,4.5,46.2,6.5],timeZone:'Europe/Paris'};
 let loaded=[];const session=agenda.mount(panel(),{resources:[local,bus],tasks:[trip],clientFactory:()=>({loadNetworks:async resources=>{loaded=resources;return {networks:resources.map(r=>({...summary,source:{...summary.source,network:r.network,url:r.url}}))};},query:async()=>({rows:[],truncated:false}),dispose(){}})});
 await session.done;assert.deepEqual(loaded.map(r=>r.id),['local','blablacar-bus']);session.dispose();
});

test('SNCF Transilien is a bounded Île-de-France source and wins over the national coach feed for a short journey',async()=>{
 const transilien=agenda.DEFAULT_RESOURCES.find(r=>r.id==='sncf-transilien');
 const bus=agenda.DEFAULT_RESOURCES.find(r=>r.id==='blablacar-bus');
 assert.ok(transilien);assert.equal(transilien.datasetId,'horaires-des-lignes-transilien-1');
 assert.match(transilien.url,/sncf\/gtfs\/transilien-gtfs\.zip$/);assert.equal(Object.hasOwn(transilien,'fareEUR'),false);
 const trip={label:'Retour',from:{lat:48.8566,lon:2.3522},to:{lat:48.807,lon:2.437},earliestDeparture:'2026-11-07T10:00:00+01:00'};
 assert.equal(agenda.selected(transilien,trip),true);assert.ok(agenda.airDistanceKm(trip.from,trip.to)<75);
 let loaded=null;const session=agenda.mount(panel(),{resources:[bus,transilien],tasks:[trip],clientFactory:()=>({
  load:async resource=>{loaded=resource;return {...summary,source:{...summary.source,network:resource.network,url:resource.url}};},
  query:async()=>({rows:[],truncated:false}),dispose(){}}
 )});
 await session.done;assert.equal(loaded?.id,'sncf-transilien');session.dispose();
});

test('Synchro, STAS and T2C use current PAN-resolved official GTFS without embedding provider tokens',()=>{
 const localNetworks=[
  ['82272',{lat:45.57,lon:5.92}],
  ['81023',{lat:45.44,lon:4.39}],
  ['83465',{lat:45.78,lon:3.09}]
 ];
 for(const [id,point] of localNetworks){
  const resource=agenda.DEFAULT_RESOURCES.find(r=>r.id===id);
  assert.ok(resource,id);assert.equal(resource.format,'GTFS');assert.equal(resource.federate,true);assert.equal(resource.resolveFromCatalogue,true);
  assert.match(resource.url,/^https:\/\/transport\.data\.gouv\.fr\/datasets\//);
  assert.equal(agenda.selected(resource,{from:point,to:{...point}}),true);
  assert.equal(Object.hasOwn(resource,'fareEUR'),false);
 }
});

test('Pays de Gex TPG and TAC Annemasse are bounded official border GTFS resources',async()=>{
 const gex=agenda.DEFAULT_RESOURCES.find(r=>r.id==='pays-gex-tpg');
 const tac=agenda.DEFAULT_RESOURCES.find(r=>r.id==='tac-annemasse');
 assert.ok(gex);assert.ok(tac);
 assert.equal(gex.datasetId,'65a901970267d05025a905ec');assert.equal(tac.datasetId,'5ca4c3d2d7857ab0c49dde9b');
 assert.match(gex.url,/95c73b12-d117-4faf-bb6f-abfe3c95eee1/);
 assert.match(tac.url,/373e19e2-af0a-4939-9f33-3f1268d1e0bb/);
 const gexTrip={label:'Retour',from:{lat:46.30,lon:6.12},to:{lat:46.35,lon:6.04},earliestDeparture:'2026-11-07T10:00:00+01:00'};
 const tacTrip={label:'Retour',from:{lat:46.20,lon:6.14},to:{lat:46.19,lon:6.24},earliestDeparture:'2026-11-07T10:00:00+01:00'};
 assert.equal(agenda.selected(gex,gexTrip),true);assert.equal(agenda.selected(tac,tacTrip),true);
 assert.equal(agenda.selected(gex,{...gexTrip,to:{lat:48.85,lon:2.35}}),false);
 for(const [trip,id] of [[gexTrip,'pays-gex-tpg'],[tacTrip,'tac-annemasse']]){
  let loaded=null;const session=agenda.mount(panel(),{tasks:[trip],clientFactory:()=>({load:async r=>{loaded=r;return {...summary,source:{...summary.source,network:r.network,url:r.url}};},query:async()=>({rows:[],truncated:false}),dispose(){}})});
  await session.done;assert.equal(loaded?.id,id);session.dispose();
 }
});


test('western Ain journey chooses Ain GTFS despite Haute-Savoie overlap',async()=>{
 const target=panel(),task={label:'Aller',from:{lat:46.20,lon:5.6},to:{lat:46.25,lon:5.7},
 earliestDeparture:'2026-11-04T09:00:00+01:00'};
 let loaded=null;
 const instance=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async resource=>{loaded=resource;return {source:{network:resource.network},counts:{stops:0}};},
  search:async()=>({rows:[]}),dispose(){}})});
 await instance.done;
 assert.equal(loaded?.id,'oura-ain');
 instance.dispose();
});

test('truncated empty GTFS results never imply a complete absence of transport',async()=>{
 const target=panel();
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,query:async()=>({rows:[],truncated:true}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/aucun trajet dans les résultats partiels/);
 assert.match(target.textContent,/recherche incomplète/);
 assert.match(target.textContent,/Affichage limité/);
 session.dispose();
});

test('malformed GTFS worker result is reported as unavailable, not as an empty schedule',async()=>{
 for(const malformed of [null,{}, {rows:null}, {rows:{}}]){
  const target=panel();
  const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
   load:async()=>summary,query:async()=>malformed,dispose(){}
  })});
  await session.done;
  assert.match(target.textContent,/recherche indisponible/);
  assert.doesNotMatch(target.textContent,/aucun trajet direct ou avec une correspondance/);
  session.dispose();
 }
});

test('GTFS journey timestamps must be valid and chronological',async()=>{
 for(const badRow of [
  row({departure:'not-a-date'}),
  row({departure:'2026-11-02T11:00:00'}),
  row({arrival:'2026-11-02T12:00:00'}),
  row({departure:1730545200000}),
  row({arrival:'invalid'}),
  row({departure:'2026-11-02T13:00:00Z',arrival:'2026-11-02T12:00:00Z'})
 ]){
  const target=panel();
  const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
   load:async()=>summary,query:async()=>({rows:[badRow],truncated:false}),dispose(){}
  })});
  await session.done;
  assert.match(target.textContent,/recherche partielle/);
  assert.doesNotMatch(target.textContent,/Retour : 1 horaire|Aller : 1 horaire/);
  session.dispose();
 }
});

test('Agenda independently enforces the mission pickup deadline on GTFS responses',async()=>{
 const mission={label:'Aller',from:point,to:{lat:45.67,lon:6.39},
  earliestDeparture:'2026-11-02T11:00:00Z',latestArrival:'2026-11-02T12:30:00Z'};
 for(const badRow of [
  row({departure:'2026-11-02T10:59:00Z',arrival:'2026-11-02T12:00:00Z'}),
  row({departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T12:16:00Z'})
 ]){
  const target=panel();
  const session=agenda.mount(target,{tasks:[mission],clientFactory:()=>({
   load:async()=>summary,query:async()=>({rows:[badRow],truncated:false}),dispose(){}
  })});
  await session.done;
  assert.match(target.textContent,/recherche partielle/);
  assert.doesNotMatch(target.textContent,/Retour : 1 horaire|Aller : 1 horaire/);
  session.dispose();
 }
});

test('invalid GTFS row timezone falls back to the official network timezone',async()=>{
 const target=panel();
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,
  query:async()=>({rows:[row({timeZone:'Invalid/Timezone'})],truncated:false}),
  dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Transport non confirmé/);
 assert.doesNotMatch(target.textContent,/recherche indisponible/);
 session.dispose();
});

test('Agenda rejects impossible GTFS transfer chronology',async()=>{
 const base={departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T12:00:00Z'};
 for(const legs of [
  [{departure:base.departure,arrival:'2026-11-02T11:45:00Z'},{departure:'2026-11-02T11:40:00Z',arrival:base.arrival}],
  [{departure:base.departure,arrival:'2026-11-02T11:20:00Z'},{departure:'2026-11-02T11:30:00Z',arrival:'2026-11-02T12:10:00Z'}],
  [{departure:'2026-11-02T11:05:00Z',arrival:'2026-11-02T11:20:00Z'},{departure:'2026-11-02T11:30:00Z',arrival:base.arrival}],
  [{departure:base.departure,arrival:'2026-11-02T11:20:00'},{departure:'2026-11-02T11:30:00Z',arrival:base.arrival}]
 ]){
  const target=panel();
  const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
   load:async()=>summary,query:async()=>({rows:[row({...base,legs})],truncated:false}),dispose(){}
  })});
  await session.done;
  assert.match(target.textContent,/recherche partielle/);
  session.dispose();
 }
});

test('Agenda rejects GTFS transfer intervals shorter than five or longer than 120 minutes',async()=>{
 for(const [firstArrival,secondDeparture] of [
  ['2026-11-02T11:20:00Z','2026-11-02T11:24:00Z'],
  ['2026-11-02T09:00:00Z','2026-11-02T11:10:00Z']
 ]){
  const target=panel();
  const legs=[{departure:'2026-11-02T08:00:00Z',arrival:firstArrival},
   {departure:secondDeparture,arrival:'2026-11-02T12:00:00Z'}];
  const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
   load:async()=>summary,query:async()=>({rows:[row({departure:'2026-11-02T08:00:00Z',legs})],truncated:false}),dispose(){}
  })});
  await session.done;
  assert.match(target.textContent,/recherche partielle/);
  session.dispose();
 }
});

test('Agenda accepts equivalent GTFS transfer instants expressed in different UTC offsets',async()=>{
 const target=panel();
 const transferred=row({departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T12:00:00Z',
  legs:[{line:'First',departure:'2026-11-02T12:00:00+01:00',arrival:'2026-11-02T11:20:00Z'},
   {line:'Second',departure:'2026-11-02T11:30:00Z',arrival:'2026-11-02T13:00:00+01:00'}]});
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,query:async()=>({rows:[transferred],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 1 horaire/);
 assert.doesNotMatch(target.textContent,/recherche indisponible/);
 session.dispose();
});

test('Agenda retains valid journeys when one worker row is invalid',async()=>{
 const target=panel();
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,query:async()=>({rows:[row({tripId:'valid'}),row({tripId:'bad',arrival:'invalid'})],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 1 horaire/);
 assert.match(target.textContent,/recherche partielle/);
 assert.match(target.textContent,/Transport non confirmé/);
 session.dispose();
});

test('Agenda never displays an invalid late pickup alongside a valid option',async()=>{
 const target=panel();
 const mission={label:'Aller',from:point,to:{lat:45.67,lon:6.39},
  earliestDeparture:'2026-11-02T11:00:00Z',latestArrival:'2026-11-02T12:30:00Z'};
 const session=agenda.mount(target,{tasks:[mission],clientFactory:()=>({
  load:async()=>summary,query:async()=>({rows:[
   row({tripId:'good',line:'VALID',departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T12:00:00Z'}),
   row({tripId:'late',line:'INVALID-LATE',departure:'2026-11-02T11:10:00Z',arrival:'2026-11-02T12:20:00Z'})
  ],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Aller : 1 horaire/);
 assert.match(target.textContent,/VALID/);
 assert.doesNotMatch(target.textContent,/INVALID-LATE/);
 assert.match(target.textContent,/recherche partielle/);
 session.dispose();
});

test('Agenda discloses truncated coverage even when valid GTFS journeys are shown',async()=>{
 const target=panel();
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,query:async()=>({rows:[row({tripId:'valid'})],truncated:true}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 1 horaire/);
 assert.match(target.textContent,/Recherche partielle/);
 assert.match(target.textContent,/Affichage limité/);
 session.dispose();
});

test('Agenda discloses missing GTFS network even when another network finds a journey',async()=>{
 const target=panel();
 const partialSummary={...summary,partial:true};
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>partialSummary,
  query:async()=>({rows:[row({tripId:'remaining-network'})],truncated:false}),
  dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 1 horaire/);
 assert.match(target.textContent,/Recherche partielle/);
 assert.match(target.textContent,/Transport non confirmé/);
 session.dispose();
});

test('Agenda keeps a valid direct service when a transfer has an impossible connection',async()=>{
 const target=panel();
 const direct=row({tripId:'valid-direct',line:'DIRECT-OK'});
 const broken=row({tripId:'bad-transfer',line:'BROKEN-TRANSFER',
  legs:[{departure:'2026-11-02T11:00:00Z',arrival:'2026-11-02T11:30:00Z'},
   {departure:'2026-11-02T11:32:00Z',arrival:'2026-11-02T12:00:00Z'}]});
 const session=agenda.mount(target,{tasks:[task],clientFactory:()=>({
  load:async()=>summary,query:async()=>({rows:[direct,broken],truncated:false}),dispose(){}
 })});
 await session.done;
 assert.match(target.textContent,/Retour : 1 horaire/);
 assert.match(target.textContent,/DIRECT-OK/);
 assert.doesNotMatch(target.textContent,/BROKEN-TRANSFER/);
 assert.match(target.textContent,/recherche partielle/);
 session.dispose();
});

test('Android PWA offline cache includes every versioned entrypoint script',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const worker=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
 const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match=>match[1]);
 assert.ok(scripts.length>10,'Expected application scripts');
 for(const script of scripts){
  assert.ok(worker.includes("'"+script+"'"),'Missing Android offline script: '+script);
 }
 assert.match(worker,/const CACHE = 'cp-app-transport-results-cards-\d{8}-v\d+'/);
});

test('Android PWA offline cache retains the transport worker and app shell',()=>{
 const worker=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','manifest.webmanifest'),'utf8'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.scope,'./');
 assert.match(html,/rel="manifest" href="manifest.webmanifest"/);
 for(const asset of ['transport-gtfs-worker.js','transport-gtfs-loader.js',
  'transport-gtfs-federation.js','transport-gtfs-index.js','transport-gtfs-time.js',
  'transport-gtfs-worker-client.js','transport-walking.js','manifest.webmanifest']){
  assert.ok(worker.includes("'"+asset+"'"),'Missing offline transport asset: '+asset);
 }
 assert.match(worker,/e\.request\.method !== 'GET'/);
 assert.match(worker,/u\.origin !== location\.origin/);
});

test('Android PWA caches only successful same-origin network responses',()=>{
 const worker=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
 assert.match(worker,/if \(r\.ok && r\.type !== 'opaque'\)/);
 assert.match(worker,/e\.waitUntil\(caches\.open\(CACHE\)/);
 assert.match(worker,/e\.request\.method !== 'GET'/);
 assert.match(worker,/u\.origin !== location\.origin/);
});

test('Android PWA manifest keeps the installed application identity stable',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','manifest.webmanifest'),'utf8'));
 assert.equal(manifest.name,'Convoyage Ultra');
 assert.equal(manifest.short_name,'Convoyage Ultra');
 assert.equal(manifest.start_url,'./index.html');
 assert.equal(manifest.scope,'./');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.orientation,'portrait');
 assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
 assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'));
 const worker=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
 for(const icon of manifest.icons){
  assert.ok(worker.includes("'"+icon.src+"'"),'Missing Android offline icon: '+icon.src);
 }
});

test('Mobile regional transport cards cover Aller Jonction Retour and safe stop lookup',()=>{
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 for(const section of ['Aller · comparer','Jonction mission · comparer','Retour · comparer']){
  assert.ok(app.includes(section),'Missing mobile transport comparison: '+section);
 }
 assert.match(app,/const showRegionalChoices = \(host, ranked, heading\) =>/);
 assert.match(app,/ranked\.slice\(0, 3\)/);
 assert.match(app,/document\.createElement\('details'\)/);
 assert.match(app,/document\.createElement\('ol'\)/);
 assert.match(app,/encodeURIComponent\(stop\)/);
 assert.match(app,/position exacte non vérifiée/);
 assert.match(app,/Transport non confirmé/);
});


test('omitted relevant networks are disclosed even when loaded feeds succeed',async()=>{
 const target=panel(),received=[];
 const base=agenda.DEFAULT_RESOURCES[0];
 const resources=[base,{...base,id:'partner1',datasetId:'partner1',network:'Partner One',federate:true},{...base,id:'partner2',datasetId:'partner2',network:'Partner Two',federate:true},{...base,id:'partner3',datasetId:'partner3',network:'Partner Three',federate:true},{...base,id:'partner4',datasetId:'partner4',network:'Partner Four',federate:true}];
 const session=agenda.mount(target,{tasks:[task],resources,
  clientFactory:()=>({loadNetworks:async()=>({networks:[summary,summary],partial:false}),query:async()=>({rows:[],truncated:false}),dispose(){}}),
  onResults:r=>received.push(r)});
 await session.done;
 assert.match(target.textContent,/Réseaux non interrogés : Partner Four/);
 assert.equal(received[0].coverage.partial,true);
 assert.deepEqual(received[0].coverage.omittedNetworks,['Partner Four']);
 session.dispose();
});


test('regular Savoie source is distinct from tourist data and scoped to candidate endpoints',()=>{
 const source=agenda.DEFAULT_RESOURCES.find(r=>r.id==='oura-savoie');
 assert.ok(source);assert.match(source.url,/provider=SAVOIE&/);
 assert.equal(source.resolveFromCatalogue,undefined);
 assert.equal(agenda.selected(source,{from:{lat:45.57,lon:5.92},to:{lat:45.67,lon:6.39}}),true);
 assert.equal(agenda.selected(source,{from:{lat:45.19,lon:5.72},to:{lat:45.28,lon:5.88}}),false);
});


test('Savoie tourism source has a separate identity and can cover southern valley candidates',()=>{
 const source=agenda.DEFAULT_RESOURCES.find(r=>r.id==='oura-savoie-tourism');
 const regular=agenda.DEFAULT_RESOURCES.find(r=>r.id==='oura-savoie');
 assert.ok(source);assert.notEqual(source.datasetId,regular.datasetId);
 assert.match(source.url,/provider=CARS_REGION_73_TOURISME&/);
 assert.equal(agenda.selected(source,{from:{lat:45.20,lon:6.67},to:{lat:45.17,lon:6.65}}),true);
 assert.equal(agenda.selected(source,{from:{lat:48.85,lon:2.35},to:{lat:45.17,lon:6.65}}),false);
});

test('a full-envelope partner remains searched ahead of earlier endpoint-only candidates',async()=>{
 const target=panel(),base={...agenda.DEFAULT_RESOURCES[0],id:'base',datasetId:'base',network:'Base',federate:true,bounds:[44,4,47,7]};
 const partial=Array.from({length:4},(_,i)=>({...base,id:'partial'+i,datasetId:'partial'+i,network:'Partial '+i,bounds:[44,4,45.5,5.5]}));
 const full={...base,id:'full',datasetId:'full',network:'Full'};let chosen;
 const session=agenda.mount(target,{resources:[base,...partial,full],tasks:[{label:'Retour',from:{lat:45,lon:5},to:{lat:46,lon:6},earliestDeparture:'2026-11-06T10:00:00Z'}],
 clientFactory:()=>({loadNetworks:async list=>{chosen=list.map(r=>r.id);return {networks:list.map(r=>({...summary,source:{...summary.source,network:r.network}}))};},query:async()=>({rows:[],truncated:false}),dispose(){}})});
 await session.done;assert.deepEqual(chosen,['base','full','partial0','partial1']);
 assert.match(target.textContent,/Réseaux non interrogés : Partial 2, Partial 3/);session.dispose();
});

test('Haute-Savoie can participate in a cross-region search outside its own envelope',async()=>{
 const target=panel(),hs=agenda.DEFAULT_RESOURCES.find(r=>r.id==='oura-haute-savoie');
 const tourist=agenda.DEFAULT_RESOURCES.find(r=>r.id==='oura-savoie-tourism');
 const journey={label:'Retour',from:{lat:45.9,lon:6.12},to:{lat:45.2,lon:6.67},earliestDeparture:'2026-11-06T10:00:00Z'};
 assert.equal(agenda.selected(hs,journey),false);
 assert.equal(agenda.crossEnvelopePair(hs,tourist,journey),true);
 let selected;
 const session=agenda.mount(target,{resources:[hs,tourist],tasks:[journey],
 clientFactory:()=>({loadNetworks:async list=>{selected=list.map(r=>r.id);return {networks:list.map(r=>({...summary,source:{...summary.source,network:r.network}}))};},query:async()=>({rows:[],truncated:false}),dispose(){}})});
 await session.done;assert.deepEqual(selected,['oura-haute-savoie','oura-savoie-tourism']);session.dispose();
});
