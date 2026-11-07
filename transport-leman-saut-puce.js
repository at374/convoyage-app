/* Limited official reference, not a confirmed journey fare or live quote. */
(function(root){
'use strict';
const SOURCE='https://www.lemanpass.com/tarifs/';
const STOPS=Object.freeze({
 '1402572:0:A':[46.24090613,6.02920473],
 '1402572:0:B':[46.24101175,6.02849506],
 '8587918:0:C':[46.23346246,6.05541757],
 '8587918:0:S':[46.23358052,6.05524699]
});
function near(stop,id){const point=STOPS[id];return !!point&&stop?.stopId===id&&Number.isFinite(stop.lat)&&Number.isFinite(stop.lon)&&Math.abs(stop.lat-point[0])<0.0003&&Math.abs(stop.lon-point[1])<0.0003;}
function reference(row){
 if(!row||row.networkId!=='65a901970267d05025a905ec'||row.line!=='68'||typeof row.tripId!=='string'||!row.tripId||
    (Array.isArray(row.legs)&&row.legs.length)||typeof row.departure!=='string'||!Number.isFinite(Date.parse(row.departure)))return null;
 const a=row.from,b=row.to;
 const pair=(a==='1402572:0:B'&&b==='8587918:0:C')||(a==='8587918:0:S'&&b==='1402572:0:A');
 if(!pair||!near(row.originStop,a)||!near(row.destinationStop,b))return null;
 return {source:SOURCE,amountEUR:2,amountCHF:2.3,checkedOn:'2026-11-07',fareVerified:false,serviceConfirmed:false,totalEUR:null};
}
function describe(ref){return ref?'Référence Léman Pass : saut de puce 2,00 € ou 2,30 CHF, ligne 68, trajet direct Porte de France ↔ CERN, 30 min. Barème consulté le 07/11/2026 ; date et conditions à vérifier. Prix total non confirmé.':'';}
const api={SOURCE,reference,describe};if(typeof module==='object'&&module.exports)module.exports=api;root.CPLemanSautPuce=api;
})(typeof window!=='undefined'?window:globalThis);
