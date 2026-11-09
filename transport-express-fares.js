/* Official 2026 illico AUTOCARS references matched to the Express GTFS. */
(function(root){
'use strict';
const DATA={
 X36:{
  source:"https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X36_Bellegarde-Bourg_2026.pdf",
  stops:[
   ["BELLEGARDE Gare","FR:01033:ZE:29769:CARSxREGIONxEXPRESS",46.110645,5.824986],
   ["BELLEGARDE Lycée","FR:01033:ZE:29803:CARSxREGIONxEXPRESS",46.11534,5.815965],
   ["CHATILLON-EN-MICHAILLE Centre","FR:01033:ZE:29821:CARSxREGIONxEXPRESS",46.144399,5.798421],
   ["SAINT-GERMAIN-DE-JOUX Centre","FR:01357:ZE:29822:CARSxREGIONxEXPRESS",46.17807,5.73776],
   ["LE-POIZAT-LALLEYRIAT RD1084","FR:01204:ZE:29823:CARSxREGIONxEXPRESS",46.167187,5.689644],
   ["LES NEYROLLES Centre","FR:01274:ZE:29807:CARSxREGIONxEXPRESS",46.140683,5.630536],
   ["NANTUA Médiathèque","FR:01269:ZE:29806:CARSxREGIONxEXPRESS",46.151193,5.603886],
   ["NANTUA Esplanade","FR:01269:ZE:29789:CARSxREGIONxEXPRESS",46.156179,5.603607],
   ["MONTREAL-LA-CLUSE Ville","FR:01265:ZE:29754:CARSxREGIONxEXPRESS",46.171287,5.573158],
   ["NURIEUX Gare","FR:01267:ZE:29805:CARSxREGIONxEXPRESS",46.184121,5.532726],
   ["HAUTECOURT Ecole","FR:01184:ZE:29765:CARSxREGIONxEXPRESS",46.159673,5.417231],
   ["CEYZERIAT Mairie","FR:01072:ZE:29764:CARSxREGIONxEXPRESS",46.178929,5.322512],
   ["BOURG-EN-BRESSE Gare","FR:01053:ZE:29763:CARSxREGIONxEXPRESS",46.199498,5.215381]
  ],
  cells:[[0,1,120],[0,2,150],[1,2,120],[0,3,240],[1,3,210],[2,3,150],[0,4,330],[1,4,290],[2,4,240],[3,4,150],[0,5,420],[1,5,380],[2,5,340],[3,5,260],[4,5,170],[0,6,470],[1,6,440],[2,6,380],[3,6,310],[4,6,220],[5,6,120],[0,7,490],[1,7,460],[2,7,400],[3,7,330],[4,7,240],[5,7,140],[6,7,120],[0,8,550],[1,8,520],[2,8,460],[3,8,360],[4,8,290],[5,8,190],[6,8,140],[7,8,120],[0,9,630],[1,9,590],[2,9,530],[3,9,440],[4,9,340],[5,9,260],[6,9,210],[7,9,190],[8,9,140],[0,10,730],[1,10,700],[2,10,660],[3,10,590],[4,10,490],[5,10,380],[6,10,340],[7,10,330],[8,10,270],[9,10,210],[0,11,940],[1,11,910],[2,11,870],[3,11,800],[4,11,730],[5,11,650],[6,11,610],[7,11,590],[8,11,530],[9,11,460],[10,11,330],[0,12,1100],[1,12,1050],[2,12,1010],[3,12,940],[4,12,870],[5,12,790],[6,12,750],[7,12,730],[8,12,690],[9,12,630],[10,12,490],[11,12,240]]
 },
 X37:{
  source:"https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X37_Nantua-St-Claude_2026.pdf",
  stops:[
   ["OYONNAX Gare","FR:01283:ZE:29810:CARSxREGIONxEXPRESS",46.259671,5.653281],
   ["BELLIGNAT Lycée","FR:01031:ZE:29761:CARSxREGIONxEXPRESS",46.248547,5.63221],
   ["BELLIGNAT Mairie","FR:01031:ZE:29762:CARSxREGIONxEXPRESS",46.24246,5.629689],
   ["MONTREAL-LA-CLUSE Ville","FR:01265:ZE:29754:CARSxREGIONxEXPRESS",46.171287,5.573158],
   ["SAINT-CLAUDE Gare","FR:39478:ZE:29812:CARSxREGIONxEXPRESS",46.389964,5.860345],
   ["MOLINGES Village","FR:39339:ZE:29811:CARSxREGIONxEXPRESS",46.356939,5.76531],
   ["DORTAN Mairie","FR:01148:ZE:29788:CARSxREGIONxEXPRESS",46.318818,5.659685],
   ["NANTUA Esplanade","FR:01269:ZE:29789:CARSxREGIONxEXPRESS",46.156179,5.603607],
   ["NANTUA Médiathèque","FR:01269:ZE:29806:CARSxREGIONxEXPRESS",46.151193,5.603886]
  ],
  cells:[[4,6,400],[5,6,230],[4,0,520],[5,0,330],[6,0,210],[4,1,540],[5,1,360],[6,1,240],[0,1,120],[4,2,560],[5,2,380],[6,2,260],[0,2,120],[1,2,120],[4,3,660],[5,3,510],[6,3,400],[0,3,270],[1,3,240],[2,3,220],[4,7,690],[5,7,540],[6,7,460],[0,7,330],[1,7,290],[2,7,270],[3,7,120],[4,8,700],[5,8,560],[6,8,470],[0,8,340],[1,8,310],[2,8,290],[3,8,140],[7,8,120]]
 },
 X38:{
  source:"https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X38_Bourg-en-Bresse-Oyonnax_2026.pdf",
  stops:[
   ["OYONNAX Gare","FR:01283:ZE:29810:CARSxREGIONxEXPRESS",46.259671,5.653281],
   ["BELLIGNAT Lycée","FR:01031:ZE:29761:CARSxREGIONxEXPRESS",46.248547,5.63221],
   ["BELLIGNAT Mairie","FR:01031:ZE:29762:CARSxREGIONxEXPRESS",46.24246,5.629689],
   ["MONTREAL-LA-CLUSE Ville","FR:01265:ZE:29754:CARSxREGIONxEXPRESS",46.171287,5.573158],
   ["BOURG-EN-BRESSE Gare","FR:01053:ZE:29763:CARSxREGIONxEXPRESS",46.199498,5.215381]
  ],
  cells:[[0,1,120],[0,2,120],[1,2,120],[0,3,270],[1,3,240],[2,3,220],[0,4,860],[1,4,830],[2,4,820],[3,4,690]]
 }
};
const NETWORK='reseau-interurbain-cars-region-express';
const boardingDate=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
function matchingStop(stops,id,stop){
 if(stop?.stopId!==id||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon))return -1;
 return stops.findIndex(([,stopId,lat,lon])=>stopId===id&&
  Math.hypot((stop.lat-lat)*111195,(stop.lon-lon)*111195*Math.cos(lat*Math.PI/180))<=50);
}
function reference(row){
 if(row?.networkId!==NETWORK||row.interNetwork||row.legs!==undefined||row.from===row.to)return null;
 if(!Object.hasOwn(DATA,row.line))return null;
 const data=DATA[row.line],departure=Date.parse(row.departure),arrival=Date.parse(row.arrival);
 if(!Number.isFinite(departure)||!Number.isFinite(arrival)||arrival<=departure)return null;
 const parts=Object.fromEntries(boardingDate.formatToParts(departure).map(part=>[part.type,part.value]));
 const day=parts.year+'-'+parts.month+'-'+parts.day;
 if(day<'2026-03-01'||day>'2026-12-31')return null;
 const from=matchingStop(data.stops,row.from,row.originStop),to=matchingStop(data.stops,row.to,row.destinationStop);
 const cell=data.cells.find(([a,b])=>a===from&&b===to);
 if(!cell)return null;
 return {line:row.line,from:data.stops[from][0],to:data.stops[to][0],
  amountEUR:cell[2]/100,source:data.source,confirmedCurrentFare:false};
}
function describe(ref){
 return ref?' · Référence '+ref.line+' : '+ref.amountEUR.toFixed(2).replace('.',',')+
  ' € adulte illico AUTOCARS (barème du 01/03/2026, à vérifier avant achat).':'';
}
const api={reference,describe};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportExpressFares=api;
})(typeof window!=='undefined'?window:globalThis);
