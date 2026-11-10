/* Exact tariff-area references only. GTFS stop mapping is a separate proof. */
(function(root){
'use strict';
function createCalculator(data){
 if(data?.schemaVersion!==1||!Array.isArray(data.areas)||data.areas.length!==15||
  new Set(data.areas).size!==15)throw new Error('Invalid Aravis tariff source');
 // Own a snapshot: a later caller mutation cannot alter the source silently.
 const source=JSON.parse(JSON.stringify(data));
 const y62Stops=new Map([
  ['FR:74010:ZE:57539:HAUTExSAVOIE',[45.9016985,6.1201612,'Annecy']],
  ['FR:74080:ZE:57774:HAUTExSAVOIE',[45.9067032,6.4191339,'La Clusaz']]
 ]);
 const sector=stop=>{
  const p=y62Stops.get(stop?.id);
  if(!p||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
  const metres=Math.hypot((stop.lat-p[0])*111195,(stop.lon-p[1])*111195*Math.cos(p[0]*Math.PI/180));
  return metres<=50?p[2]:null;
 };
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
 function stopReference({networkId,line,fromStop,toStop,travelDate,profile='adult',age}={}){
  if(networkId!=='oura-haute-savoie'||line!=='Y62'||typeof travelDate!=='string'||travelDate<'2026-11-07')return null;
  const fromArea=sector(fromStop),toArea=sector(toStop);
  if(!fromArea||!toArea||fromArea===toArea)return null;
  const value=reference({line,fromArea,toArea,travelDate,profile,age});
  return value?{...value,stopMappingVerified:true,gtfsCheckedOn:'2026-11-07',gtfsSource:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA'}:null;
 }
 function coverage(){
  const lines={};
  for(const line of ['Y62','Y63']){
   const cells=source.lines[line].matrix.flat();
   const counts={priced:0,sibra:0,unspecified:0};
   for(const cell of cells){if(cell==='SIBRA')counts.sibra++;
    else if(cell==='UNSPECIFIED')counts.unspecified++;
    else counts.priced++;}
   const byOriginArea=source.areas.map((area,index)=>{
    const row=source.lines[line].matrix[index];
    return {area,priced:row.filter(cell=>['1','2','3','4'].includes(cell)).length,
     sibra:row.filter(cell=>cell==='SIBRA').length,
     unspecified:row.filter(cell=>cell==='UNSPECIFIED').length};
   });
   lines[line]={...counts,total:cells.length,byOriginArea,gtfsStopIdsAudited:line==='Y62'?y62Stops.size:0};
  }
  return {areas:source.areas.length,lines,kind:'tariff_matrix_coverage_not_gtfs_network_coverage'};
 }
 return {reference,stopReference,coverage};
}
const api={createCalculator};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPAravisFares=api;
})(typeof window!=='undefined'?window:globalThis);
