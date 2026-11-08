/* SANEF A1 2026: optional, preview-only tariff selection.
 * Requires SanefA1ReglesOfficielles2026 and externally validated
 * sanef-a1-modulation-2026.json + sanef-a1-gare-alias-2026.json.
 * NEVER overwrites the normal toll or certifies a modulated price.
 */
(function(root){'use strict';
function selectionner(dataset,aliases,request,normalExistantCentimes){
 const fallback=reason=>Object.freeze({status:'NORMAL_ONLY',reason,priceCents:normalExistantCentimes,modulatedPriceCents:null,certifiedForBilling:false});
 if(!Number.isSafeInteger(normalExistantCentimes)||normalExistantCentimes<0)return fallback('normal_invalid');
 if(!request||!root.SanefA1ReglesOfficielles2026||!dataset||!aliases||!aliases.aliases||!Array.isArray(dataset.records))return fallback('dependencies_missing');
 if(dataset.application!=='2026-02-01'||dataset.status!=='experimental_not_activated')return fallback('dataset_not_validated');
 const regle=root.SanefA1ReglesOfficielles2026.determiner({classe:request.classe,direction:request.direction,passageLocal:request.passageLocal,jourFerie:request.jourFerie,lundiFerie:request.lundiFerie,mardiFerie:request.mardiFerie,calendrierFeriesVerifie:request.calendrierFeriesVerifie});
 if(regle.statut!=='HORAIRE_OFFICIEL')return fallback(regle.motif);
 if(request.passageGareConfirme!==true)return fallback('passage_not_confirmed');
 const origine=aliases.aliases[request.origine],destination=aliases.aliases[request.destination];
 if(typeof origine!=='string'||typeof destination!=='string')return fallback('alias_missing');
 const records=dataset.records.filter(r=>r.origine===origine&&r.destination===destination);
 if(records.length!==1)return fallback('relation_missing_or_duplicate');
 const c=records[0].centimes;
 if(!c||!Number.isSafeInteger(c.classe1_normal)||c.classe1_normal!==normalExistantCentimes)return fallback('normal_price_mismatch');
 const amount=c['classe1_'+regle.couleur];
 if(!Number.isSafeInteger(amount)||amount<0)return fallback('modulated_price_invalid');
 return Object.freeze({status:'MODULATION_PREVIEW',reason:'official_sunday_band',priceCents:normalExistantCentimes,modulatedPriceCents:amount,period:regle.couleur,certifiedForBilling:false,source:dataset.source});
}
Object.defineProperty(root,'SanefA1OfficialSelector',{value:Object.freeze({selectionner}),writable:false,configurable:false});
})(typeof window!=='undefined'?window:globalThis);
