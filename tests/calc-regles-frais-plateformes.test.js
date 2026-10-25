// node tests/calc-regles-frais-plateformes.test.js
'use strict';
const assert=require('node:assert/strict');
const calc=require('../calc.js');
const fees={carburant:10,lavage:7,peage:8,exceptionnel:3,train:5,devis_numero:'D-1'};
const total=(platform,extra={})=>calc.fraisRembourses({kind:'acceptee',platform,fees,...extra}).reduce((s,[,v])=>s+v,0);
assert.equal(total('Otoqi'),10);
assert.equal(total('Otoqi',{lavage_demande:true}),17);
assert.equal(total('DriiveMe'),15);
assert.equal(total('PopValet'),10);
assert.equal(total('Hiflow'),18);
assert.equal(total('Hiflow',{carburant_supplementaire_accord:true}),28);
assert.equal(calc.fraisRembourses({kind:'acceptee',platform:'Hiflow',fees:{carburant:10,lavage:7,peage:8,exceptionnel:3}}).length,0);
assert.equal(total('Otoqi',{carburant_supplementaire_accord:true}),10);
assert.equal(total('PopValet',{lavage_demande:true}),10);
console.log('Platform-specific expenses: 9 assertions passed');
