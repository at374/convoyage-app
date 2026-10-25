// node tests/planning-hotel-retour-combines.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const base={id:'H1',kind:'disponible',platform:'Hiflow',fee:200,fees:{},origin:{lat:0},
 pickup_start:'2026-10-27T20:00:00+01:00',pickup_end:'2026-10-27T20:30:00+01:00',
 delivery_end:'2026-10-28T08:00:00+01:00'};
const run=(lat,budget_hotel)=>root.CPPlanning.planifier([{...base,destination:{lat}}],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:2,nuits_max:1,
 budget_hotel,domicile:{lat:0,nom:'domicile'}});
for(const [lat,budget,retour,net] of [[0,40,0,117.6],[5,40,6,111.6],[10,75,12,70.6]]){
 const r=run(lat,budget);
 assert.equal(r.plans.length,1,'overnight plan feasible');
 const p=r.plans[0];
 assert.equal(p.nuits,1,'one overnight');
 assert.equal(p.coutHotel,budget,'hotel counted once');
 assert.equal(p.retour.cout,retour,'return counted once');
 assert.equal(p.netMissions,157.6,'mission net unchanged');
 assert.equal(p.net,net,'combined net');
 assert.equal(p.net,Math.round((p.netMissions-budget-retour)*100)/100,'hotel and return each deducted once');
}
console.log('Hotel and return combined: 21 assertions passed');
