/* Convoyage Ultra — client OJP 1.0 (opentransportdata.swiss) : lieux, trajets, prix OJP Fare.
 *
 * Règles (instructions du 15/11/2026) :
 *  - le type de référence d'un lieu est celui que renvoie OJPLocationInformationResponse, conservé tel quel :
 *    « StopPlaceRef » (gare ou arrêt) ou « StopPointRef » (point d'arrêt précis) ;
 *  - ce type n'est JAMAIS déduit de la forme de l'identifiant (nombre de segments d'un SLOID, longueur, etc.) ;
 *  - espaces de noms : siri:StopPointRef et ojp:StopPlaceRef ;
 *  - type absent ou ambigu : aucune référence n'est fabriquée (placeRefXml renvoie null → « Transport non confirmé ») ;
 *  - un prix OJP Fare n'est retenu que s'il couvre le trajet complet (toutes les portions en véhicule).
 * Le jeton d'API n'est jamais écrit ici ni journalisé : il est fourni à l'appel (serveur uniquement).
 */
(function(root){
'use strict';
const ENDPOINT='https://api.opentransportdata.swiss/ojp2020';
const FARE_ENDPOINT='https://api.opentransportdata.swiss/ojpfare';
const REF_TYPES=Object.freeze(['StopPlaceRef','StopPointRef']);
const UNCONFIRMED='Transport non confirmé';
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const unesc=v=>String(v).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
// Lecture XML minimale, indifférente au préfixe (ojp:, siri:, espace de noms par défaut).
const tagRe=(name,flags)=>new RegExp('<(?:[A-Za-z][\\w.-]*:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z][\\w.-]*:)?'+name+'>',flags||'');
const all=(xml,name)=>{const out=[],re=tagRe(name,'g');let m;while((m=re.exec(String(xml||''))))out.push(m[1]);return out;};
const first=(xml,name)=>{const m=tagRe(name).exec(String(xml||''));return m?m[1]:null;};
const text=(xml,name)=>{const v=first(xml,name);if(v==null)return null;const inner=first(v,'Text');return unesc((inner==null?v:inner).replace(/<[^>]*>/g,'').trim());};
// Une référence est une chaîne non vide, sans blanc ni caractère XML : on ne l'interprète pas davantage.
function validRef(ref){return typeof ref==='string'&&ref.length>0&&ref.length<=120&&!/[\s<>&"']/.test(ref);}
function header(now){return '<?xml version="1.0" encoding="UTF-8"?>\n<OJP xmlns="http://www.siri.org.uk/siri" xmlns:siri="http://www.siri.org.uk/siri" xmlns:ojp="http://www.vdv.de/ojp" version="1.0"><OJPRequest><ServiceRequest>'+
 '<RequestTimestamp>'+now+'</RequestTimestamp><RequestorRef>ConvoyageUltra</RequestorRef>';}
const FOOTER='</ServiceRequest></OJPRequest></OJP>';
const stamp=d=>new Date(d==null?Date.now():d).toISOString();
function locationRequest(name,opts={}){
 if(typeof name!=='string'||!name.trim())throw new Error('Nom de lieu manquant');
 const now=stamp(opts.now);
 return header(now)+'<ojp:OJPLocationInformationRequest><RequestTimestamp>'+now+'</RequestTimestamp>'+
  '<ojp:InitialInput><ojp:LocationName>'+esc(name.trim())+'</ojp:LocationName></ojp:InitialInput>'+
  '<ojp:Restrictions><ojp:Type>stop</ojp:Type><ojp:NumberOfResults>'+(Number.isInteger(opts.limit)?opts.limit:5)+'</ojp:NumberOfResults></ojp:Restrictions>'+
  '</ojp:OJPLocationInformationRequest>'+FOOTER;
}
// Lieux d'une OJPLocationInformationResponse. refType = nom exact de l'élément lu dans la réponse.
// Un lieu qui porte les deux types de référence, ou aucun, reste listé avec refType null et la raison.
function parseLocations(xml){
 const out=[];
 for(const result of all(xml,'Location')){
  // Le résultat englobant contient lui-même un élément Location : on ne traite que le niveau qui porte le lieu.
  const inner=first(result,'Location');const body=inner==null?result:inner;
  if(inner==null&&!/StopPlace|StopPoint/.test(body))continue;
  const place=first(body,'StopPlace'),point=first(body,'StopPoint');
  const placeRef=place==null?null:text(place,'StopPlaceRef'),pointRef=point==null?null:text(point,'StopPointRef');
  const name=text(place||'','StopPlaceName')||text(point||'','StopPointName')||text(body,'LocationName');
  const lat=Number(text(body,'Latitude')),lon=Number(text(body,'Longitude'));
  const base={name:name||null,lat:Number.isFinite(lat)?lat:null,lon:Number.isFinite(lon)?lon:null};
  if(placeRef&&pointRef)out.push({...base,refType:null,ref:null,reason:'référence ambiguë (StopPlaceRef et StopPointRef)'});
  else if(placeRef)out.push({...base,refType:'StopPlaceRef',ref:placeRef,reason:validRef(placeRef)?null:'référence invalide'});
  else if(pointRef)out.push({...base,refType:'StopPointRef',ref:pointRef,reason:validRef(pointRef)?null:'référence invalide'});
  else out.push({...base,refType:null,ref:null,reason:'type de référence absent'});
 }
 return out;
}
// Élément PlaceRef pour une demande de trajet. null si le type n'est pas l'un des deux types exacts ou si la
// référence est invalide : l'appelant affiche alors « Transport non confirmé ».
function placeRefXml(loc){
 if(!loc||!REF_TYPES.includes(loc.refType)||!validRef(loc.ref)||loc.reason)return null;
 const ref=loc.refType==='StopPointRef'?'<StopPointRef>'+esc(loc.ref)+'</StopPointRef>':'<ojp:StopPlaceRef>'+esc(loc.ref)+'</ojp:StopPlaceRef>';
 // « siri » est l'espace de noms par défaut du document : <StopPointRef> y est donc siri:StopPointRef.
 // (le préfixe siri: est aussi déclaré, pour les blocs recopiés d'une réponse)
 return '<ojp:PlaceRef>'+ref+'<ojp:LocationName><ojp:Text>'+esc(loc.name||loc.ref)+'</ojp:Text></ojp:LocationName></ojp:PlaceRef>';
}
function tripRequest(from,to,when,opts={}){
 const a=placeRefXml(from),b=placeRefXml(to);
 if(!a||!b)return null;
 if(!Number.isFinite(new Date(when==null?Date.now():when).getTime()))return null;
 const at=stamp(when);
 const now=stamp(opts.now);
 return header(now)+'<ojp:OJPTripRequest><RequestTimestamp>'+now+'</RequestTimestamp>'+
  '<ojp:Origin>'+a+'<ojp:DepArrTime>'+at+'</ojp:DepArrTime></ojp:Origin><ojp:Destination>'+b+'</ojp:Destination>'+
  '<ojp:Params><ojp:NumberOfResults>'+(Number.isInteger(opts.limit)?opts.limit:3)+'</ojp:NumberOfResults>'+
  '<ojp:IncludeTrackSections>false</ojp:IncludeTrackSections><ojp:IncludeIntermediateStops>true</ojp:IncludeIntermediateStops></ojp:Params>'+
  '</ojp:OJPTripRequest>'+FOOTER;
}
function parseTrips(xml){
 const trips=[];
 for(const result of all(xml,'TripResult')){
  const trip=first(result,'Trip');if(trip==null)continue;
  const legs=[];
  for(const leg of all(trip,'TripLeg')){
   const id=text(leg,'LegId'),timed=first(leg,'TimedLeg');
   if(timed==null){legs.push({id,kind:/TransferLeg/.test(leg)?'transfer':'continuous'});continue;}
   const board=first(timed,'LegBoard')||'',alight=first(timed,'LegAlight')||'',service=first(timed,'Service')||'';
   legs.push({id,kind:'timed',from:text(board,'StopPointName'),to:text(alight,'StopPointName'),
    fromRef:text(board,'StopPointRef'),toRef:text(alight,'StopPointRef'),
    departure:text(first(board,'ServiceDeparture')||'','TimetabledTime'),arrival:text(first(alight,'ServiceArrival')||'','TimetabledTime'),
    line:text(service,'PublishedLineName'),operatorRef:text(service,'OperatorRef'),operator:text(service,'OperatorName'),mode:text(first(service,'Mode')||'','PtMode')});
  }
  trips.push({id:text(result,'ResultId'),duration:text(trip,'Duration'),startTime:text(trip,'StartTime'),endTime:text(trip,'EndTime'),
   transfers:Number(text(trip,'Transfers')),legs,xml:trip});
 }
 return trips;
}
// Demande de prix pour un trajet renvoyé par OJP (le bloc <Trip> est recopié tel quel, sans retouche).
function fareRequest(trip,opts={}){
 if(!trip||typeof trip.xml!=='string'||!trip.xml.trim())return null;
 const now=stamp(opts.now);
 return header(now)+'<ojp:OJPFareRequest><RequestTimestamp>'+now+'</RequestTimestamp>'+
  '<ojp:TripFareRequest><ojp:Trip>'+trip.xml+'</ojp:Trip></ojp:TripFareRequest>'+
  '<ojp:Params><ojp:FareAuthorityFilter>ch:1:NOVA</ojp:FareAuthorityFilter><ojp:PassengerCategory>Adult</ojp:PassengerCategory>'+
  '<ojp:TravelClass>second</ojp:TravelClass><ojp:Traveller><ojp:Age>40</ojp:Age><ojp:PassengerCategory>Adult</ojp:PassengerCategory>'+
  (opts.halfFare?'<ojp:EntitlementProduct>HTA</ojp:EntitlementProduct>':'')+'</ojp:Traveller></ojp:Params></ojp:OJPFareRequest>'+FOOTER;
}
// Billets dégriffés (contingentés, liés à un train : essai réel du 15/11/2026, « Sparbillett ») et cartes journalières
// (à filtrer selon la documentation officielle) : jamais retenus comme prix du trajet.
const SPECIAL_PRODUCT=/spar|supersaver|d[ée]griff|tageskarte|carte journali|day ?pass/i;
// Prix plein tarif 2e classe couvrant TOUT le trajet, sinon null avec la raison (jamais de prix partiel affiché).
// opts.halfFare : la réponse provient d'une demande demi-tarif (abonnement demi-tarif) ; le prix est alors
// étiqueté « demi-tarif » et n'est jamais présenté comme le plein tarif.
function parseFare(xml,trip,opts={}){
 const timed=(trip&&Array.isArray(trip.legs)?trip.legs:[]).filter(l=>l.kind==='timed'&&l.id);
 if(!timed.length)return {price:null,reason:'trajet sans portion en véhicule identifiée'};
 const ids=(trip.legs||[]).map(l=>l.id),firstId=timed[0].id,lastId=timed[timed.length-1].id;
 const offers=[];
 for(const r of all(xml,'TripFareResult')){
  const fromId=text(r,'FromTripLegIdRef'),toId=text(r,'ToTripLegIdRef');
  for(const p of all(r,'FareProduct')){
   const amount=Number(text(p,'Price')),currency=text(p,'Currency'),cls=text(p,'TravelClass'),card=text(p,'RequiredCard');
   offers.push({fromId,toId,amount,currency,travelClass:cls,requiredCard:card||null,name:text(p,'FareProductName'),authority:text(p,'FareAuthorityRef')});
  }
 }
 if(!offers.length)return {price:null,reason:'aucun produit tarifaire dans la réponse',offers};
 const full=offers.filter(o=>Number.isFinite(o.amount)&&o.amount>0&&/^(CHF|EUR)$/.test(o.currency||'')&&
  o.fromId!=null&&o.toId!=null&&ids.indexOf(o.fromId)>=0&&ids.indexOf(o.fromId)<=ids.indexOf(firstId)&&ids.indexOf(o.toId)>=ids.indexOf(lastId)&&
  !o.requiredCard&&(!o.travelClass||/second|2/i.test(o.travelClass))&&!SPECIAL_PRODUCT.test(o.name||''));
 if(!full.length)return {price:null,reason:'aucun billet ordinaire plein tarif 2e classe ne couvre le trajet complet',offers};
 const best=full.reduce((a,b)=>b.amount<a.amount?b:a);
 return {price:{amount:best.amount,currency:best.currency,name:best.name,authority:best.authority,fromId:best.fromId,toId:best.toId,
  travelClass:'second',passenger:opts.halfFare?'adulte demi-tarif':'adulte plein tarif',indicative:true},reason:null,offers};
}
// Appel HTTP. Le jeton n'apparaît dans aucun message d'erreur.
async function post(url,body,token,fetcher){
 if(typeof token!=='string'||!token)throw new Error('Jeton OJP absent');
 const res=await (fetcher||root.fetch)(url,{method:'POST',headers:{'Content-Type':'application/xml','Authorization':'Bearer '+token},body});
 const xml=await res.text();
 if(!res.ok)throw new Error('OJP HTTP '+res.status+' : '+xml.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,200));
 return xml;
}
const api={ENDPOINT,FARE_ENDPOINT,REF_TYPES,UNCONFIRMED,validRef,locationRequest,parseLocations,placeRefXml,tripRequest,parseTrips,fareRequest,parseFare,post};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportOJP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
