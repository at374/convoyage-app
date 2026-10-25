// node tests/calc-hiflow-carburant-accord.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const run=(fees,extra={})=>calc.rentabiliteComplete({platform:'Hiflow',kind:'acceptee',fee:100,fees,...extra},{},{approcheKm:100});
const cases=[
 ['carburant sans accord',{devis_numero:'D1',carburant:25},{},0],
 ['carburant accordé',{devis_numero:'D1',carburant:25},{carburant_supplementaire_accord:true},25],
 ['carburant accordé hors devis',{carburant:25},{carburant_supplementaire_accord:true},25],
 ['lavage hors devis',{lavage:10},{},0],
 ['lavage sur devis',{devis_numero:'D1',lavage:10},{},10],
 ['péage sur devis',{devis_numero:'D1',peage:8},{},8],
 ['exceptionnel sur devis',{devis_numero:'D1',exceptionnel:6},{},6]
];
for(const [name,fees,extra,expected] of cases){
 const r=run(fees,extra);
 assert.equal(r.remboursements,expected,name+' eligible reimbursement');
 assert.equal(r.net,66.8,name+' advance and refund must cancel in net');
}
console.log('Hiflow quote and extra fuel agreement: 14 assertions passed');
