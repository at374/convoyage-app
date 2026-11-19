/* Réseaux locaux des fiches mission : téléchargement, lecture du ZIP, indexation et recherche des trajets directs
   se font ICI, hors du fil de l'écran (l'application ne se fige plus pendant le calcul). Résultat identique au calcul
   sur le fil principal : mêmes fonctions (transport-gtfs-loader / -index / -fares). */
'use strict';
importScripts('transport-catalogue.js','transport-gtfs-index.js','transport-gtfs-loader.js','transport-gtfs-fares.js');
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
self.onmessage=async({data})=>{
 const {id,key,urls,date,from,to,radius,clock,arriveBy,directMeters}=data||{};
 try{
  let p=feeds.get(key);
  if(!p){
   p=CPGTFSLoader.loadResource({format:'GTFS',url:urls[0],fallbackUrls:urls.slice(1)},{fetcher:cacheFetch,indexServiceDates:[date],retainSourceTables:false});
   feeds.set(key,p);p.catch(()=>feeds.delete(key));
   while(feeds.size>6)feeds.delete(feeds.keys().next().value);
  }
  const feed=await p;
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
