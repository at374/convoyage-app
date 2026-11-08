'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const context={window:{}};
for(const name of ['sanef-a1-regles-officielles-2026.js','sanef-a1-official-selector.js'])vm.runInNewContext(read(name),context,{filename:name});
const dataset=JSON.parse(read('sanef-a1-modulation-2026.json'));
const aliases=JSON.parse(read('sanef-a1-gare-alias-2026.json'));
const select=context.window.SanefA1OfficialSelector.selectionner;
const inverse=Object.fromEntries(Object.entries(aliases.aliases).map(([k,v])=>[v,k]));
const expected={ARSY:29,CHEVRIERES:30,SENLIS:31,CHAMANT:32};
assert.equal(dataset.status,'experimental_not_activated');
assert.equal(dataset.records.length,122);
assert.equal(Object.keys(aliases.aliases).length,33);
let count=3;const seen=new Set();
for(const [destination,n] of Object.entries(expected)){assert.equal(dataset.records.filter(r=>r.destination===destination).length,n);count++;}
for(const r of dataset.records){
 const key=r.origine+'|'+r.destination;
 assert.equal(seen.has(key),false);seen.add(key);count++;
 for(const c of Object.values(r.centimes)){assert.ok(Number.isSafeInteger(c)&&c>=0);count++;}
 const req={origine:inverse[r.origine],destination:inverse[r.destination],classe:1,direction:'VERS_PARIS',passageLocal:'2026-11-08T17:00:00',passageGareConfirme:true,calendrierFeriesVerifie:true};
 assert.ok(req.origine&&req.destination);count++;
 for(const [hour,period,field] of [['15:00:00','vert','classe1_vert'],['17:00:00','rouge','classe1_rouge'],['21:00:00','vert','classe1_vert']]){
  const actual=select(dataset,aliases,{...req,passageLocal:'2026-11-08T'+hour},r.centimes.classe1_normal);
  assert.equal(actual.status,'MODULATION_PREVIEW');count++;
  assert.equal(actual.period,period);count++;
  assert.equal(actual.modulatedPriceCents,r.centimes[field]);count++;
  assert.equal(actual.priceCents,r.centimes.classe1_normal);count++;
  assert.equal(actual.certifiedForBilling,false);count++;
 }
 const got=select(dataset,aliases,req,r.centimes.classe1_normal);
 assert.equal(got.status,'MODULATION_PREVIEW');count++;
 assert.equal(got.modulatedPriceCents,r.centimes.classe1_rouge);count++;
 assert.equal(got.priceCents,r.centimes.classe1_normal);count++;
 assert.equal(got.certifiedForBilling,false);count++;
 const conflict=select(dataset,aliases,req,r.centimes.classe1_normal+1);
 assert.equal(conflict.status,'NORMAL_ONLY');count++;
 assert.equal(conflict.modulatedPriceCents,null);count++;
 const class2=select(dataset,aliases,{...req,classe:2},r.centimes.classe2_normal);
 assert.equal(class2.status,'NORMAL_ONLY');count++;
 assert.equal(class2.priceCents,r.centimes.classe2_normal);count++;
}
console.log('PASS '+count+' SANEF A1 published data assertions');
