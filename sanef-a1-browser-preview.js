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
 try{
  const {dataset,aliases}=await load();
  return root.SanefA1OfficialSelector.selectionner(dataset,aliases,request,normalCents);
 }catch(e){return normalOnly('dataset_unavailable');}
}
Object.defineProperty(root,'CPSanefA1Preview2026',{value:Object.freeze({preview}),configurable:false,writable:false});
})(typeof window!=='undefined'?window:globalThis);
