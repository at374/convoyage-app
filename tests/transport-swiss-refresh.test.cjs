const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const slotCode=app.slice(app.indexOf('      // Regional refresh slots:'),app.indexOf("      regionalSlot('Jonction', () => [regionalPoint"));
const swissCode=app.slice(app.indexOf('      // Swiss API: outbound, return and junction suggestions.'),app.indexOf('      // SNCF station-only fallback'));
class Element{
 constructor(){this.children=[];this.root=false;this.parent=null;this.style={};this.value='';}
 get isConnected(){return this.root||!!this.parent?.isConnected;}
 set textContent(v){this.value=String(v);for(const c of this.children)c.parent=null;this.children=[];}
 get textContent(){return this.value+this.children.map(c=>c.textContent).join('');}
 appendChild(c){c.parent=this;this.children.push(c);return c;}
 setAttribute(){}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const panel=new Element();panel.root=true;const sheet={hidden:false},button={},calls=[];
 const current={o:null,d:{lat:46.2,lng:6.14,precision:'adresse'}},next={o:null,pickup_start:'2026-11-07T14:00:00+01:00'};
 const context={AbortController,window:{CPSwissTransport:{plan:options=>new Promise(resolve=>calls.push({options,resolve}))}},document:{createElement:()=>new Element()},panel,sourcePanel:panel,transportDestinations:{Aller:panel,Retour:panel,Jonction:panel},bt:button,
  $:id=>id==='feuille'?sheet:button,m:current,next,etat:{reglages:{domicile_lat:45.9,domicile_lng:6.1}},
  G:{coordonnees:(obj,side)=>obj?.[side==='origin'?'o':'d']},transportAddressPoint:p=>!!p&&p.precision==='adresse',
  pickupDate:'2026-11-07T09:00:00+01:00',deliveryDate:'2026-11-07T11:00:00+01:00',securityMarginMin:15,formatParis:x=>x,Date};
 vm.runInNewContext(slotCode+swissCode,context);return {panel,sheet,button,current,next,calls,context};
}
test('Swiss searches start when precise points arrive and cancel only replaced searches',()=>{
 const s=setup();assert.equal(s.calls.length,1);assert.equal(s.calls[0].options.from.lat,46.2);
 s.current.o={lat:46.1,lng:6.1,precision:'adresse'};s.button.cpRefreshRegional();assert.equal(s.calls.length,2);
 assert.equal(s.calls[0].options.signal.aborted,false);assert.equal(s.calls[1].options.arriveBy,true);
 s.next.o={lat:46.3,lng:6.2,precision:'adresse'};s.button.cpRefreshRegional();assert.equal(s.calls.length,3);
 s.current.o.lat=46.11;s.button.cpRefreshRegional();assert.equal(s.calls.length,4);assert.equal(s.calls[1].options.signal.aborted,true);
 assert.equal(s.calls[2].options.signal.aborted,false);
});
test('late Swiss responses cannot replace a newer search or update a hidden panel',async()=>{
 const s=setup();s.current.o={lat:46.1,lng:6.1,precision:'adresse'};s.button.cpRefreshRegional();
 const old=s.calls[1];s.current.o.lat=46.11;s.button.cpRefreshRegional();const before=s.panel.textContent;
 old.resolve([{departure:'2026-11-07T06:00:00Z',arrival:'2026-11-07T07:00:00Z',sections:[]}]);await tick();assert.equal(s.panel.textContent,before);
 s.sheet.hidden=true;const hidden=s.panel.textContent;s.calls[2].resolve([{departure:'2026-11-07T06:00:00Z',arrival:'2026-11-07T07:00:00Z',sections:[]}]);await tick();assert.equal(s.panel.textContent,hidden);
});
test('valid Swiss answers are passed to comparison cards with unknown price',async()=>{
 const s=setup(),calls=[];
 s.context.window.CPTransportAdapters=require('../transport-adapters.js');
 s.context.window.CPTransportRanking=require('../transport-ranking.js');
 s.context.showRegionalChoices=(host,choices,heading)=>calls.push({choices,heading});
 s.calls[0].resolve([{departure:'2026-11-07T10:10:00Z',arrival:'2026-11-07T10:45:00Z',sections:[{mode:'BUS',line:'64',from:'A',to:'B',fromPoint:{lat:46.2,lon:6.14},toPoint:{lat:46.24,lon:6.08},departure:'2026-11-07T10:10:00Z',arrival:'2026-11-07T10:45:00Z'}]}]);
 await tick();assert.equal(calls.length,1);assert.equal(calls[0].heading,'Retour suisse · comparer');
 assert.equal(calls[0].choices[0].journey.priceEUR,null);assert.equal(calls[0].choices[0].journey.feasible,false);
});
