// node tests/calc-remboursement-metadata.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const mk=(fees,extra={})=>({platform:'Hiflow',kind:'disponible',fee:100,fees,...extra});
const withFlag=mk({transport_rembourse_confirme:true});
const noFlag=mk({});
assert.deepEqual(calc.fraisRembourses(withFlag),[]);
assert.equal(calc.rentabilite(withFlag,{}).remboursements,0);
assert.equal(calc.rentabiliteComplete(withFlag,{}, {approcheKm:100}).rembTransport,0);
assert.equal(calc.rentabiliteComplete(withFlag,{}, {approcheKm:100}).net,78.8);
assert.equal(calc.rentabiliteComplete(noFlag,{}, {approcheKm:100}).net,66.8);
const withMoney=mk({transport_rembourse_confirme:true,train:5});
assert.deepEqual(calc.fraisRembourses(withMoney),[['train',5]]);
assert.equal(calc.rentabilite(withMoney,{}).remboursements,5);
assert.equal(calc.rentabiliteComplete(withMoney,{}, {approcheKm:100}).rembTransport,5);
console.log('Reimbursement metadata isolation: 8 assertions passed');
