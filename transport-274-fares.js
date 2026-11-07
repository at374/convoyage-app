/* Published 274 fare reference. Mapping a real stop to a fare sector is separate. */
(function(root){
'use strict';
const SOURCE='https://jacquet-autocars.com/wp-content/uploads/2026/01/Grille-tarifaire-TRANSFRONTALIERS-2025-2026.pdf';
const TO='Genève';
const AMOUNTS=Object.freeze({
 'Nangy Findrol':{zone:'10+210',multizones_10_210:4.90},
 Fillinges:{zone:'1',parcours:4.60,parcours_zone10:4.90},
 'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz':{zone:'2',parcours:6.00,parcours_zone10:6.40},
 Bonneville:{zone:'3',parcours:6.40,parcours_zone10:8.10},
 'Taninges / Mieussy':{zone:'4',parcours:7.50,parcours_zone10:8.20},
 Sallanches:{zone:'5',parcours:11.40,parcours_zone10:14.60}
});
// Exact IDs and coordinates from the official Haute-Savoie GTFS checked on
// 2026-11-07; IDs alone are not enough to identify a stop in another feed.
const STOPS=new Map([
 ['FR:74197:ZE:58716:HAUTExSAVOIE',[46.1423557,6.3179182,'Nangy Findrol']],
 ['FR:74128:ZE:75337:HAUTExSAVOIE',[46.1634053,6.3531174,'Fillinges']],
 ['FR:74241:ZE:57653:HAUTExSAVOIE',[46.1362776,6.4777986,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74241:ZE:57654:HAUTExSAVOIE',[46.1361914,6.4777291,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74241:ZE:57655:HAUTExSAVOIE',[46.138307,6.4579872,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74241:ZE:57656:HAUTExSAVOIE',[46.1382578,6.4580766,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74304:ZE:57657:HAUTExSAVOIE',[46.1428742,6.4185632,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74304:ZE:57658:HAUTExSAVOIE',[46.1422882,6.4202016,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74311:ZE:58304:HAUTExSAVOIE',[46.1458135,6.3860544,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74311:ZE:58305:HAUTExSAVOIE',[46.1457319,6.3868507,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74311:ZE:58474:HAUTExSAVOIE',[46.1423931,6.4033413,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74311:ZE:58475:HAUTExSAVOIE',[46.1422673,6.4033764,'Saint-Jeoire / Ville-en-Sallaz / Viuz-en-Sallaz']],
 ['FR:74042:ZE:58718:HAUTExSAVOIE',[46.0708039,6.4249336,'Bonneville']],
 ['FR:74042:ZE:75327:HAUTExSAVOIE',[46.0705054,6.4253512,'Bonneville']],
 ['FR:74276:ZE:57620:HAUTExSAVOIE',[46.1075737,6.5920651,'Taninges / Mieussy']],
 ['FR:74276:ZE:57621:HAUTExSAVOIE',[46.1076543,6.592104,'Taninges / Mieussy']],
 ['FR:74183:ZE:57651:HAUTExSAVOIE',[46.1336799,6.523335,'Taninges / Mieussy']],
 ['FR:74183:ZE:57652:HAUTExSAVOIE',[46.1336667,6.5231536,'Taninges / Mieussy']],
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
 if(line!=='274'||profile!=='adult'||!['parcours','parcours_zone10','multizones_10_210'].includes(product))return null;
 const sector=toSector===TO?fromSector:fromSector===TO?toSector:null;
 if(!sector||!Object.hasOwn(AMOUNTS,sector)||!Object.hasOwn(AMOUNTS[sector],product))return null;
 if(typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||travelDate<'2026-11-07'||travelDate>'2026-12-12')return null;
 return {line,fromSector,toSector,travelDate,product,profile,zone:AMOUNTS[sector].zone,amount:AMOUNTS[sector][product],currency:'EUR',
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
