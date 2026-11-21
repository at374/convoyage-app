/* Réseaux locaux des fiches mission : téléchargement, lecture du ZIP, indexation et recherche des trajets directs
   se font ICI, hors du fil de l'écran (l'application ne se fige plus pendant le calcul). Résultat identique au calcul
   sur le fil principal : mêmes fonctions (transport-gtfs-loader / -index / -fares). */
'use strict';
importScripts('transport-catalogue.js','transport-gtfs-index.js','transport-gtfs-time.js','transport-gtfs-federation.js','transport-gtfs-loader.js','transport-gtfs-fares.js','transport-national-gtfs-journeys.js');
const feeds=new Map();   // «id|date» -> promesse du flux (6 au maximum)
const cacheFetch=async(url,init)=>{
 if(!self.caches||!/\/data\/gtfs\/[^/?]+\.zip(\?|$)/.test(String(url)))return fetch(url,init);
 try{
  const c=await caches.open('cp-gtfs-zips'),hit=await c.match(url);
  if(hit){const at=Number(hit.headers.get('x-cp-saved'));if(Number.isFinite(at)&&Date.now()-at<12*3600*1000)return hit;}
  const resp=await fetch(url,init);
  if(resp&&resp.ok){try{const b=await resp.clone().arrayBuffer();await c.put(url,new Response(b,{status:200,headers:{'content-type':'application/zip','x-cp-saved':String(Date.now())}}));}catch(_){}}
  return resp;
 }catch(_){return fetch(url,init);}
};
function attachFares(feed,rows){
 const F=self.CPGTFSFares;
 if(!Array.isArray(rows)||!F||typeof F.prepare!=='function'||typeof F.legFare!=='function')return rows;
 if(feed.preparedFares===undefined){try{feed.preparedFares=F.prepare(feed.files);}catch(_){feed.preparedFares=null;}}
 if(!feed.preparedFares)return rows;
 const one=l=>{try{return F.legFare(feed.preparedFares,feed.index,l);}catch(_){return null;}};
 return rows.map(row=>!row?row:Array.isArray(row.legs)&&row.legs.length?{...row,legs:row.legs.map(l=>({...l,gtfsFare:l.gtfsFare||one(l)}))}:{...row,gtfsFare:row.gtfsFare||one(row)});
}
const feedFor=async(key,urls,date)=>{
 let p=feeds.get(key);
 if(!p){
  p=CPGTFSLoader.loadResource({format:'GTFS',url:urls[0],fallbackUrls:urls.slice(1)},{fetcher:cacheFetch,indexServiceDates:[date],retainSourceTables:false});
  feeds.set(key,p);p.catch(()=>feeds.delete(key));
  while(feeds.size>6)feeds.delete(feeds.keys().next().value);
 }
 return p;
};
// 21/11/2026 (Laurent : « l'écran se fige pendant la recherche ») : la recherche de correspondances (même
// réseau via nearbyTransferTrips, et entre réseaux via CPGTFSFederation.crossNetworkTrips) tournait sur le
// fil principal, dans local_correspondances (transport-mission-hub.js) — potentiellement jusqu'à 28 paires
// de réseaux, chacune examinant jusqu'à 100 000 combinaisons d'horaires. C'est le calcul le plus lourd de
// toute la recherche de transport, et il bloquait l'affichage/le défilement pendant qu'il tournait. Il est
// désormais fait ICI, hors du fil de l'écran, comme les trajets directs (local_<id>) le sont déjà.
const runCorrespondances=async data=>{
 const {nets,date,from,to,window,sameNetworkRadius,crossNetworkRadius,maxWaitMinutes}=data;
 const loaded=(await Promise.all(nets.map(async n=>{
  try{
   const feed=await feedFor(n.id+'|'+date,n.urls,date);
   // 21/11/2026 : datasetId doit être propagé dans source (CPGTFSFederation.crossNetworkTrips exige des
   // identifiants distincts par réseau), et networkUrls/serviceDate sont attachés à chaque trajet/correspondance
   // ci-dessous pour que le bouton « Tous les horaires » fonctionne aussi sur les résultats de correspondance (Y22).
   return {...feed,source:{...feed.source,network:n.name,datasetId:n.id},__urls:n.urls};
  }catch(_){return null;}
 }))).filter(Boolean);
 if(loaded.length<1)return [];
 const rows=[];
 for(let i=0;i<loaded.length;i++){
  try{
   const bounds=CPGTFSTime.serviceWindow(loaded[i].files,date,window);
   const t=CPGTFSIndex.nearbyTransferTrips(loaded[i].files,loaded[i].index,date,from,to,sameNetworkRadius,{...bounds,maxWaitMinutes});
   const dated=CPGTFSTime.datedTransferTrips(loaded[i].files,loaded[i].index,t.journeys,window);
   rows.push(...dated.map(x=>({...x,network:loaded[i].source.network,
    legs:x.legs?.map(l=>({...l,network:loaded[i].source.network,networkUrls:loaded[i].__urls,serviceDate:l.date||date}))})));
  }catch(_){}
  for(let j=i+1;j<loaded.length;j++){
   try{
    const c=CPGTFSFederation.crossNetworkTrips([loaded[i],loaded[j]],date,from,to,window,{radiusMeters:crossNetworkRadius,maxWaitMinutes});
    rows.push(...c.journeys.map(x=>({...x,legs:x.legs.map(l=>({...l,
     networkUrls:(l.networkId===loaded[j].source.datasetId?loaded[j].__urls:loaded[i].__urls),
     serviceDate:l.date||date}))})));
   }catch(_){}
  }
 }
 return rows;
};
// 21/11/2026 (Laurent : « ça bloque toujours ») : SNCF (TER/TGV), FlixBus et BlaBlaCar Bus (national_sncf,
// national_blablacarBus, national_flixbus dans transport-mission-hub.js) appelaient CPNationalGTFSJourneys.
// loadAndSearch() directement sur le fil principal — jusqu'à 4 recherches par mission (fenêtre normale,
// élargie à 5 km, nuit, ancrage) sur le plus gros flux de tous (SNCF national). Fait ICI désormais ; en cas
// d'échec du worker, ancien calcul sur le fil principal (même résultat).
const runNational=async data=>{
 const {operator,resource,searchOptions}=data;
 return self.CPNationalGTFSJourneys.loadAndSearch({operator,resource,fetcher:cacheFetch,...searchOptions});
};
self.onmessage=async({data})=>{
 const {id,op}=data||{};
 if(op==='correspondances'){
  try{self.postMessage({id,rows:await runCorrespondances(data)});}
  catch(e){self.postMessage({id,error:String(e&&e.message||e)});}
  return;
 }
 if(op==='national'){
  try{self.postMessage({id,result:await runNational(data)});}
  catch(e){self.postMessage({id,error:String(e&&e.message||e)});}
  return;
 }
 const {key,urls,date,from,to,radius,clock,arriveBy,directMeters}=data||{};
 try{
  const feed=await feedFor(key,urls,date);
  // Pré-sélection (même règle que le fil principal) : un seul passage par véhicule (le plus proche à pied), avant d'envoyer le résultat à l'écran.
  const sec=t=>{const a=String(t||'').split(':').map(Number);return a.length===3&&a.every(Number.isFinite)?a[0]*3600+a[1]*60+a[2]:NaN;};
  const all=CPGTFSIndex.nearbyDirectTrips(feed.files,feed.index,date,from,to,radius||3000),best=new Map();
  for(const x of all){
   if(!(arriveBy?sec(x.arrival)<=sec(clock):sec(x.departure)>=sec(clock)))continue;
   const k=String(x.tripId||'')+'|'+date,a=Number(x.accessDistanceMeters),e=Number(x.egressDistanceMeters);
   if(!k||!Number.isFinite(a)||!Number.isFinite(e))continue;
   const score=a+e,prev=best.get(k);
   if(directMeters>0&&score>=directMeters)continue;
   if(!prev||score<prev.score)best.set(k,{x,score});
  }
  const rows=attachFares(feed,[...best.values()].map(v=>v.x));
  self.postMessage({id,rows});
 }catch(e){self.postMessage({id,error:String(e&&e.message||e)});}
};
