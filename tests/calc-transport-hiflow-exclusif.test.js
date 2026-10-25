// node tests/calc-transport-hiflow-exclusif.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const run=(platform,extra={})=>calc.rentabiliteComplete({kind:'disponible',platform,fee:100,fees:{train:5},...extra},{},{approcheKm:100});
for(const platform of ['DriiveMe','Otoqi','PopValet']){
  const result=run(platform,{transport_rembourse_confirme:true,transport_rembourse_montant_confirme:20});
  assert.equal(result.couverture,0,platform+' cannot reimburse transport');
  assert.equal(result.transportNonCouvert,12,platform+' transport remains payable');
}
const hiflow=run('Hiflow',{transport_rembourse_confirme:true});
assert.equal(hiflow.couverture,12);
assert.equal(hiflow.transportNonCouvert,0);
const partiel=run('Hiflow',{transport_rembourse_montant_confirme:3});
assert.equal(partiel.couverture,3);
assert.equal(partiel.transportNonCouvert,9);
console.log('Exclusive Hiflow transport reimbursement: 10 assertions passed');
