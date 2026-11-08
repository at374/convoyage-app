'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'sanef-a1-browser-preview.js'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'sanef-a1-modulation-2026.json'),'utf8'));
const aliases=JSON.parse(fs.readFileSync(path.join(__dirname,'sanef-a1-gare-alias-2026.json'),'utf8'));
let calls=0,override=null;
const window={SanefA1ReglesOfficielles2026:{determiner:req=>req.passageLocal==='2026-11-08T17:00:00'?{statut:'HORAIRE_OFFICIEL',couleur:'rouge'}:{statut:'NORMAL',motif:'hors_plage_modulee'}},SanefA1OfficialSelector:{selectionner:(d,a,req,normal)=>override||({status:'MODULATION_PREVIEW',priceCents:normal,modulatedPriceCents:1250,period:'rouge',certifiedForBilling:false})}};
const fetch=async name=>{calls++;return {ok:true,json:async()=>name.includes('modulation')?data:aliases};};
vm.runInNewContext(script,{window,fetch},{filename:'sanef-a1-browser-preview.js'});
(async()=>{
 const preview=window.CPSanefA1Preview2026.preview;let count=0;
 const normal=await preview({},1000);
 assert.equal(normal.status,'NORMAL_ONLY');assert.equal(calls,0);count+=2;
 const valid={previewExplicitlyRequested:true,passageGareConfirme:true,calendrierFeriesVerifie:true,direction:'VERS_PARIS',classe:1,origine:'DEPART',destination:'ARRIVEE',passageLocal:'2026-11-08T17:00:00'};
 const r=await preview(valid,1000);
 assert.equal(r.status,'MODULATION_PREVIEW');assert.equal(r.priceCents,1000);assert.equal(calls,2);count+=3;
 const again=await preview(valid,1000);
 assert.equal(again.status,'MODULATION_PREVIEW');assert.equal(calls,2);count+=2;
 const invalid=await preview(valid,-1);
 assert.equal(invalid.status,'NORMAL_ONLY');assert.equal(calls,2);count+=2;
 for(const [request,reason] of [
  [{...valid,calendrierFeriesVerifie:undefined},'calendrier_non_verifie'],
  [{...valid,calendrierFeriesVerifie:null},'calendrier_non_verifie'],
  [{...valid,calendrierFeriesVerifie:false},'calendrier_non_verifie'],
  [{...valid,calendrierFeriesVerifie:'true'},'calendrier_non_verifie'],
  [{...valid,passageGareConfirme:false},'passage_not_confirmed'],
  [{...valid,direction:'INCONNU'},'classe_ou_sens_non_eligible'],
  [{...valid,classe:2},'classe_ou_sens_non_eligible'],
  [{...valid,origine:''},'passage_details_missing'],
  [{...valid,destination:'DEPART'},'same_station'],
  [{...valid,passageLocal:''},'passage_details_missing']
 ]){
  const fallback=await preview(request,1000);
  assert.equal(fallback.status,'NORMAL_ONLY');count++;
  assert.equal(fallback.reason,reason);count++;
  assert.equal(calls,2,'unconfirmed preview must not fetch');count++;
 }
  for(const flag of ['jourFerie','lundiFerie','mardiFerie']){
  const rejected=await preview({...valid,[flag]:true},1000);
  assert.equal(rejected.status,'NORMAL_ONLY');count++;
  assert.equal(rejected.reason,'calendrier_ferie_a_verifier');count++;
  assert.equal(calls,2,'holiday exception must not fetch');count++;
 }
 const outside=await preview({...valid,passageLocal:'2026-11-08T12:00:00'},1000);
 assert.equal(outside.status,'NORMAL_ONLY');count++;
 assert.equal(outside.reason,'hors_plage_modulee');count++;
 assert.equal(calls,2,'non-modulated hour must not fetch');count++;
 override={status:'MODULATION_PREVIEW',priceCents:1000,modulatedPriceCents:1250,period:'vert',certifiedForBilling:false};
 const wrongPeriod=await preview(valid,1000);
 assert.equal(wrongPeriod.status,'NORMAL_ONLY');count++;
 assert.equal(wrongPeriod.reason,'selector_period_mismatch');count++;
 override=null;
 for(const malformed of [
  {status:'MODULATION_PREVIEW',priceCents:1000,modulatedPriceCents:1250,certifiedForBilling:true},
  {status:'MODULATION_PREVIEW',priceCents:999,modulatedPriceCents:1250,certifiedForBilling:false},
  {status:'MODULATION_PREVIEW',priceCents:1000,modulatedPriceCents:-1,certifiedForBilling:false},
  {status:'UNKNOWN',priceCents:1000,modulatedPriceCents:null,certifiedForBilling:false},
  {status:'NORMAL_ONLY',priceCents:1000,modulatedPriceCents:1250,certifiedForBilling:false}
 ]){
  override=malformed;
  const rejected=await preview(valid,1000);
  assert.equal(rejected.status,'NORMAL_ONLY');count++;
  assert.equal(rejected.reason,'selector_contract_invalid');count++;
  assert.equal(rejected.priceCents,1000);count++;
  assert.equal(rejected.certifiedForBilling,false);count++;
 }
 override=null;
  console.log('PASS '+count+' SANEF A1 browser bridge assertions');
})().catch(e=>{console.error(e);process.exitCode=1;});
