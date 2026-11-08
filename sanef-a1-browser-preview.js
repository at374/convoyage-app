/* Optional SANEF A1 2026 preview data bridge.
 * No automatic requests, no pricing overrides, no DOM changes.
 * Explicit calls only. Normal toll remains the caller's source of truth.
 */
(function(root){'use strict';
let pending=null;
function load(){
 if(!pending)pending=Promise.all(['sanef-a1-modulation-2026.json','sanef-a1-gare-alias-2026.json'].map(async file=>{
  const response=await fetch(file,{cache:'no-store'});
  if(!response.ok)throw new Error('SANEF data unavailable: '+file);
  return response.json();
 })).then(([dataset,aliases])=>{
  if(dataset.status!=='experimental_not_activated'||dataset.records.length!==122||Object.keys(aliases.aliases||{}).length!==33)throw new Error('SANEF dataset incomplete');
  return {dataset,aliases};
 }).catch(err=>{pending=null;throw err;});
 return pending;
}
async function preview(request,normalCents){
 const normalOnly=(reason)=>({status:'NORMAL_ONLY',reason,priceCents:normalCents,modulatedPriceCents:null,certifiedForBilling:false});
 if(!Number.isSafeInteger(normalCents)||normalCents<0)return normalOnly('normal_invalid');
 if(!root.SanefA1OfficialSelector)return normalOnly('selector_not_loaded');
 if(!request||request.previewExplicitlyRequested!==true)return normalOnly('preview_not_requested');
 if(request.passageGareConfirme!==true)return normalOnly('passage_not_confirmed');
 if(request.direction!=='VERS_PARIS'||request.classe!==1)return normalOnly('classe_ou_sens_non_eligible');
 if(typeof request.origine!=='string'||!request.origine||typeof request.destination!=='string'||!request.destination||typeof request.passageLocal!=='string'||!request.passageLocal)return normalOnly('passage_details_missing');
 if(request.origine===request.destination)return normalOnly('same_station');
 // Independent guard: holiday flags must never be bypassed by a rule adapter.
 if(request.jourFerie===true||request.lundiFerie===true||request.mardiFerie===true)return normalOnly('calendrier_ferie_a_verifier');
 if(!root.SanefA1ReglesOfficielles2026||typeof root.SanefA1ReglesOfficielles2026.determiner!=='function')return normalOnly('rules_not_loaded');
 const rule=root.SanefA1ReglesOfficielles2026.determiner({classe:request.classe,direction:request.direction,passageLocal:request.passageLocal,jourFerie:request.jourFerie,lundiFerie:request.lundiFerie,mardiFerie:request.mardiFerie,calendrierFeriesVerifie:request.calendrierFeriesVerifie});
 if(rule.statut!=='HORAIRE_OFFICIEL')return normalOnly(rule.motif||'modulation_not_applicable');
 try{
  const {dataset,aliases}=await load();
  const result=root.SanefA1OfficialSelector.selectionner(dataset,aliases,request,normalCents);
  // Do not propagate a malformed or billing-certified result from any adapter.
  if(!result||result.certifiedForBilling!==false||result.priceCents!==normalCents)return normalOnly('selector_contract_invalid');
  if(result.status!=='MODULATION_PREVIEW'&&result.status!=='NORMAL_ONLY')return normalOnly('selector_contract_invalid');
  if(result.status==='NORMAL_ONLY'&&result.modulatedPriceCents!==null)return normalOnly('selector_contract_invalid');
  if(result.status==='MODULATION_PREVIEW'&&(!Number.isSafeInteger(result.modulatedPriceCents)||result.modulatedPriceCents<0))return normalOnly('selector_contract_invalid');
  if(result.status==='MODULATION_PREVIEW'&&(result.period!==rule.couleur||!['vert','rouge'].includes(result.period)))return normalOnly('selector_period_mismatch');
  return result;
 }catch(e){return normalOnly('dataset_unavailable');}
}
Object.defineProperty(root,'CPSanefA1Preview2026',{value:Object.freeze({preview}),configurable:false,writable:false});
})(typeof window!=='undefined'?window:globalThis);
