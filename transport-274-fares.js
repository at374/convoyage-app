/* Published 274 fare reference. Mapping a real stop to a fare sector is separate. */
(function(root){
'use strict';
const SOURCE='https://jacquet-autocars.com/wp-content/uploads/2026/01/Grille-tarifaire-TRANSFRONTALIERS-2025-2026.pdf';
const FROM=new Set(['Sallanches']),TO='Genève';
const AMOUNTS=Object.freeze({parcours:11.40,parcours_zone10:14.60});
// Exact IDs and coordinates from the official Haute-Savoie GTFS checked on
// 2026-11-07; IDs alone are not enough to identify a stop in another feed.
const STOPS=new Map([
 ['FR:74256:ZE:58792:HAUTExSAVOIE',[45.9618912,6.6302667,'Sallanches']],
 ['FR:74256:ZE:58793:HAUTExSAVOIE',[45.9618002,6.6301578,'Sallanches']],
 ['FR:6623:ZE:57862:HAUTExSAVOIE',[46.230964,6.1096781,'Genève']],
 ['FR:6621:ZE:58825:HAUTExSAVOIE',[46.2071155,6.1473359,'Genève']],
 ['FR:6621:ZE:58826:HAUTExSAVOIE',[46.2075182,6.1466875,'Genève']]
]);
function stopSector(stop){
 const pin=STOPS.get(stop?.id);
 if(!pin||typeof stop.lat!=='number'||typeof stop.lon!=='number'||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
 const metres=Math.hypot((stop.lat-pin[0])*111195,(stop.lon-pin[1])*111195*Math.cos(pin[0]*Math.PI/180));
 return metres<=50?pin[2]:null;
}
function reference({line,fromSector,toSector,travelDate,product,profile}={}){
 if(line!=='274'||profile!=='adult'||!Object.hasOwn(AMOUNTS,product))return null;
 if(!((FROM.has(fromSector)&&toSector===TO)||(fromSector===TO&&FROM.has(toSector))))return null;
 if(typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||travelDate<'2026-11-07'||travelDate>'2026-12-12')return null;
 return {line,fromSector,toSector,travelDate,product,profile,zone:'5',amount:AMOUNTS[product],currency:'EUR',
  source:SOURCE,sourceCheckedOn:'2026-11-07',publishedThrough:'2026-12-12',kind:'official_tariff_reference',
  fareVerified:false,stopMappingVerified:false,serviceConfirmed:false};
}
function stopReference({networkId,line,fromStop,toStop,travelDate,product,profile}={}){
 if(networkId!=='oura-haute-savoie')return null;
 const fromSector=stopSector(fromStop),toSector=stopSector(toStop);
 if(!fromSector||!toSector)return null;
 const result=reference({line,fromSector,toSector,travelDate,product,profile});
 return result?{...result,stopMappingVerified:true,gtfsSource:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA',gtfsCheckedOn:'2026-11-07'}:null;
}
const api={reference,stopReference,SOURCE};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CP274Fares=api;
})(typeof window!=='undefined'?window:globalThis);
