// node tests/planning-retour-domicile-temps-disponible.test.js
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root={CPCalc:require('../calc.js'),
 CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const mission=(id,day,start,end,lat)=>({id,kind:'disponible',platform:'Hiflow',fee:200,fees:{},
 origin:{lat},destination:{lat},pickup_start:'2026-10-'+day+'T'+start+':00+01:00',
 pickup_end:'2026-10-'+day+'T'+start+':30+01:00',
 delivery_end:'2026-10-'+day+'T'+end+':00+01:00'});
for(const [label,soir,matin,lat,hotel] of [
 ['long interval','12','10',5,0],['short interval','23','01',5,60],['home','12','10',0,0]]){
 const r=root.CPPlanning.planifier([
 mission('A','27','10',soir,lat),mission('B','28',matin,'12',lat)],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:2,nuits_max:1,
 budget_hotel:60,domicile:{lat:0,nom:'domicile'},seuil_dom:100});
 const p=r.plans.find(x=>x.etapes.length===2);
 assert.ok(p,label+': both missions planned');
 assert.equal(p.nuits,1,label+': one night');
 assert.equal(p.coutHotel,hotel,label+': hotel reflects travel-time feasibility');
}
console.log('Home overnight time feasibility: 9 assertions passed');
