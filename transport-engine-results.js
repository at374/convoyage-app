/* Engine-only journey results: never synthesize fares or itineraries from static tables. */
(function(root){
'use strict';
function validDate(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}
function normalize(provider,raw,index){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const departure=raw.departure||raw.startTime,arrival=raw.arrival||raw.endTime;
 if(!validDate(departure)||!validDate(arrival)||Date.parse(arrival)<=Date.parse(departure))return null;
 const legs=Array.isArray(raw.legs)?raw.legs:[];
 if(!legs.length)return null;
 const price=raw.priceEUR??raw.verifiedPriceEUR??null;
 const validPrice=typeof price==='number'&&Number.isFinite(price)&&price>=0;
 const source=String(raw.source||provider).trim();
 const engineId=String(raw.engineId||raw.id||index);
 return {
   id:provider+':'+engineId,provider,source,departure,arrival,
   legs:legs.map(leg=>({...leg})),
   priceEUR:validPrice?price:null,
   priceStatus:validPrice?(raw.fareVerified===true?'verified':'indicative'):'unavailable',
   fareVerified:validPrice&&raw.fareVerified===true,
   currency:validPrice?'EUR':null,
   exactOrigin:raw.exactOrigin===true,exactDestination:raw.exactDestination===true,
   accessVerified:raw.accessVerified===true,
   serviceConfirmed:raw.serviceConfirmed===true,
   provenance:[{provider,source,engineId}],
   engineResult:true
 };
}
function fingerprint(j){
 // Do not merge same-time journeys unless every leg identifies the same real service.
 if(!j.legs.every(l=>l&&l.tripId&&l.fromStopId&&l.toStopId))return null;
 return [j.departure,j.arrival,...j.legs.map(l=>[l.provider||'',l.tripId,l.fromStopId,l.toStopId].join('/'))].join('|');
}
function aggregateEngineResponses(responses){
 const journeys=[],statuses=[],keys=new Map();
 for(const item of Array.isArray(responses)?responses:[]){
   if(!item||typeof item.provider!=='string'||!item.provider.trim())continue;
   const provider=item.provider.trim();
   if(item.error||!Array.isArray(item.journeys)){
     statuses.push({provider,status:'unavailable',reason:String(item.error||'invalid response')});continue;
   }
   let accepted=0;
   for(let i=0;i<item.journeys.length;i++){
     const j=normalize(provider,item.journeys[i],i);if(!j)continue;
     accepted++;
     const key=fingerprint(j);
     if(key!==null&&keys.has(key)){
       const old=journeys[keys.get(key)];
       old.provenance.push(...j.provenance);
       // Keep independently quoted prices as separate offers when they differ.
       if(old.priceEUR!==j.priceEUR||old.priceStatus!==j.priceStatus){
         journeys.push(j);
       }else{
         old.serviceConfirmed=old.serviceConfirmed||j.serviceConfirmed;
         old.accessVerified=old.accessVerified||j.accessVerified;
       }
     }else{
       if(key!==null)keys.set(key,journeys.length);
       journeys.push(j);
     }
   }
   statuses.push({provider,status:'responded',returned:item.journeys.length,accepted});
 }
 return {journeys,statuses,source:'live-engine-responses-only'};
}
function sortJourneys(journeys,mode='cheapest'){
 const result=[...(Array.isArray(journeys)?journeys:[])];
 const duration=j=>Date.parse(j.arrival)-Date.parse(j.departure);
 if(mode==='fastest')result.sort((a,b)=>duration(a)-duration(b));
 else if(mode==='compromise')result.sort((a,b)=>(a.priceEUR??Infinity)-(b.priceEUR??Infinity)||duration(a)-duration(b));
 else result.sort((a,b)=>(a.priceEUR??Infinity)-(b.priceEUR??Infinity)||duration(a)-duration(b));
 return result;
}
const api={aggregateEngineResponses,sortJourneys};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.CPTransportEngineResults=api;
})(typeof globalThis!=='undefined'?globalThis:this);
