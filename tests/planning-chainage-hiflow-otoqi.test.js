// node tests/planning-chainage-hiflow-otoqi.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const base={kind:'disponible',fee:100,origin:{lat:10},destination:{lat:10},
 pickup_start:'2026-10-27T10:00:00+01:00',pickup_end:'2026-10-27T10:30:00+01:00',
 delivery_end:'2026-10-27T12:00:00+01:00'};
const missions=[
 {...base,id:'A',kind:'acceptee',platform:'Hiflow',fees:{devis_numero:'D1',train:5}},
 {...base,id:'B',platform:'Otoqi',fees:{train:5},
  pickup_start:'2026-10-27T15:00:00+01:00',pickup_end:'2026-10-27T15:30:00+01:00',
  delivery_end:'2026-10-27T17:00:00+01:00'}
];
const result=root.CPPlanning.planifier(missions,{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,
 domicile:{lat:0,nom:'domicile'},inclureAcceptees:true});
const chain=result.plans.find(p=>p.etapes.length===2);
assert.ok(chain,'two-mission chain exists');
assert.equal(chain.net,138.6,'combined net');
assert.equal(chain.etapes[0].mission.id,'A','accepted first');
assert.equal(chain.etapes[1].mission.id,'B','available second');
assert.equal(chain.etapes[0].rentabilite.rembTransport,5,'Hiflow quoted transport');
assert.equal(chain.etapes[1].rentabilite.rembTransport,0,'Otoqi transport not reimbursed');
assert.equal(chain.etapes[0].debut,Date.parse(missions[0].pickup_start),'accepted time fixed');
assert.equal(chain.etapes[1].debut,Date.parse(missions[1].pickup_start),'second mission time');
console.log('Mixed Hiflow/Otoqi chain: 8 assertions passed');
