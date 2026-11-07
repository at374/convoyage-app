/* One manually checked Y21 sector pair; no fare or service confirmation. */
(function(root){
'use strict';
const SOURCE='https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_tarifs_MAJ-septembre_2026_Y21.pdf';
// Matrix reviewed from the pinned official PDF; Grand Annecy cells remain excluded.
const AREAS=["Annecy","Épagny Metz-Tessy","Sillingy","Chilly","Menthonnex","Clermont","Desingy","Seyssel"];
const MATRIX=["SSS11122","SSS11122","SSS11112","11111111","11111111","11111111","22111111","22211111"];
const PINS=new Map([["FR:74010:ZE:57539:HAUTExSAVOIE",[45.9016985,6.1201612,0]],["FR:74269:ZE:57777:HAUTExSAVOIE",[45.9578116,5.8369357,7]],["FR:74100:ZE:57778:HAUTExSAVOIE",[45.9927202,5.8530919,6]],["FR:74100:ZE:92378:HAUTExSAVOIE",[45.9928157,5.8531829,6]],["FR:74100:ZE:57780:HAUTExSAVOIE",[45.995458,5.8903384,6]],["FR:74100:ZE:57781:HAUTExSAVOIE",[45.9954623,5.8900328,6]],["FR:74078:ZE:57782:HAUTExSAVOIE",[45.9722894,5.9069194,5]],["FR:74078:ZE:57783:HAUTExSAVOIE",[45.9723274,5.9068724,5]],["FR:74078:ZE:57784:HAUTExSAVOIE",[45.9812555,5.9151227,5]],["FR:74078:ZE:57785:HAUTExSAVOIE",[45.9812393,5.913872,5]],["FR:74075:ZE:57786:HAUTExSAVOIE",[45.9832886,5.9387231,3]],["FR:74075:ZE:57787:HAUTExSAVOIE",[45.9832495,5.9388508,3]],["FR:74178:ZE:57788:HAUTExSAVOIE",[45.9792124,5.9415325,4]],["FR:74178:ZE:57789:HAUTExSAVOIE",[45.9792355,5.9415277,4]],["FR:74075:ZE:57790:HAUTExSAVOIE",[45.9747503,5.9666592,3]],["FR:74075:ZE:57791:HAUTExSAVOIE",[45.9747953,5.9669694,3]],["FR:74075:ZE:57792:HAUTExSAVOIE",[45.9726536,5.9749097,3]],["FR:74075:ZE:57793:HAUTExSAVOIE",[45.9726625,5.9747697,3]],["FR:74272:ZE:57794:HAUTExSAVOIE",[45.9602472,6.0021996,2]],["FR:74272:ZE:57795:HAUTExSAVOIE",[45.9600327,6.0027793,2]],["FR:74272:ZE:57796:HAUTExSAVOIE",[45.9457367,6.0347543,2]],["FR:74272:ZE:57797:HAUTExSAVOIE",[45.9459679,6.0347287,2]],["FR:74272:ZE:57800:HAUTExSAVOIE",[45.9446802,6.052833,2]],["FR:74272:ZE:57801:HAUTExSAVOIE",[45.944837,6.0529029,2]],["FR:74010:ZE:57802:HAUTExSAVOIE",[45.915991,6.090482,0]],["FR:74010:ZE:57803:HAUTExSAVOIE",[45.916201,6.090056,0]],["FR:74010:ZE:57804:HAUTExSAVOIE",[45.9076114,6.1065165,0]],["FR:74010:ZE:57805:HAUTExSAVOIE",[45.9076715,6.106537,0]],["FR:74272:ZE:57928:HAUTExSAVOIE",[45.9432289,6.06098,2]],["FR:74272:ZE:57929:HAUTExSAVOIE",[45.943266,6.0608786,2]],["FR:74272:ZE:58427:HAUTExSAVOIE",[45.9504727,6.0151951,2]],["FR:74272:ZE:58428:HAUTExSAVOIE",[45.9504742,6.0153565,2]],["FR:74272:ZE:58429:HAUTExSAVOIE",[45.945844,6.0249105,2]],["FR:74272:ZE:58430:HAUTExSAVOIE",[45.9459073,6.0248987,2]],["FR:74112:ZE:58786:HAUTExSAVOIE",[45.9399247,6.0766601,1]],["FR:74112:ZE:58787:HAUTExSAVOIE",[45.9400105,6.0765882,1]],["FR:74112:ZE:58788:HAUTExSAVOIE",[45.9346182,6.0838154,1]],["FR:74112:ZE:58789:HAUTExSAVOIE",[45.9347383,6.0837556,1]]]);
function sector(stop){
 const p=PINS.get(stop?.id);if(!p||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
 const metres=Math.hypot((stop.lat-p[0])*111195,(stop.lon-p[1])*111195*Math.cos(p[0]*Math.PI/180));
 return metres<=50?p[2]:null;
}
function stopReference({networkId,line,fromStop,toStop,travelDate,profile}={}){
 if(networkId!=='oura-haute-savoie'||line!=='Y21'||profile!=='adult'||typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||travelDate<'2026-11-07'||travelDate>'2026-12-06')return null;
 const a=sector(fromStop),b=sector(toStop);if(!Number.isInteger(a)||!Number.isInteger(b)||a===b)return null;
 const zone=MATRIX[a][b];if(!['1','2'].includes(zone))return null;
 return {line,fromSector:AREAS[a],toSector:AREAS[b],amount:zone==='1'?1.7:4,currency:'EUR',zone,source:SOURCE,checkedOn:'2026-11-07',
  stopMappingVerified:true,fareVerified:false,serviceConfirmed:false,travelDateValidityKnown:false};
}
const api={stopReference,SOURCE};if(typeof module==='object'&&module.exports)module.exports=api;root.CPY21Fares=api;
})(typeof window!=='undefined'?window:globalThis);
