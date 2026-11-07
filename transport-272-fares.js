/* Published 272 fare reference. Mapping a real stop to a fare sector is separate. */
(function(root){
'use strict';
const SOURCE='https://www.tpg.ch/sites/default/files/2026-09/LIT272_grille_tarifaire_20251214_20261212_vDEF.pdf';
const FROM=new Set(['Annecy','Annecy Pringy']),TO='Genève ou Saint-Julien Douane';
const AMOUNTS=Object.freeze({parcours:11.30,parcours_zone10:14.50});
// Exact IDs and coordinates from the official Haute-Savoie GTFS checked on
// 2026-11-07; IDs alone are not enough to identify a stop in another feed.
const STOPS=new Map([
 ['FR:74010:ZE:57539:HAUTExSAVOIE',[45.9016985,6.1201612,'Annecy']],
 ['FR:74010:ZE:57875:HAUTExSAVOIE',[45.9388232,6.1221602,'Annecy Pringy']],
 ['FR:74010:ZE:57876:HAUTExSAVOIE',[45.9394318,6.1223775,'Annecy Pringy']],
 ['FR:6623:ZE:57862:HAUTExSAVOIE',[46.230964,6.1096781,'Genève ou Saint-Julien Douane']]
]);
function stopSector(stop){
 const pin=STOPS.get(stop?.id);
 if(!pin||typeof stop.lat!=='number'||typeof stop.lon!=='number'||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return null;
 const metres=Math.hypot((stop.lat-pin[0])*111195,(stop.lon-pin[1])*111195*Math.cos(pin[0]*Math.PI/180));
 return metres<=50?pin[2]:null;
}
function reference({line,fromSector,toSector,travelDate,product,profile}={}){
 if(line!=='272'||profile!=='adult'||!Object.hasOwn(AMOUNTS,product))return null;
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
root.CP272Fares=api;
})(typeof window!=='undefined'?window:globalThis);
