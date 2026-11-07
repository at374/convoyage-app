/* Reviewed Y02 sector pairs only. Reference is never a complete fare. */
(function(root){
'use strict';
const SOURCE='https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_tarifs_MAJ-septembre_2026_Y02.pdf';
const PINS=new Map([
 ['FR:74012:ZE:57669:HAUTExSAVOIE',[46.1996235,6.2381237,'Annemasse']],
 ['FR:74273:ZE:57640:HAUTExSAVOIE',[46.053724,6.7737146,'Sixt-Fer-à-Cheval']],
 ['FR:74273:ZE:57641:HAUTExSAVOIE',[46.053759,6.773773,'Sixt-Fer-à-Cheval']],
 ['FR:74258:ZE:57644:HAUTExSAVOIE',[46.0829415,6.7231899,'Samoëns']]
]);
function sector(stop){const p=PINS.get(stop?.id);if(!p||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
 const m=Math.hypot((stop.lat-p[0])*111195,(stop.lon-p[1])*111195*Math.cos(p[0]*Math.PI/180));return m<=50?p[2]:null;}
function stopReference({networkId,line,fromStop,toStop,travelDate,profile}={}){
 if(networkId!=='oura-haute-savoie'||line!=='Y02'||profile!=='adult'||typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||travelDate<'2026-11-07'||travelDate>'2026-12-06')return null;
 const a=sector(fromStop),b=sector(toStop),outer=new Set(['Sixt-Fer-à-Cheval','Samoëns']);
 if(!((a==='Annemasse'&&outer.has(b))||(b==='Annemasse'&&outer.has(a))))return null;
 return {line,fromSector:a,toSector:b,amount:4,currency:'EUR',zone:'2',source:SOURCE,checkedOn:'2026-11-07',
  stopMappingVerified:true,fareVerified:false,serviceConfirmed:false,travelDateValidityKnown:false};
}
const api={stopReference,SOURCE};if(typeof module==='object'&&module.exports)module.exports=api;root.CPY02Fares=api;
})(typeof window!=='undefined'?window:globalThis);
