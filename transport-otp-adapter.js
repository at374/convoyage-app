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
function parse(response){
 const plan=response?.data?.plan??response?.plan;
 if(!plan||!Array.isArray(plan.itineraries))return [];
 return plan.itineraries.map(it=>{
  if(!it||!Array.isArray(it.legs)||!it.legs.length)return null;
  const legs=[];
  for(const raw of it.legs){
   if(!raw||typeof raw!=='object')return null;
   const mode=String(raw.mode||'').toUpperCase();
   if(FORBIDDEN.test(mode)||!MODE[mode])return null;
   const departure=time(raw.startTime),arrival=time(raw.endTime);
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
   legs.push({
    kind:walk?'walk':'transit',mode:MODE[mode],
    line:walk?null:String(raw.route?.shortName||raw.route?.longName||raw.routeShortName||'').trim()||null,
    provider:walk?null:String(raw.agency?.name||raw.route?.agency?.name||'OpenTripPlanner (GTFS)'),
    from:String(raw.from?.name||''),to:String(raw.to?.name||''),
    fromPoint,toPoint,departure,arrival,
    distanceMeters:Number.isFinite(raw.distance)&&raw.distance>=0?raw.distance:null,
    durationSeconds:Number.isFinite(raw.duration)&&raw.duration>=0?raw.duration:null,
    // Les géométries OTP doivent être décodées et validées par le moteur piéton existant.
    walkSource:null,geometry:null,realtime:false,delayMinutes:null,cancelled:false,
    fare:null,ticketUrl:null
   });
  }
  return {source:'OpenTripPlanner (GTFS)',sources:['OpenTripPlanner (GTFS)'],legs,
   alerts:[],realtime:false,dataDate:null};
 }).filter(Boolean);
}
const api={parse};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPOTPAdapter=api;
})(typeof window!=='undefined'?window:globalThis);
