// node tests/calc-hiflow-devis-multifrais.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const run=(fees,extra={})=>calc.rentabiliteComplete({platform:'Hiflow',kind:'acceptee',fee:100,fees,...extra},{},{approcheKm:100});
const scenarios=[
 ['devis sans accord carburant',{devis_numero:'D1',train:6,lavage:7,peage:8,exceptionnel:3,carburant:10},{},18,6,6,72.8],
 ['devis avec accord carburant',{devis_numero:'D1',train:6,lavage:7,peage:8,exceptionnel:3,carburant:10},{carburant_supplementaire_accord:true},28,6,6,72.8],
 ['accord carburant sans devis',{train:6,lavage:7,peage:8,exceptionnel:3,carburant:10},{carburant_supplementaire_accord:true},10,0,12,66.8]
];
for(const [name,fees,extra,remb,transport,nonCouvert,net] of scenarios){
 const r=run(fees,extra);
 assert.equal(r.remboursements,remb,name+' nontransport reimbursements');
 assert.equal(r.rembTransport,transport,name+' transport reimbursement');
 assert.equal(r.transportNonCouvert,nonCouvert,name+' remaining transport cost');
 assert.equal(r.net,net,name+' net');
}
console.log('Hiflow multi-expense quotes: 12 assertions passed');
