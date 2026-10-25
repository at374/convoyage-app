// node tests/planning-plafond-28-jours.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const mission=(id,day)=>({id,kind:'disponible',platform:'Hiflow',fee:200,fees:{},
 origin:{lat:0},destination:{lat:0},
 pickup_start:'2026-11-'+day+'T10:00:00+01:00',
 pickup_end:'2026-11-'+day+'T10:30:00+01:00',
 delivery_end:'2026-11-'+day+'T12:00:00+01:00'});
for(const jours of [28,29,60]){
 const r=root.CPPlanning.planifier([mission('D28','28'),mission('D29','29')],{},
 {debut:Date.parse('2026-11-01T07:00:00+01:00'),jours,nuits_max:30,
 domicile:{lat:0,nom:'domicile'}});
 assert.equal(r.ecartees.horsPeriode,1,'one mission outside 28-day window');
 assert.equal(r.plans.some(p=>p.etapes.some(e=>e.mission.id==='D28')),true,'last allowed day included');
 assert.equal(r.plans.some(p=>p.etapes.some(e=>e.mission.id==='D29')),false,'day 29 excluded');
}
console.log('28-day planning cap: 9 assertions passed');
