// node tests/calc-transport-hiflow-limites.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const mission=(platform,extra={})=>({platform,kind:'disponible',fee:100,fees:{},...extra});
const result=(platform,extra)=>calc.rentabiliteComplete(mission(platform,extra),{}, {approcheKm:100});
for(const platform of ['DriiveMe','Otoqi','PopValet']){
  for(const amount of [-5,0,5,12,500]){
    const r=result(platform,{transport_rembourse_montant_confirme:amount,transport_rembourse_confirme:true});
    assert.equal(r.couverture,0,platform+' cannot reimburse transport');
    assert.equal(r.transportNonCouvert,12,platform+' must bear transport cost');
  }
}
for(const [amount,expected] of [[-5,0],[0,0],[5,5],[12,12],[500,12]]){
  const r=result('Hiflow',{transport_rembourse_montant_confirme:amount});
  assert.equal(r.couverture,expected,'Hiflow confirmed amount '+amount);
  assert.equal(r.transportNonCouvert,12-expected);
}
assert.equal(result('Hiflow',{}).couverture,0);
assert.equal(result('Hiflow',{transport_rembourse_confirme:true}).couverture,12);
console.log('Hiflow-only transport reimbursement boundaries: 42 assertions passed');
