/* Coverage decisions for officially inventoried lines. Never infer absence from an empty search. */
(function(root){
'use strict';
function assessLineCoverage(line,checks,requiredProviders){
 const providers=[...new Set((requiredProviders||[]).filter(p=>typeof p==='string'&&p.trim()))];
 const observations=(Array.isArray(checks)?checks:[]).filter(c=>c&&c.lineId===line.id);
 const found=observations.filter(c=>c.status==='found');
 const partial=observations.some(c=>c.status==='partial');
 const evidence=providers.map(provider=>{
   const checksForProvider=observations.filter(c=>c.provider===provider);
   const successful=checksForProvider.filter(c=>['found','not_found','partial'].includes(c.status));
   const dates=new Set(successful.filter(c=>c.direction&&c.date&&c.time).map(c=>c.date+'|'+c.direction+'|'+c.time));
   const directions=new Set(successful.map(c=>c.direction));
   return {provider,successful:successful.length,dates:dates.size,directions:[...directions],hasError:checksForProvider.some(c=>c.status==='error')};
 });
 let status='non_conclusive';
 if(found.length)status=partial?'partial':'engine_found';
 else if(partial)status='partial';
 // Absence requires explicit human verification against official line timetable and every applicable engine.
 // Empty engine results, even on multiple days, are insufficient by themselves.
 else if(line.officialSourceVerified===true&&line.absenceReviewApproved===true&&providers.length&&evidence.every(e=>e.successful>=4&&e.dates>=4&&e.directions.includes('outbound')&&e.directions.includes('inbound')&&!e.hasError)&&observations.every(c=>c.status!=='found'&&c.status!=='partial')){
   status='confirmed_absent';
 }
 return {lineId:line.id,status,manualEligible:status==='confirmed_absent',providers:evidence,observations:observations.length};
}
const api={assessLineCoverage};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.CPTransportLineCoverage=api;
})(typeof globalThis!=='undefined'?globalThis:this);
