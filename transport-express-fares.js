/* Official 2026 adult fare references matched to the Express GTFS. */
(function(root){
'use strict';
const DATA={
 X25:{
  source:"https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/Tarifs-a-bord-mars-2026-x25.pdf",
  product:"adulte à bord",
  stops:[
   ["Villefranche-sur-Saône Gare routière","FR:69264:ZE:92713:CARSxREGIONxEXPRESS",45.983777,4.720479],
   ["Villefranche-sur-Saône Burie","FR:69264:ZE:92721:CARSxREGIONxEXPRESS",45.996743,4.719046],
   ["Arnas Avé Maria","FR:69013:ZE:92722:CARSxREGIONxEXPRESS",46.021111,4.720277],
   ["Saint-Georges-de-Reneins Centre","FR:69206:ZE:92715:CARSxREGIONxEXPRESS",46.063092,4.722683],
   ["Belleville-sur-Saône Gare","FR:69019:ZE:92716:CARSxREGIONxEXPRESS",46.111952,4.729011],
   ["Romanèche-Thorins Maison Blanche","FR:71372:ZE:92720:CARSxREGIONxEXPRESS",46.176344,4.741973],
   ["La Chapelle de Guinchay Pontanevaux","FR:71090:ZE:92719:CARSxREGIONxEXPRESS",46.213047,4.772881],
   ["Crèches-sur-Saône Mairie","FR:71150:ZE:92718:CARSxREGIONxEXPRESS",46.246154,4.784047],
   ["Mâcon Loché TGV","FR:71270:ZE:92717:CARSxREGIONxEXPRESS",46.282912,4.778924]
  ],
  cells:[
   [0,3,220],[1,3,220],[2,3,150],
   [0,4,330],[1,4,330],[2,4,260],[3,4,170],
   [0,5,440],[1,5,440],[2,5,360],[3,5,290],[4,5,190],
   [0,6,530],[1,6,530],[2,6,460],[3,6,360],[4,6,270],[5,6,600],
   [0,7,610],[1,7,610],[2,7,530],[3,7,440],[4,7,340],[5,7,600],[6,7,600],
   [0,8,960],[1,8,960],[2,8,900],[3,8,820],[4,8,720],[5,8,600],[6,8,600],[7,8,600]
  ]
 },
 X33:{
  source:"https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/X33_Grilles-tarifaires-01032026.pdf",
  stops:[
   ["DIVONNE-LES-BAINS Anc.Gare","FR:01143:ZE:29820:CARSxREGIONxEXPRESS",46.353462,6.137003],
   ["GEX L'Aiglette","FR:01173:ZE:63750:CARSxREGIONxEXPRESS",46.335675,6.06826],
   ["GEX Centre","FR:01173:ZE:29819:CARSxREGIONxEXPRESS",46.331773,6.05837],
   ["GEX Vertes Campagnes","FR:01173:ZE:29745:CARSxREGIONxEXPRESS",46.326057,6.055178],
   ["ECHENEVEX RD984","FR:01153:ZE:29818:CARSxREGIONxEXPRESS",46.310653,6.049014],
   ["CHEVRY Mairie","FR:01103:ZE:29817:CARSxREGIONxEXPRESS",46.28222,6.038532],
   ["FERNEY-VOLTAIRE Lycée international","FR:01160:ZE:29693:CARSxREGIONxEXPRESS",46.263,6.1153],
   ["FERNEY-VOLTAIRE Mairie","FR:01160:ZE:29692:CARSxREGIONxEXPRESS",46.256019,6.10822],
   ["PREVESSIN MOENS Mairie","FR:01313:ZE:29694:CARSxREGIONxEXPRESS",46.25446,6.081099],
   ["ST GENIS POUILLY Allondon Nord","FR:01354:ZE:63749:CARSxREGIONxEXPRESS",46.263601,6.030596],
   ["ST GENIS POUILLY Allondon Sud","FR:01354:ZE:29774:CARSxREGIONxEXPRESS",46.255547,6.02749],
   ["ST GENIS POUILLY Jean Monnet","FR:01354:ZE:29775:CARSxREGIONxEXPRESS",46.244904,6.022978],
   ["ST GENIS POUILLY Porte de France","FR:01354:ZE:29744:CARSxREGIONxEXPRESS",46.240849,6.029241],
   ["SERGY Centre","FR:01401:ZE:29816:CARSxREGIONxEXPRESS",46.248455,6.011399],
   ["THOIRY Allemogne","FR:01419:ZE:29756:CARSxREGIONxEXPRESS",46.244473,5.984344],
   ["THOIRY Mairie","FR:01419:ZE:29741:CARSxREGIONxEXPRESS",46.236107,5.98024],
   ["THOIRY Val Thoiry","FR:01419:ZE:29802:CARSxREGIONxEXPRESS",46.227114,5.992444],
   ["ST JEAN DE GONVILLE RD 984","FR:01360:ZE:29815:CARSxREGIONxEXPRESS",46.206656,5.960426],
   ["PERON RD984","FR:01288:ZE:29814:CARSxREGIONxEXPRESS",46.187652,5.929806],
   ["PERON Logras","FR:01288:ZE:29825:CARSxREGIONxEXPRESS",46.180116,5.917594],
   ["FARGES Eglise","FR:01158:ZE:29813:CARSxREGIONxEXPRESS",46.168463,5.906042],
   ["COLLONGES Poste","FR:01109:ZE:29800:CARSxREGIONxEXPRESS",46.136811,5.903134],
   ["LEAZ Longeray","FR:01209:ZE:29801:CARSxREGIONxEXPRESS",46.115362,5.883254],
   ["LEAZ Bourg","FR:01209:ZE:63748:CARSxREGIONxEXPRESS",46.0992,5.8807],
   ["LEAZ Grésin","FR:01033:ZE:29824:CARSxREGIONxEXPRESS",46.0908,5.8599],
   ["VALSERÔNE Gare","FR:01033:ZE:29769:CARSxREGIONxEXPRESS",46.110645,5.824986],
   ["VALSERHÔNE Lycée","FR:01033:ZE:29803:CARSxREGIONxEXPRESS",46.11534,5.815965]
  ],
  cells:[
   [0,1,190],
   [0,2,210],[1,2,120],
   [0,3,220],[1,3,120],[2,3,120],
   [0,4,260],[1,4,140],[2,4,120],[3,4,120],
   [0,5,340],[1,5,220],[2,5,210],[3,5,190],[4,5,150],
   [0,6,270],
   [6,7,120],
   [6,8,120],[7,8,120],
   [0,9,340],[1,9,240],[2,9,220],[3,9,210],[4,9,170],[5,9,120],
   [0,10,380],[1,10,270],[2,10,260],[3,10,240],[4,10,210],[5,10,120],[9,10,120],
   [0,11,400],[1,11,290],[2,11,270],[3,11,260],[4,11,220],[5,11,140],[6,11,210],[7,11,190],[8,11,150],[9,11,120],[10,11,120],
   [0,12,420],[1,12,310],[2,12,290],[3,12,270],[4,12,240],[5,12,150],[6,12,220],[7,12,210],[8,12,170],[9,12,140],[10,12,120],[11,12,120],
   [6,13,240],[7,13,220],[8,13,190],[9,13,150],[11,13,120],
   [6,14,260],[7,14,240],[8,14,210],[9,14,170],[11,14,120],[13,14,120],
   [6,15,270],[7,15,260],[8,15,220],[9,15,190],[11,15,140],[13,15,120],[14,15,120],
   [0,16,490],[1,16,360],[2,16,340],[3,16,340],[4,16,310],[5,16,220],[6,16,290],[7,16,270],[8,16,240],[9,16,210],[10,16,170],[11,16,150],[12,16,140],[13,16,120],[14,16,120],[15,16,120],
   [6,17,340],[7,17,330],[8,17,290],[9,17,260],[11,17,210],[13,17,170],[14,17,150],[15,17,140],[16,17,120],
   [6,18,380],[7,18,360],[8,18,340],[9,18,310],[11,18,260],[13,18,220],[14,18,210],[15,18,190],[16,18,170],[17,18,120],
   [6,19,400],[7,19,380],[8,19,340],[9,19,330],[11,19,270],[13,19,240],[14,19,220],[15,19,210],[16,19,190],[17,19,140],[18,19,120],
   [6,20,420],[7,20,400],[8,20,360],[9,20,340],[11,20,290],[13,20,260],[14,20,240],[15,20,220],[16,20,210],[17,20,150],[18,20,120],[19,20,120],
   [0,21,700],[1,21,610],[2,21,590],[3,21,570],[4,21,530],[5,21,440],[6,21,520],[7,21,490],[8,21,460],[9,21,420],[10,21,380],[11,21,360],[12,21,340],[13,21,340],[14,21,330],[15,21,310],[16,21,290],[17,21,240],[18,21,190],[19,21,170],[20,21,150],
   [0,22,750],[1,22,650],[6,22,570],[7,22,550],[8,22,520],[9,22,470],[11,22,420],[12,22,400],[13,22,380],[14,22,360],[15,22,340],[16,22,340],[17,22,290],[18,22,240],[19,22,220],[20,22,210],[21,22,120],
   [0,23,790],[1,23,690],[2,23,680],[3,23,660],[4,23,630],[5,23,550],[6,23,630],[7,23,610],[8,23,570],[9,23,570],[10,23,530],[11,23,470],[12,23,460],[13,23,440],[14,23,420],[15,23,400],[16,23,380],[17,23,340],[18,23,290],[19,23,270],[20,23,260],[21,23,170],[22,23,120],
   [6,24,630],[7,24,630],[8,24,590],[9,24,590],[10,24,550],[11,24,490],[13,24,460],[14,24,440],[15,24,420],[16,24,400],[17,24,340],[18,24,310],[19,24,290],[20,24,270],[21,24,190],[22,24,140],[23,24,120],
   [0,25,860],[1,25,760],[2,25,750],[3,25,730],[4,25,700],[5,25,630],[6,25,690],[7,25,680],[8,25,650],[9,25,650],[10,25,590],[11,25,570],[12,25,550],[13,25,530],[14,25,520],[15,25,490],[16,25,470],[17,25,420],[18,25,360],[19,25,340],[20,25,340],[21,25,260],[22,25,210],[23,25,170],[24,25,140],
   [0,26,900],[1,26,800],[2,26,790],[3,26,770],[4,26,750],[5,26,680],[6,26,730],[7,26,720],[8,26,690],[9,26,690],[10,26,630],[11,26,630],[12,26,610],[13,26,590],[14,26,570],[15,26,550],[16,26,530],[17,26,470],[18,26,420],[19,26,400],[20,26,380],[21,26,310],[22,26,260],[23,26,220],[24,26,190],[25,26,120]
  ]
 },
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
const LINE_PAGES={
 X13:'cars-region-de-la-loire/ligne/x13-roanne-le-creusot-tgv/',
 X18:'cars-region-de-la-loire/ligne/x18-saint-etienne-clermont-ferrand/',
 X25:'cars-region-de-lain/ligne/x25-villefranche-sur-saone-macon-loche-tgv/',
 X33:'cars-region-de-lain/ligne/x33-valserhone-divonne-les-bains/',
 X36:'cars-region-de-lain/ligne/x36-bellegarde-bourg-en-bresse/',
 X37:'cars-region-de-lain/ligne/x37-nantua-saint-claude/',
 X38:'cars-region-de-lain/ligne/x38-oyonnax-bourg-en-bresse/',
 X51:'cars-region-du-puy-de-dome/ligne/x51-saint-gervais-les-ancizes-pontgibaud-volvic/',
 X71:'cars-region-de-la-drome/ligne/d36-x71-montelimar-grignan-nyons/',
 X73:'cars-region-de-la-drome/ligne/x73-valence-tgv-valence-ville-privas-aubenas/',
 X74:'cars-region-de-la-drome/ligne/x74-valence-tgv-montelimar-aubenas-les-vans-2/',
 X75:'cars-region-de-lardeche/ligne/x75-annonay-le-peage-de-roussillon-lyon/',
 X76:'cars-region-de-la-drome/ligne/x76-valence-tgv-montelimar-vallon-pont-darc-2/',
};
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
  amountEUR:cell[2]/100,product:data.product||"adulte illico AUTOCARS",source:data.source,confirmedCurrentFare:false};
}
function describe(ref){
 return ref?' · Référence '+ref.line+' : '+ref.amountEUR.toFixed(2).replace('.',',')+
  ' € '+ref.product+' (barème du 01/03/2026, à vérifier avant achat).':'';
}
function lookup(row){
 const legs=Array.isArray(row?.legs)?row.legs:[row];
 const lines=[...new Set(legs.filter(leg=>leg?.networkId===NETWORK&&Object.hasOwn(LINE_PAGES,leg.line)).map(leg=>leg.line))];
 if(!lines.length)return null;
 return {searchURL:'https://www.sncf-connect.com/billet-train',
  lines:lines.map(line=>({line,url:'https://www.laregionvoustransporte.fr/cars-region/'+LINE_PAGES[line]}))};
}
const api={reference,describe,lookup};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportExpressFares=api;
})(typeof window!=='undefined'?window:globalThis);
