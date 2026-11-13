/* Convoyage Ultra — tarifs officiels publiés DANS les flux GTFS (Fares V1 : fare_attributes.txt / fare_rules.txt).
 * Prix fourni par l'autorité organisatrice elle-même, jamais estimé.
 * Règles prudentes : contains_id non géré (=> pas de prix) ; plusieurs prix différents possibles => pas de prix ;
 * devise EUR ou CHF uniquement ; une règle sans champ s'applique à tout le réseau.
 */
(function(root){
'use strict';
function rows(files,name){
 const parse=root.CPGTFSIndex?.csvRows;
 return typeof parse==='function'&&typeof files?.[name]==='string'?[...parse(files[name])]:[];
}
function prepare(files){
 const attrs=rows(files,'fare_attributes.txt'),rules=rows(files,'fare_rules.txt');
 const fares=new Map();
 for(const a of attrs){
  const price=Number(a.price),currency=String(a.currency_type||'').toUpperCase();
  if(!a.fare_id||!Number.isFinite(price)||price<0||!/^(EUR|CHF)$/.test(currency))continue;
  const cents=Math.round(price*100);if(Math.abs(price*100-cents)>1e-6)continue;
  const duration=a.transfer_duration===undefined||a.transfer_duration===''?null:Number(a.transfer_duration);
  const transfers=a.transfers===undefined||a.transfers===''?null:Number(a.transfers); // vide = illimité
  fares.set(a.fare_id,{fareId:a.fare_id,amount:cents/100,currency,
   transferMinutes:Number.isFinite(duration)&&duration>0?Math.floor(duration/60):null,
   transfers:Number.isInteger(transfers)?transfers:null,agencyId:a.agency_id||null});
 }
 return {fares,rules:rules.filter(r=>r.fare_id&&fares.has(r.fare_id)),hasRulesFile:typeof files?.['fare_rules.txt']==='string'};
}
// Prix d'une portion (montée tripId/from → descente to) ; null si non déterminable sans ambiguïté.
function legFare(prepared,index,leg){
 if(!prepared||!prepared.fares.size||!leg)return null;
 const trip=index?.tripById?.get(leg.tripId);if(!trip)return null;
 const routeId=trip.route_id,origin=index.stopById?.get(leg.from)?.zone_id||'',destination=index.stopById?.get(leg.to)?.zone_id||'';
 let candidates;
 if(!prepared.hasRulesFile||!prepared.rules.length){
  candidates=prepared.fares.size===1?[...prepared.fares.values()]:[];
 }else{
  if(prepared.rules.some(r=>r.contains_id))return null;
  const match=r=>(!r.route_id||r.route_id===routeId)&&(!r.origin_id||(origin&&r.origin_id===origin))&&
   (!r.destination_id||(destination&&r.destination_id===destination));
  candidates=[...new Set(prepared.rules.filter(match).map(r=>r.fare_id))].map(id=>prepared.fares.get(id));
 }
 const distinct=new Set(candidates.map(f=>f.amount+' '+f.currency));
 if(!candidates.length||distinct.size!==1)return null;
 const f=candidates[0];
 return {amount:f.amount,currency:f.currency,fareId:f.fareId,transferMinutes:f.transferMinutes,transfers:f.transfers,
  routeId,originZone:origin||null,destinationZone:destination||null};
}
const api={prepare,legFare};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSFares=api;
})(typeof self!=='undefined'?self:typeof window!=='undefined'?window:globalThis);
