/* One manually checked Y21 sector pair; no fare or service confirmation. */
(function(root){
'use strict';
const SOURCE='https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_tarifs_MAJ-septembre_2026_Y21.pdf';
const PINS=new Map([
 ['FR:74010:ZE:57539:HAUTExSAVOIE',[45.9016985,6.1201612,'Annecy']],
 ['FR:74269:ZE:57777:HAUTExSAVOIE',[45.9578116,5.8369357,'Seyssel']]
]);
function sector(stop){
 const p=PINS.get(stop?.id);if(!p||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
 const metres=Math.hypot((stop.lat-p[0])*111195,(stop.lon-p[1])*111195*Math.cos(p[0]*Math.PI/180));
 return metres<=50?p[2]:null;
}
function stopReference({networkId,line,fromStop,toStop,travelDate,profile}={}){
 if(networkId!=='oura-haute-savoie'||line!=='Y21'||profile!=='adult'||typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||travelDate<'2026-11-07'||travelDate>'2026-12-06')return null;
 const a=sector(fromStop),b=sector(toStop);if(!((a==='Annecy'&&b==='Seyssel')||(a==='Seyssel'&&b==='Annecy')))return null;
 return {line,fromSector:a,toSector:b,amount:4,currency:'EUR',zone:'2',source:SOURCE,checkedOn:'2026-11-07',
  stopMappingVerified:true,fareVerified:false,serviceConfirmed:false,travelDateValidityKnown:false};
}
const api={stopReference,SOURCE};if(typeof module==='object'&&module.exports)module.exports=api;root.CPY21Fares=api;
})(typeof window!=='undefined'?window:globalThis);
