// node tests/planning-nuits-retour-periode.test.js
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
const run=(jours,nuits_max)=>root.CPPlanning.planifier([mission],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours,nuits_max,domicile:{lat:0,nom:'domicile'}});
assert.equal(run(1,0).plans.length,0,'one-day window and no overnight');
assert.equal(run(2,0).plans.length,0,'two-day window but overnight prohibited');
assert.equal(run(1,1).plans.length,0,'overnight allowed but return outside one-day window');
const valid=run(2,1);
assert.equal(valid.plans.length,1,'two-day window and one overnight allowed');
assert.equal(valid.plans[0].nuits,1,'one overnight counted');
assert.equal(valid.plans[0].etapes[0].mission.id,'N1','correct mission');
console.log('Overnight limit and return deadline: 6 assertions passed');
