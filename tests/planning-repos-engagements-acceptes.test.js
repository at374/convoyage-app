// node tests/planning-repos-engagements-acceptes.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const make=(id,kind)=>({id,kind,platform:'Hiflow',fee:100,fees:{},origin:{lat:0},destination:{lat:0},
 pickup_start:'2026-10-27T09:00:00+01:00',pickup_end:'2026-10-27T09:30:00+01:00',
 delivery_end:'2026-10-27T11:00:00+01:00'});
const run=(kind,option)=>root.CPPlanning.planifier([make(kind,kind)],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,
 domicile:{lat:0,nom:'domicile'},inclureAcceptees:true,...option});
for(const option of [{joursSansTravail:['2026-10-27']},{joursReposHebdo:['tue']}]){
 assert.equal(run('disponible',option).plans.length,0,'available mission excluded on rest day');
 const accepted=run('acceptee',option);
 assert.equal(accepted.plans.length,1,'already accepted commitment retained on rest day');
 assert.equal(accepted.plans[0].etapes[0].debut,Date.parse('2026-10-27T09:00:00+01:00'),'accepted start unchanged');
}
console.log('Rest days vs accepted commitments: 6 assertions passed');
