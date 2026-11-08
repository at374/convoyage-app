'use strict';
/* End-to-end read-only smoke test with the actual published dataset and rules. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const dataset=JSON.parse(read('sanef-a1-modulation-2026.json'));
const aliases=JSON.parse(read('sanef-a1-gare-alias-2026.json'));
const context={window:{},fetch:async name=>({ok:true,json:async()=>name.includes('modulation')?dataset:aliases})};
for(const file of ['sanef-a1-regles-officielles-2026.js','sanef-a1-official-selector.js','sanef-a1-browser-preview.js'])
 vm.runInNewContext(read(file),context,{filename:file});
const first=dataset.records[0];
const inverse=Object.fromEntries(Object.entries(aliases.aliases).map(([k,v])=>[v,k]));
assert.ok(inverse[first.origine]&&inverse[first.destination]);
const input={previewExplicitlyRequested:true,passageGareConfirme:true,origine:inverse[first.origine],destination:inverse[first.destination],classe:1,direction:'VERS_PARIS'};
const preview=context.window.CPSanefA1Preview2026.preview;
(async()=>{
 let count=0;
 for(const [date,field,period] of [
  ['2026-11-08T15:00:00','classe1_vert','vert'],
  ['2026-11-08T17:00:00','classe1_rouge','rouge'],
  ['2026-11-08T21:00:00','classe1_vert','vert']
 ]){
  const result=await preview({...input,passageLocal:date},first.centimes.classe1_normal);
  assert.equal(result.status,'MODULATION_PREVIEW');count++;
  assert.equal(result.period,period);count++;
  assert.equal(result.modulatedPriceCents,first.centimes[field]);count++;
  assert.equal(result.priceCents,first.centimes.classe1_normal);count++;
  assert.equal(result.certifiedForBilling,false);count++;
 }
 for(const [date,expectedStatus,expectedPeriod] of [
  ['2026-11-08T14:29:59','NORMAL_ONLY',null],
  ['2026-11-08T14:30:00','MODULATION_PREVIEW','vert'],
  ['2026-11-08T16:29:59','MODULATION_PREVIEW','vert'],
  ['2026-11-08T16:30:00','MODULATION_PREVIEW','rouge'],
  ['2026-11-08T20:29:59','MODULATION_PREVIEW','rouge'],
  ['2026-11-08T20:30:00','MODULATION_PREVIEW','vert'],
  ['2026-11-08T23:29:59','MODULATION_PREVIEW','vert'],
  ['2026-11-08T23:30:00','NORMAL_ONLY',null]
 ]){
  const result=await preview({...input,passageLocal:date},first.centimes.classe1_normal);
  assert.equal(result.status,expectedStatus,'boundary '+date);count++;
  assert.equal(result.priceCents,first.centimes.classe1_normal);count++;
  assert.equal(result.certifiedForBilling,false);count++;
  if(expectedPeriod){assert.equal(result.period,expectedPeriod);count++;}
  else {assert.equal(result.modulatedPriceCents,null);count++;}
 }
 // Exercise all 122 published relations through the actual browser bridge,
 // including the normal-price mismatch guard (not only the first sample).
 for(const relation of dataset.records){
  const stations={...input,origine:inverse[relation.origine],destination:inverse[relation.destination]};
  assert.ok(stations.origine&&stations.destination);count++;
  for(const [date,field,period] of [
   ['2026-11-08T15:00:00','classe1_vert','vert'],
   ['2026-11-08T17:00:00','classe1_rouge','rouge']
  ]){
   const result=await preview({...stations,passageLocal:date},relation.centimes.classe1_normal);
   assert.equal(result.status,'MODULATION_PREVIEW',relation.origine+' -> '+relation.destination);count++;
   assert.equal(result.period,period);count++;
   assert.equal(result.modulatedPriceCents,relation.centimes[field]);count++;
   assert.equal(result.priceCents,relation.centimes.classe1_normal);count++;
   assert.equal(result.certifiedForBilling,false);count++;
  }
  const mismatch=await preview({...stations,passageLocal:'2026-11-08T17:00:00'},relation.centimes.classe1_normal+1);
  assert.equal(mismatch.status,'NORMAL_ONLY');count++;
  assert.equal(mismatch.reason,'normal_price_mismatch');count++;
  assert.equal(mismatch.modulatedPriceCents,null);count++;
 }
 for(const [change,reason] of [
  [{jourFerie:true},'calendrier_ferie_a_verifier'],
  [{passageGareConfirme:false},'passage_not_confirmed'],
  [{direction:'INCONNU'},'classe_ou_sens_non_eligible']
 ]){
  const result=await preview({...input,passageLocal:'2026-11-08T17:00:00',...change},first.centimes.classe1_normal);
  assert.equal(result.status,'NORMAL_ONLY');count++;
  assert.equal(result.reason,reason);count++;
  assert.equal(result.modulatedPriceCents,null);count++;
 }
 console.log('PASS '+count+' SANEF A1 real-data end-to-end assertions (preview only)');
})().catch(error=>{console.error(error);process.exitCode=1;});
