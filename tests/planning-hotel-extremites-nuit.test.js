// node tests/planning-hotel-extremites-nuit.test.js
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root={CPCalc:require('../calc.js'),
 CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const mission=(id,day,lat)=>({id,kind:'disponible',platform:'Hiflow',fee:200,fees:{},
 origin:{lat},destination:{lat},pickup_start:'2026-10-'+day+'T10:00:00+01:00',
 pickup_end:'2026-10-'+day+'T10:30:00+01:00',delivery_end:'2026-10-'+day+'T12:00:00+01:00'});
for(const [soir,matin,hotel] of [[0,0,0],[5,5,60],[5,0,60],[0,5,60]]){
 const res=root.CPPlanning.planifier([mission('A','27',soir),mission('B','28',matin)],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:2,nuits_max:1,
 budget_hotel:60,domicile:{lat:0,nom:'domicile'},seuil_dom:15});
 const p=res.plans.find(p=>p.etapes.length===2);
 assert.ok(p,'two-mission plan exists');
 assert.equal(p.nuits,1,'one night');
 assert.equal(p.coutHotel,hotel,'hotel must reflect both endpoints');
}
console.log('Overnight endpoint checks: 12 assertions passed');
