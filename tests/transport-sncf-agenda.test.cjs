const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../sncf-fallback.js');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const slotCode=app.slice(app.indexOf('      // Regional refresh slots:'),app.indexOf("      regionalSlot(() => [regionalPoint"));
const railCode=app.slice(app.indexOf('      // SNCF station-only fallback'),app.indexOf('      // Regional return'));
class Element{
 constructor(){this.children=[];this.style={};this.parent=null;this.root=false;this.value='';}
 get isConnected(){return this.root||!!this.parent?.isConnected;}
 set textContent(value){this.value=String(value);for(const c of this.children)c.parent=null;this.children=[];}
 get textContent(){return this.value+this.children.map(c=>c.textContent).join('');}
 appendChild(child){child.parent=this;this.children.push(child);return child;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
 setAttribute(){}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const grenoble={lat:45.191491,lng:5.714548,precision:'adresse'};
function setup(plan,fetcher){
 const panel=new Element();panel.root=true;
 const button={},sheet={hidden:false},current={from_city:'Grenoble',to_city:'Grenoble',o:null,d:null};
 const next={from_city:'Annecy',o:null,pickup_start:'2026-11-02T20:00:00+01:00'};
 const context={AbortController,window:{CPSncfFallback:plan?{plan}:api},document:{createElement:()=>new Element()},panel,bt:button,
  $:id=>id==='feuille'?sheet:button,m:current,next,etat:{reglages:{domicile_ville:'Annecy',domicile_lat:45.902047,domicile_lng:6.121826}},
  G:{coordonnees:(m,side)=>m?.[side==='origin'?'o':'d'],trouverVille:()=>null},transportAddressPoint:()=>false,
  pickupDate:'2026-11-02T16:00:00+01:00',deliveryDate:'2026-11-02T17:00:00+01:00',securityMarginMin:30,
  regionalFetch:fetcher,formatParis:v=>new Date(v).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}),Date};
 vm.runInNewContext(slotCode+railCode,context);return {panel,button,sheet,current,next,context};
}
test('SNCF refreshes only changed station inputs after late geocoding, with the mission deadline and cancellation',()=>{
 const calls=[],s=setup(options=>{calls.push(options);return new Promise(()=>{});});
 assert.equal(calls.length,3);assert.equal(calls[0].to.point,null);
 s.current.o={...grenoble};s.button.cpRefreshRegional();assert.equal(calls.length,4);
 assert.equal(calls[0].signal.aborted,true);assert.equal(calls[1].signal.aborted,false);
 assert.equal(calls[3].to.point.lat,grenoble.lat);assert.equal(calls[3].when,'2026-11-02T14:30:00.000Z');
 assert.equal(calls[2].latestArrival,'2026-11-02T18:30:00.000Z');
 s.current.o.description='Same coordinates';s.button.cpRefreshRegional();assert.equal(calls.length,4);
 s.context.etat.reglages.domicile_lat=45.903;s.button.cpRefreshRegional();assert.equal(calls.length,6);
 assert.equal(calls[2].signal.aborted,false,'home changes do not restart the mission junction');
});
test('SNCF responses cannot overwrite replaced, hidden or disconnected mission slots',async()=>{
 for(const stage of ['replaced','hidden','disconnected']){
  const gates=[],s=setup(()=>new Promise(resolve=>gates.push(resolve)));
  if(stage==='replaced'){s.current.o={...grenoble};s.button.cpRefreshRegional();}
  if(stage==='hidden')s.sheet.hidden=true;
  if(stage==='disconnected')s.panel.root=false;
  const before=s.panel.textContent;gates[0]({itineraries:[],sourceVersion:'LATE'});await tick();
  assert.equal(s.panel.textContent,before,stage);
 }
});
test('recorded official SNCF subset renders Annecy–Grenoble after the ambiguous station receives its coordinates',async()=>{
 const fixture=require('./fixtures/sncf-annecy-grenoble-2026-11-02.json');
 const urls=[],fetcher=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('manifest.json')?fixture.manifest:fixture.day};};
 const s=setup(null,fetcher);
 await tick();await tick();
 assert.match(s.panel.children[0].textContent,/gare non identifiée/);
 s.current.o={...grenoble};s.button.cpRefreshRegional();await tick();await tick();
 const outbound=s.panel.children.at(-1).textContent;
 assert.match(outbound,/Aller — secours SNCF, horaires théoriques/);assert.match(outbound,/proposition\(s\) de gare à gare/);
 assert.match(outbound,/Annecy/);assert.match(outbound,/Grenoble/);assert.match(outbound,/Transport non confirmé/);
 assert.doesNotMatch(outbound,/Réalisable/);assert(urls.every(u=>!u.includes('45.191491')),'Coordinates stay local');
});
