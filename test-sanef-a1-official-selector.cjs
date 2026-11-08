'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{}};
for(const name of ['sanef-a1-regles-officielles-2026.js','sanef-a1-official-selector.js']){
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context,{filename:name});
}
const aliases={aliases:{'DEPART':'ORIGINE','ARRIVEE':'DESTINATION'}};
const dataset={application:'2026-02-01',status:'experimental_not_activated',source:'SANEF grille modulee 2026',records:[{origine:'ORIGINE',destination:'DESTINATION',centimes:{classe1_normal:1000,classe1_vert:750,classe1_rouge:1250,classe2_normal:1500}}]};
const select=context.window.SanefA1OfficialSelector.selectionner;
const base={origine:'DEPART',destination:'ARRIVEE',classe:1,direction:'VERS_PARIS',passageLocal:'2026-11-08T17:00:00',passageGareConfirme:true,calendrierFeriesVerifie:true};
let checks=0;
function test(overrides,expected,price=1000,data=dataset){const r=select(data,aliases,{...base,...overrides},price);assert.equal(r.status,expected);assert.equal(r.priceCents,price);assert.equal(r.certifiedForBilling,false);checks+=3;return r;}
assert.equal(test({},'MODULATION_PREVIEW').modulatedPriceCents,1250);checks++;
assert.equal(test({passageLocal:'2026-11-08T15:00:00'},'MODULATION_PREVIEW').modulatedPriceCents,750);checks++;
for(const [input,reason] of [[{passageGareConfirme:false},'passage_not_confirmed'],[{direction:'AUTRE'},'classe_ou_sens_non_eligible'],[{classe:2},'classe_ou_sens_non_eligible'],[{passageLocal:'2026-11-09T17:00:00'},'jour_special_non_exclu'],[{passageLocal:'2027-02-07T17:00:00'},'hors_grille_2026']]){assert.equal(test(input,'NORMAL_ONLY').reason,reason);checks++;}
assert.equal(test({},'NORMAL_ONLY',999).reason,'normal_price_mismatch');checks++;
assert.equal(test({},'NORMAL_ONLY',1000,{...dataset,status:'active'}).reason,'dataset_not_validated');checks++;
assert.equal(test({origine:'UNKNOWN'},'NORMAL_ONLY').reason,'alias_missing');checks++;
assert.equal(test({destination:'DEPART'},'NORMAL_ONLY').reason,'same_station');checks++;
const aliasSame={aliases:{...aliases.aliases,ALTERNATE:'ORIGINE'}};
const sameCanonical=select(dataset,aliasSame,{...base,destination:'ALTERNATE'},1000);
assert.equal(sameCanonical.status,'NORMAL_ONLY');checks++;
assert.equal(sameCanonical.reason,'same_station');checks++;
assert.equal(test({},'NORMAL_ONLY',1000,{...dataset,records:[...dataset.records,...dataset.records]}).reason,'relation_missing_or_duplicate');checks++;
console.log('PASS '+checks+' selector safety assertions');
