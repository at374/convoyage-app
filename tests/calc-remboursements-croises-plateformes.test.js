// node tests/calc-remboursements-croises-plateformes.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const fees={devis_numero:'D-42',train:4,bus:3,lavage:8,peage:9,exceptionnel:2,carburant:11};
const scenarios=[
 ['Hiflow devis','Hiflow',{},19,7],
 ['Hiflow accord carburant','Hiflow',{carburant_supplementaire_accord:true},30,7],
 ['Otoqi lavage demandé','Otoqi',{lavage_demande:true},19,0],
 ['DriiveMe','DriiveMe',{},17,0],
 ['Pop Valet','PopValet',{},11,0]
];
for(const [name,platform,extra,other,transport] of scenarios){
 const r=calc.rentabiliteComplete({kind:'acceptee',platform,fee:100,fees,...extra},{},{approcheKm:100});
 assert.equal(r.remboursements,other,name+' eligible nontransport expenses');
 assert.equal(r.rembTransport,transport,name+' eligible transport');
 assert.equal(r.transportDeclare,7,name+' declared transport');
}
console.log('Cross-platform multi-expense reimbursement: 15 assertions passed');
