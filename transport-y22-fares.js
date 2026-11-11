/* One manually checked Y22 sector pair; no fare or service confirmation. */
(function(root){
'use strict';
const SOURCE='https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_tarifs_MAJ-septembre_2026_Y22.pdf';
// Matrix sampled from the pinned official PDF; Grand Annecy cells remain excluded.
const AREAS=["Annecy","Épagny Metz-Tessy","Sillingy Les Grands Champs","Sillingy Collège","La Balme-de-Sillingy","Mésigny","Sallenôves","Musièges","Frangy","Chessenaz","Vanzy","Chêne-en-Semine","Éloise","Valserhône"];
const MATRIX=["SSSSS222233333","SSSSS222233333","SSSSS112222223","SSSSS111122223","SSSSS111122223","22111111111222","22111111111222","22211111111111","22211111111111","33222111111111","33222111111111","33222221111111","33222221111111","33333221111111"];
const PINS=new Map([["FR:74010:ZE:57539:HAUTExSAVOIE",[45.9016985,6.1201612,0]],["FR:74272:ZE:57798:HAUTExSAVOIE",[45.950171,6.036903,3]],["FR:74272:ZE:57799:HAUTExSAVOIE",[45.950422,6.03684,3]],["FR:74272:ZE:57800:HAUTExSAVOIE",[45.9446802,6.052833,2]],["FR:74272:ZE:57801:HAUTExSAVOIE",[45.944837,6.0529029,2]],["FR:74026:ZE:57810:HAUTExSAVOIE",[45.960809,6.0402622,4]],["FR:74026:ZE:57811:HAUTExSAVOIE",[45.9602786,6.0406578,4]],["FR:74179:ZE:57812:HAUTExSAVOIE",[45.9858794,6.0167637,5]],["FR:74179:ZE:57813:HAUTExSAVOIE",[45.9855263,6.0181806,5]],["FR:74179:ZE:57814:HAUTExSAVOIE",[45.9914533,6.0046397,5]],["FR:74179:ZE:57815:HAUTExSAVOIE",[45.9912794,6.0049058,5]],["FR:74257:ZE:57816:HAUTExSAVOIE",[46.0005323,5.9985799,6]],["FR:74257:ZE:57817:HAUTExSAVOIE",[46.0005615,5.9986158,6]],["FR:74257:ZE:57818:HAUTExSAVOIE",[46.0052552,5.9987238,6]],["FR:74257:ZE:57819:HAUTExSAVOIE",[46.0054388,5.9986897,6]],["FR:74257:ZE:57820:HAUTExSAVOIE",[46.0101859,5.9923289,6]],["FR:74257:ZE:57821:HAUTExSAVOIE",[46.0102498,5.9924028,6]],["FR:74195:ZE:57822:HAUTExSAVOIE",[46.0059724,5.9574098,7]],["FR:74195:ZE:57823:HAUTExSAVOIE",[46.0058617,5.9573909,7]],["FR:74071:ZE:57824:HAUTExSAVOIE",[46.0269024,5.8919148,9]],["FR:74071:ZE:57825:HAUTExSAVOIE",[46.0275192,5.8906919,9]],["FR:74291:ZE:57826:HAUTExSAVOIE",[46.0427283,5.8859653,10]],["FR:74291:ZE:57827:HAUTExSAVOIE",[46.042377,5.8861855,10]],["FR:74068:ZE:57828:HAUTExSAVOIE",[46.0618991,5.864765,11]],["FR:74068:ZE:57829:HAUTExSAVOIE",[46.0617694,5.8647261,11]],["FR:74109:ZE:57830:HAUTExSAVOIE",[46.0777502,5.8506665,12]],["FR:74109:ZE:57831:HAUTExSAVOIE",[46.077815,5.8508291,12]],["FR:01033:ZE:57832:HAUTExSAVOIE",[46.1059618,5.8215827,13]],["FR:01033:ZE:57833:HAUTExSAVOIE",[46.109695,5.824159,13]],["FR:74257:ZE:58650:HAUTExSAVOIE",[46.0095009,5.9799827,6]],["FR:74257:ZE:58651:HAUTExSAVOIE",[46.0095919,5.9799004,6]],["FR:74026:ZE:58706:HAUTExSAVOIE",[45.9579502,6.0397323,4]],["FR:74026:ZE:58707:HAUTExSAVOIE",[45.9579374,6.0397777,4]],["FR:74131:ZE:58745:HAUTExSAVOIE",[46.019003,5.933457,8]],["FR:74112:ZE:58786:HAUTExSAVOIE",[45.9399247,6.0766601,1]],["FR:74112:ZE:58787:HAUTExSAVOIE",[45.9400105,6.0765882,1]],["FR:74112:ZE:58788:HAUTExSAVOIE",[45.9346182,6.0838154,1]],["FR:74112:ZE:58789:HAUTExSAVOIE",[45.9347383,6.0837556,1]],["FR:74026:ZE:58808:HAUTExSAVOIE",[45.972025,6.032591,4]],["FR:74026:ZE:58809:HAUTExSAVOIE",[45.972035,6.0327436,4]],["FR:01033:ZE:58838:HAUTExSAVOIE",[46.1082726,5.8239945,13]],["FR:74026:ZE:58917:HAUTExSAVOIE",[45.9748719,6.0322504,4]],["FR:74026:ZE:58918:HAUTExSAVOIE",[45.9749494,6.0323686,4]]]);
function sector(stop){
 const p=PINS.get(stop?.id);if(!p||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
 const metres=Math.hypot((stop.lat-p[0])*111195,(stop.lon-p[1])*111195*Math.cos(p[0]*Math.PI/180));
 return metres<=50?p[2]:null;
}
function stopReference({networkId,line,fromStop,toStop,travelDate,profile}={}){
 if(networkId!=='oura-haute-savoie'||line!=='Y22'||profile!=='adult'||typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||travelDate<'2026-11-07'||travelDate>'2026-12-06')return null;
 const a=sector(fromStop),b=sector(toStop);if(!Number.isInteger(a)||!Number.isInteger(b)||a===b)return null;
 const zone=MATRIX[a][b];if(!['1','2','3'].includes(zone))return null;
 return {line,fromSector:AREAS[a],toSector:AREAS[b],amount:({'1':1.7,'2':4,'3':6.6})[zone],currency:'EUR',zone,source:SOURCE,checkedOn:'2026-11-07',
  stopMappingVerified:true,fareVerified:false,serviceConfirmed:false,travelDateValidityKnown:false};
}
const api={stopReference,SOURCE};if(typeof module==='object'&&module.exports)module.exports=api;root.CPY22Fares=api;
})(typeof window!=='undefined'?window:globalThis);
