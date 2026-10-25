// node tests/calc-remboursements-eligibles.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const expected={Hiflow:[18,12,0],DriiveMe:[18,0,0],Otoqi:[10,0,8],PopValet:[10,0,8]};
for(const [platform,[remb,transport,peage]] of Object.entries(expected)){
 const r=calc.rentabiliteComplete({kind:'disponible',platform,fee:100,fees:{train:5,carburant:10,peage:8},transport_rembourse_confirme:true},{},{approcheKm:100});
 assert.equal(r.remboursements,remb,platform+' other eligible reimbursements');
 assert.equal(r.rembTransport,transport,platform+' transport coverage');
 assert.equal(r.peageCharge,peage,platform+' toll borne by driver');
 assert.equal(r.transportDeclare,5,platform+' declared transport');
}
console.log('Eligible reimbursements by platform: 16 assertions passed');
