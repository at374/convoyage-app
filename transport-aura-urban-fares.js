/* Unit-ticket references from current official network pages.
 * They are informational only: no fare is injected into a journey total until
 * the exact title, validity, transfer and passenger conditions are proven.
 */
(function(root){
'use strict';
const NETWORKS=Object.freeze({
 '5bae8c2806e3e75b699dc606':Object.freeze({network:'Synchro Bus — Grand Chambéry',amountEUR:1.40,validityMinutes:60,product:'1 voyage sur support rechargeable',
  source:'https://synchro.grandchambery.fr/tarifs-et-abonnements-bus/les-tickets/',checkedOn:'2026-11-07'}),
 '5c34c93f8b4c4104b817fb3a':Object.freeze({network:'STAS — Saint-Étienne',amountEUR:1.60,validityMinutes:90,product:'1 voyage par carte bancaire (tram et lignes Métropoles pour la première validation)',
  source:'https://www.reseau-stas.fr/fr/titre-carte-bancaire/1031',checkedOn:'2026-11-07'}),
 '6397c0fb7612df845fc8cd1f':Object.freeze({network:'T2C — Clermont Auvergne Métropole',amountEUR:1.60,validityMinutes:70,product:'1 voyage ; support éventuel en supplément',
  source:'https://www.t2c.fr/page/voyageur-occasionnel',checkedOn:'2026-11-07'})
});
function validLeg(leg){return leg&&typeof leg==='object'&&typeof leg.networkId==='string'&&
 typeof leg.departure==='string'&&Number.isFinite(Date.parse(leg.departure));}
function reference(row){
 const legs=Array.isArray(row?.legs)&&row.legs.length?row.legs:row?[row]:[];
 const portions=legs.filter(validLeg).map(leg=>{
  const tariff=NETWORKS[leg.networkId];if(!tariff)return null;
  return {...tariff,line:typeof leg.line==='string'?leg.line:null,fareVerified:false,
   kind:'official_unit_fare_reference',transferEligibilityVerified:false,travelDateValidityKnown:false};
 });
 return portions.some(Boolean)?{portions,totalEUR:null,fareVerified:false}:null;
}
function describe(result){
 const portions=result?.portions?.filter(Boolean)||[];if(!portions.length)return '';
 return portions.map(p=>'Référence '+p.network+' · '+p.amountEUR.toFixed(2).replace('.',',')+' € · '+p.product+' · validité annoncée '+p.validityMinutes+' min').join(' ; ')+
  ' · page consultée le '+portions.map(p=>p.checkedOn).sort().at(-1)+' ; application à cette ligne, date, support et correspondances à vérifier. Total non calculé.';
}
const api={NETWORKS,reference,describe};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPAuraUrbanFares=api;
})(typeof window!=='undefined'?window:globalThis);
