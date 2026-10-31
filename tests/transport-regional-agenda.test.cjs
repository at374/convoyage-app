const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../regional-routing.js');
const fixture=require('./fixtures/mobilites-m-grenoble-crolles-2026-10-30.json');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const code=app.slice(app.indexOf('      // Regional refresh slots:'),app.indexOf('      // Swiss API: outbound'))+
 app.slice(app.indexOf('      // Regional return from the exact delivery point'),app.indexOf('      // Statut réel du fichier GTFS quotidien'));
class Element{
 constructor(){this.children=[];this.value='';this.parent=null;this.root=false;}
 get isConnected(){return this.root||!!this.parent?.isConnected;}
 set textContent(value){this.value=value;for(const child of this.children)child.parent=null;this.children=[];}
 get textContent(){return this.value+this.children.map(child=>child.textContent).join('');}
 appendChild(child){child.parent=this;this.children.push(child);return child;}
 setAttribute(name,value){this[name]=value;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
}
const from={lat:45.1914,lng:5.7143,precision:'adresse'},to={lat:45.28364,lng:5.88224,precision:'gps'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(plan,fetcher){
 const panel=new Element();panel.root=true;
 const button={dataset:{}},sheet={hidden:false},current={o:{...from,precision:'ville'},d:{...from}},next={o:{...to,precision:'ville'},pickup_start:'2026-11-02T13:00:00+01:00'};
 const routing={...api,...(plan?{plan}:{})};
 const context={AbortController,window:{CPRegionalRouting:routing},panel,bt:button,document:{createElement:()=>new Element()},m:current,next,
  etat:{reglages:{domicile_lat:to.lat,domicile_lng:to.lng}},G:{coordonnees:(mission,side)=>mission?.[side==='origin'?'o':'d']},
  transportAddressPoint:p=>!!p&&['adresse','gps'].includes(p.precision),
  $:id=>id==='feuille'?sheet:button,regionalEngineReady:true,regionalProviderReady:true,regionalEndpointConfigured:false,
  regionalPointsReady:(a,b)=>api.supportsPublic(a,b),regionalFetch:fetcher,
  pickupDate:'2026-11-02T13:00:00+01:00',deliveryDate:'2026-11-02T10:00:00+01:00',securityMarginMin:30,
  formatParis:value=>new Date(value).toISOString()};
 vm.runInNewContext(code,context);return {panel,button,sheet,current,next,context};
}
test('regional tasks start independently when exact coordinates arrive and keep unchanged requests',()=>{
 const calls=[],gates=[];
 const state=setup(options=>{calls.push(options);return new Promise(resolve=>gates.push(resolve));});
 assert.equal(calls.length,1); // Return is ready; outbound and junction are not.
 state.next.o.precision='adresse';state.button.cpRefreshRegional();assert.equal(calls.length,2);
 assert.equal(calls[1].to.lat,to.lat);
 state.button.cpRefreshRegional();state.next.o.description='Updated label';state.button.cpRefreshRegional();
 assert.equal(calls.length,2);
 let notify;
 state.context.pointsMission=(mission,callback)=>{notify=callback;};
 state.context.$=id=>id==='feuille'?state.sheet:id==='btnTransportsMission'?state.button:id==='cpTransportMissionDetails'?state.panel:null;
 const callback=app.slice(app.indexOf('    const transportDetailButton ='),app.indexOf('  // ---------- V77')).replace(/\n  }\s*$/, '');
 vm.runInNewContext(callback,state.context);
 state.current.o.precision='gps';notify();assert.equal(calls.length,3);
 assert.equal(calls[2].arrivalDeadline,'2026-11-02T11:30:00.000Z');
 state.next.o.lat=45.284;state.button.cpRefreshRegional();assert.equal(calls.length,4);
 assert.equal(calls[3].to.lat,45.284);
 state.sheet.hidden=true;state.current.d.lat=45.192;state.button.cpRefreshRegional();assert.equal(calls.length,4);
 for(const resolve of gates)resolve({itineraries:[]});
});
test('replaced, hidden and disconnected regional results cannot update the visible panel',async()=>{
 for(const stage of ['replaced','hidden','disconnected']){
  const gates=[],state=setup(()=>new Promise(resolve=>gates.push(resolve)));
  if(stage==='replaced'){state.current.d.lat=45.192;state.button.cpRefreshRegional();}
  if(stage==='hidden')state.sheet.hidden=true;
  if(stage==='disconnected')state.panel.root=false;
  const before=state.panel.textContent;
  gates[0]({itineraries:[]});await tick();assert.equal(state.panel.textContent,before,stage);
 }
});
test('recorded official Mobilités M response reaches the actual Agenda rendering after delayed geocoding',async()=>{
 const requests=[],state=setup(null,async(url,options)=>{
  requests.push(url);assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-cache');
  return new Response(JSON.stringify(fixture.response));
 });
 // Isolate the junction; no home reference is available for the other tasks.
 // The initial return request above is ignored once its slot is replaced.
 state.context.etat.reglages={};state.next.o.precision='adresse';state.button.cpRefreshRegional();
 await tick();await tick();
 const request=requests.map(url=>new URL(url)).find(url=>url.searchParams.get('fromPlace')===fixture.request.fromPlace&&url.searchParams.get('toPlace')===fixture.request.toPlace);
 assert.ok(request);assert.equal(request.searchParams.get('date'),'2026-11-02');
 assert.match(state.panel.textContent,/Jonction régionale : 4 proposition/);
 assert.match(state.panel.textContent,/C11/);assert.match(state.panel.textContent,/Crolles Mairie/);
 assert.match(state.panel.textContent,/2026-11-02T10:05:59.000Z/);
 assert.match(state.panel.textContent,/transport non confirmé/);assert.doesNotMatch(state.panel.textContent,/Réalisable/);
});
