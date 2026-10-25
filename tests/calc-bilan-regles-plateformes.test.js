// node tests/calc-bilan-regles-plateformes.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const fees={carburant:10,lavage:7,peage:8,exceptionnel:3,train:5,devis_numero:'D-1'};
const expected={Otoqi:[10,0,8,58.8],DriiveMe:[15,0,0,66.8],PopValet:[10,0,8,58.8],Hiflow:[18,0,0,66.8]};
for(const [platform,[remb,transport,peage,net]] of Object.entries(expected)){
 const r=calc.rentabiliteComplete({kind:'acceptee',platform,fee:100,fees},{},{approcheKm:100});
 assert.equal(r.remboursements,remb,platform+' eligible reimbursements');
 assert.equal(r.rembTransport,transport,platform+' unconfirmed transport');
 assert.equal(r.peageCharge,peage,platform+' toll cost');
 assert.equal(r.net,net,platform+' estimated net');
}
console.log('Platform-specific profitability: 16 assertions passed');
