/* Convoyage Ultra — assemblage sûr des correspondances bus locaux / TER.
 * Module pur, sans requête ni horaire inventé. À raccorder à la recherche des réseaux.
 */
(function(root){
'use strict';
const ms=x=>{const n=Date.parse(x);return Number.isFinite(n)?n:NaN;};
const point=x=>x&&Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lon??x.lng))?
 {lat:Number(x.lat),lon:Number(x.lon??x.lng)}:null;
function distance(a,b){
 const p=point(a),q=point(b);if(!p||!q)return Infinity;
 const rad=Math.PI/180,dLat=(q.lat-p.lat)*rad,dLon=(q.lon-p.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(p.lat*rad)*Math.cos(q.lat*rad)*Math.sin(dLon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
// Deux segments uniquement si même arrêt ou quais voisins (<=150 m), et marge >=5 min.
// Au-delà, une marche de correspondance réelle doit être calculée AVANT assemblage.
function combine(first,second,{minTransferMinutes=5,maxTransferMeters=150}={}){
 if(!Array.isArray(first?.legs)||!first.legs.length||!Array.isArray(second?.legs)||!second.legs.length)return null;
 if(first.legs.some(l=>!l||l.kind==='walk'&&!Number.isFinite(l.durationSeconds))||
    second.legs.some(l=>!l||l.kind==='walk'&&!Number.isFinite(l.durationSeconds)))return null;
 const a=first.legs[first.legs.length-1],b=second.legs[0];
 const end=ms(a.arrival),start=ms(b.departure);
 if(!Number.isFinite(end)||!Number.isFinite(start)||start-end<minTransferMinutes*60000)return null;
 if(distance(a.toPoint,b.fromPoint)>maxTransferMeters)return null;
 const legs=[...first.legs,...second.legs];
 for(let i=1;i<legs.length;i++)if(ms(legs[i].departure)<ms(legs[i-1].arrival))return null;
 return {source:'Correspondance locale + interurbaine',sources:[...new Set([...(first.sources||[first.source]),...(second.sources||[second.source])].filter(Boolean))],
  legs,missing:[...new Set([...(first.missing||[]),...(second.missing||[]),'correspondance locale programmée non confirmée en temps réel'])],
  realtime:false,alerts:[...(first.alerts||[]),...(second.alerts||[])].slice(0,10)};
}
const api={combine,distance};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportLocalConnections=api;
})(typeof window!=='undefined'?window:globalThis);
