// node tests/planning-acceptee-liaison-insuffisante.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const make=(id,kind,platform,start,end,origin,destination)=>({id,kind,platform,fee:100,fees:{},
 origin:{lat:origin},destination:{lat:destination},pickup_start:'2026-10-27T'+start+':00+01:00',
 pickup_end:'2026-10-27T'+start.slice(0,2)+':30:00+01:00',
 delivery_end:'2026-10-27T'+end+':00+01:00'});
const accepted=make('A','acceptee','Hiflow','15:00','17:00',10,10);
const incompatible=make('B','disponible','Otoqi','10:00','14:00',0,0);
const result=root.CPPlanning.planifier([accepted,incompatible],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,
 domicile:{lat:0,nom:'domicile'},inclureAcceptees:true});
assert.ok(result.plans.length>0,'accepted mission yields a plan');
for(const plan of result.plans){
 assert.equal(plan.etapes.some(e=>e.mission.id==='A'),true,'accepted mission retained');
 assert.equal(plan.etapes.some(e=>e.mission.id==='B'),false,'infeasible connection excluded');
 assert.equal(plan.etapes.find(e=>e.mission.id==='A').debut,Date.parse(accepted.pickup_start),'fixed appointment preserved');
}
console.log('Insufficient connection time to accepted mission: assertions passed');
