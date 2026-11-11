/* Limited official reference, not a confirmed journey fare or live quote. */
(function(root){
'use strict';
const SOURCE='https://www.lemanpass.com/tarifs/';
const STOPS=Object.freeze({
 '1402572:0:A':[46.24090613,6.02920473],
 '1402572:0:B':[46.24101175,6.02849506],
 '8587918:0:C':[46.23346246,6.05541757],
 '8587918:0:S':[46.23358052,6.05524699],
 '1401733:0:K':[46.24491958,6.09404512],
 '1401733:0:L':[46.24556568,6.09424275],
 '1401781:0:P':[46.24856001,6.08665199],
 '8594946:0:I':[46.23988098,6.08658012],
 '8594946:0:J':[46.23953926,6.08621181],
 '8594961:0:C':[46.23625861,6.08285211],
 '1401814:0:E':[46.29539810,6.10029740],
 '1401814:0:F':[46.29560292,6.10000994],
 '8587035:0:W':[46.27964291,6.11408654],
 '8587035:0:Z':[46.27974225,6.11421230],
 '8592722:0:B':[46.27381893,6.12280918],
 '8592722:0:Y':[46.27376925,6.12299782]
});
// Only stop pairs present in the official timetable inspected on 07/11/2026.
const PAIRS={
 '68':[['1402572:0:B','8587918:0:C'],['8587918:0:S','1402572:0:A']],
 '64':[['1401733:0:K','8594946:0:I'],['1401733:0:K','8594961:0:C'],['8594946:0:J','1401733:0:L'],['8594961:0:C','1401733:0:L'],['1401781:0:P','8594946:0:I'],['8594946:0:J','1401781:0:P'],['1401781:0:P','8594961:0:C'],['8594961:0:C','1401781:0:P']],
 '52':[['8587035:0:Z','1401814:0:E'],['8592722:0:Y','1401814:0:E'],['1401814:0:F','8587035:0:W'],['1401814:0:F','8592722:0:B']]
};
function near(stop,id){const point=STOPS[id];return !!point&&stop?.stopId===id&&Number.isFinite(stop.lat)&&Number.isFinite(stop.lon)&&Math.abs(stop.lat-point[0])<0.0003&&Math.abs(stop.lon-point[1])<0.0003;}
function reference(row){
 if(!row||row.networkId!=='65a901970267d05025a905ec'||!Object.hasOwn(PAIRS,row.line)||typeof row.tripId!=='string'||!row.tripId||
    (Array.isArray(row.legs)&&row.legs.length)||typeof row.departure!=='string'||typeof row.arrival!=='string'||
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(row.departure)||!/(?:Z|[+-]\d{2}:\d{2})$/i.test(row.arrival))return null;
 const duration=Date.parse(row.arrival)-Date.parse(row.departure);
 if(!Number.isFinite(duration)||duration<0||duration>30*60000)return null;
 const a=row.from,b=row.to;
 const pair=PAIRS[row.line].some(([from,to])=>from===a&&to===b);
 if(!pair||!near(row.originStop,a)||!near(row.destinationStop,b))return null;
 return {source:SOURCE,line:row.line,amountEUR:2,amountCHF:2.3,checkedOn:'2026-11-07',fareVerified:false,serviceConfirmed:false,totalEUR:null};
}
function describe(ref){return ref?'Référence Léman Pass : saut de puce 2,00 € ou 2,30 CHF, ligne '+ref.line+', trajet direct entre les arrêts affichés, 30 min. Barème consulté le 07/11/2026 ; date et conditions à vérifier. Prix total non confirmé.':'';}
const api={SOURCE,reference,describe};if(typeof module==='object'&&module.exports)module.exports=api;root.CPLemanSautPuce=api;
})(typeof window!=='undefined'?window:globalThis);
