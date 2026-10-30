'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const api=require('../sncf-fallback.js');
const sha='a'.repeat(64);
const fixture=(date,trips)=>({schemaVersion:1,date,timeZone:'Europe/Paris',sourceSha256:sha,sourceVersion:'fixture',transportConfirmed:false,realtime:false,stations:[['A','Alpha',45,5],['X','Échange',45.1,5.1],['B','Bravo',45.2,5.2]],trips});
const a=['first','TER','',[[0,28800,28800,0,0],[1,30000,30000,0,0]]];
const b=['second','TER','',[[1,30900,30900,0,0],[2,32400,32400,0,0]]];
const day=api.validateDay(fixture('2026-10-30',[a,b]),'2026-10-30',sha);
const request={from:'Alpha',to:'Bravo',when:'2026-10-30T07:50:00+01:00'};
let result=api.search([day],request);
assert.equal(result.itineraries.length,1);assert.equal(result.itineraries[0].legs.length,2);assert.equal(result.itineraries[0].transferMinutes,15);
assert.equal(result.itineraries[0].transportConfirmed,false);assert.equal(result.itineraries[0].walkingVerified,false);assert.equal(result.itineraries[0].price,null);
assert.equal(api.search([day],{...request,transferMinutes:20}).itineraries.length,0);
assert.equal(api.search([day],{...request,arriveBy:true,when:'2026-10-30T09:00:00+01:00'}).itineraries.length,1);
assert.equal(api.search([day],{...request,arriveBy:true,when:'2026-10-30T08:59:00+01:00'}).itineraries.length,0);
assert.equal(api.search([day],{...request,from:'Bravo',to:'Alpha'}).itineraries.length,0);
assert.equal(api.search([fixture('2026-10-30',[[a[0],a[1],a[2],[[0,28800,28800,1,0],a[3][1]]],b])],request).itineraries.length,0);
const bad=JSON.parse(JSON.stringify(day));bad.trips[0][3][1][1]=1;assert.throws(()=>api.validateDay(bad,'2026-10-30',sha));
assert.throws(()=>api.validateDay({...day,transportConfirmed:true},'2026-10-30',sha));
assert.throws(()=>api.validateDay(day,'2026-10-31',sha));
assert.equal(api.stationsFor('echange',day.stations)[0].index,1);
assert.equal(api.stationsFor({point:{lat:0,lon:0}},day.stations).length,0);
const night=fixture('2026-10-29',[['night','TER','',[[0,90000,90000,0,0],[2,91800,91800,0,0]]]]);
assert.equal(api.search([night],{...request,when:'2026-10-30T00:30:00+01:00'}).itineraries[0].departure,'2026-10-30T00:00:00.000Z');
assert.equal(api.serviceBase('2026-10-25'),Date.parse('2026-10-24T23:00:00Z'));
assert.equal(api.serviceBase('2026-07-30'),Date.parse('2026-07-29T22:00:00Z'));
const direct=['direct','TER','',[[0,28800,28800,0,0],[1,30000,30000,0,0],[2,31200,31200,0,0]]];
assert.equal(api.search([fixture('2026-10-30',[direct,b])],request).itineraries.length,1,'unnecessary slower transfer off a through train must be removed');

