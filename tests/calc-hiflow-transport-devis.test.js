// node tests/calc-hiflow-transport-devis.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const run=(platform,fees,extra={})=>calc.rentabiliteComplete({kind:'acceptee',platform,fee:100,fees,...extra},{},{approcheKm:100});
const cases=[
 ['devis 5',run('Hiflow',{devis_numero:'D1',train:5}),5,71.8],
 ['devis plafonné',run('Hiflow',{devis_numero:'D1',train:20}),12,78.8],
 ['sans devis',run('Hiflow',{train:5}),0,66.8],
 ['autre plateforme',run('Otoqi',{devis_numero:'D1',train:20}),0,66.8],
 ['partiel explicite',run('Hiflow',{devis_numero:'D1',train:20},{transport_rembourse_montant_confirme:3}),3,69.8]
];
for(const [name,r,cover,net] of cases){
 assert.equal(r.couverture,cover,name+' coverage');
 assert.equal(r.rembTransport,cover,name+' displayed reimbursement');
 assert.equal(r.net,net,name+' net');
}
console.log('Hiflow transport on documented quote: 15 assertions passed');
