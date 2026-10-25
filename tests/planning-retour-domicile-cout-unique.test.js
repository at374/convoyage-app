// node tests/planning-retour-domicile-cout-unique.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const base={id:'R1',kind:'disponible',platform:'Hiflow',fee:200,fees:{},origin:{lat:0},
 pickup_start:'2026-10-27T09:00:00+01:00',pickup_end:'2026-10-27T09:30:00+01:00',
 delivery_end:'2026-10-27T11:00:00+01:00'};
const run=lat=>root.CPPlanning.planifier([{...base,destination:{lat}}],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,domicile:{lat:0,nom:'domicile'}});
for(const [lat,km,cout,net] of [[0,0,0,157.6],[5,50,6,151.6],[10,100,12,145.6]]){
 const r=run(lat);
 assert.equal(r.plans.length,1,'return feasible');
 const p=r.plans[0];
 assert.equal(p.retour.km,km,'return distance');
 assert.equal(p.retour.cout,cout,'return cost');
 assert.equal(p.netMissions,157.6,'mission net unchanged');
 assert.equal(p.net,net,'return deducted once');
 assert.equal(p.coutLiaisons,cout,'total connections include return once');
}
console.log('Return-to-home cost deducted once: 18 assertions passed');
