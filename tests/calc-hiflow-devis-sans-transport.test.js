// node tests/calc-hiflow-devis-sans-transport.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const run=(fees,extra={})=>calc.rentabiliteComplete({platform:'Hiflow',kind:'acceptee',fee:100,fees,...extra},{},{approcheKm:100});
const cases=[
 ['devis sans transport',{devis_numero:'D1',lavage:7},{transport_rembourse_confirme:true},0,12],
 ['devis avec transport',{devis_numero:'D1',train:5},{transport_rembourse_confirme:true},5,7],
 ['montant partiel explicite',{devis_numero:'D1',lavage:7},{transport_rembourse_montant_confirme:3},3,9],
 ['sans devis non confirmé',{train:5},{},0,12]
];
for(const [name,fees,extra,cover,uncovered] of cases){
 const r=run(fees,extra);
 assert.equal(r.couverture,cover,name+' coverage');
 assert.equal(r.rembTransport,cover,name+' reimbursed transport');
 assert.equal(r.transportNonCouvert,uncovered,name+' noncovered transport');
}
console.log('Hiflow quote missing transport: 12 assertions passed');
