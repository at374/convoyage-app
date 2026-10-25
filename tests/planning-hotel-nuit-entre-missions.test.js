// node tests/planning-hotel-nuit-entre-missions.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const calc=require('../calc.js');
const root={CPCalc:calc,CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const run=lat=>{
 const missions=['27','28'].map((day,i)=>({id:'M'+i,kind:'disponible',platform:'Hiflow',fee:200,fees:{},
 origin:{lat},destination:{lat},pickup_start:'2026-10-'+day+'T10:00:00+01:00',
 pickup_end:'2026-10-'+day+'T10:30:00+01:00',delivery_end:'2026-10-'+day+'T12:00:00+01:00'}));
 const result=root.CPPlanning.planifier(missions,{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:2,nuits_max:1,
 budget_hotel:60,domicile:{lat:0,nom:'domicile'},seuil_dom:15});
 return result.plans.find(p=>p.etapes.length===2);
};
const home=run(0),away=run(5);
assert.ok(home,'two-day plan at home exists');
assert.ok(away,'two-day plan away exists');
assert.equal(home.nuits,1);
assert.equal(away.nuits,1);
assert.equal(home.nuitsDom[0].domicile,true);
assert.equal(away.nuitsDom[0].domicile,false);
assert.equal(home.coutHotel,0,'no hotel for home night');
assert.equal(away.coutHotel,60,'one hotel night away');
assert.equal(home.net,315.2);
assert.equal(away.net,243.2);
console.log('Hotel between two missions: 10 assertions passed');
