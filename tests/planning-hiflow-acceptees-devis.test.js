// node tests/planning-hiflow-acceptees-devis.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const base={id:'AC1',kind:'acceptee',platform:'Hiflow',fee:100,origin:{lat:10},destination:{lat:10},
 pickup_start:'2026-10-27T14:00:00+01:00',pickup_end:'2026-10-27T14:30:00+01:00',
 delivery_end:'2026-10-27T16:00:00+01:00'};
const run=(fees,inclureAcceptees)=>root.CPPlanning.planifier([{...base,fees}],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,domicile:{lat:0,nom:'domicile'},inclureAcceptees});
for(const [name,fees,net,remb] of [
 ['accepted quote',{devis_numero:'D1',train:5},59.8,5],
 ['accepted no quote',{train:5},54.8,0]
]){
 const r=run(fees,true);
 assert.equal(r.plans.length,1,name+' plan');
 assert.equal(r.plans[0].net,net,name+' net');
 assert.equal(r.plans[0].etapes[0].rentabilite.rembTransport,remb,name+' reimbursement');
 assert.equal(r.plans[0].etapes[0].debut,Date.parse(base.pickup_start),name+' fixed time');
}
assert.equal(run({devis_numero:'D1',train:5},false).plans.length,0,'accepted excluded when disabled');
console.log('Accepted Hiflow planning quote: 9 assertions passed');
