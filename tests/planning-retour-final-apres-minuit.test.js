// node tests/planning-retour-final-apres-minuit.test.js
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root={CPCalc:require('../calc.js'),
 CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const cases=[
 ['return crosses midnight',10,'2026-10-27T23:50:00+01:00',true,false],
 ['return before midnight',0,'2026-10-27T22:00:00+01:00',false,false],
 ['mission crosses midnight',10,'2026-10-28T08:00:00+01:00',false,true]
];
for(const [name,lat,end,retourEnCours,enMission] of cases){
 const m={id:'M',kind:'disponible',platform:'Hiflow',fee:200,fees:{},
 origin:{lat},destination:{lat},pickup_start:'2026-10-27T20:00:00+01:00',
 pickup_end:'2026-10-27T20:30:00+01:00',delivery_end:end};
 const r=root.CPPlanning.planifier([m],{},{
 debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:2,nuits_max:1,
 budget_hotel:60,domicile:{lat:0,nom:'domicile'},seuil_dom:15});
 const p=r.plans.find(x=>x.etapes.length===1);
 assert.ok(p,name+': plan exists');
 assert.equal(p.coutHotel,0,name+': no hotel charged');
 assert.equal(p.nuitsDetails.some(x=>x.retourEnCours),retourEnCours,name+': return flag');
 assert.equal(p.nuitsDetails.some(x=>x.enMission),enMission,name+': working flag');
}
console.log('Overnight final return: 12 assertions passed');
