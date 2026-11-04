/* Read-only provider orchestration. Provider functions must be supplied by a separately
 * authorized integration; this module does not scrape sites or claim live availability. */
(function(root){
'use strict';
const adapters=root.CPTransportAdapters||(typeof module==='object'&&module.exports?require('./transport-adapters.js'):null);
const PROVIDERS=['FlixBus','BlaBlaCar','BlaBlaCar Bus'];
function validQuery(query){
 if(!query||typeof query!=='object'||Array.isArray(query))throw new Error('Invalid long-distance search');
 for(const key of ['from','to'])if(typeof query[key]!=='string'||!query[key].trim()||query[key].length>200)
  throw new Error('Invalid long-distance search location');
 if(typeof query.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(query.date))throw new Error('Invalid long-distance search date');
 const ms=Date.parse(query.date+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==query.date)throw new Error('Invalid long-distance search date');
 return {from:query.from.trim(),to:query.to.trim(),date:query.date};
}
async function searchLongDistance(query,fetchers={}){
 const input=validQuery(query);
 if(!fetchers||typeof fetchers!=='object'||Array.isArray(fetchers))throw new Error('Invalid provider integrations');
 const results=await Promise.all(PROVIDERS.map(async provider=>{
  const fetch=fetchers[provider];
  if(typeof fetch!=='function')return {provider,status:'not-connected',offers:[]};
  try{
   const response=await fetch({...input});
   if(!Array.isArray(response))return {provider,status:'invalid-response',offers:[]};
   const offers=adapters.adaptLongDistance(response,provider).filter(offer=>
    offer.departure.slice(0,10)===input.date ||
    new Date(offer.departure).toISOString().slice(0,10)===input.date);
   return {provider,status:'candidates-unverified',offers};
  }catch(_){return {provider,status:'provider-error',offers:[]};}
 }));
 return {query:input,providers:results,offers:results.flatMap(r=>r.offers),
  serviceConfirmed:false,pricesVerified:false};
}
const api={searchLongDistance,validQuery,PROVIDERS};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportLongDistanceSearch=api;
})(typeof window!=='undefined'?window:globalThis);
