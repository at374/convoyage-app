/* Published 272 fare reference. Mapping a real stop to a fare sector is separate. */
(function(root){
'use strict';
const SOURCE='https://www.tpg.ch/sites/default/files/2026-09/LIT272_grille_tarifaire_20251214_20261212_vDEF.pdf';
const FROM='Annecy',TO='Genève ou Saint-Julien Douane';
const AMOUNTS=Object.freeze({parcours:11.30,parcours_zone10:14.50});
function reference({line,fromSector,toSector,travelDate,product,profile}={}){
 if(line!=='272'||profile!=='adult'||!Object.hasOwn(AMOUNTS,product))return null;
 if(!((fromSector===FROM&&toSector===TO)||(fromSector===TO&&toSector===FROM)))return null;
 if(typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||travelDate<'2026-11-07'||travelDate>'2026-12-12')return null;
 return {line,fromSector,toSector,travelDate,product,profile,zone:'5',amount:AMOUNTS[product],currency:'EUR',
  source:SOURCE,sourceCheckedOn:'2026-11-07',publishedThrough:'2026-12-12',kind:'official_tariff_reference',
  fareVerified:false,stopMappingVerified:false,serviceConfirmed:false};
}
const api={reference,SOURCE};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CP272Fares=api;
})(typeof window!=='undefined'?window:globalThis);
