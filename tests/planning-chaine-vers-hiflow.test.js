// node tests/planning-chaine-vers-hiflow.test.js
'use strict';
const assert=require('node:assert/strict');
global.CPGeo={coordonnees:(m,w)=>m[w],routeKm:(a,b)=>Math.abs(a.lat-b.lat)*10};
global.CPRetours={domicile:()=>({lat:0,nom:'domicile'}),debut:m=>Date.parse(m.pickup_start),fin:m=>({t:Date.parse(m.delivery_end),estimee:false}),cle:m=>m.id};
require('../calc.js');
const {planifier}=require('../planning.js');
const mk=(id,platform,start,end,from,to,extra={})=>({kind:'acceptee',id,platform,fee:100,fees:{},pickup_start:start,delivery_end:end,origin:{lat:from},destination:{lat:to},...extra});
const opts={debut:Date.parse('2026-11-02T06:00:00Z'),jours:2,nuits_max:3,inclureAcceptees:true};
for(const platform of ['DriiveMe','Otoqi','PopValet']){
 const first=mk('a',platform,'2026-11-02T09:00:00Z','2026-11-02T10:00:00Z',10,20,{transport_rembourse_confirme:true,transport_rembourse_montant_confirme:100});
 const second=mk('b','Hiflow','2026-11-02T17:00:00Z','2026-11-02T18:00:00Z',30,40,{transport_rembourse_montant_confirme:5});
 const plans=planifier([first,second],{marge_minutes:60},opts).plans;
 assert.equal(plans.length,1);
 const p=plans[0];
 assert.equal(p.etapes[0].rentabilite.couverture,0);
 assert.equal(p.etapes[0].rentabilite.transportNonCouvert,12);
 assert.equal(p.etapes[1].rentabilite.couverture,5);
 assert.equal(p.etapes[1].rentabilite.transportNonCouvert,7);
 assert.equal(p.retour.cout,48);
 assert.equal(p.net,90.6);
}
console.log('Chains ending with Hiflow: 21 assertions passed');
