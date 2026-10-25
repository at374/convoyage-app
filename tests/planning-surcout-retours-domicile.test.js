// node tests/planning-surcout-retours-domicile.test.js
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
for(const [name,lat,seuil,hotel,extra] of [
 ['home detour',5,100,0,12],['hotel',5,15,60,0],['local',0,100,0,0]]){
 const r=root.CPPlanning.planifier([mission('A','27',lat),mission('B','28',lat)],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:2,nuits_max:1,
 budget_hotel:60,domicile:{lat:0,nom:'domicile'},seuil_dom:seuil});
 const p=r.plans.find(x=>x.etapes.length===2);
 assert.ok(p,name+': two missions planned');
 assert.equal(p.coutHotel,hotel,name+': hotel');
 assert.equal(p.surcoutRetoursDomicile,extra,name+': home detour surcharge');
 assert.ok(Math.abs(p.net-(p.netMissions-p.retour.cout-hotel-extra))<0.011,
   name+': net reconciles all displayed costs');
}
const ui=fs.readFileSync(require.resolve('../app.js'),'utf8');
assert.ok(ui.includes('détours domicile'), 'home detour is visible in financial summary');
console.log('Home detour accounting: 13 assertions passed');
