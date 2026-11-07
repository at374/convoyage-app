/* One manually checked Y22 sector pair; no fare or service confirmation. */
(function(root){
'use strict';
const SOURCE='https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_tarifs_MAJ-septembre_2026_Y22.pdf';
const PINS=new Map([
 ['FR:74010:ZE:57539:HAUTExSAVOIE',[45.9016985,6.1201612,'Annecy']],
 ['FR:01033:ZE:57833:HAUTExSAVOIE',[46.109695,5.824159,'Valserhône']]
]);
function sector(stop){
 const p=PINS.get(stop?.id);if(!p||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
 const metres=Math.hypot((stop.lat-p[0])*111195,(stop.lon-p[1])*111195*Math.cos(p[0]*Math.PI/180));
 return metres<=50?p[2]:null;
}
function stopReference({networkId,line,fromStop,toStop,travelDate,profile}={}){
 if(networkId!=='oura-haute-savoie'||line!=='Y22'||profile!=='adult'||typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||travelDate<'2026-11-07'||travelDate>'2026-12-06')return null;
 const a=sector(fromStop),b=sector(toStop);if(!((a==='Annecy'&&b==='Valserhône')||(a==='Valserhône'&&b==='Annecy')))return null;
 return {line,fromSector:a,toSector:b,amount:6.6,currency:'EUR',zone:'3',source:SOURCE,checkedOn:'2026-11-07',
  stopMappingVerified:true,fareVerified:false,serviceConfirmed:false,travelDateValidityKnown:false};
}
const api={stopReference,SOURCE};if(typeof module==='object'&&module.exports)module.exports=api;root.CPY22Fares=api;
})(typeof window!=='undefined'?window:globalThis);
