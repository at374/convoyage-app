// node tests/planning-acceptee-marge-frontiere.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const make=(id,kind,start,end)=>({id,kind,platform:'Hiflow',fee:100,fees:{},
 origin:{lat:0},destination:{lat:0},pickup_start:'2026-10-27T'+start+':00+01:00',
 pickup_end:'2026-10-27T'+start.slice(0,2)+':30:00+01:00',
 delivery_end:'2026-10-27T'+end+':00+01:00'});
const accepted=make('A','acceptee','15:00','17:00');
const available=make('B','disponible','12:00','14:00');
const run=marge=>root.CPPlanning.planifier([accepted,available],{marge_minutes:marge},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,
 domicile:{lat:0,nom:'domicile'},inclureAcceptees:true});
const at60=run(60),at61=run(61),at0=run(0);
const hasChain=r=>r.plans.some(p=>p.etapes.map(e=>e.mission.id).join(',')==='B,A');
assert.equal(hasChain(at60),true,'exactly sufficient margin accepted');
assert.equal(hasChain(at61),false,'one minute beyond available gap rejected');
assert.equal(hasChain(at0),true,'zero margin accepted');
for(const [label,r] of [['60',at60],['61',at61],['0',at0]]){
 assert.ok(r.plans.length>0,label+' retains accepted mission');
 for(const p of r.plans){
  assert.equal(p.etapes.some(e=>e.mission.id==='A'),true,label+' contains accepted mission');
  assert.equal(p.etapes.find(e=>e.mission.id==='A').debut,Date.parse(accepted.pickup_start),label+' fixed start');
 }
}
console.log('Accepted mission boundary margins: assertions passed');
