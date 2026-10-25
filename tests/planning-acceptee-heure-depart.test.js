// node tests/planning-acceptee-heure-depart.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const accepted={id:'A',kind:'acceptee',platform:'Hiflow',fee:100,fees:{},
 origin:{lat:0},destination:{lat:0},pickup_start:'2026-10-27T09:00:00+01:00',
 pickup_end:'2026-10-27T09:30:00+01:00',delivery_end:'2026-10-27T11:00:00+01:00'};
const run=heureMin=>root.CPPlanning.planifier([accepted],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,
 domicile:{lat:0,nom:'domicile'},inclureAcceptees:true,heureMin});
for(const hour of [8,9]){
 const result=run(hour*60);
 assert.equal(result.plans.length,1,'departure '+hour+' allows accepted mission');
 assert.equal(result.plans[0].etapes[0].debut,Date.parse(accepted.pickup_start),'accepted mission starts at fixed hour');
}
assert.equal(run(10*60).plans.length,0,'departure after accepted start is infeasible');
console.log('Accepted mission minimum departure time: 5 assertions passed');
