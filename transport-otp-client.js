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
 const timeout=Number.isFinite(c.timeoutMs)?Math.min(60000,Math.max(1000,c.timeoutMs)):30000;
 const controller=new AbortController();
 let timedOut=false;
 const abort=()=>controller.abort();
 if(c.signal?.aborted)controller.abort();
 else c.signal?.addEventListener?.('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeout);
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
 }catch(e){
  if(timedOut)throw Error('OTP2 : délai dépassé ('+Math.round(timeout/1000)+' s), serveur indisponible ou démarrage à froid');
  if(c.signal?.aborted)throw Error('OTP2 : recherche interrompue (changement de mission ou actualisation)');
  if(controller.signal.aborted)throw Error('OTP2 : requête interrompue');
  throw e;
 }finally{clearTimeout(timer);c.signal?.removeEventListener?.('abort',abort);}
}
// Requête standard de la fiche mission (API GraphQL GTFS d'OTP2, planConnection) :
// construite uniquement depuis les points GPS exacts et la fenêtre horaire de la mission, sans saisie.
// 23/11/2026 (Laurent : bouton « Tous les horaires » absent sur les étapes calculées par OTP2) : gtfsId
// (route/arrêts) et date de service du voyage ajoutés, pour retrouver ensuite la ligne exacte dans nos
// propres fichiers GTFS locaux (même mécanisme que pour les moteurs locaux). Champs standards du schéma
// GraphQL GTFS d'OTP2 (docs.opentripplanner.org) ; aucun changement aux champs déjà utilisés.
const FIELDS='edges{node{start end legs{mode duration distance start{scheduledTime} end{scheduledTime} '+
 'from{name lat lon stop{gtfsId}} to{name lat lon stop{gtfsId}} route{shortName longName agency{name} gtfsId} '+
 'trip{serviceDate} legGeometry{points}}}}';
function buildQuery(task,window,count){
 const ok=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 const norm=p=>p&&typeof p==='object'&&p.lat!=null&&(p.lon??p.lng)!=null?{lat:Number(p.lat),lon:Number(p.lon??p.lng)}:null;
 const f=norm(task?.from),t=norm(task?.to);
 if(!ok(f)||!ok(t)||!window||typeof window.when!=='string')return null;
 const when=new Date(window.when);
 if(!Number.isFinite(when.getTime()))return null;
 const n=Number.isInteger(count)&&count>0&&count<=10?count:6;
 const at=p=>'{location:{coordinate:{latitude:'+Number(p.lat)+',longitude:'+Number(p.lon)+'}}}';
 const key=window.arriveBy===true?'latestArrival':'earliestDeparture';
 return {query:'{planConnection(origin:'+at(f)+',destination:'+at(t)+',dateTime:{'+key+':"'+when.toISOString()+'"},first:'+n+'){'+FIELDS+'}}',variables:{}};
}
const api={search,buildQuery};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPOTPClient=api;
})(typeof window!=='undefined'?window:globalThis);
