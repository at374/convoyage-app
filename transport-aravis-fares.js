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
  ['FR:74003:ZE:57757:HAUTExSAVOIE',[45.8910822,6.2386944,'Alex','Y62']],
  ['FR:74003:ZE:57758:HAUTExSAVOIE',[45.8911653,6.2385836,'Alex','Y62']],
  ['FR:74102:ZE:57727:HAUTExSAVOIE',[45.91015,6.2215891,'Dingy-Saint-Clair','Y63']],
  ['FR:74102:ZE:57728:HAUTExSAVOIE',[45.9102256,6.2216854,'Dingy-Saint-Clair','Y63']],
  ['FR:74027:ZE:57720:HAUTExSAVOIE',[45.9007615,6.276505,'La Balme-de-Thuy','Y63']],
  ['FR:74027:ZE:57721:HAUTExSAVOIE',[45.9007332,6.2765074,'La Balme-de-Thuy','Y63']],
  ['FR:74280:ZE:57724:HAUTExSAVOIE',[45.894817,6.3027046,'Thônes Morette / Thuy']],
  ['FR:74280:ZE:57725:HAUTExSAVOIE',[45.8949443,6.3027811,'Thônes Morette / Thuy']],
  ['FR:74302:ZE:57761:HAUTExSAVOIE',[45.9060553,6.3622384,'Les Villards-sur-Thônes']],
  ['FR:74302:ZE:57762:HAUTExSAVOIE',[45.90609,6.3620814,'Les Villards-sur-Thônes']],
  ['FR:74302:ZE:57763:HAUTExSAVOIE',[45.9086097,6.3661244,'Les Villards-sur-Thônes']],
  ['FR:74302:ZE:57764:HAUTExSAVOIE',[45.9084845,6.3655439,'Les Villards-sur-Thônes']],
  ['FR:74302:ZE:57765:HAUTExSAVOIE',[45.913639,6.3741401,'Les Villards-sur-Thônes']],
  ['FR:74302:ZE:57766:HAUTExSAVOIE',[45.9132832,6.3738411,'Les Villards-sur-Thônes']],
  ['FR:74302:ZE:57767:HAUTExSAVOIE',[45.9186946,6.3836292,'Les Villards-sur-Thônes']],
  ['FR:74302:ZE:57768:HAUTExSAVOIE',[45.918909,6.3841708,'Les Villards-sur-Thônes']],
  ['FR:74280:ZE:57726:HAUTExSAVOIE',[45.8829602,6.3239672,'Thônes']],
  ['FR:74280:ZE:92692:HAUTExSAVOIE',[45.8830315,6.3237866,'Thônes']],
  ['FR:74239:ZE:57771:HAUTExSAVOIE',[45.9224885,6.4099568,'Saint-Jean-de-Sixt']],
  ['FR:74239:ZE:57772:HAUTExSAVOIE',[45.9226142,6.4110797,'Saint-Jean-de-Sixt']],
  ['FR:74239:ZE:92691:HAUTExSAVOIE',[45.9230136,6.4103621,'Saint-Jean-de-Sixt']],
  ['FR:74136:ZE:57773:HAUTExSAVOIE',[45.9416443,6.4287024,'Le Grand-Bornand']],
  ['FR:74080:ZE:57774:HAUTExSAVOIE',[45.9067032,6.4191339,'La Clusaz']]
 ]);
 const sector=(stop,line)=>{
  const p=y62Stops.get(stop?.id);
  if(!p||(p[3]&&p[3]!==line)||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
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
  if(networkId!=='oura-haute-savoie'||!['Y62','Y63'].includes(line)||typeof travelDate!=='string'||travelDate<'2026-11-07')return null;
  // Freshness limit is our conservative review window, not a published tariff expiry.
  // Require another documented check before reusing this undated tariff later.
  const checked=Date.parse(source.checkedOn+'T12:00:00Z'),travel=Date.parse(travelDate+'T12:00:00Z');
  if(!Number.isFinite(checked)||!Number.isFinite(travel)||travel>checked+30*86400000)return null;
  const fromArea=sector(fromStop,line),toArea=sector(toStop,line);
  if(!fromArea||!toArea||fromArea===toArea)return null;
  const value=reference({line,fromArea,toArea,travelDate,profile,age});
  return value?{...value,stopMappingVerified:true,gtfsCheckedOn:'2026-11-07',gtfsSource:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA'}:null;
 }
 return {reference,stopReference};
}
const api={createCalculator};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPAravisFares=api;
})(typeof window!=='undefined'?window:globalThis);
