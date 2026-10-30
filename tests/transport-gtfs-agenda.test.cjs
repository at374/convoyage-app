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
 assert.equal(calls[0].method,'missionDirectTrips');assert.equal(calls[0].radiusMeters,700);
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
test('actual Agenda call passes mission windows and refreshes only GTFS when coordinates arrive',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const code=source.slice(source.indexOf('      // GTFS candidate search:'),source.indexOf('      // Swiss public transport connections for an accepted mission junction.'));
 const calls=[],callbacks=[];let stopped=0,removed=0;
 const button={},sheet={hidden:false},panel={isConnected:true,hidden:false,querySelector:()=>({remove(){removed++;}})};
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
 assert.equal(calls.length,2);assert.equal(calls[1].tasks[2].to.lat,45.8);
 assert.equal(stopped,2);assert.equal(removed,2);
 sheet.hidden=true;callbacks[0]();assert.equal(calls.length,2);
});
