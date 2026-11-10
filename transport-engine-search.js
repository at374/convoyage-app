/* Concurrent engine orchestration. No GTFS-derived trips, fabricated fares or mission writes. */
(function(root){
'use strict';
const aggregate=typeof module==='object'&&module.exports?
 require('./transport-engine-results.js').aggregateEngineResponses:
 root.CPTransportEngineResults?.aggregateEngineResponses;
async function searchEngines(engines,query,options={}){
 const timeoutMs=Number.isFinite(options.timeoutMs)?Math.max(100,options.timeoutMs):12000;
 const active=(Array.isArray(engines)?engines:[]).filter(e=>e&&typeof e.name==='string'&&typeof e.search==='function');
 const settled=await Promise.all(active.map(async engine=>{
   let timer;
   const controller=typeof AbortController==='function'?new AbortController():null;
   try{
     const journeys=await Promise.race([
       Promise.resolve().then(()=>engine.search(query,{signal:controller?.signal})),
       new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(new Error('timeout'));},timeoutMs);})
     ]);
     if(!Array.isArray(journeys))throw new Error('invalid engine response');
     return {provider:engine.name,journeys};
   }catch(error){return {provider:engine.name,error:error?.message||'engine failed'};}
   finally{clearTimeout(timer);}
 }));
 return aggregate(settled);
}
const api={searchEngines};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.CPTransportEngineSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
