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
   ["BRION Gare","FR:01063:ZE:29691:CARSxREGIONxEXPRESS",46.175774,5.558513],
   ["NURIEUX Gare","FR:01267:ZE:29805:CARSxREGIONxEXPRESS",46.184121,5.532726],
   ["HAUTECOURT Ecole","FR:01184:ZE:29765:CARSxREGIONxEXPRESS",46.159673,5.417231],
   ["VILLEREVERSURE Gare","FR:01447:ZE:29804:CARSxREGIONxEXPRESS",46.194192,5.397474],
   ["CEYZERIAT Mairie","FR:01072:ZE:29764:CARSxREGIONxEXPRESS",46.178929,5.322512],
   ["BOURG-EN-BRESSE Gare","FR:01053:ZE:29763:CARSxREGIONxEXPRESS",46.199498,5.215381]
  ],
  cells:[[0,1,120],[0,2,150],[1,2,120],[0,3,240],[1,3,210],[2,3,150],[0,4,330],[1,4,290],[2,4,240],[3,4,150],[0,5,420],[1,5,380],[2,5,340],[3,5,260],[4,5,170],[0,6,470],[1,6,440],[2,6,380],[3,6,310],[4,6,220],[5,6,120],[0,7,490],[1,7,460],[2,7,400],[3,7,330],[4,7,240],[5,7,140],[6,7,120],[0,8,550],[1,8,520],[2,8,460],[3,8,360],[4,8,290],[5,8,190],[6,8,140],[7,8,120],[0,9,570],[1,9,530],[2,9,470],[3,9,380],[4,9,310],[5,9,210],[6,9,150],[7,9,140],[8,9,120],[0,10,630],[1,10,590],[2,10,530],[3,10,440],[4,10,340],[5,10,260],[6,10,210],[7,10,190],[8,10,140],[9,10,120],[0,11,730],[1,11,700],[2,11,660],[3,11,590],[4,11,490],[5,11,380],[6,11,340],[7,11,330],[8,11,270],[9,11,260],[10,11,210],[0,12,820],[1,12,790],[2,12,750],[3,12,680],[4,12,610],[5,12,490],[6,12,440],[7,12,420],[8,12,360],[9,12,340],[10,12,310],[11,12,170],[0,13,940],[1,13,910],[2,13,870],[3,13,800],[4,13,730],[5,13,650],[6,13,610],[7,13,590],[8,13,530],[9,13,520],[10,13,460],[11,13,330],[12,13,220],[0,14,1100],[1,14,1050],[2,14,1010],[3,14,940],[4,14,870],[5,14,790],[6,14,750],[7,14,730],[8,14,690],[9,14,680],[10,14,630],[11,14,490],[12,14,380],[13,14,240]]
 },
 X37:{
  source:"https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X37_Nantua-St-Claude_2026.pdf",
  stops:[
   ["OYONNAX Gare","FR:01283:ZE:29810:CARSxREGIONxEXPRESS",46.259671,5.653281],
   ["BELLIGNAT Lycée","FR:01031:ZE:29761:CARSxREGIONxEXPRESS",46.248547,5.63221],
   ["BELLIGNAT Mairie","FR:01031:ZE:29762:CARSxREGIONxEXPRESS",46.24246,5.629689],
   ["MONTREAL-LA-CLUSE Ville","FR:01265:ZE:29754:CARSxREGIONxEXPRESS",46.171287,5.573158],
   ["BRION Gare","FR:01063:ZE:29691:CARSxREGIONxEXPRESS",46.175774,5.558513],
   ["MONTREAL-LA-CLUSE Mairie","FR:01265:ZE:29808:CARSxREGIONxEXPRESS",46.184733,5.576972],
   ["MARTIGNAT Mairie","FR:01237:ZE:29809:CARSxREGIONxEXPRESS",46.209166,5.610731],
   ["SAINT-CLAUDE Gare","FR:39478:ZE:29812:CARSxREGIONxEXPRESS",46.389964,5.860345],
   ["MOLINGES Village","FR:39339:ZE:29811:CARSxREGIONxEXPRESS",46.356939,5.76531],
   ["DORTAN Mairie","FR:01148:ZE:29788:CARSxREGIONxEXPRESS",46.318818,5.659685],
   ["NANTUA Esplanade","FR:01269:ZE:29789:CARSxREGIONxEXPRESS",46.156179,5.603607],
   ["NANTUA Médiathèque","FR:01269:ZE:29806:CARSxREGIONxEXPRESS",46.151193,5.603886]
  ],
  cells:[[7,9,400],[8,9,230],[7,0,520],[8,0,330],[9,0,210],[7,1,540],[8,1,360],[9,1,240],[0,1,120],[7,2,560],[8,2,380],[9,2,260],[0,2,120],[1,2,120],[7,6,600],[8,6,430],[9,6,330],[0,6,190],[1,6,150],[2,6,140],[7,5,640],[8,5,490],[9,5,380],[0,5,260],[1,5,220],[2,5,210],[6,5,140],[7,4,670],[8,4,520],[9,4,420],[0,4,290],[1,4,260],[2,4,240],[6,4,190],[5,4,120],[7,3,660],[8,3,510],[9,3,400],[0,3,270],[1,3,240],[2,3,220],[6,3,150],[5,3,120],[4,3,120],[7,10,690],[8,10,540],[9,10,460],[0,10,330],[1,10,290],[2,10,270],[6,10,210],[5,10,140],[4,10,140],[3,10,120],[7,11,700],[8,11,560],[9,11,470],[0,11,340],[1,11,310],[2,11,290],[6,11,220],[5,11,150],[4,11,150],[3,11,140],[10,11,120]]
 },
 X38:{
  source:"https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X38_Bourg-en-Bresse-Oyonnax_2026.pdf",
  stops:[
   ["OYONNAX Gare","FR:01283:ZE:29810:CARSxREGIONxEXPRESS",46.259671,5.653281],
   ["BELLIGNAT Lycée","FR:01031:ZE:29761:CARSxREGIONxEXPRESS",46.248547,5.63221],
   ["BELLIGNAT Mairie","FR:01031:ZE:29762:CARSxREGIONxEXPRESS",46.24246,5.629689],
   ["MONTREAL-LA-CLUSE Ville","FR:01265:ZE:29754:CARSxREGIONxEXPRESS",46.171287,5.573158],
   ["BRION Gare","FR:01063:ZE:29691:CARSxREGIONxEXPRESS",46.175774,5.558513],
   ["MONTREAL-LA-CLUSE Mairie","FR:01265:ZE:29808:CARSxREGIONxEXPRESS",46.184733,5.576972],
   ["MARTIGNAT Mairie","FR:01237:ZE:29809:CARSxREGIONxEXPRESS",46.209166,5.610731],
   ["BOURG-EN-BRESSE Gare","FR:01053:ZE:29763:CARSxREGIONxEXPRESS",46.199498,5.215381]
  ],
  cells:[[0,1,120],[0,2,120],[1,2,120],[0,6,190],[1,6,150],[2,6,140],[0,5,260],[1,5,220],[2,5,210],[6,5,140],[0,3,270],[1,3,240],[2,3,220],[6,3,150],[5,3,120],[0,4,290],[1,4,260],[2,4,240],[6,4,190],[5,4,120],[3,4,120],[0,7,860],[1,7,830],[2,7,820],[6,7,760],[5,7,700],[3,7,690],[4,7,680]]
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
