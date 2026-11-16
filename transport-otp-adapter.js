/* Convoyage Ultra — adaptateur de réponse OpenTripPlanner 2.
 * Expérimental, sans appel réseau ni activation de fournisseur.
 * Les horaires GTFS ne constituent ni une réservation ni une preuve temps réel.
 */
(function(root){
'use strict';
const MODE={WALK:'Marche',BUS:'Bus',COACH:'Car',RAIL:'Train',TRAIN:'Train',TRAM:'Tram',SUBWAY:'Métro',METRO:'Métro',FUNICULAR:'Funiculaire'};
const FORBIDDEN=/^(FERRY|GONDOLA)$/;
function point(p){
 if(!p||p.lat==null||p.lat===''||(p.lon??p.lng)==null||(p.lon??p.lng)==='')return null;
 const lat=Number(p.lat),lon=Number(p.lon??p.lng);
 return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0)?{lat,lon}:null;
}
function time(v){
 if(typeof v==='number'&&Number.isFinite(v)){
  const d=new Date(v<1e11?v*1000:v);
  return Number.isFinite(d.getTime())?d.toISOString():null;
 }
 if(typeof v==='string'&&/(Z|[+-]\d{2}:\d{2})$/i.test(v)){
  const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null;
 }
 return null;
}
// Polyligne encodée (précision 5) fournie par OTP2 : tracé piéton calculé sur OpenStreetMap.
// Toute anomalie (caractère invalide, point hors bornes, moins de 2 points) → null, jamais de tracé inventé.
function decodePolyline(text){
 if(typeof text!=='string'||!text||text.length>200000)return null;
 const out=[];let i=0,lat=0,lon=0;
 while(i<text.length){
  for(const axis of [0,1]){
   let shift=0,result=0,b;
   do{
    if(i>=text.length)return null;
    b=text.charCodeAt(i++)-63;
    if(b<0||b>63)return null;
    result|=(b&31)<<shift;shift+=5;
   }while(b>=32&&shift<=30);
   if(b>=32)return null;
   const delta=result&1?~(result>>1):result>>1;
   if(axis===0)lat+=delta;else lon+=delta;
  }
  const p=point({lat:lat/1e5,lon:lon/1e5});
  if(!p)return null;
  out.push(p);
 }
 return out.length>=2?out:null;
}
function parse(response){
 const rootPlan=response?.data??response;
 const plan=rootPlan?.plan;
 const connection=rootPlan?.planConnection;
 const itineraries=Array.isArray(plan?.itineraries)?plan.itineraries:
  Array.isArray(connection?.edges)?connection.edges.map(edge=>edge?.node):null;
 if(!itineraries)return [];
 return itineraries.map(it=>{
  if(!it||!Array.isArray(it.legs)||!it.legs.length)return null;
  const legs=[];
  for(const raw of it.legs){
   if(!raw||typeof raw!=='object')return null;
   const mode=String(raw.mode||'').toUpperCase();
   if(FORBIDDEN.test(mode)||!MODE[mode])return null;
   // Compatible avec les deux formes de réponse uniquement si les champs sont présents.
   // Ne pas confondre heure planifiée et preuve de temps réel.
   const departure=time(raw.startTime??raw.start?.scheduledTime??raw.departure?.scheduledTime),
    arrival=time(raw.endTime??raw.end?.scheduledTime??raw.arrival?.scheduledTime);
   if(!departure||!arrival||Date.parse(arrival)<Date.parse(departure))return null;
   if(legs.length&&Date.parse(departure)<Date.parse(legs[legs.length-1].arrival))return null;
   const fromPoint=point(raw.from),toPoint=point(raw.to);
   if(!fromPoint||!toPoint)return null;
   // OTP ne doit pas relier deux segments distants sans marche de correspondance.
   if(legs.length){
    const prev=legs[legs.length-1].toPoint;
    const rad=Math.PI/180,dLat=(fromPoint.lat-prev.lat)*rad,dLon=(fromPoint.lon-prev.lon)*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(prev.lat*rad)*Math.cos(fromPoint.lat*rad)*Math.sin(dLon/2)**2;
    if(12742000*Math.asin(Math.min(1,Math.sqrt(h)))>150)return null;
   }
   const walk=mode==='WALK';
   // Une durée de marche n'est pas une preuve de cheminement routable ;
   // rejeter les distances absurdes plutôt que les afficher comme trajet piéton.
   if(walk&&(!Number.isFinite(raw.distance)||raw.distance<0||!Number.isFinite(raw.duration)||raw.duration<0))return null;
   // Tracé piéton OTP2 (OpenStreetMap) : accepté seulement si ses extrémités collent aux points du segment.
   let geometry=walk?decodePolyline(raw.legGeometry?.points):null;
   if(geometry){
    const near=(a,b)=>Math.abs(a.lat-b.lat)<0.003&&Math.abs(a.lon-b.lon)<0.004;
    if(!near(geometry[0],fromPoint)||!near(geometry[geometry.length-1],toPoint))geometry=null;
   }
   legs.push({
    kind:walk?'walk':'transit',mode:MODE[mode],
    line:walk?null:String(raw.route?.shortName||raw.route?.longName||raw.routeShortName||'').trim()||null,
    provider:walk?null:String(raw.agency?.name||raw.route?.agency?.name||'OpenTripPlanner (GTFS)'),
    from:String(raw.from?.name||''),to:String(raw.to?.name||''),
    fromPoint,toPoint,departure,arrival,
    distanceMeters:Number.isFinite(raw.distance)&&raw.distance>=0?raw.distance:null,
    durationSeconds:Number.isFinite(raw.duration)&&raw.duration>=0?raw.duration:null,
    // Sans tracé OTP valide, la marche reste à vérifier par le moteur piéton existant.
    walkSource:geometry?'provider':null,geometry,realtime:false,delayMinutes:null,cancelled:false,
    fare:null,ticketUrl:null
   });
  }
  return {source:'OpenTripPlanner (GTFS)',sources:['OpenTripPlanner (GTFS)'],legs,
   alerts:[],realtime:false,dataDate:null};
 }).filter(Boolean);
}
const api={parse,decodePolyline};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPOTPAdapter=api;
})(typeof window!=='undefined'?window:globalThis);
