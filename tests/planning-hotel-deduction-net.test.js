// node tests/planning-hotel-deduction-net.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const mission={id:'N1',kind:'disponible',platform:'Hiflow',fee:200,fees:{},
 origin:{lat:0},destination:{lat:0},pickup_start:'2026-10-27T20:00:00+01:00',
 pickup_end:'2026-10-27T20:30:00+01:00',delivery_end:'2026-10-28T08:00:00+01:00'};
const run=budget_hotel=>root.CPPlanning.planifier([mission],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:2,nuits_max:1,
 budget_hotel,domicile:{lat:0,nom:'domicile'}});
for(const [budget,expectedNet] of [[0,157.6],[40,157.6],[75,157.6]]){
 const r=run(budget);
 assert.equal(r.plans.length,1,'plan remains feasible');
 assert.equal(r.plans[0].coutHotel,0,'no hotel charged while mission runs overnight');
 assert.equal(r.plans[0].net,expectedNet,'overnight work not charged as hotel');
 assert.equal(r.plans[0].netMissions,157.6,'mission net unaffected by hotel option');
}
console.log('Hotel budget net deduction: 12 assertions passed');
