/* Read-only provider orchestration. Provider functions must be supplied by a separately
 * authorized integration; this module does not scrape sites or claim live availability. */
(function(root){
'use strict';
const adapters=root.CPTransportAdapters||(typeof module==='object'&&module.exports?require('./transport-adapters.js'):null);
const PROVIDERS=['FlixBus','BlaBlaCar','BlaBlaCar Bus'];
const ranking=root.CPTransportRanking||(typeof module==='object'&&module.exports?require('./transport-ranking.js'):null);
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
   // Compare the provider's explicit local departure date, never its UTC date:
   // an overnight journey can cross midnight without changing service day.
   const normalizePlace=value=>typeof value==='string'?value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR'):'';
   const onRequestedDay=response.filter(item=>item&&typeof item==='object'&&
    typeof item.departure==='string'&&item.departure.slice(0,10)===input.date&&
    normalizePlace(item.from)===normalizePlace(input.from)&&
    normalizePlace(item.to)===normalizePlace(input.to));
   // Bound large provider responses, collapse duplicate services, and keep deterministic order.
   const adapted=adapters.adaptLongDistance(onRequestedDay,provider);
   const unique=new Map();
   for(const offer of adapted){
    const key=JSON.stringify([offer.provider,offer.departure,offer.arrival,
     offer.legs[0]?.from,offer.legs[0]?.to,offer.legs[0]?.line,
     offer.legs[0]?.serviceTripId,offer.legs[0]?.routeId,
     offer.legs[0]?.fromStopCode,offer.legs[0]?.toStopCode,
     offer.legs[0]?.fromPoint,offer.legs[0]?.toPoint]);
    if(!unique.has(key))unique.set(key,offer);
   }
   const offers=[...unique.values()].sort((a,b)=>
    Date.parse(a.departure)-Date.parse(b.departure)||a.id.localeCompare(b.id)).slice(0,100);
   return {provider,status:'candidates-unverified',offers,
    truncated:unique.size>offers.length};
  }catch(_){return {provider,status:'provider-error',offers:[]};}
 }));
 return {query:input,providers:results,offers:results.flatMap(r=>r.offers),
  serviceConfirmed:false,pricesVerified:false};
}
// Combine pre-existing SNCF/TER candidates with long-distance candidates.
// Rankings remain explicitly provisional until door-to-door evidence is available.
function compareWithRegional(regionalJourneys,longDistanceResult,options={}){
 const regional=Array.isArray(regionalJourneys)?regionalJourneys:[];
 const longDistance=Array.isArray(longDistanceResult?.offers)?longDistanceResult.offers:[];
 // Mission windows apply to all providers before ranking. Otherwise a cheap
 // overnight bus outside the pickup/return window can be recommended.
 const timestamp=value=>{
  if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value))return null;
  const offset=value.match(/([+-])(\d{2}):(\d{2})$/);
  if(offset&&Number(offset[2])===14&&Number(offset[3])!==0)return null;
  const day=Date.parse(value.slice(0,10)+'T12:00:00Z');
  if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==value.slice(0,10))return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
 };
 const earliest=timestamp(options?.earliestDeparture);
 const latest=timestamp(options?.latestArrival);
 // Invalid explicit mission windows must fail closed, never widen the search.
 const invalidWindow=['earliestDeparture','latestArrival','deadline'].some(key=>
  options?.[key]!=null&&timestamp(options[key])===null);
 if(invalidWindow||earliest!==null&&latest!==null&&earliest>latest)
  return {candidates:[],choices:[],providerStatuses:longDistanceResult?.providers||[],allSourcesConnected:false};
 // Assemble only same-stop regional-to-long-distance transfers. No walking
 // route, service confirmation or price is inferred from provider candidates.
 const connections=[];
 if(typeof ranking.connectJourneys==='function'){
  const regionalPool=regional.slice(0,100),longDistancePool=longDistance.slice(0,100);
  // Both orders matter: a regional feeder may precede a coach, or a
  // regional service may complete the journey after a long-distance arrival.
  // Stop at 100 combined candidates across both orders.
  outer: for(const [firstPool,secondPool] of [
   [regionalPool,longDistancePool],[longDistancePool,regionalPool]
  ])for(const first of firstPool)for(const second of secondPool){
   if(connections.length>=100)break outer;
   const connected=ranking.connectJourneys(first,second,options);
   if(connected)connections.push(connected);
  }
 }
 const candidates=[...regional,...longDistance,...connections].filter(journey=>{
  if(!journey||typeof journey!=='object')return false;
  const start=timestamp(journey.departure),end=timestamp(journey.arrival);
  if(start===null||end===null||end<=start)return false;
  return (earliest===null||start>=earliest)&&(latest===null||end<=latest);
 });
 // For an outbound pickup, latestArrival is the mission's pickup time.
 // Apply the safety margin before ranking, even when caller omits deadline.
 const isReturn=options?.direction==='return';
 const pickupDeadline=isReturn?null:timestamp(options?.deadline)??latest;
 const requestedMargin=Number.isFinite(options?.marginMinutes)?Math.max(0,options.marginMinutes):15;
 const minimumMargin=journey=>options?.exactGPSReliable===true&&journey.exactDestination===true&&journey.accessVerified===true?5:15;
 const marginMinutes=isReturn?0:requestedMargin;
 const safeCandidates=pickupDeadline===null?candidates:candidates.filter(journey=>
  Date.parse(journey.arrival)+Math.max(minimumMargin(journey),requestedMargin)*60000<=pickupDeadline);
 // A return journey has no pickup deadline. Keep its arrival-window filter,
 // but never apply an outbound pickup margin to the homeward journey.
 const rankingOptions=isReturn?{...options,deadline:undefined,marginMinutes:0}:{
  ...options,marginMinutes,deadline:pickupDeadline===null?options?.deadline:new Date(pickupDeadline).toISOString()
 };
 const choices=ranking.rank(safeCandidates,rankingOptions);
 return {candidates:safeCandidates,choices,providerStatuses:longDistanceResult?.providers||[],
  allSourcesConnected:PROVIDERS.every(provider=>
   longDistanceResult?.providers?.some(p=>p.provider===provider&&p.status==='candidates-unverified'))};
}
const api={searchLongDistance,compareWithRegional,validQuery,PROVIDERS};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportLongDistanceSearch=api;
})(typeof window!=='undefined'?window:globalThis);
