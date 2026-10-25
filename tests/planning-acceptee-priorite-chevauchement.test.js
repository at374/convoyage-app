// node tests/planning-acceptee-priorite-chevauchement.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const make=(id,kind,platform,start,end)=>({id,kind,platform,fee:100,fees:{},
 origin:{lat:10},destination:{lat:10},pickup_start:'2026-10-27T'+start+':00+01:00',
 pickup_end:'2026-10-27T'+start.slice(0,2)+':30:00+01:00',
 delivery_end:'2026-10-27T'+end+':00+01:00'});
const accepted=make('A','acceptee','Hiflow','14:00','16:00');
const conflicting=make('B','disponible','Otoqi','12:00','15:00');
const result=root.CPPlanning.planifier([accepted,conflicting],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,
 domicile:{lat:0,nom:'domicile'},inclureAcceptees:true});
assert.ok(result.plans.length>0,'at least one valid plan');
for(const plan of result.plans){
 assert.equal(plan.etapes.some(e=>e.mission.id==='A'),true,'accepted mission preserved');
 assert.equal(plan.etapes.some(e=>e.mission.id==='B'),false,'overlapping available mission excluded');
 assert.equal(plan.etapes.find(e=>e.mission.id==='A').debut,Date.parse(accepted.pickup_start),'accepted start unchanged');
}
console.log('Accepted mission protected from overlap: assertions passed');
