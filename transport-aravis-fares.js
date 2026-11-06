/* Exact tariff-area references only. GTFS stop mapping is a separate proof. */
(function(root){
'use strict';
function createCalculator(data){
 if(data?.schemaVersion!==1||!Array.isArray(data.areas)||data.areas.length!==15||
  new Set(data.areas).size!==15)throw new Error('Invalid Aravis tariff source');
 // Own a snapshot: a later caller mutation cannot alter the source silently.
 const source=JSON.parse(JSON.stringify(data));
 for(const line of ['Y62','Y63']){
  const item=source.lines?.[line];
  if(!item||!/^https:\/\/storage\.googleapis\.com\//.test(item.source)||
   !/^[a-f0-9]{64}$/.test(item.sha256)||item.matrix?.length!==15||
   item.matrix.some(row=>!Array.isArray(row)||row.length!==15||row.some(z=>!['1','2','3','4','SIBRA','UNSPECIFIED'].includes(z))))
   throw new Error('Invalid Aravis tariff matrix');
 }
 function reference({line,fromArea,toArea,profile='adult',age,travelDate}={}){
  if(!['Y62','Y63'].includes(line)||!['adult','declic'].includes(profile))return null;
  const from=source.areas.indexOf(fromArea),to=source.areas.indexOf(toArea);
  if(from<0||to<0)return null;
  // Never infer an age reduction, a future validity interval or a free fare.
  if(profile==='declic'&&(!Number.isInteger(age)||age<6||age>=26))return null;
  if(travelDate!==undefined){
   if(typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)||
    !Number.isFinite(Date.parse(travelDate))||new Date(travelDate).toISOString().slice(0,10)!==travelDate||travelDate<source.effectiveFrom)return null;
  }
  const zone=source.lines[line].matrix[from][to];
  if(zone==='SIBRA'||zone==='UNSPECIFIED')return null;
  const amount=(profile==='adult'?source.adultSingleEUR:source.declicSingleEUR)?.[zone];
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0)return null;
  return {line,fromArea,toArea,zone,amount,currency:'EUR',profile,
   product:'1 voyage',source:source.lines[line].source,sourceSHA256:source.lines[line].sha256,
   effectiveFrom:source.effectiveFrom,checkedOn:source.checkedOn,
   eligibilityProofRequired:profile==='declic',kind:'official_tariff_reference',
   fareVerified:false,travelDateValidityKnown:false,stopMappingVerified:false,serviceConfirmed:false};
 }
 return {reference};
}
const api={createCalculator};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPAravisFares=api;
})(typeof window!=='undefined'?window:globalThis);
