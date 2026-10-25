// node tests/planning-hiflow-devis-transport.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const planning=require('../planning.js');
// Injecter les dépendances avant le chargement de planning.js dans un contexte isolé
// si le moteur utilise les dépendances globales (CPGeo/CPRetours).
const root={CPGeo:{coordonnees:(m,w)=>m[w],routeKm:(x,y)=>Math.abs(x.lat-y.lat)*10},
 CPRetours:{domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),
 fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id}};
const fs=require('node:fs'),vm=require('node:vm');
root.CPCalc=calc;root.globalThis=root;
vm.runInNewContext(fs.readFileSync(require.resolve('../planning.js'),'utf8'),root);
const base={id:'M1',kind:'disponible',fee:100,origin:{lat:10},destination:{lat:10},
 pickup_start:'2026-10-27T14:00:00+01:00',pickup_end:'2026-10-27T14:30:00+01:00',
 delivery_end:'2026-10-27T16:00:00+01:00'};
const run=(platform,fees)=>root.CPPlanning.planifier([{...base,platform,fees}],{},
 {debut:Date.parse('2026-10-27T07:00:00+01:00'),jours:1,nuits_max:0,domicile:{lat:0,nom:'domicile'}});
const cases=[['Hiflow devis','Hiflow',{devis_numero:'D1',train:5},59.8,5],
 ['Hiflow sans devis','Hiflow',{train:5},54.8,0],
 ['Otoqi','Otoqi',{devis_numero:'D1',train:5},54.8,0]];
for(const [name,platform,fees,net,remb] of cases){
 const result=run(platform,fees);
 assert.equal(result.plans.length,1,name+' planning result');
 assert.equal(result.plans[0].net,net,name+' net');
 assert.equal(result.plans[0].etapes[0].rentabilite.rembTransport,remb,name+' reimbursement');
}
console.log('Planning + Hiflow quote transport: 9 assertions passed');
