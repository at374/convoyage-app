/* Convoyage Ultra — client OTP2 expérimental, strictement opt-in.
 * Aucune URL, clé, requête ni dépense par défaut.
 * Le serveur OTP2 doit être fourni par l'opérateur ; pas de service commercial implicite.
 */
(function(root){
'use strict';
const adapter=typeof module==='object'&&module.exports?require('./transport-otp-adapter.js'):root.CPOTPAdapter;
async function search(config){
 const c=config||{};
 if(c.enabled!==true)throw Error('OTP2 désactivé : activation explicite requise');
 if(typeof c.endpoint!=='string'||!/^https:\/\//i.test(c.endpoint))throw Error('Endpoint HTTPS OTP2 requis');
 const url=new URL(c.endpoint);
 if(url.username||url.password||url.hash||url.port&&url.port!=='443')throw Error('Endpoint OTP2 non autorisé');
 if(!c.query||typeof c.query!=='string'||!c.query.trim())throw Error('Requête GraphQL OTP2 requise');
 if(typeof c.fetch!=='function')throw Error('Fonction fetch explicitement fournie requise');
 const timeout=Number.isFinite(c.timeoutMs)?Math.min(15000,Math.max(1000,c.timeoutMs)):8000;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await c.fetch(url.toString(),{
   method:'POST',headers:{'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify({query:c.query,variables:c.variables||{}}),
   signal:controller.signal,redirect:'error'
  });
  if(!response||!response.ok)throw Error('OTP2 HTTP '+(response?.status??'inconnu'));
  const json=await response.json();
  if(json?.errors?.length)throw Error('OTP2 GraphQL : réponse en erreur');
  const journeys=adapter.parse(json);
  return {journeys,source:'OpenTripPlanner (GTFS)',realtime:false,pricesVerified:false};
 }finally{clearTimeout(timer);}
}
const api={search};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPOTPClient=api;
})(typeof window!=='undefined'?window:globalThis);
