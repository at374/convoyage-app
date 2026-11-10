/* X36 published matrix lookup only. No GTFS stop identity or journey fare is verified. */
(function(root){
'use strict';
const data=typeof module!=='undefined'&&module.exports?
 require('./data/transport/x36-illico-autocars-reference-2026-11-08.json'):null;
function reference({line,fromStopName,toStopName,travelDate,profile='adult',sourceData=data}={}){
 if(line!=='X36'||profile!=='adult'||!sourceData||sourceData.line!=='X36')return null;
 if(typeof fromStopName!=='string'||typeof toStopName!=='string'||
    !fromStopName.trim()||!toStopName.trim()||fromStopName===toStopName)return null;
 if(typeof travelDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(travelDate))return null;
 const ms=Date.parse(travelDate+'T12:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==travelDate||
    travelDate<sourceData.effectiveFrom||
    (sourceData.validUntil&&travelDate>sourceData.validUntil))return null;
 // The published lower-triangle matrix is directional evidence only.
 // Do not assume the reverse direction is priced identically.
 const matches=sourceData.pairs.filter(p=>p.from===fromStopName&&p.to===toStopName);
 if(matches.length!==1||!Number.isFinite(matches[0].amountEUR)||matches[0].amountEUR<0)return null;
 return {line,fromStopName,toStopName,travelDate,profile,
  amount:matches[0].amountEUR,currency:'EUR',source:sourceData.source,
  kind:'official_tariff_reference',alreadyDiscounted:true,
  fareVerified:false,stopMappingVerified:false,serviceConfirmed:false,
  note:'Tarif publié indicatif : arrêts GTFS, sens et trajet réel non vérifiés'};
}
const api={reference};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.CPX36FareReference=api;
})(typeof globalThis!=='undefined'?globalThis:this);
