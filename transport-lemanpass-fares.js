/* Read-only tariff reference from the official public calculator.
 * No timetable, sales availability, future validity or zone coverage inferred.
 */
(function(root){
'use strict';
const ENDPOINT='https://www.lemanpass.com/wp-admin/admin-ajax.php';
const SOURCE='https://www.lemanpass.com/tarifs/';
function query(input){
 const location=value=>typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=120&&!/[\x00-\x1f\x7f<>]/.test(value);
 if(!location(input?.departure)||!location(input?.arrival)||input.departure===input.arrival||
  !['1','2'].includes(input.class??'2'))throw new Error('Invalid Léman Pass reference query');
 return {departure:input.departure,arrival:input.arrival,class:input.class??'2'};
}
function requestURL(input){
 const q=query(input),url=new URL(ENDPOINT);
 url.search=new URLSearchParams({action:'leman_get_price',departure:q.departure,arrival:q.arrival,product:'4',category:'1'});
 return url.href;
}
function amount(value){
 if(typeof value!=='string'||!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))return null;
 const cents=Math.round(Number(value)*100);
 return Number.isSafeInteger(cents)?cents/100:null;
}
function parse(payload,input,{receivedAt=new Date().toISOString()}={}){
 const q=query(input);
 if(!Number.isFinite(Date.parse(receivedAt)))throw new Error('Invalid receipt date');
 if(!payload||!Array.isArray(payload.errors)||payload.errors.length||!Array.isArray(payload.rows)||payload.rows.length>500)
  throw new Error('Unrecognised Léman Pass calculator response');
 const offers=[];
 for(const row of payload.rows){
  // The calculator returns zone alternatives, indirect paths and even other
  // endpoints. A lower-priced alternative must not become this direct fare.
  if(!row||row.combination!=='P'||row.departure_label!==q.departure||row.arrival_label!==q.arrival||
   row.via||row.zone_departure||row.zone_via||row.zone_arrival||row.bus_line||
   row.product!=='Billet Léman Pass'||row.category!=='Adulte'||row.transport?.type!=='train')continue;
  const label=typeof row.class==='string'?row.class.replace(/<\/?sup>/g,'').trim():'';
  const match=/^(1(?:re|ère|ere)?|2e?) classe$/.exec(label);
  if(!match||match[1][0]!==q.class)continue;
  const eur=amount(row.price_eur),chf=amount(row.price_chf);
  if(eur===null&&chf===null)continue;
  offers.push({departure:q.departure,arrival:q.arrival,class:q.class,
   product:row.product,category:row.category,prices:{EUR:eur,CHF:chf},
   source:SOURCE,receivedAt,kind:'official_calculator_reference',
   fareVerified:false,travelDateValidityKnown:false,serviceConfirmed:false});
 }
 // Duplicate conflicting rows are ambiguous; never choose the cheaper one.
 const unique=[...new Map(offers.map(o=>[JSON.stringify(o.prices),o])).values()];
 return {query:q,offers:unique.length===1?unique:[],ambiguous:unique.length>1,source:SOURCE};
}
async function fetchReference(input,{fetcher=root.fetch,signal}={}){
 if(typeof fetcher!=='function')throw new TypeError('fetch required');
 const response=await fetcher(requestURL(input),{credentials:'omit',cache:'no-store',signal});
 if(!response?.ok)throw new Error('Léman Pass calculator unavailable');
 // This website endpoint sends JSON with text/html; JSON parsing still must succeed.
 const raw=await response.text();
 if(raw.length>1024*1024)throw new Error('Léman Pass response too large');
 return parse(JSON.parse(raw),input);
}
const api={requestURL,parse,fetchReference,SOURCE};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPLemanPassFares=api;
})(typeof window!=='undefined'?window:globalThis);
