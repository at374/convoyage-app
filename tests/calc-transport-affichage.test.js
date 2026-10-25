// node tests/calc-transport-affichage.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const run=(platform,extra={})=>calc.rentabiliteComplete({kind:'disponible',platform,fee:100,fees:{train:5},...extra},{},{approcheKm:100});
for(const platform of ['DriiveMe','Otoqi','PopValet']){
 const r=run(platform,{transport_rembourse_confirme:true,transport_rembourse_montant_confirme:20});
 assert.equal(r.rembTransport,0);
 assert.equal(r.transportDeclare,5);
 assert.equal(r.couverture,0);
 assert.equal(r.transportNonCouvert,12);
}
for(const [extra,cover] of [[{},0],[{transport_rembourse_montant_confirme:3},3],[{transport_rembourse_confirme:true},12]]){
 const r=run('Hiflow',extra);
 assert.equal(r.rembTransport,cover);
 assert.equal(r.transportDeclare,5);
 assert.equal(r.couverture,cover);
 assert.equal(r.transportNonCouvert,12-cover);
}
console.log('Transport reimbursement reporting: 24 assertions passed');
