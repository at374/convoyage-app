/* Published unit-fare references; not a verified full journey price. */
(function(root){
'use strict';
const HS_LINES=new Set(['Y13','Y03','Y04','Y81','Y82','Y83','Y84','Y85','Y86','Y91','Y92','Y93','Y94']);
const SOURCES={
 ain:'https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/02/cars_region_ain_tarifs_mars-2026.pdf',
 hs:'https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_tarifs_MAJ-septembre_2026_Y13-03-04-81-82-83-84-85-86-91-92-93-94.pdf'
};
function portion(leg){
 if(!leg||typeof leg.tripId!=='string'||!leg.tripId.trim()||typeof leg.line!=='string'||
  typeof leg.departure!=='string'||!/[Zz]|[+-]\d{2}:\d{2}$/.test(leg.departure))return null;
 if(!/^20\d{2}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.test(leg.departure))return null;
 const localDay=leg.departure.slice(0,10),day=Date.parse(localDay+'T12:00:00Z');
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==localDay)return null;
 const time=Date.parse(leg.departure);
 if(!Number.isFinite(time))return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));
 if(parts.year+'-'+parts.month+'-'+parts.day<'2026-03-01')return null;
 const family=leg.networkId==='reseau-interurbain-cars-region-ain-01'&&/^A\d{2}$/.test(leg.line)?'ain':
  leg.networkId==='oura-haute-savoie'&&HS_LINES.has(leg.line)?'hs':null;
 if(!family)return null;
 return {line:leg.line,amountEUR:family==='ain'?2.3:1.7,product:'1 voyage adulte, hors abonnement',
  source:SOURCES[family],effectiveFrom:'2026-03-01',checkedOn:'2026-11-06',fareVerified:false};
}
function reference(row){
 const legs=Array.isArray(row?.legs)&&row.legs.length?row.legs:row?[row]:[];
 const portions=legs.map(portion);
 return portions.some(Boolean)?{portions,totalEUR:null,fareVerified:false}:null;
}
function describe(result){
 if(!result?.portions?.some(Boolean))return '';
 return 'Barème officiel du 01/03/2026 : '+result.portions.filter(Boolean).map(p=>p.line+' · '+p.amountEUR.toFixed(2).replace('.',',')+' € pour 1 voyage adulte').join(' ; ')+
  ' · Consulté le 06/11/2026. Validité à confirmer pour le trajet. Abonnements et correspondances à vérifier ; total non calculé.';
}
const api={reference,describe};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPCarsRegionFares=api;
})(typeof window!=='undefined'?window:globalThis);
