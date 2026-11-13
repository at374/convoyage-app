'use strict';
const assert=require('node:assert/strict');
const {completeWalks,walkOnly,cachedRouter,assess}=require('../transport-mission-hub.js');
const when=m=>new Date(Date.parse('2026-11-16T08:00:00Z')+m*60000).toISOString();
const a={lat:45.0000,lon:5.0000},b={lat:45.0020,lon:5.0020},c={lat:45.0010,lon:5.0000};
const task={from:a,to:b,latestArrival:when(70),marginMinutes:15,fromName:'Adresse précise',toName:'Livraison précise'};
const bus={kind:'transit',mode:'Bus',provider:'Test',line:'1',from:'Arrêt A',to:'Arrêt B',
 fromPoint:a,toPoint:b,departure:when(20),arrival:when(40)};
const mock={route:async(from,to)=>({status:'calculated',durationSeconds:120,distanceMeters:180,
 geometry:[from,{lat:(from.lat+to.lat)/2+0.0003,lon:(from.lon+to.lon)/2},to]})};
const checked=async(j,t=task,r=mock)=>assess(await completeWalks(j,t,r),t,()=>null);
(async()=>{
 const basic=await checked({legs:[bus]});
 assert.equal(basic.feasible,true,'Un trajet avec deux points GPS identiques aux adresses reste réalisable');
 const noStart={kind:'walk',mode:'Marche',from:'Départ moteur',to:'Arrêt A',fromPoint:null,toPoint:a,
  departure:when(15),arrival:when(20),durationSeconds:300,distanceMeters:310,walkSource:'provider'};
 const badStart=await checked({legs:[noStart,bus]});
 assert.equal(badStart.feasible,false,'Ne pas considérer comme vérifiée une marche moteur sans origine GPS');
 assert.match(badStart.statusDetail,/position du début de la marche/);
 const knownStart={...noStart,fromPoint:c};
 const extended=await checked({legs:[knownStart,bus]});
 assert.equal(extended.feasible,true,'Approche réelle ajoutée au début de la marche moteur');
 assert.equal(extended.legs.length,3,'Une approche à pied supplémentaire doit apparaître');
 assert.equal(extended.legs[0].kind,'walk');
 assert.equal(extended.legs[0].fromPoint.lat,a.lat);
 assert.equal(extended.legs[0].toPoint.lat,c.lat);
 const noEnd={kind:'walk',mode:'Marche',from:'Arrêt B',to:'Dernier kilomètre',
  fromPoint:b,toPoint:null,departure:when(40),arrival:when(45),durationSeconds:300,distanceMeters:290,walkSource:'provider'};
 const badEnd=await checked({legs:[bus,noEnd]});
 assert.equal(badEnd.feasible,false,'La marche finale sans GPS doit empêcher la validation');
 assert.match(badEnd.statusDetail,/position de la fin de la marche/);
 const extendedEnd=await checked({legs:[bus,{...noEnd,toPoint:c}]});
 assert.equal(extendedEnd.feasible,true,'Raccordement final réel jusqu’à l’adresse de livraison');
 assert.equal(extendedEnd.legs.length,3,'Le dernier kilomètre non couvert doit être ajouté');
 assert.equal(extendedEnd.legs[2].toPoint.lat,b.lat);
 const missingMetrics=await checked({legs:[{...noStart,fromPoint:a,distanceMeters:null},bus]});
 assert.equal(missingMetrics.feasible,false,'Une marche sans distance prouvée ne doit pas être réalisable');
 const bus2={...bus,line:'2',from:'Arrêt B',to:'Arrêt C',fromPoint:b,toPoint:b,departure:when(40.5),arrival:when(55)};
 const shortTransfer=await checked({legs:[bus,bus2]});
 assert.equal(shortTransfer.feasible,false,'Correspondance même arrêt de 30 secondes insuffisante');
 assert.match(shortTransfer.statusDetail,/2 min minimum/);
 const longTransfer=await checked({legs:[bus,{...bus2,departure:when(45)}]});
 assert.equal(longTransfer.feasible,true,'Correspondance de cinq minutes au même arrêt permise');
 const noTransferGPS=await checked({legs:[{...bus,toPoint:null},{...bus2,fromPoint:null,departure:when(45)}]});
 assert.equal(noTransferGPS.feasible,false,'Deux arrêts portant le même nom ne prouvent pas leur proximité GPS');
 assert.match(noTransferGPS.statusDetail,/positions GPS de correspondance non vérifiées/);
 const failedWalk=await checked({legs:[bus],to:{...task,from:{lat:45.003,lon:5.003}},r:mock}.to,{
  route:async()=>({status:'calculated',durationSeconds:null,distanceMeters:250})});
 assert.equal(failedWalk.feasible,false,'Durée de marche absente : itinéraire non confirmé');
 assert.equal(await walkOnly({from:a,to:c,earliestDeparture:when(0)},{
  route:async()=>({status:'calculated',distanceMeters:200,durationSeconds:null})
 },3),null,'Marche gratuite sans durée ne peut pas être proposée');
 const cacheKey='45,5,45.001,5';
 const storage={getItem:()=>JSON.stringify({[cacheKey]:{t:Date.now(),d:120,m:160,g:null}}),setItem:()=>{}};
 const cache=cachedRouter({route:async()=>{throw Error('Cache non lu');}},{storage});
 const cached=await cache.route(a,c);
 assert.equal(cached.status,'calculated');
 assert.equal(cached.geometry,null,'Ne jamais dessiner un faux tracé piéton rectiligne depuis le cache');
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 assert.match(source,/l\.kind==='walk'\?\[\]:\[l\.fromPoint,l\.toPoint\]/,'Le SVG ne doit pas inventer de polyligne piétonne');
 console.log('10 contrôles piétons : raccordement GPS, correspondances, métriques, cache et SVG OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
