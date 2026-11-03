/* Dated official Y51 single full-fare references; never a booking quote. */
(function(root){
'use strict';
const DATA={"effectiveFrom":"2026-03-01","checkedOn":"2026-10-31","referenceYear":2026,"source":"https://annecy.transdev.com/wp-content/uploads/2021/04/AURA-FICHES-TARIFAIRES-2026-Y51_mars-2026.pdf","areas":["Annecy","Sevrier","Saint-Jorioz","Duingt","Doussard Bredannaz","Doussard Bout du Lac","Lathuile","Doussard Gare","Giez","Faverges-Seythenex","Saint-Ferréol","Val de Chaise","Ugine","Marthod","Albertville"],"matrix":["SSSS22222222344","SSSS11122222333","SSSS11112222233","SSSS11111112223","211111111112223","211111111111222","211111111111222","221111111111222","222111111111222","222111111111112","222111111111112","222221111111111","332222222111AAA","433222222111AAA","433332222221AAA"],"singleFullFareEUR":{"1":1.7,"2":4,"3":6.6,"4":8.9,"S":2.5,"A":1.4},"stops":[["FR:74010:ZE:57539:HAUTExSAVOIE",45.9016985,6.1201612,0,"Gare Routiere"],["FR:74010:ZE:57555:HAUTExSAVOIE",45.899777,6.12817,0,"Hôtel de Ville"],["FR:74010:ZE:57556:HAUTExSAVOIE",45.9000241,6.128212,0,"Hôtel de Ville"],["FR:74267:ZE:57557:HAUTExSAVOIE",45.8733375,6.1413155,1,"Létraz"],["FR:74267:ZE:57558:HAUTExSAVOIE",45.8739445,6.1416083,1,"Létraz"],["FR:74267:ZE:57559:HAUTExSAVOIE",45.8697301,6.1406339,1,"Le Cret"],["FR:74267:ZE:57560:HAUTExSAVOIE",45.8697323,6.1404445,1,"Le Cret"],["FR:74267:ZE:57561:HAUTExSAVOIE",45.8588823,6.1422619,1,"Riant Port"],["FR:74267:ZE:57562:HAUTExSAVOIE",45.8593442,6.1419398,1,"Riant Port"],["FR:74267:ZE:57563:HAUTExSAVOIE",45.8525478,6.1444409,1,"L.P. Roselieres"],["FR:74267:ZE:57564:HAUTExSAVOIE",45.8529488,6.1444834,1,"L.P. Roselieres"],["FR:74267:ZE:57565:HAUTExSAVOIE",45.8476612,6.1465834,1,"Le Brouillet"],["FR:74267:ZE:57566:HAUTExSAVOIE",45.8477898,6.1463383,1,"Le Brouillet"],["FR:74242:ZE:57567:HAUTExSAVOIE",45.8379298,6.1579781,2,"Les Chapelles"],["FR:74242:ZE:57568:HAUTExSAVOIE",45.8379542,6.158264,2,"Les Chapelles"],["FR:74242:ZE:57569:HAUTExSAVOIE",45.8345575,6.1618635,2,"College Jean Monnet"],["FR:74242:ZE:57570:HAUTExSAVOIE",45.8349227,6.1620746,2,"College Jean Monnet"],["FR:74242:ZE:57572:HAUTExSAVOIE",45.832219,6.1717336,2,"Gendarmerie"],["FR:74242:ZE:57573:HAUTExSAVOIE",45.8324037,6.1714453,2,"Gendarmerie"],["FR:74242:ZE:57574:HAUTExSAVOIE",45.8291318,6.1878668,3,"Chez Daviet"],["FR:74242:ZE:57575:HAUTExSAVOIE",45.8290592,6.1877524,3,"Chez Daviet"],["FR:74104:ZE:57576:HAUTExSAVOIE",45.8141403,6.209516,4,"Bredannaz"],["FR:74104:ZE:57577:HAUTExSAVOIE",45.8139898,6.2093074,4,"Bredannaz"],["FR:74104:ZE:57578:HAUTExSAVOIE",45.7952367,6.2131485,5,"Bout du Lac"],["FR:74104:ZE:57579:HAUTExSAVOIE",45.7957176,6.2131353,5,"Bout du Lac"],["FR:74147:ZE:57580:HAUTExSAVOIE",45.7913438,6.2131882,6,"Le Polé"],["FR:74147:ZE:57581:HAUTExSAVOIE",45.7913097,6.2132586,6,"Le Polé"],["FR:74104:ZE:57582:HAUTExSAVOIE",45.777294,6.213595,7,"Marceau la Plaine"],["FR:74104:ZE:57583:HAUTExSAVOIE",45.7772744,6.213569,7,"Marceau la Plaine"],["FR:74104:ZE:57584:HAUTExSAVOIE",45.7765336,6.2190319,7,"Guinettes"],["FR:74104:ZE:57585:HAUTExSAVOIE",45.7764922,6.2189895,7,"Guinettes"],["FR:74104:ZE:57586:HAUTExSAVOIE",45.7750866,6.22546,7,"Poste"],["FR:74104:ZE:57587:HAUTExSAVOIE",45.7750618,6.2254774,7,"Poste"],["FR:74104:ZE:57588:HAUTExSAVOIE",45.780903,6.2292526,7,"Ancienne Gare"],["FR:74104:ZE:57589:HAUTExSAVOIE",45.7807579,6.2292097,7,"Ancienne Gare"],["FR:74135:ZE:57590:HAUTExSAVOIE",45.7629543,6.2549553,8,"Gare"],["FR:74135:ZE:57591:HAUTExSAVOIE",45.7630359,6.2550539,8,"Gare"],["FR:74123:ZE:57592:HAUTExSAVOIE",45.751289,6.282463,9,"Pont Englannaz"],["FR:74123:ZE:57593:HAUTExSAVOIE",45.7513753,6.2825242,9,"Pont Englannaz"],["FR:74234:ZE:57594:HAUTExSAVOIE",45.7643834,6.3065871,10,"Carrefour Thônes"],["FR:74234:ZE:57595:HAUTExSAVOIE",45.7644446,6.3064951,10,"Carrefour Thônes"],["FR:74234:ZE:57596:HAUTExSAVOIE",45.7638192,6.3103635,10,"Champ Canon"],["FR:74234:ZE:57597:HAUTExSAVOIE",45.7638524,6.3101083,10,"Champ Canon"],["FR:74234:ZE:57598:HAUTExSAVOIE",45.7603647,6.3160394,10,"Lotissement Chapelle"],["FR:74234:ZE:57599:HAUTExSAVOIE",45.7610131,6.314942,10,"Lotissement Chapelle"],["FR:74234:ZE:57600:HAUTExSAVOIE",45.7607415,6.3255862,10,"Le Chenay"],["FR:74234:ZE:57601:HAUTExSAVOIE",45.7604506,6.3231199,10,"Le Chenay"],["FR:74167:ZE:57602:HAUTExSAVOIE",45.7622644,6.3350685,11,"Thermesay"],["FR:74167:ZE:57603:HAUTExSAVOIE",45.7623806,6.3351635,11,"Thermesay"],["FR:74167:ZE:57604:HAUTExSAVOIE",45.7635173,6.3421866,11,"Gare"],["FR:74167:ZE:57605:HAUTExSAVOIE",45.7636124,6.3436284,11,"Gare"],["FR:73303:ZE:57606:HAUTExSAVOIE",45.760226,6.3907322,12,"Soney"],["FR:73303:ZE:57607:HAUTExSAVOIE",45.7601756,6.3912067,12,"Soney"],["FR:73303:ZE:57608:HAUTExSAVOIE",45.7488094,6.4147849,12,"Rue Derobert"],["FR:73303:ZE:57609:HAUTExSAVOIE",45.7487441,6.4147825,12,"Rue Derobert"],["FR:73303:ZE:57610:HAUTExSAVOIE",45.7463462,6.4213992,12,"Les Fontaines"],["FR:73303:ZE:57611:HAUTExSAVOIE",45.746156,6.4212337,12,"Les Fontaines"],["FR:73153:ZE:57612:HAUTExSAVOIE",45.71847,6.4089785,13,"Carrefour"],["FR:73153:ZE:57613:HAUTExSAVOIE",45.7185156,6.4092241,13,"Carrefour"],["FR:73011:ZE:57614:HAUTExSAVOIE",45.6751499,6.3927443,14,"Hôtel de Ville"],["FR:73011:ZE:57615:HAUTExSAVOIE",45.6751264,6.3930412,14,"Hôtel de Ville"],["FR:73011:ZE:57616:HAUTExSAVOIE",45.6727223,6.3833431,14,"Gare Routiere"],["FR:73011:ZE:57617:HAUTExSAVOIE",45.6725711,6.3833102,14,"Gare Routiere"],["FR:74147:ZE:57920:HAUTExSAVOIE",45.7818617,6.2062382,6,"Pied du Village"],["FR:74147:ZE:57921:HAUTExSAVOIE",45.7821149,6.2061112,6,"Pied du Village"],["FR:74123:ZE:57934:HAUTExSAVOIE",45.7518153,6.3046589,9,"Lycée la Fontaine"],["FR:74123:ZE:57935:HAUTExSAVOIE",45.7517405,6.3047355,9,"Lycée la Fontaine"],["FR:74108:ZE:58436:HAUTExSAVOIE",45.827708,6.2018053,3,"Eglise"],["FR:74108:ZE:58437:HAUTExSAVOIE",45.8276579,6.2022617,3,"Eglise"],["FR:74267:ZE:58438:HAUTExSAVOIE",45.8805187,6.1417571,1,"Regina"],["FR:74267:ZE:58439:HAUTExSAVOIE",45.8810307,6.1419496,1,"Regina"],["FR:74267:ZE:58440:HAUTExSAVOIE",45.863937,6.14022,1,"Mairie"],["FR:74267:ZE:58441:HAUTExSAVOIE",45.8646501,6.1401187,1,"Mairie"],["FR:74123:ZE:58666:HAUTExSAVOIE",45.7477428,6.2976192,9,"La Soierie"],["FR:74123:ZE:58667:HAUTExSAVOIE",45.7475119,6.2974588,9,"La Soierie"],["FR:74123:ZE:58669:HAUTExSAVOIE",45.759282,6.2976722,9,"Le Noyeray"],["FR:74123:ZE:58670:HAUTExSAVOIE",45.7604456,6.2982126,9,"Le Noyeray"],["FR:74010:ZE:58799:HAUTExSAVOIE",45.8933503,6.1358716,0,"Marquisats"],["FR:74010:ZE:58800:HAUTExSAVOIE",45.8933637,6.1359787,0,"Marquisats"],["FR:74242:ZE:58804:HAUTExSAVOIE",45.8308474,6.1789097,2,"Tuileries"],["FR:74242:ZE:58805:HAUTExSAVOIE",45.8306534,6.1793191,2,"Tuileries"],["FR:73292:ZE:58894:HAUTExSAVOIE",45.7118625,6.4059338,13,"Thénésol"],["FR:73292:ZE:58895:HAUTExSAVOIE",45.7121115,6.4061803,13,"Thénésol"],["FR:73153:ZE:58896:HAUTExSAVOIE",45.7249932,6.4138974,13,"Café de la Plaine"],["FR:73153:ZE:58897:HAUTExSAVOIE",45.7248719,6.4139397,13,"Café de la Plaine"],["FR:73303:ZE:58898:HAUTExSAVOIE",45.7519832,6.4044703,12,"Outrechaise"],["FR:73303:ZE:58899:HAUTExSAVOIE",45.7521131,6.4045363,12,"Outrechaise"],["FR:73011:ZE:58900:HAUTExSAVOIE",45.6693897,6.3897282,14,"Ecole Saint-François"],["FR:73011:ZE:58901:HAUTExSAVOIE",45.6696889,6.3890125,14,"Ecole Saint-François"],["FR:74108:ZE:58922:HAUTExSAVOIE",45.827332,6.196979,3,"Plage"],["FR:74108:ZE:58923:HAUTExSAVOIE",45.8273692,6.1969119,3,"Plage"]]};
const STOPS=new Map(DATA.stops.map(([id,lat,lon,area,name])=>[id,{lat,lon,area,name}]));
function travelDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 const date=Date.parse(value),day=Date.parse(value.slice(0,10)+'T12:00:00Z');
 if(!Number.isFinite(date)||!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==value.slice(0,10))return null;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(date)).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function legReference(leg){
 const day=travelDay(leg?.departure),proof=leg?.fareScopePath;
 if(leg?.networkId!=='oura-haute-savoie'||leg.line!=='Y51'||!day||day<DATA.effectiveFrom||Number(day.slice(0,4))!==DATA.referenceYear||
  !travelDay(leg.arrival)||Date.parse(leg.arrival)<=Date.parse(leg.departure)||Date.parse(leg.arrival)-Date.parse(leg.departure)>86400000||leg.from===leg.to||!proof||
  ['networkId','tripId','from','to','departure','arrival'].some(k=>typeof leg[k]!=='string'||proof[k]!==leg[k])||
  !Array.isArray(proof.stops)||proof.stops.length<2||proof.stops.length>64||proof.stops[0]?.stopId!==leg.from||proof.stops.at(-1)?.stopId!==leg.to)return null;
 const areas=[];
 for(const stop of proof.stops){
  const pin=STOPS.get(stop?.stopId);
  if(!pin||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lon)||Math.hypot((stop.lat-pin.lat)*111195,(stop.lon-pin.lon)*111195*Math.cos(pin.lat*Math.PI/180))>50)return null;
  areas.push(pin.area);
 }
 // A detour outside the endpoint tariff range cannot use their cheaper cell.
 const forward=areas.at(-1)>=areas[0];
 if(areas.some((a,i)=>i&&(forward?a<areas[i-1]:a>areas[i-1])))return null;
 const zone=DATA.matrix[areas[0]][areas.at(-1)],amount=DATA.singleFullFareEUR[zone];
 if(!Number.isFinite(amount))return null;
 return {zone,amountEUR:amount,digitalAlternativeEUR:zone==='S'?2:null,
  fromArea:DATA.areas[areas[0]],toArea:DATA.areas[areas.at(-1)],
  product:'1 voyage, plein tarif, hors abonnement',source:DATA.source,
  effectiveFrom:DATA.effectiveFrom,checkedOn:DATA.checkedOn,confirmedCurrentFare:false};
}
function reference(row){
 const legs=Array.isArray(row?.legs)&&row.legs.length?row.legs:row?[row]:[];
 return {portions:legs.map(legReference),confirmedCurrentFare:false};
}
function importedStopMatches(stop,area,name){
 const pin=STOPS.get(stop?.stop_id),lat=Number(stop?.stop_lat),lon=Number(stop?.stop_lon);
 return !!(pin&&DATA.areas[pin.area]===area&&pin.name===name&&
  typeof stop.stop_lat==='string'&&stop.stop_lat.trim()&&typeof stop.stop_lon==='string'&&stop.stop_lon.trim()&&
  Number.isFinite(lat)&&Number.isFinite(lon)&&Math.hypot((lat-pin.lat)*111195,(lon-pin.lon)*111195*Math.cos(pin.lat*Math.PI/180))<=50);
}
function fromImportedTables(tables,date,ride){
 const planner=root.CPSibraPlanner,clock=root.CPGTFSTime;
 const empty=()=>reference(null);
 try{
  if(tables?.source!=='https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA'||
   !planner?.datedInterurbanRides||!clock?.serviceTimestamp||!ride||!Array.isArray(tables.trips)||!Array.isArray(tables.routes)||
   !Number.isFinite(Date.parse(tables.checked_at_utc))||Date.parse(tables.checked_at_utc)>Date.now())return empty();
  const trip=tables.trips.find(t=>t.trip_id===ride.trip_id);
  const route=tables.routes.find(r=>r.route_id===trip?.route_id&&r.route_short_name==='Y51');
  if(!route)return empty();
  // Recompute the active service: never attach a price to a copied or stale ride.
  const matched=planner.datedInterurbanRides(tables,date,route.route_id,ride.from_stop_id,ride.to_stop_id)
   .find(r=>['trip_id','from_stop_id','to_stop_id','departure_time','arrival_time','departureSeconds','arrivalSeconds','fromStopSequence','toStopSequence'].every(k=>r[k]===ride[k]));
  if(!matched)return empty();
  const times=tables.stop_times.filter(t=>t.trip_id===trip.trip_id).sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence));
  if(times.length>1024)return empty();
  const path=times.filter(t=>Number(t.stop_sequence)>=matched.fromStopSequence&&Number(t.stop_sequence)<=matched.toStopSequence);
  if(path.length<2||path.length>64||path.some((t,i)=>i&&Number(t.stop_sequence)<=Number(path[i-1].stop_sequence)))return empty();
  const stopMap=new Map(tables.stops.map(s=>[s.stop_id,s]));
  const number=v=>typeof v==='string'&&v.trim()&&Number.isFinite(Number(v))?Number(v):null;
  const leg={networkId:'oura-haute-savoie',line:'Y51',tripId:trip.trip_id,from:matched.from_stop_id,to:matched.to_stop_id,
   departure:new Date(clock.serviceTimestamp(date,matched.departure_time,'Europe/Paris')).toISOString(),
   arrival:new Date(clock.serviceTimestamp(date,matched.arrival_time,'Europe/Paris')).toISOString()};
  leg.fareScopePath={...leg,stops:path.map(t=>{const s=stopMap.get(t.stop_id);return {stopId:t.stop_id,lat:number(s?.stop_lat),lon:number(s?.stop_lon)};})};
  return reference(leg);
 }catch(_){return empty();}
}
function describe(result){
 if(!result?.portions?.some(Boolean))return '';
 const money=n=>n.toFixed(2).replace('.',',')+' €';
 return ' · Référence Y51 : '+result.portions.map((q,i)=>!q?'portion '+(i+1)+' : prix inconnu':
  (result.portions.length>1?'portion '+(i+1)+' : ':'')+q.fromArea+' → '+q.toArea+' · '+
  (q.zone==='S'?'SIBRA, '+money(q.amountEUR)+' à bord / '+money(q.digitalAlternativeEUR)+' digital (support éventuel en supplément)':
   (q.zone==='A'?'Arlysère':'zone '+q.zone)+', '+money(q.amountEUR))+' pour 1 voyage plein tarif, hors abonnement').join(' · ')+
  (result.portions.length>1?' · Total du trajet non calculé ; cumul des titres à vérifier.':'')+
  ' Barème du 01/03/2026, consulté le 31/10/2026 ; à revérifier avant achat.';
}
const api={reference,describe,fromImportedTables,importedStopMatches,SOURCE:DATA.source};
if(typeof module==='object'&&module.exports)module.exports=api;root.CPTY51Fares=api;
})(typeof window!=='undefined'?window:globalThis);