(async()=>{
 const root=process.env.SNCF_DATA_DIR||path.join(__dirname,'..','data','sncf');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
 let checked=0;
 for(const [date,entry] of Object.entries(manifest.dates)){
  const bytes=fs.readFileSync(path.join(root,entry.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  const loaded=api.validateDay(JSON.parse(bytes),date,manifest.sourceSha256);assert.equal(loaded.trips.length,entry.trips);checked++;
 }
 const urls=[];
 const fetcher=async url=>{urls.push(url);assert.match(url,/^data\/sncf\/(manifest|sncf-20\d{2}-\d{2}-\d{2})\.json(?:\?v=[a-f0-9]{16})?$/);const filename=url.split('/').at(-1).split('?')[0];return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,filename)))};};
 const dates=Object.keys(manifest.dates).sort();const target=manifest.dates['2026-10-30']?'2026-10-30':dates[1]||dates[0];
 const before=performance.now();const real=await api.plan({from:'Ambérieu-en-Bugey',to:'Annecy',when:target+'T13:30:00+01:00',fetcher});
 const knownSnapshot=manifest.sourceSha256==='c5c122aebd4aba12f40efad01669885a163b54c09bada701395f36ab246cebd3';
 if(knownSnapshot&&target==='2026-10-30'){assert.equal(real.itineraries[0].departure,'2026-10-30T13:33:00.000Z');assert.equal(real.itineraries[0].arrival,'2026-10-30T15:07:00.000Z');assert.equal(real.itineraries[0].legs.length,1);}
 const sample=JSON.parse(fs.readFileSync(path.join(root,manifest.dates[target].file)));
 let generic=null;
 for(const t of sample.trips){
  for(let i=0;i<t[3].length-1&&!generic;i++){
   const a=t[3][i];if(a[3]!==0||a[2]<21600||a[2]>72000)continue;
   const b=t[3].slice(i+1).find(e=>e[4]===0&&e[0]!==a[0]);if(!b)continue;
   const query=index=>({name:sample.stations[index][1],point:{lat:sample.stations[index][2],lon:sample.stations[index][3]}});
   generic={from:query(a[0]),to:query(b[0]),when:new Date(api.serviceBase(target)+a[2]*1000-1000).toISOString(),fetcher};
  }
  if(generic)break;
 }
 assert(generic,'at least one valid scheduled railway segment');
 assert((await api.plan(generic)).itineraries.length>0,'generated dataset must reproduce a known segment from itself');
 const durationMs=Math.round(performance.now()-before);
 await api.plan({from:{name:'private location',point:{lat:45.9,lon:6.1}},to:'Annecy',when:target+'T13:30:00+01:00',fetcher});
 assert(urls.every(url=>!url.includes('private')&&!url.includes('45.9')));
 await assert.rejects(api.plan({from:'Annecy',to:'Grenoble',when:'2030-01-01T08:00:00+01:00',fetcher}),/non publié/);
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const start=app.indexOf('      // SNCF station-only fallback'),end=app.indexOf('      // Regional return',start);
 assert(start>=0&&end>start);
 class Element{constructor(){this.style={};this.children=[];this.isConnected=true;this.text='';}setAttribute(){}set textContent(t){this.text=String(t);this.children=[];}get textContent(){return this.text+this.children.map(c=>c.textContent).join('');}appendChild(child){this.children.push(child);}}
 const panel=new Element();
 const context={window:{CPSncfFallback:api},document:{createElement:()=>new Element()},panel,etat:{reglages:{domicile_ville:'Annecy'}},G:{trouverVille:()=>null,coordonnees:()=>null},m:{from_city:'Grenoble',to_city:'Ambérieu-en-Bugey'},pickupDate:target+'T12:00:00+01:00',deliveryDate:target+'T13:30:00+01:00',next:null,securityMarginMin:30,regionalFetch:fetcher,Date,formatParis:v=>new Date(v).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})};
 vm.createContext(context);vm.runInContext(app.slice(start,end),context);
 await new Promise(resolve=>setTimeout(resolve,100));
 assert(panel.textContent.includes('Retour — secours SNCF'));
 assert(panel.textContent.includes('Transport non confirmé'));
 if(knownSnapshot&&target==='2026-10-30'){assert(panel.textContent.includes('14:33'));assert(panel.textContent.includes('16:07'));}
 console.log(JSON.stringify({passed:true,validatedDays:checked,sourceVersion:manifest.sourceVersion,firstJourney:real.itineraries[0],localLoadAndSearchMs:durationMs,ui:'simulated DOM, not Android'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
