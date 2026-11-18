/* Convoyage Ultra — Hub transports de mission.
 * Interroge automatiquement les sources GTFS, la Suisse (transport.opendata.ch), Mobilités M et le
 * secours SNCF, reçoit les horaires GTFS locaux, complète les marches réelles (Valhalla/OSM)
 * et produit UN classement par direction : moins cher, compromis, plus rapide.
 * Règles : aucun prix ni horaire inventé ; pas de vol d'oiseau présenté comme une marche ;
 * « Réalisable » seulement si horaires, marches et correspondances tiennent avec la marge.
 * Lecture seule : aucune écriture de mission, de réglage, d'authentification ou de synchro.
 */
(function(root){
'use strict';
const VERSION='hub-20261113';
const SWISS_BOX={minLat:45.80,maxLat:47.90,minLon:5.90,maxLon:10.60};
const GENEVA={lat:46.2044,lon:6.1432};
const LYON_COACH_ANCHORS=[{name:'Lyon Part-Dieu',lat:45.7605,lon:4.8590},{name:'Lyon Perrache',lat:45.7487,lon:4.8262},{name:'Lyon Gerland',lat:45.7290,lon:4.8300}];
const SAFE_TRANSFER_MIN=10,SAME_POINT_M=30,PROVIDER_JOIN_M=60,TRANSFER_BUFFER_S=120;

const finite=v=>typeof v==='number'&&Number.isFinite(v);
function pt(p){
 if(!p||typeof p!=='object')return null;
 const lat=Number(p.lat),lon=Number(p.lon??p.lng);
 if(p.lat===null||p.lat===''||(p.lon??p.lng)===null||(p.lon??p.lng)==='')return null;
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))return null;
 return {lat,lon};
}
function meters(a,b){
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
function ms(v){
 if(typeof v==='number')return Number.isFinite(v)&&v>0?(v<1e11?v*1000:v):NaN;
 if(typeof v!=='string'||!v.trim())return NaN;
 // transport.opendata.ch : 2026-11-13T07:12:00+0100 (sans deux-points dans le décalage)
 const fixed=v.replace(/([+-]\d{2})(\d{2})$/,'$1:$2');
 return /[zZ]|[+-]\d{2}:\d{2}$/.test(fixed)?Date.parse(fixed):NaN;
}
const iso=v=>{const t=ms(v);return Number.isFinite(t)?new Date(t).toISOString():null;};
const BOATS=/ferry|bateau|boat|ship|cgn|navette lacustre|^bat$|^ms$/i;

/* ---------- Normalisation par fournisseur ---------- */
function leg(o){
 return {kind:o.kind||'transit',mode:o.mode||'',line:o.line||null,provider:o.provider||null,
  from:o.from||'',to:o.to||'',fromPoint:pt(o.fromPoint),toPoint:pt(o.toPoint),
  departure:iso(o.departure),arrival:iso(o.arrival),
  distanceMeters:finite(o.distanceMeters)&&o.distanceMeters>=0?o.distanceMeters:null,
  durationSeconds:finite(o.durationSeconds)&&o.durationSeconds>=0?o.durationSeconds:null,
  walkSource:o.walkSource||null,geometry:Array.isArray(o.geometry)?o.geometry:null,
  steps:Array.isArray(o.steps)&&o.steps.length?o.steps:null,
  realtime:o.realtime===true,delayMinutes:finite(o.delayMinutes)?o.delayMinutes:null,
  cancelled:o.cancelled===true,fare:o.fare||null,ticketUrl:o.ticketUrl||null,...(finite(o.speedKmh)?{speedKmh:o.speedKmh}:{})};
}
function journey(source,legs,extra={}){
 const L=legs.filter(Boolean);
 return {source,sources:[source],legs:L,alerts:Array.isArray(extra.alerts)?extra.alerts.slice(0,10):[],
  realtime:extra.realtime===true,dataDate:extra.dataDate||null,raw:undefined};
}
function swissMode(category){
 const c=String(category||'').toUpperCase();
 if(!c||c==='WALK')return 'walk';
 if(/^(B|BUS|NFB|NFO|KB|EXB)$/.test(c))return 'Bus';
 if(/^(T|TRAM|NFT)$/.test(c))return 'Tram';
 if(/^(BAT|BAV|FAE|SCH)$/.test(c))return 'boat';
 if(/^(FUN|PB|GB|LB|SL)$/.test(c))return 'Funiculaire';
 return 'Train';
}
function fromSwiss(results){
 return (Array.isArray(results)?results:[]).map(r=>{
  const legs=(r.sections||[]).map(s=>{
   const mode=swissMode(s.mode);
   if(mode==='boat')return {boat:true};
   // Les sections « walk » de transport.opendata.ch n'ont souvent ni durée ni horaires fiables (marche initiale
   // ignorée dans l'heure de départ) : on les retire et la marche réelle est recalculée par Valhalla.
   if(mode==='walk')return null;
   return leg({mode,line:[s.category||s.mode,s.line].filter(Boolean).join(' ')||null,provider:s.operator||'Transports suisses',
    from:s.from,to:s.to,fromPoint:s.fromPoint,toPoint:s.toPoint,departure:s.departure,arrival:s.arrival,
    realtime:s.delay!=null,delayMinutes:finite(s.delay)?s.delay:null});
  });
  if(legs.some(l=>l&&l.boat))return null;
  return journey('Suisse (transport.opendata.ch)',legs,{realtime:legs.some(l=>l&&l.realtime)});
 }).filter(Boolean);
}
// Vocabulaire PtMode d'OJP (opentransportdata.swiss) : bateau écarté comme les sections « walk » de fromSwiss
// (le trajet entier est retiré s'il comporte une portion bateau, jamais affiché partiellement).
function ojpMode(m){
 const c=String(m||'').toLowerCase();
 if(/water|ferry|boat|ship/.test(c))return 'boat';
 if(/rail|train/.test(c))return 'Train';
 if(/tram/.test(c))return 'Tram';
 if(/metro|underground|subway/.test(c))return 'Métro';
 if(/coach/.test(c))return 'Car';
 if(/bus/.test(c))return 'Bus';
 if(/funicular|cableway|gondola|telecabin/.test(c))return 'Funiculaire';
 return 'Transport';
}
// entries = [{trip, price}] (trip : transport-ojp.js::parseTrips ; price : transport-ojp.js::parseFare().price ou null).
// Seules les portions « timed » (en véhicule) sont conservées — les « transfer »/« continuous » (correspondances à
// pied) sont retirées, comme fromSwiss retire ses sections « walk » : la marche réelle est recalculée par
// completeWalks(), qui dégrade déjà sûrement (aucune marche à vol d'oiseau) quand les positions GPS intermédiaires
// manquent — or OJP ne fournit aucune coordonnée pour ses arrêts de correspondance (constaté sur une réponse réelle).
// Seules les positions d'origine/destination de la mission (connues, vérifiées) sont donc posées, sur la première et
// la dernière portion ; les correspondances intermédiaires restent sans position, et basculent honnêtement
// en « Transport non confirmé » via le pipeline existant plutôt que d'être fabriquées.
// Tarif : OJP Fare donne un prix unique pour tout le trajet (jamais par portion). Pour l'intégrer sans contourner
// priceOf() (son mécanisme de « titre combiné » suppose des tarifs par réseau déjà vérifiés séparément, absents
// ici), on pose 0 sur chaque portion sauf la dernière, qui porte le prix total — la somme reste exacte et chaque
// portion est « vérifiée » au sens de priceOf(), sans sur-compter ni inventer de répartition par portion.
function fromOJP(entries,{origin,destination}={}){
 return (Array.isArray(entries)?entries:[]).map(({trip,price}={})=>{
  if(!trip)return null;
  const timed=(trip.legs||[]).filter(l=>l&&l.kind==='timed');
  if(!timed.length)return null;
  if(timed.some(l=>ojpMode(l.mode)==='boat'))return null;
  const network='ojp:'+(trip.id||Math.random().toString(36).slice(2));
  const verified=price&&finite(price.amount)&&price.amount>=0&&/^(EUR|CHF)$/.test(price.currency||'');
  const legs=timed.map((l,i)=>{
   const isLast=i===timed.length-1;
   const fare=!verified?null:isLast?
    {amount:price.amount,currency:price.currency,network,
     source:'OJP Fare ('+(price.name||price.authority||'tarif officiel')+')'+(price.passenger?' — '+price.passenger:'')}:
    {amount:0,currency:price.currency,network,source:'Couvert par le billet OJP du trajet'};
   // Opérateur manquant côté OJP (fréquent pour les trajets purement suisses) : CFF par défaut, pour que
   // ticketLink() propose le bon lien d'achat plutôt que le repli Oùra (portail régional français).
   return leg({mode:ojpMode(l.mode),line:l.line||null,provider:l.operator||'CFF',from:l.from,to:l.to,
    fromPoint:i===0?origin:null,toPoint:isLast?destination:null,
    departure:l.departure,arrival:l.arrival,fare});
  });
  return journey('OJP Suisse (opentransportdata.swiss)',legs,{});
 }).filter(Boolean);
}
function tripgoMode(m){return m==='wa_wal'?'walk':/train|rail/.test(m)?'Train':/tram|lrt/.test(m)?'Tram':/metro|subway/.test(m)?'Métro':/coach/.test(m)?'Car':/bus/.test(m)?'Bus':'Transport';}
function fromTripGo(answer){
 return (answer&&Array.isArray(answer.itineraries)?answer.itineraries:[]).map(it=>{
  const legs=[];
  for(const l of it.legs||[]){
   if(/^stationary_/.test(l.mode))continue;
   const mode=/flixbus|blablacar|eurolines|ouibus/i.test((l.line||'')+' '+(l.provider||''))?'Car':tripgoMode(l.modeInfo||l.mode);
   if(mode==='walk')legs.push(leg({kind:'walk',mode:'Marche',from:l.from,to:l.to,fromPoint:l.fromPoint,toPoint:l.toPoint,
    departure:l.departure,arrival:l.arrival,distanceMeters:l.distanceMeters,
    durationSeconds:(ms(l.arrival)-ms(l.departure))/1000,walkSource:'provider'}));
   else legs.push(leg({mode,line:l.line||l.serviceShortName,provider:l.provider||'TripGo',from:l.from,to:l.to,
    fromPoint:l.fromPoint,toPoint:l.toPoint,departure:l.departure,arrival:l.arrival,realtime:l.realtimeReported,ticketUrl:l.ticketWebsiteURL,
    // Billet transmis par TripGo pour cette portion (jamais le coût global estimé « moneyCost »).
    fare:l.ticket?{amount:l.ticket.amount,currency:l.ticket.currency,source:'Prix transmis par TripGo'+(l.ticket.name?' ('+l.ticket.name+')':'')+' pour '+(l.provider||'l’opérateur')}:null}));
  }
  return journey('TripGo',legs,{alerts:it.alerts,realtime:it.evidence?.realtimeReported===true});
 });
}
function fromRegional(itineraries,source='Mobilités M'){
 const map={WALK:'walk',BUS:'Bus',TRAM:'Tram',SUBWAY:'Métro',RAIL:'Train'};
 return (Array.isArray(itineraries)?itineraries:[]).map(it=>journey(source,(it.legs||[]).map(l=>{
  const mode=map[l.mode]||'Transport';
  return mode==='walk'?leg({kind:'walk',mode:'Marche',from:l.from,to:l.to,fromPoint:l.fromPoint,toPoint:l.toPoint,
    departure:l.startTime,arrival:l.endTime,distanceMeters:l.distanceMeters,durationSeconds:(l.endTime-l.startTime)/1000,walkSource:'provider',geometry:l.geometry}):
   leg({mode,line:l.route||null,provider:l.agency||source,from:l.from,to:l.to,fromPoint:l.fromPoint,toPoint:l.toPoint,departure:l.startTime,arrival:l.endTime});
 })));
}
function fromSNCF(answer){
 return (answer&&Array.isArray(answer.itineraries)?answer.itineraries:[]).map(it=>journey('SNCF (GTFS officiel)',(it.legs||[]).map(l=>leg({
  mode:/car|bus/i.test(l.line||'')?'Car':'Train',line:[l.line,l.trainNumber].filter(Boolean).join(' '),provider:'SNCF',
  from:l.from,to:l.to,fromPoint:l.fromPoint,toPoint:l.toPoint,departure:l.departure,arrival:l.arrival})),{dataDate:answer.sourceVersion||null}));
}
// Tarif publié dans le flux GTFS lui-même (fare_attributes / fare_rules), attaché à chaque portion comme le fait
// transport-gtfs-worker.js. Sans cela, les fournisseurs GTFS des fiches mission (hors worker) perdaient ce prix
// officiel : constaté en réel le 14/11/2026 sur Lyon Part-Dieu → Bellecour (70 trajets TCL, 0 tarifé).
function attachGTFSFares(feed,rows,F=root.CPGTFSFares){
 if(!Array.isArray(rows)||!feed||!feed.index||!F||typeof F.prepare!=='function'||typeof F.legFare!=='function')return rows;
 if(feed.preparedFares===undefined){try{feed.preparedFares=F.prepare(feed.files);}catch(_){feed.preparedFares=null;}}
 if(!feed.preparedFares)return rows;
 const one=l=>{try{return F.legFare(feed.preparedFares,feed.index,l);}catch(_){return null;}};
 return rows.map(row=>!row?row:Array.isArray(row.legs)&&row.legs.length?{...row,legs:row.legs.map(l=>({...l,gtfsFare:l.gtfsFare||one(l)}))}:
  {...row,gtfsFare:row.gtfsFare||one(row)});
}
// Consignes de réservation d'un transport à la demande selon le réseau (sources : fiches horaires et sites des réseaux, 18/11/2026).
function bookingNote(nets){
 const n=String(nets||'');
 if(/ginko/i.test(n))return '📞 transport à la demande Ginko : à réserver jusqu’à la veille avant 18 h, sur ginko.voyage ou au 03 70 27 71 60 (lundi–samedi 7 h–19 h) ; pas de réservation le dimanche et les jours fériés pour le lendemain';
 if(/divia/i.test(n))return '📞 transport à la demande Divia : compte à créer au préalable (appli « Divia à la demande », divia.fr ou 03 80 11 29 29, lundi–samedi 7 h–19 h) ; délai exact de réservation à confirmer auprès de Divia';
 if(/mobigo/i.test(n))return '📞 transport à la demande Mobigo : à réserver à l’avance, au plus tard la veille ; renseignements et réservation au 03 80 11 29 29 ; délai et numéro exacts sur la fiche horaire de la ligne';
 if(/haute[- ]savoie|y9[234]/i.test(n))return '📞 transport à la demande : à réserver 24 h à l’avance (la veille avant 16 h ; le vendredi avant 16 h pour un lundi) au 04 8000 7000';
 return '📞 transport à la demande : à réserver à l’avance (numéro et délai sur la fiche horaire de la ligne, repérer le petit téléphone)';
}
function fromGTFS(rows,network='Réseau local'){
 // A single GTFS vehicle trip may appear through dozens of nearby boarding/alighting
 // stop pairs. Keep the shortest straight-line access + egress candidate per trip
 // before requesting expensive pedestrian routing. Transfer itineraries are left
 // untouched: their distinct interchange choices must be evaluated separately.
 const selected=[],bestDirect=new Map();
 for(const r of Array.isArray(rows)?rows:[]){
  if(!r)continue;
  const isDirect=!Array.isArray(r.legs)||r.legs.length===0;
  const tripId=r.tripId||r.trip_id;
  const access=Number(r.accessDistanceMeters??r.originStop?.distanceMeters);
  const egress=Number(r.egressDistanceMeters??r.destinationStop?.distanceMeters);
  if(!isDirect||!tripId||!Number.isFinite(access)||!Number.isFinite(egress)||
   access<0||egress<0){selected.push(r);continue;}
  const key=String(r.network||network)+'|'+String(tripId)+'|'+String(r.date||'');
  const score=access+egress;
  const previous=bestDirect.get(key);
  if(!previous||score<previous.score)bestDirect.set(key,{r,score});
 }
 selected.push(...[...bestDirect.values()].map(x=>x.r));
 return selected.map(r=>{
  const raw=Array.isArray(r.legs)&&r.legs.length?r.legs:[{line:r.line,network:r.network,from:r.originStop?.name||r.from,to:r.destinationStop?.name||r.to,departure:r.departure,arrival:r.arrival}];
  const legs=raw.map((l,i)=>{
   const start=i===0?r.originStop:(r.legs?.length===2?(r.interNetwork?r.transferDestinationStop:r.transferStop):null);
   const end=i===raw.length-1?r.destinationStop:(r.transferStop||null);
   const out=leg({mode:'Bus',line:l.line||r.line,provider:l.network||r.network||network,from:start?.name||l.from,to:end?.name||l.to,
    fromPoint:start,toPoint:end,departure:l.departure,arrival:l.arrival});
   // Ligne GTFS brute conservée pour les grilles tarifaires officielles (ex. Y51 : zones par arrêt).
   out.gtfsRaw=Array.isArray(r.legs)&&r.legs.length?l:r;
   // Tarif publié par l'autorité dans le flux GTFS lui-même (fare_attributes / fare_rules).
   const g=out.gtfsRaw&&out.gtfsRaw.gtfsFare;
   if(g&&finite(g.amount)&&g.amount>=0&&/^(EUR|CHF)$/.test(g.currency)){
    const net=out.provider||network;
    out.fare={amount:g.amount,currency:g.currency,network:'gtfs:'+net,
     validityMinutes:g.transfers===0?null:(finite(g.transferMinutes)?g.transferMinutes:null),
     source:net+' · tarif publié dans le GTFS officiel (fare_id '+g.fareId+(g.originZone||g.destinationZone?', zones '+(g.originZone||'?')+' → '+(g.destinationZone||'?'):'')+')'};
   }
   return out;
  });
  return {...journey((r.network||network)+' (GTFS)'+(r.onDemand?' · à la demande 📞':''),legs),
   // Static GTFS proves a scheduled service, not its live operation.
   // Never label the itinerary as confirmed until a live source validates it.
   missing:['horaire GTFS local non confirmé en temps réel',
    ...(r.onDemand?[bookingNote([r.network,network,...(r.legs||[]).filter(l=>l&&l.onDemand).map(l=>l.network)].filter(Boolean).join(' '))]:[]),
    ...(r.searchTruncated?['recherche des correspondances incomplète']:[])]};
 });
}

/* National GTFS provides scheduled candidates, not live service or ticket inventory.
 * GTFS service day is Europe/Paris, including 24+:xx overnight times. */
function fromNationalGTFS(rows,operator){
 const names={sncf:'SNCF',blablacarBus:'BlaBlaCar Bus',flixbus:'FlixBus'};
 if(!Object.prototype.hasOwnProperty.call(names,operator))return [];
 const localTime=(date,time)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(time||''))return null;
  const [h,m,s=0]=time.split(':').map(Number),day=Date.parse(date+'T00:00:00Z');
  if(!Number.isFinite(day))return null;
  const wall=day+(h*3600+m*60+s)*1000;
  // Resolve the UTC offset from the intended service day. Do not iterate over
  // formatted wall-clock dates: a midnight representation can drift by days.
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',
   timeZoneName:'shortOffset'}).formatToParts(new Date(wall));
  const zone=parts.find(p=>p.type==='timeZoneName')?.value||'';
  const match=/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
  if(!match)return null;
  const offset=(match[1]==='+'?1:-1)*(Number(match[2])*60+Number(match[3]||0));
  return new Date(wall-offset*60000).toISOString();
 };
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&r.operator===operator&&
  (!Array.isArray(r.legs)||(r.legs.length===2&&r.transferStop&&
   r.legs.every(l=>l&&l.departure&&l.arrival)))).map(r=>{
  const a=r.originStop,b=r.destinationStop;
  const point=s=>({lat:s?.lat??s?.stop_lat,lon:s?.lon??s?.stop_lon});
  const makeLeg=(from,to,line,departure,arrival)=>leg({mode:operator==='sncf'?'Train':'Car',
   provider:names[operator],line,from:from?.name||from?.stop_name||'',
   to:to?.name||to?.stop_name||'',fromPoint:point(from),toPoint:point(to),
   departure:localTime(r.date,departure),arrival:localTime(r.date,arrival)});
  const transit=Array.isArray(r.legs)&&r.legs.length===2&&r.transferStop?
   [makeLeg(a,r.transferStop,r.legs[0].line,r.legs[0].departure,r.legs[0].arrival),
    makeLeg(r.transferStop,b,r.legs[1].line,r.legs[1].departure,r.legs[1].arrival)]:
   [makeLeg(a,b,r.line,r.departure,r.arrival)];
  return {...journey(names[operator]+' (GTFS)',transit),
   missing:['horaire GTFS non confirmé en temps réel','prix commercial et disponibilité non vérifiés',
    // Correspondance au même arrêt d'après l'horaire officiel : avec au moins 10 min de battement programmé, c'est
    // une réserve « à confirmer le jour J » (comme l'horaire lui-même) ; en dessous, elle reste bloquante.
    ...(transit.length>1?[(ms(transit[1].departure)-ms(transit[0].arrival))/60000>=SAFE_TRANSFER_MIN?
     'correspondance programmée non confirmée en temps réel':'correspondance GTFS non confirmée']:[]),
    ...(r.searchTruncated?['recherche des correspondances incomplète']:[])]};
 }).filter(j=>j.legs.length>0&&j.legs.every((l,i)=>{
  const departure=ms(l.departure),arrival=ms(l.arrival);
  return Number.isFinite(departure)&&Number.isFinite(arrival)&&arrival>=departure&&
   (i===0||departure>=ms(j.legs[i-1].arrival));
 }));
}

/* ---------- Marches ---------- */
// Noms génériques des moteurs (« Point d'arrivée », « Origin »…) remplacés par l'adresse exacte de la mission.
const GENERIC_END=/^(?:point d[’']arrivée|point de départ|origin|destination|adresse d[’']arrivée|adresse de départ|départ|arrivée)$/i;
function renameEnds(j,task){
 if(!j||!Array.isArray(j.legs)||!j.legs.length||!task)return j;
 const legs=j.legs.slice();let changed=false;
 const a=legs[0],b=legs[legs.length-1];
 if(task.fromName&&a&&GENERIC_END.test(String(a.from||'').trim())){legs[0]={...a,from:task.fromName};changed=true;}
 const z=legs[legs.length-1];
 if(task.toName&&z&&GENERIC_END.test(String(z.to||'').trim())){legs[legs.length-1]={...z,to:task.toName};changed=true;}
 return changed?{...j,legs}:j;
}
function isFoot(l){return !!l&&(l.kind==='walk'||l.kind==='scooter');}
function walkLeg(route,from,to,fromName,toName,depMs){
 return leg({kind:'walk',mode:'Marche',from:fromName,to:toName,fromPoint:from,toPoint:to,
  departure:new Date(depMs).toISOString(),arrival:new Date(depMs+route.durationSeconds*1000).toISOString(),
  distanceMeters:route.distanceMeters,durationSeconds:route.durationSeconds,walkSource:'valhalla',geometry:route.geometry,steps:route.steps});
}
async function completeWalks(j,task,router,scooter){
 // Keep provider warnings (e.g. GTFS schedules without live confirmation) through walking enrichment.
 const legs=j.legs.slice(),missing=Array.isArray(j.missing)?j.missing.slice():[];
 const from=pt(task.from),to=pt(task.to);
 const transit=legs.filter(l=>l.kind!=='walk');
 if(!transit.length)return {...j,legs,missing:['aucun transport public dans la proposition']};
 const call=async(a,b)=>{
  if(!router||!a||!b)return null;
  try{const r=await router.route(a,b);return r&&r.status==='calculated'&&
   finite(r.durationSeconds)&&r.durationSeconds>=0&&finite(r.distanceMeters)&&r.distanceMeters>=0?r:null;}catch(_){return null;}
 };
 // Marche entre deux points ; si elle dépasse la limite de marche et que la trottinette est activée (et sous sa distance maximale),
 // elle est remplacée par un trajet en trottinette (tracé vélo OpenStreetMap, durée estimée à la vitesse réglée).
 const footLeg=async(a,b,fromName,toName,{startMs,endMs})=>{
  const r=await call(a,b);if(!r)return null;
  const walkMax=Number.isFinite(task.walkMaxMeters)?task.walkMaxMeters:null;
  if(walkMax!==null&&r.distanceMeters>walkMax&&scooter&&scooter.enabled&&scooter.router){
   let sr=null;try{sr=await scooter.router.route(a,b);}catch(_){}
   const limit=(finite(scooter.maxKm)&&scooter.maxKm>0?scooter.maxKm:8)*1000,speed=finite(scooter.speedKmh)&&scooter.speedKmh>0?Math.min(30,Math.max(5,scooter.speedKmh)):15;
   if(sr&&sr.status==='calculated'&&finite(sr.distanceMeters)&&sr.distanceMeters>=0&&sr.distanceMeters<=limit){
    const seconds=Math.max(60,Math.round(sr.distanceMeters/(speed/3.6)));
    const start=Number.isFinite(startMs)?startMs:endMs-seconds*1000;
    return leg({kind:'scooter',mode:'Trottinette',from:fromName,to:toName,fromPoint:a,toPoint:b,
     departure:new Date(start).toISOString(),arrival:new Date(start+seconds*1000).toISOString(),distanceMeters:sr.distanceMeters,durationSeconds:seconds,
     walkSource:'valhalla-bicycle',geometry:sr.geometry,steps:sr.steps,speedKmh:speed});
   }
  }
  const start=Number.isFinite(startMs)?startMs:endMs-r.durationSeconds*1000;
  return walkLeg(r,a,b,fromName,toName,start);
 };
 // Ne jamais qualifier de « réalisable » une marche moteur sans durée, distance ou horaires cohérents.
 for(const l of legs)if(l.kind==='walk'&&(!finite(l.durationSeconds)||!finite(l.distanceMeters)||
  !Number.isFinite(ms(l.departure))||!Number.isFinite(ms(l.arrival))))
  missing.push('marche fournisseur sans durée, distance ou horaires vérifiables');
 // Approche : l'adresse GPS doit être reliée au début exact de la première portion.
 const first=legs[0];
 if(!from)missing.push('point GPS de départ inconnu');
 else if(!first.fromPoint)missing.push('position du début de la marche ou de l’arrêt inconnue');
 else if(meters(from,first.fromPoint)>SAME_POINT_M){
  const dep=ms(first.departure);
  const w=Number.isFinite(dep)?await footLeg(from,first.fromPoint,task.fromName||'Adresse de départ',first.from,{endMs:dep}):null;
  if(w)legs.unshift(w);
  else missing.push('marche depuis l’adresse exacte de départ non calculée');
 }
 // Correspondances entre deux véhicules sans marche fournie.
 for(let i=1;i<legs.length;i++){
  const a=legs[i-1],b=legs[i];
  if(isFoot(a)||isFoot(b))continue;
  const gap=(ms(b.departure)-ms(a.arrival))/1000;
  if(a.toPoint&&b.fromPoint){
   if(meters(a.toPoint,b.fromPoint)<=SAME_POINT_M){
    if(gap<TRANSFER_BUFFER_S)missing.push('correspondance trop courte à '+(a.to||'l’arrêt')+' (2 min minimum)');
    continue;
   }
   const w=await footLeg(a.toPoint,b.fromPoint,a.to,b.from,{startMs:ms(a.arrival)});
   if(!w){missing.push('marche de correspondance à '+(a.to||'l’arrêt')+' non calculée');continue;}
   if(w.durationSeconds+TRANSFER_BUFFER_S>gap)missing.push('correspondance trop courte à '+(a.to||'l’arrêt')+' ('+Math.ceil(w.durationSeconds/60)+' min de '+(w.kind==='scooter'?'trottinette':'marche')+')');
   legs.splice(i,0,w);i++;
  }else missing.push('positions GPS de correspondance non vérifiées : '+(a.to||'?')+' → '+(b.from||'?'));
 }
 // Dernière marche : dernier point de la proposition vers l'adresse exacte d'arrivée.
 const last=legs[legs.length-1];
 if(!to)missing.push('point GPS d’arrivée inconnu');
 else if(!last.toPoint)missing.push('position de la fin de la marche ou de l’arrêt inconnue');
 else if(meters(last.toPoint,to)>SAME_POINT_M){
  const arr=ms(last.arrival);
  const w=Number.isFinite(arr)?await footLeg(last.toPoint,to,last.to,task.toName||'Adresse d’arrivée',{startMs:arr}):null;
  if(w)legs.push(w);
  else missing.push('marche jusqu’à l’adresse exacte d’arrivée non calculée');
 }
 return renameEnds({...j,legs,missing},task);
}
// Cache des marches : partagé entre moteurs, directions et fiches (stockage local du téléphone, 30 jours).
// Clés arrondies au 1/10 000 de degré (≈ 10 m) : deux arrêts « identiques » vus par deux moteurs partagent la marche.
function cachedRouter(router,{storage=null,key='cp_marches_v1',ttlDays=30,maxEntries=400}={}){
 if(!router||typeof router.route!=='function')return router;
 const round=p=>({lat:Math.round(p.lat*1e4)/1e4,lon:Math.round(p.lon*1e4)/1e4});
 const id=(a,b)=>[round(a).lat,round(a).lon,round(b).lat,round(b).lon].join(',');
 let saved={};try{saved=JSON.parse(storage?.getItem(key)||'{}')||{};}catch(_){saved={};}
 const now=Date.now(),ttl=ttlDays*86400000;
 for(const k of Object.keys(saved))if(!(saved[k]&&now-saved[k].t<ttl))delete saved[k];
 const memory=new Map();let hits=0,misses=0;
 const persist=()=>{try{const keys=Object.keys(saved);if(keys.length>maxEntries){keys.sort((x,y)=>saved[x].t-saved[y].t).slice(0,keys.length-maxEntries).forEach(k=>delete saved[k]);}
  storage?.setItem(key,JSON.stringify(saved));}catch(_){}};
 function route(a,b){
  if(!pt(a)||!pt(b))return router.route(a,b);
  const k=id(a,b);
  if(memory.has(k)){hits++;return memory.get(k);}
  const s=saved[k];
  if(s){hits++;const r=Promise.resolve({status:'calculated',provider:(router.mode==='bicycle'?'Valhalla vélo':'Valhalla pedestrian')+' / OpenStreetMap (cache)',durationSeconds:s.d,distanceMeters:s.m,
   geometry:s.g||null,steps:s.s||null,from:{...a},to:{...b},endpointsMatched:true,cached:true});memory.set(k,r);return r;}
  misses++;
  const r=Promise.resolve(router.route(round(a),round(b))).then(x=>{
   if(x&&x.status==='calculated'){
    // géométrie allégée (≤ 40 points) pour le stockage
    const g=Array.isArray(x.geometry)?x.geometry.filter((_,i,arr)=>i%Math.max(1,Math.ceil(arr.length/40))===0||i===arr.length-1).map(round):null;
    saved[k]={t:Date.now(),d:x.durationSeconds,m:x.distanceMeters,g,s:Array.isArray(x.steps)?x.steps.slice(0,25):undefined};persist();
   }else memory.delete(k); // échec : on pourra réessayer plus tard
   return x;
  });
  memory.set(k,r);return r;
 }
 return {route,stats:()=>({hits,misses,stored:Object.keys(saved).length,...(router.stats?router.stats():{})}),dispose:()=>router.dispose?.()};
}
async function walkOnly(task,router,maxKm){
 const from=pt(task.from),to=pt(task.to),limit=(finite(maxKm)&&maxKm>0?maxKm:3)*1000;
 if(!from||!to||!router)return null;
 if(meters(from,to)>limit)return null; // la marche réelle est toujours au moins aussi longue
 let r=null;try{r=await router.route(from,to);}catch(_){}
 if(!r||r.status!=='calculated'||!finite(r.distanceMeters)||!finite(r.durationSeconds)||r.distanceMeters<0||r.durationSeconds<0||r.distanceMeters>limit)return null;
 const margin=marginFor(task);
 const deadline=ms(task.latestArrival),earliest=ms(task.earliestDeparture);
 // Avec deux bornes (jonction), partir le plus tard possible tout en arrivant
 // avant la marge : partir à earliest peut afficher une marche inutilement tôt.
 const latestWalkDeparture=Number.isFinite(deadline)?deadline-margin*60000-r.durationSeconds*1000:NaN;
 const dep=Number.isFinite(latestWalkDeparture)?latestWalkDeparture:earliest;
 if(!Number.isFinite(dep)||Number.isFinite(earliest)&&dep<earliest)return null;
 const j=journey('Marche (Valhalla / OpenStreetMap)',[walkLeg(r,from,to,task.fromName||'Départ',task.toName||'Arrivée',dep)]);
 return {...j,walkOnly:true,missing:[]};
}

// Trajet en trottinette électrique personnelle (réglages : vitesse et distance maximale). Le tracé vient du service
// d'itinéraires OpenStreetMap (Valhalla, mode vélo : pistes cyclables et rues autorisées) ; la durée est une ESTIMATION
// calculée à la vitesse réglée par le convoyeur, jamais un horaire confirmé. Gratuit (matériel personnel).
async function scooterOnly(task,router,{maxKm=8,speedKmh=15}={}){
 const from=pt(task.from),to=pt(task.to),limit=(finite(maxKm)&&maxKm>0?maxKm:8)*1000,speed=(finite(speedKmh)&&speedKmh>0?Math.min(30,Math.max(5,speedKmh)):15);
 if(!from||!to||!router)return null;
 if(meters(from,to)>limit)return null;
 let r=null;try{r=await router.route(from,to);}catch(_){}
 if(!r||r.status!=='calculated'||!finite(r.distanceMeters)||r.distanceMeters<0||r.distanceMeters>limit)return null;
 const seconds=Math.max(60,Math.round(r.distanceMeters/(speed/3.6)));
 const margin=marginFor(task),deadline=ms(task.latestArrival),earliest=ms(task.earliestDeparture);
 const latest=Number.isFinite(deadline)?deadline-margin*60000-seconds*1000:NaN;
 const dep=Number.isFinite(latest)?latest:earliest;
 if(!Number.isFinite(dep)||Number.isFinite(earliest)&&dep<earliest)return null;
 const l=leg({kind:'scooter',mode:'Trottinette',from:task.fromName||'Départ',to:task.toName||'Arrivée',fromPoint:from,toPoint:to,
  departure:new Date(dep).toISOString(),arrival:new Date(dep+seconds*1000).toISOString(),distanceMeters:r.distanceMeters,durationSeconds:seconds,
  walkSource:'valhalla-bicycle',geometry:r.geometry,steps:r.steps});
 const j=journey('Trottinette (Valhalla vélo / OpenStreetMap)',[l]);
 return {...j,scooterOnly:true,scooterSpeedKmh:speed,missing:[]};
}

/* ---------- Tarifs ---------- */
function priceOf(j,fareFor){
 // Une marche issue d'un fournisseur tiers peut ne pas avoir le drapeau walkOnly.
 // La tarification doit rester gratuite si toutes les étapes sont piétonnes.
 if(j.scooterOnly)return {status:'free',amounts:{EUR:0},label:'Gratuit (trottinette personnelle)',missingSources:[]};
 if(j.walkOnly||j.legs?.length>0&&j.legs.every(l=>l.kind==='walk'))
  return {status:'free',amounts:{EUR:0},label:'Gratuit (à pied)',missingSources:[]};
 const amounts={},missingSources=[],sources=[],legFares=[];
 let ticket=null; // titre en cours : {network,validUntilMs} — une correspondance dans la validité ne se repaie pas
 const isVerifiedFare=f=>!!(f&&finite(f.amount)&&f.amount>=0&&/^(EUR|CHF)$/.test(f.currency)&&f.source);
 const found=j.legs.map(l=>{if(isFoot(l))return null;
  const direct=isVerifiedFare(l.fare)?l.fare:null;return direct||(typeof fareFor==='function'?fareFor(l):null);});
 // Titre combiné officiel (ex. ligne 272 « Parcours + zone 10 », Léman Pass multizones) : quand le même trajet
 // emprunte aussi le réseau que ce titre couvre, on compte le titre combiné une fois et les portions couvertes
 // ne se repaient pas — on n'additionne jamais deux titres là où la grille officielle en prévoit un seul.
 const combo=found.findIndex(f=>isVerifiedFare(f)&&f.combined&&finite(f.combined.amount)&&f.combined.covers);
 const covered=new Set();
 if(combo>=0){const c=found[combo].combined;
  found.forEach((f,i)=>{if(i!==combo&&isVerifiedFare(f)&&(Array.isArray(c.covers)?c.covers.includes(f.network):f.network===c.covers))covered.add(i);});
  if(covered.size)found[combo]={...found[combo],amount:c.amount,validityMinutes:null,source:found[combo].source+' — titre retenu : '+c.label};}
 for(let i=0;i<j.legs.length;i++){const l=j.legs[i];
  if(isFoot(l)){legFares.push(null);continue;}
  const f=found[i];
  legFares.push(isVerifiedFare(f)?f:null);
  if(covered.has(i)){sources.push(f.network+' : couvert par le titre combiné');continue;}
  if(f&&finite(f.amount)&&f.amount>=0&&/^(EUR|CHF)$/.test(f.currency)&&f.source){
   const boarding=ms(l.departure);
   if(ticket&&f.network&&ticket.network===f.network&&Number.isFinite(boarding)&&boarding<=ticket.validUntilMs){sources.push(f.network+' : correspondance couverte par le même titre');continue;}
   ticket=f.network&&finite(f.validityMinutes)&&Number.isFinite(boarding)?{network:f.network,validUntilMs:boarding+f.validityMinutes*60000}:null;
   amounts[f.currency]=Math.round(((amounts[f.currency]||0)+f.amount)*100)/100;sources.push(f.source);
  }else missingSources.push((l.provider||'opérateur inconnu')+(l.line&&l.line!==l.provider?' '+l.line:''));
 }
 const fmt=(v,c)=>v.toFixed(2).replace('.',',')+(c==='EUR'?' €':' CHF');
 const order=o=>Object.entries(o).sort((a,b)=>a[0]===b[0]?0:a[0]==='EUR'?-1:1);
 if(missingSources.length)return {status:'unknown',amounts,label:'Prix à confirmer',missingSources:[...new Set(missingSources)],
  partial:Object.keys(amounts).length?order(amounts).map(([c,v])=>fmt(v,c)).join(' + '):null,sources,legFares};
 return {status:'verified',amounts,label:order(amounts).map(([c,v])=>fmt(v,c)).join(' + ')||'0,00 €',missingSources:[],sources:[...new Set(sources)],legFares};
}
// Valeur de tri en euros : on ne convertit pas les CHF (pas de taux inventé) ; CHF trié après EUR.
function priceSortKey(p){if(p.status==='free')return 0;if(p.status!=='verified')return Infinity;
 return (p.amounts.EUR||0)+(p.amounts.CHF?1e4+p.amounts.CHF:0);}
function fareCurrency(p){
 if(p?.status==='free')return 'free';
 if(p?.status!=='verified')return null;
 const currencies=Object.entries(p.amounts||{}).filter(([,v])=>v>0).map(([c])=>c);
 return currencies.length===1?currencies[0]:currencies.length===0?'free':null;
}
// Prix comparable uniquement dans une même devise, ou si un trajet est gratuit.
function compareFares(a,b){
 const ca=fareCurrency(a),cb=fareCurrency(b);
 if(ca==='free'&&cb==='free')return 0;
 if(ca==='free')return -1;
 if(cb==='free')return 1;
 if(!ca||!cb||ca!==cb)return 0;
 return (a.amounts[ca]||0)-(b.amounts[cb]||0);
}

/* ---------- Évaluation ---------- */
function marginFor(task){
 const base=finite(task.marginMinutes)?Math.max(5,task.marginMinutes):15;
 return task.exactTarget===true&&task.allowShortMargin===true?Math.min(base,5):Math.max(15,base);
}
const ADVISORY=/^(?:horaire GTFS(?: local)? non confirmé en temps réel|correspondance programmée non confirmée en temps réel|prix commercial et disponibilité non vérifiés|recherche des correspondances incomplète)$/;
// Horaires civils français : une arrivée la veille ou un trajet de nuit ne doit
// jamais apparaître comme une solution normale pour une mission du lendemain.
function parisDayParts(value){
 const t=ms(value);if(!Number.isFinite(t))return null;
 const a=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));
 return {day:a.year+'-'+a.month+'-'+a.day,minute:Number(a.hour)*60+Number(a.minute)};
}
function dayWindowOk(j,task){
 const dep=parisDayParts(j.legs[0]?.departure),arr=parisDayParts(j.legs[j.legs.length-1]?.arrival);
 if(!dep||!arr)return false;
 const first=Number.isFinite(task.dayStartMinutes)?task.dayStartMinutes:300;
 const last=Number.isFinite(task.dayEndMinutes)?task.dayEndMinutes:1140;
 if(dep.minute<first||arr.minute>last||dep.day!==arr.day)return false;
 // Agences et parcs fermés en fin de journée (17:30 par défaut, plus tard si la fenêtre de la plateforme le permet) :
 // arrivée au site (prise en charge / mission suivante) ou départ du site (retour) après cette heure = proposition écartée.
 if(Number.isFinite(task.siteCloseMinutes)){
  const depart=task.windowKind==='departure'||(Number.isFinite(ms(task.earliestDeparture))&&!Number.isFinite(ms(task.latestArrival)));
  if((depart?dep.minute:arr.minute)>task.siteCloseMinutes)return false;
 }
 const reference=parisDayParts(task.latestArrival||task.earliestDeparture);
 return !reference||dep.day===reference.day;
}
function assess(j,task,fareFor){
 const reasons=[...(j.missing||[])];
 // Un centre-ville permet de chercher, mais ne confirme jamais l'arrivée à l'adresse exacte.
 if(task.approximateEndpoint===true)reasons.push('point de départ ou d’arrivée approximatif (centre-ville) : adresse exacte à vérifier');
 const legs=j.legs;
 const dep=ms(legs[0]?.departure),arr=ms(legs[legs.length-1]?.arrival);
 let chrono=Number.isFinite(dep)&&Number.isFinite(arr)&&arr>=dep,prev=dep;
 for(const l of legs){const a=ms(l.departure),b=ms(l.arrival);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a||a<prev-60000){chrono=false;break;}prev=b;}
 if(!chrono)reasons.push('horaires incohérents');
 if(!dayWindowOk(j,task))reasons.push('trajet hors plage de jour ou date de mission');
 if(legs.some(l=>l.cancelled))reasons.push('course annulée signalée');
 const margin=marginFor(task),deadline=ms(task.latestArrival),earliest=ms(task.earliestDeparture);
 const slack=Number.isFinite(deadline)&&Number.isFinite(arr)?Math.floor((deadline-arr)/60000):null;
 if(Number.isFinite(earliest)&&Number.isFinite(dep)&&dep<earliest-60000)reasons.push('départ avant la fin de la mission précédente');
 if(slack!==null&&slack<margin)reasons.push(slack<0?'arrivée après l’heure de mission':'marge insuffisante ('+slack+' min, '+margin+' min requises)');
 // Ne pas proposer un train arrivant des heures trop tôt comme solution à une prise en charge.
 // La fenêtre peut être élargie explicitement par un futur scénario horaire multi-jours.
 // Fenêtre de prise en charge (ex. 08:00–19:00) : on peut arriver jusqu'à 3 h AVANT l'ouverture, donc très en avance sur la fin de fenêtre.
 const windowSpan=task.windowKind==='arrival'&&Number.isFinite(task.windowStartMs)&&Number.isFinite(deadline)?Math.max(0,Math.floor((deadline-task.windowStartMs)/60000)):0;
 const maxEarly=Number.isFinite(task.maxEarlyArrivalMinutes)?task.maxEarlyArrivalMinutes:180+windowSpan;
 if(slack!==null&&slack>maxEarly)reasons.push('arrivée trop tôt pour le créneau choisi ('+slack+' min d’avance)');
 // Réglage « marche maximale » (3 km par défaut) : appliqué à CHAQUE marche d'approche, de correspondance ou finale,
 // pas seulement aux trajets entièrement à pied. Une marche non calculée (distance inconnue) n'est pas écartée ici.
 const walkMax=Number.isFinite(task.walkMaxMeters)?task.walkMaxMeters:null;
 const longWalk=walkMax===null?null:legs.find(l=>l.kind==='walk'&&finite(l.distanceMeters)&&l.distanceMeters>walkMax);
 // Point approximatif : la marche n'est pas écartée (distance peu fiable), elle reste signalée dans le trajet.
 if(longWalk&&task.approximateEndpoint)reasons.push('marche longue à vérifier ('+(longWalk.distanceMeters/1000).toFixed(1).replace('.',',')+' km, point GPS approximatif)');
 else if(longWalk)reasons.push('marche trop longue ('+(longWalk.distanceMeters/1000).toFixed(1).replace('.',',')+' km, limite '+(walkMax/1000).toFixed(1).replace('.',',')+' km)');
 const price=priceOf(j,fareFor);
 const delays=legs.filter(l=>finite(l.delayMinutes)&&l.delayMinutes>0).map(l=>(l.line||l.mode)+' +'+l.delayMinutes+' min');
 const feasible=reasons.length===0;
 // Trois niveaux, jamais confondus (demande du 14/11/2026 : distinguer horaire programmé, disponibilité et prix) :
 //  - « Réalisable » : tout est vérifié, rien ne manque ;
 //  - « Horaire programmé » : horaire officiel publié, marches calculées, correspondances et marge respectées, mais
 //    pas de confirmation en temps réel (ou prix/disponibilité commerciale non vérifiés) — à confirmer le jour J ;
 //  - « Transport non confirmé » : une vérification manque ou échoue (marche, correspondance, marge, horaires).
 // Sans ce niveau intermédiaire, tout trajet issu d'un horaire GTFS (TER, cars, bus locaux) apparaissait comme
 // « non confirmé » avec le même avertissement qu'un trajet impossible (constaté en navigateur le 14/11/2026).
 const scheduled=!feasible&&reasons.every(r=>ADVISORY.test(r));
 return {...j,scheduled,departure:Number.isFinite(dep)?new Date(dep).toISOString():null,arrival:Number.isFinite(arr)?new Date(arr).toISOString():null,
  durationMinutes:chrono?Math.ceil((arr-dep)/60000):null,slackMinutes:slack,marginMinutes:margin,price,reasons,delays,
  transfers:Math.max(0,legs.filter(l=>!isFoot(l)).length-1),
  walkMeters:legs.filter(l=>l.kind==='walk').reduce((s,l)=>s+(l.distanceMeters||0),0),
  feasible,status:feasible?'Réalisable':scheduled?'Horaire programmé — à confirmer le jour J':'Transport non confirmé',
  statusDetail:scheduled?'Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : '+reasons.join(' · '):feasible?(j.realtime?'Horaires temps réel du fournisseur':'Horaires théoriques : retards et annulations à surveiller le jour J'):reasons.join(' · ')};
}
// Un transport n'a d'intérêt que s'il rapproche du but : si la marche à vol d'oiseau jusqu'au premier arrêt plus celle
// depuis le dernier arrêt atteint déjà la distance directe départ → arrivée, marcher directement est au moins aussi
// court. Ces candidats (rayon de recherche de 3 km autour de chaque adresse) épuisaient le quota de marches calculées
// avant les trajets utiles : constaté en réel le 14/11/2026 sur Lyon Part-Dieu → Bellecour (0 marche calculée).
// Points GPS absents : le trajet est conservé (aucune élimination sans preuve).
function walkDetour(j,task){
 const from=pt(task&&task.from),to=pt(task&&task.to);if(!from||!to||!j||!Array.isArray(j.legs))return false;
 const rides=j.legs.filter(l=>l&&!isFoot(l));if(!rides.length)return false;
 const first=pt(rides[0].fromPoint),last=pt(rides[rides.length-1].toPoint);if(!first||!last)return false;
 const direct=meters(from,to);
 return direct>0&&meters(from,first)+meters(last,to)>=direct;
}
// Détour manifestement excessif : le chemin parcouru en véhicule (somme des distances à vol d'oiseau des portions)
// fait au moins 3 fois la distance directe ET au moins 30 km de plus (ex. réel du 14/11/2026 : Annecy → Saint-Étienne
// → Genève en car pour 35 km directs). Les deux conditions ensemble épargnent les détours ferroviaires normaux
// (Annecy → Genève par La Roche-sur-Foron ≈ 1,6 fois) et les petits trajets urbains. GPS absent : trajet conservé.
function excessiveDetour(j,task){
 const from=pt(task&&task.from),to=pt(task&&task.to);if(!from||!to||!j||!Array.isArray(j.legs))return false;
 const rides=j.legs.filter(l=>l&&!isFoot(l));if(!rides.length)return false;
 let path=0;for(const l of rides){const a=pt(l.fromPoint),b=pt(l.toPoint);if(!a||!b)return false;path+=meters(a,b);}
 const direct=meters(from,to);
 return direct>0&&path>=3*direct&&path-direct>=30000;
}
// Couples de points dont la marche doit être calculée pour un trajet (accès et sortie) : sert à compter le coût réel
// en requêtes piétonnes, les trajets d'une même ligne partageant presque toujours les mêmes arrêts.
function walkPairs(j,task){
 const from=pt(task&&task.from),to=pt(task&&task.to),legs=j.legs||[],out=[];
 const k=(a,b)=>[a.lat,a.lon,b.lat,b.lon].map(v=>Math.round(v*1e4)).join(',');
 const first=legs[0],last=legs[legs.length-1];
 if(from&&first&&pt(first.fromPoint)&&meters(from,first.fromPoint)>SAME_POINT_M)out.push(k(from,first.fromPoint));
 if(to&&last&&pt(last.toPoint)&&meters(last.toPoint,to)>SAME_POINT_M)out.push(k(last.toPoint,to));
 return out;
}
function signature(j){
 return j.legs.filter(l=>!isFoot(l)).map(l=>[
  String(l.provider||'').replace(/\s+/g,'').toLowerCase(),
  String(l.line||'').replace(/\s+/g,'').toLowerCase(),
  String(l.from||'').trim().toLowerCase(),String(l.to||'').trim().toLowerCase(),
  l.fromPoint?.lat,l.fromPoint?.lon,l.toPoint?.lat,l.toPoint?.lon,
  Math.round(ms(l.departure)/60000),Math.round(ms(l.arrival)/60000)
 ].join('|')).join(';');
}
function rank(items,task={}){
 const seen=new Map();
 for(const j of items){if(!j||j.durationMinutes===null)continue;
  // Ne pas fusionner toutes les marches sous une clé unique : les points
  // d'accès et les créneaux peuvent différer d'une proposition à l'autre.
  // Certains moteurs renvoient une marche pure sans positionner walkOnly.
  // Une signature de transports vide fusionnerait alors tous ces itinéraires.
  const walkingJourney=j.walkOnly||j.scooterOnly||j.legs?.length>0&&j.legs.every(l=>l.kind==='walk'||l.kind==='scooter');
  const k=walkingJourney?[
   (j.scooterOnly?'scooter':'walk'),String(j.legs?.[0]?.from||'').trim().toLowerCase(),
   String(j.legs?.[j.legs.length-1]?.to||'').trim().toLowerCase(),
   j.legs?.[0]?.fromPoint?.lat,j.legs?.[0]?.fromPoint?.lon,
   j.legs?.[j.legs.length-1]?.toPoint?.lat,j.legs?.[j.legs.length-1]?.toPoint?.lon,
   Math.round(ms(j.departure)/60000),Math.round(ms(j.arrival)/60000)
  ].join('|'):signature(j);
  const old=seen.get(k);
  if(!old){seen.set(k,j);continue;}
  // Fusion : garder la version la plus complète (marches, prix, temps réel) et cumuler les sources.
  // Comparer les critères dans l'ordre : un prix connu ne doit jamais
  // remplacer un doublon réalisable par une version non réalisable.
  const quality=x=>[Number(!!x.feasible),Number(!!x.scheduled),
   -((x.reasons||[]).length),Number(x.price?.status==='verified'||x.price?.status==='free')];
  const qj=quality(j),qo=quality(old);
  const firstDifference=qj.findIndex((v,i)=>v!==qo[i]);
  const better=firstDifference>=0&&qj[firstDifference]>qo[firstDifference]?j:old;
  seen.set(k,{...better,sources:[...new Set([...(old.sources||[]),...(j.sources||[])])]});
 }
 const all=[...seen.values()].filter(j=>!Array.isArray(j.reasons)||!(j.reasons.includes('trajet hors plage de jour ou date de mission')||j.reasons.some(r=>String(r).startsWith('marche trop longue'))));
 // Une arrivée des heures avant la prise en charge n'est pas un bon compromis.
 // Garder les alternatives possibles, mais privilégier celles proches de la marge cible.
 const target=ms(task.latestArrival),margin=marginFor(task);
 const arrivalGap=j=>Number.isFinite(target)&&Number.isFinite(ms(j.arrival))?
  Math.abs((target-ms(j.arrival))/60000-margin):0;
 const relevant=(a,b)=>arrivalGap(a)-arrivalGap(b);
 // Classement : les trajets exploitables (réalisables OU en horaire officiel programmé) passent avant les incomplets,
 // puis le critère (prix, compromis, durée) ; à égalité seulement, le réalisable passe devant le programmé.
 // Avant : tout réalisable passait devant tout programmé, si bien que « Plus rapide » pouvait désigner 30 min de
 // marche alors qu'un bus de 12 min existait (Lyon Part-Dieu → Bellecour, diagnostic réel du 14/11/2026). Le statut
 // affiché sur chaque carte reste celui du trajet : un horaire programmé n'est jamais présenté comme confirmé.
 const tier=j=>j.feasible||j.scheduled?1:0,confirmedFirst=(a,b)=>Number(b.feasible)-Number(a.feasible);
 const byFeasible=(a,b)=>tier(b)-tier(a);
 // « Plus rapide » départage uniquement sur la durée, puis la confirmation et la marche.
 // Un tarif EUR/CHF ne doit pas rendre ce tri non transitif.
 const fastest=[...all].sort((a,b)=>byFeasible(a,b)||a.durationMinutes-b.durationMinutes||
  confirmedFirst(a,b)||a.walkMeters-b.walkMeters)[0];
 // « Moins cher » ne doit jamais recommander un trajet impossible, même si son prix est connu.
 const priced=all.filter(j=>(j.feasible||j.scheduled)&&
  (j.price.status==='verified'||j.price.status==='free'));
 // Ne jamais comparer des montants EUR et CHF sans taux de change fiable.
 // Un trajet gratuit est comparable à toutes les devises ; sinon, « Moins cher »
 // n'est affiché que si les offres payantes ont la même devise unique.
 const currencies=[...new Set(priced.filter(j=>j.price.status!=='free').flatMap(j=>
  Object.keys(j.price.amounts||{}).filter(c=>j.price.amounts[c]>0)))];
 const comparable=currencies.length<=1&&priced.every(j=>j.price.status==='free'||
  Object.keys(j.price.amounts||{}).filter(c=>j.price.amounts[c]>0).length<=1);
 const cheapest=comparable?[...priced].sort((a,b)=>byFeasible(a,b)||
  priceSortKey(a.price)-priceSortKey(b.price)||confirmedFirst(a,b)||
  a.durationMinutes-b.durationMinutes)[0]:undefined;
 const score=j=>(fareCurrency(j.price)==='EUR'?Math.min(j.price.amounts.EUR||0,200):60)+j.durationMinutes/3+j.transfers*8+j.walkMeters/250+
  (j.slackMinutes===null?0:Math.max(0,30-j.slackMinutes));
 // Un trajet confirmé (réalisable) prime sur un simple horaire programmé ; la proximité de la marge ne départage qu'ensuite.
  // Priorité du convoyeur (17/11/2026) : partir et arriver le plus tôt possible. Le « meilleur compromis » est donc, parmi les trajets
  // exploitables (confirmés d'abord), celui qui arrive le plus tôt, puis part le plus tôt ; le prix et le confort ne départagent qu'ensuite.
  const compromise=[...all].sort((a,b)=>byFeasible(a,b)||confirmedFirst(a,b)||(ms(a.arrival)-ms(b.arrival))||(ms(a.departure)-ms(b.departure))||score(a)-score(b))[0];
 const picks=[];
 for(const [label,j] of [['Moins cher',cheapest],['Meilleur compromis',compromise],['Plus rapide',fastest]])
  if(j){const found=picks.find(p=>p.journey===j);if(found)found.labels.push(label);else picks.push({labels:[label],journey:j});}
 // Une offre FlixBus/BlaBlaCar Bus ne doit pas disparaître derrière
 // « Autres propositions » uniquement parce qu'un TER est plus rapide.
 // Ne jamais promouvoir une course hors date, annulée ou non exploitable.
 const coachOperators=[
  ['FlixBus',/flixbus/i],
  ['BlaBlaCar Bus',/blablacar\s*(?:bus|coach)|blablacarbus|ouibus/i]
 ];
 for(const [name,pattern] of coachOperators){
  const matches=all.filter(j=>(j.feasible||j.scheduled)&&
   (j.sources||[]).concat(j.source||'',j.legs.map(l=>l.provider||'')).some(x=>pattern.test(String(x))));
  // Parmi les cars exploitables, afficher d'abord le tarif total vérifié
  // le moins cher ; un tarif inconnu ne doit jamais être supposé avantageux.
  const verifiedCoach=j=>j.price?.status==='verified'||j.price?.status==='free';
  // Une comparaison paire à paire EUR/CHF n'est pas transitive. Si plusieurs
  // devises sont présentes, ne pas départager les cars sur leur montant.
  const coachCurrencies=new Set(matches.map(j=>fareCurrency(j.price)).filter(c=>c&&c!=='free'));
  const coachPricesComparable=coachCurrencies.size<=1&&matches.every(j=>
   !verifiedCoach(j)||fareCurrency(j.price)!==null);
  const best=[...matches].sort((a,b)=>byFeasible(a,b)||
   (coachPricesComparable?Number(verifiedCoach(b))-Number(verifiedCoach(a)):0)||
   (coachPricesComparable&&verifiedCoach(a)&&verifiedCoach(b)?compareFares(a.price,b.price):0)||
   relevant(a,b)||a.durationMinutes-b.durationMinutes||confirmedFirst(a,b))[0];
  if(!best)continue;
  const already=picks.find(p=>p.journey===best);
  if(already)already.labels.push(name);
  else picks.push({labels:[name],journey:best});
 }
 // Fenêtre horaire de la mission (prise en charge 11:00–12:30, livraison 14:00–16:00…) : en plus des trois meilleurs choix,
 // proposer un trajet qui arrive AVANT le début de la fenêtre et un autre qui arrive le plus tard possible dans la fenêtre
 // (retour : départ dès l'ouverture de la fenêtre, puis le plus tard dans la fenêtre), marge de sécurité comprise.
 if(Number.isFinite(task.windowStartMs)&&Number.isFinite(task.windowEndMs)&&(task.windowKind==='arrival'||task.windowKind==='departure')){
  // Jamais de « jusqu'à » au-delà de l'heure de fermeture du site (17:30 par défaut), quelle que soit la façon dont la fenêtre a été construite.
  const sp=parisDayParts(new Date(task.windowStartMs).toISOString());
  if(sp&&Number.isFinite(task.siteCloseMinutes)){const cap=task.windowStartMs+(task.siteCloseMinutes-sp.minute)*60000-(task.windowKind==='arrival'?marginFor(task)*60000:0);
   if(cap>task.windowStartMs&&cap<task.windowEndMs)task={...task,windowEndMs:cap};}
  const ok=all.filter(j=>j.feasible||j.scheduled),arr=task.windowKind==='arrival';
  const at=j=>ms(arr?j.arrival:j.departure);
  const first=ok.filter(j=>arr?at(j)<=task.windowStartMs:at(j)>=task.windowStartMs&&at(j)<=task.windowStartMs+45*60000).sort((x,y)=>arr?at(y)-at(x):at(x)-at(y))[0];
  const last=ok.filter(j=>at(j)<=task.windowEndMs&&at(j)>task.windowStartMs).sort((x,y)=>at(y)-at(x))[0];
  for(const [j,label] of [[first,arr?'Arrive avant '+clock(task.windowStartMs):'Départ dès '+clock(task.windowStartMs)],[last,arr?'Arrive jusqu’à '+clock(task.windowEndMs):'Départ jusqu’à '+clock(task.windowEndMs)]]){
   if(!j)continue;const already=picks.find(p=>p.journey===j);
   if(already){if(!already.labels.includes(label))already.labels.push(label);}else picks.push({labels:[label],journey:j});}
 }
 picks.sort((a,b)=>(tier(b.journey)-tier(a.journey))||(ms(a.journey.departure)-ms(b.journey.departure))||(ms(a.journey.arrival)-ms(b.journey.arrival)));   // les propositions mises en avant : la plus matinale en premier
 const others=all.filter(j=>!picks.some(p=>p.journey===j)).sort((a,b)=>byFeasible(a,b)||ms(a.departure)-ms(b.departure)||ms(a.arrival)-ms(b.arrival)||confirmedFirst(a,b));   // autres propositions : les plus matinales d'abord
 return {picks,others,total:all.length};
}

/* ---------- Requêtes par direction ---------- */
function inSwissArea(p){return !!p&&((p.lat>=SWISS_BOX.minLat&&p.lat<=SWISS_BOX.maxLat&&p.lon>=SWISS_BOX.minLon&&p.lon<=SWISS_BOX.maxLon&&
 // exclure la France au sud-ouest de Genève (hors frontière immédiate)
 !(p.lat<46.15&&meters(p,GENEVA)>30000))||meters(p,GENEVA)<=30000);}
function queryWindow(task){
 const margin=marginFor(task),deadline=ms(task.latestArrival),earliest=ms(task.earliestDeparture);
 // Une jonction impossible ne doit pas déclencher de recherche réseau inutile.
 if(Number.isFinite(deadline)&&Number.isFinite(earliest)&&earliest>deadline-margin*60000)return null;
 // Une prise en charge a une heure limite : chercher d'abord une arrivée avant la marge.
 // Le départ après une mission précédente reste contrôlé dans assess().
 if(Number.isFinite(deadline))return {when:new Date(deadline-margin*60000).toISOString(),arriveBy:true};
 if(Number.isFinite(earliest))return {when:new Date(earliest).toISOString(),arriveBy:false};
 return null;
}
function makeProviders(r,opts={}){
 const fetcher=opts.fetcher||((...a)=>r.fetch(...a));
 const P={};
 // Regional GTFS archives already hosted by the project. These are scheduled
 // candidates only; the pedestrian router and confirmation checks still apply.
 if(r.CPGTFSLoader?.loadResource&&r.CPGTFSIndex?.nearbyDirectTrips){
  const localNetworks=[
   ['tac','TAC Annemasse','tac-annemasse.zip',[46.1,5.98,46.27,6.42]],
   ['synchro','Synchro Chambéry','synchro-chambery.zip',[45.48,5.75,45.72,6.04]],
   ['tcl','TCL Lyon','tcl-lyon.zip',[45.55,4.6,46.02,5.1]],
   ['cars_isere','Cars Région Isère','cars-region-isere.zip',[44.69,4.74,45.89,6.36]],
   ['cars_savoie','Cars Région Savoie','cars-region-savoie.zip',[45.05,5.62,45.80,7.19]],
   // 18/11/2026 : Cars Région Haute-Savoie (Y02, Y51, Y91-Y94 à la demande…) découpé sur Faucigny / Giffre / Chablais.
   ['cars_haute_savoie','Cars Région Haute-Savoie','cars-region-haute-savoie.zip',[45.90,6.30,46.30,6.85]],
   // 18/11/2026 : réseaux présents dans data/gtfs mais absents de ce moteur (audit de couverture).
   ['mreso_grenoble','M Réso Grenoble','mreso-grenoble.zip',[45.0,5.5,45.45,6.0]],
   ['mreso_gresivaudan','M Réso Grésivaudan','mreso-gresivaudan.zip',[45.15,5.7,45.5,6.15]],
   ['ondea','Ondéa Aix-les-Bains (Grand Lac)','ondea-grand-lac.zip',[45.6,5.75,45.85,6.05]],
   ['sibra','Sibra Annecy','sibra-annecy.zip',[45.7,5.9,46.1,6.5]],
   ['start_thonon','Star’t Thonon','start-thonon.zip',[46.25,6.3,46.45,6.65]],
   ['ginko_besancon','Ginko (Besançon)','ginko-besancon.zip',[47.15,5.9,47.35,6.2]],
   ['zoom_chalon','Zoom (Chalon-sur-Saône)','zoom-chalon.zip',[46.7,4.75,46.85,5.0]],
   ['grandole_dole','Grandole Mobilités (Dole)','grandole-dole.zip',[47.0,5.4,47.2,5.65]],
   ['evolity_montbeliard','évolitY (Montbéliard)','evolity-montbeliard.zip',[47.4,6.65,47.6,6.95]],
   ['orizo_avignon','Orizo (Grand Avignon)','orizo-avignon.zip',[43.85,4.7,44.05,4.95]],
   ['agglo_bus_gap','L’Agglo en Bus (Gap)','agglo-bus-gap.zip',[44.4,5.95,44.75,6.25]],
   ['altigo_briancon','Altigo (Briançonnais)','altigo-briancon.zip',[44.8,6.4,45.15,6.8]],
   ['divia_dijon','Divia Mobilités (Dijon)','divia-dijon.zip',[47.2,4.95,47.45,5.2]],
   ['tango_nimes','Tango (Nîmes Métropole)','tango-nimes.zip',[43.7,4.15,44.0,4.55]],
   ['alesy_ales',"Ales'y (Alès)",'alesy-ales.zip',[43.95,3.9,44.35,4.4]],
   ['tisseo_toulouse','Tisséo (Toulouse)','tisseo-toulouse.zip',[43.45,1.15,43.85,1.7]],
   ['mistral_toulon','Réseau Mistral (Toulon)','mistral-toulon.zip',[43.0,5.75,43.25,6.15]],
   ['aixenbus_aix','Aix en Bus','aixenbus-aix.zip',[43.45,5.35,43.65,5.55]],
   ['tam_montpellier','TaM (Montpellier, urbain et suburbain)','tam-montpellier.zip',[43.45,3.5,43.95,4.15]],
   ['palmbus_cannes','Palmbus (Cannes Pays de Lérins)','palmbus-cannes.zip',[43.45,6.85,43.7,7.15]],
   ['lignes_azur_nice',"Lignes d'Azur (Nice)",'lignes-azur-nice.zip',[43.63,7.15,43.82,7.4]],
   ['rtm_marseille','RTM (Marseille)','rtm-marseille.zip',[43.2,5.3,43.38,5.5]],
   ['trema_macon','TréMA (Mâcon)','trema-macon.zip',[46.2,4.7,46.5,5.0]],
   ['lio_occitanie_nord','liO Occitanie (Gard, Lozère)','lio-occitanie-nord.zip',[44.0,3.3,44.95,4.7]],
   ['mobigo_bfc_jura','Mobigo Bourgogne-Franche-Comté (Jura)','mobigo-bfc-jura.zip',[46.2,5.3,47.1,6.3]],
   ['zou_express_nord','ZOU ! Express (Alpes du Sud)','zou-express-nord.zip',[44.0,5.0,45.2,7.2]],
   ['zou_proximite_nord','ZOU ! Proximité (Hautes-Alpes, Vaucluse nord)','zou-proximite-nord.zip',[44.0,5.0,45.0,7.0]],
   ['cars_ain','Cars Région Ain','cars-region-ain.zip',[45.75,4.75,46.5,6.15]],
   ['jybus','J’y bus Rumilly','jybus-rumilly.zip',[45.80,5.85,45.93,6.05]],
   ['tam','TAM Ambérieu','tam-amberieu.zip',[45.90,5.28,46.04,5.43]],
   // 15/11/2026 : autres réseaux de l'agrégat officiel Oùra (extraits par la tâche serveur, emprises relevées).
   ['rubis', "Rubis Bourg-en-Bresse", 'rubis-bourg.zip', [46.15,5.05,46.52,5.41]],
   ['evad', "ÉVA'D Évian", 'evad-evian.zip', [46.24,6.45,46.42,6.86]],
   ['chamonix', "Chamonix Bus", 'chamonix-bus.zip', [45.87,6.74,46.06,6.96]],
   ['proximiti', "Proxim iTi Bonneville – La Roche", 'proximiti-bonneville.zip', [45.91,6.17,46.23,6.53]],
   ['mobivals', "Mobi'Vals Valserhône", 'mobivals-valserhone.zip', [46.08,5.76,46.16,5.87]],
   ['tra', "TRA Mobilité Albertville", 'tra-albertville.zip', [45.55,6.22,45.77,6.59]],
   ['duobus', "Duobus Oyonnax", 'duobus-oyonnax.zip', [46.19,5.59,46.34,5.7]],
   ['ruban', "Ruban Bourgoin-Jallieu", 'ruban-bourgoin.zip', [45.48,5.08,45.71,5.4]],
   ['lva', "L'va Vienne", 'lva-vienne.zip', [45.39,4.59,45.69,5.49]],
   ['colibri', "Colibri Miribel", 'colibri-miribel.zip', [45.8,4.89,45.85,5.04]],
   ['tico', "TICO Montluel", 'tico-montluel.zip', [45.81,5.03,45.88,5.15]],
   ['saonibus', "Saônibus Trévoux", 'saonibus-trevoux.zip', [45.86,4.7,45.97,4.85]],
   ['cars_express', "Cars Région Express", 'cars-region-express.zip', [44.35,2.8,46.78,6.15]],
   ['cars_loire', "Cars Région Loire", 'cars-region-loire.zip', [45.23,3.68,46.22,4.88]],
   ['cars_drome', "Cars Région Drôme", 'cars-region-drome.zip', [44.04,4.63,45.38,6.1]],
   ['cars_ardeche', "Cars Région Ardèche", 'cars-region-ardeche.zip', [44.25,3.85,45.4,4.95]],
   ['cars_allier', "Cars Région Allier", 'cars-region-allier.zip', [46.02,2.18,46.85,4.07]],
   ['cars_cantal', "Cars Région Cantal", 'cars-region-cantal.zip', [44.67,2.18,45.79,3.32]],
   ['cars_haute_loire', "Cars Région Haute-Loire", 'cars-region-haute-loire.zip', [44.71,3.23,45.56,4.41]],
   ['coqueligo', "CoqueliGO Annonay", 'coqueligo-annonay.zip', [45.21,4.62,45.29,4.72]],
   ['toutenbus', "Tout'enbus Aubenas", 'toutenbus-aubenas.zip', [44.54,4.3,44.69,4.47]],
   ['transcab', "Trans'Cab Aurillac", 'transcab-aurillac.zip', [44.8,2.22,45.09,2.68]],
   ['montelibus', "Montélibus Montélimar", 'montelibus-montelimar.zip', [44.44,4.69,44.73,5.02]],
   ['maelis', "Maelis Montluçon", 'maelis-montlucon.zip', [46.15,2.49,46.42,2.74]],
   ['aleo', "Aléo Moulins", 'aleo-moulins.zip', [46.49,3.27,46.65,3.46]],
   ['tcap', "T'CAP Privas", 'tcap-privas.zip', [44.68,4.52,44.84,4.82]],
   ['velay', "Mobilité en Velay (Le Puy)", 'velay-le-puy.zip', [44.97,3.83,45.09,4.01]],
   ['rlv', "RLV Mobilités Riom", 'rlv-riom.zip', [45.83,3.02,45.98,3.24]],
   ['star_roanne', "Star Roanne", 'star-roanne.zip', [45.96,3.78,46.22,4.26]],
   ['lebus', "Le Bus Tain-Tournon", 'lebus-tain-tournon.zip', [44.99,4.52,45.16,5.07]],
   ['smtut', "SMTUT Thiers", 'smtut-thiers.zip', [45.69,3.36,46.03,3.74]],
   ['mobivie', "MobiVie Vichy", 'mobivie-vichy.zip', [46.06,3.37,46.17,3.49]],
   ['le37', "Le 37 Péage-de-Roussillon", 'le37-roussillon.zip', [45.3,4.75,45.47,5.07]],
   // 15/11/2026 (soir) : trois réseaux confirmés par le sondage PAN mais absents de l'agrégat Oùra
   // (chacun un GTFS officiel à part). citea : bbox testée contre le flux réel avant câblage. stas/t2c :
   // bbox provisoire (cœur urbain estimé, flux non téléchargeable depuis le poste de développement) —
   // confirmée correcte par le premier passage réel de build-regional-gtfs.yml (21 h 20, run 43757097623 :
   // 30 trajets réels chacun via scripts/verifier-moteurs-regionaux.cjs), pas de resserrement nécessaire.
   ['citea', "Citéa (Valence Romans Mobilités)", 'citea-valence.zip', [44.85,4.80,45.10,5.15]],
   ['stas', "STAS (Saint-Étienne Métropole)", 'stas-saint-etienne.zip', [45.38,4.32,45.50,4.45]],
   ['t2c', "T2C (Clermont Auvergne Métropole)", 't2c-clermont.zip', [45.72,3.00,45.85,3.20]]
  ];
  // Archives are published on the transport feature branch, not necessarily on
  // the deployed GitHub Pages site. Explicit HTTPS URLs avoid a silent 404
  // when the Android app is served from another origin or an older deployment.
  const base='https://raw.githubusercontent.com/at374/convoyage-app/feature/transports-aura-suisse/data/gtfs/';
  let deployedBase=null;
  try{const l=r.location;if(l&&l.protocol==='https:'&&/(^|\.)github\.io$/.test(l.hostname))deployedBase=new URL('data/gtfs/',l.href).href;}catch(_){}
  const cache=new Map();
  const inBounds=(p,b)=>p&&p.lat>=b[0]&&p.lon>=b[1]&&p.lat<=b[2]&&p.lon<=b[3];
  const dateParts=when=>{
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(when));
   const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
   return {date:p.year+'-'+p.month+'-'+p.day,clock:p.hour+':'+p.minute+':00'};
  };
  const toISO=(date,clock)=>{
   if(!/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(clock||''))return null;
   const [h,m,s]=clock.split(':').map(Number);
   const wall=Date.parse(date+'T00:00:00Z')+(h*3600+m*60+s)*1000;
   const tz=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',timeZoneName:'shortOffset'})
    .formatToParts(new Date(wall)).find(x=>x.type==='timeZoneName')?.value||'';
   const match=/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
   if(!match)return null;
   const offset=(match[1]==='+'?1:-1)*(Number(match[2])*60+Number(match[3]||0));
   return new Date(wall-offset*60000).toISOString();
  };
  for(const [id,name,file,bounds] of localNetworks){
   P['local_'+id]={name:name+' GTFS',
    enabled:task=>!!queryWindow(task)&&inBounds(pt(task.from),bounds)&&inBounds(pt(task.to),bounds),
    disabledReason:'trajet hors zone du réseau local ou horaires manquants',
    run:async(task,signal)=>{
     const w=queryWindow(task),when=ms(w.when);
     if(!Number.isFinite(when))return [];
     // Publication sans retouche : sur le site déployé (GitHub Pages), la copie du site passe en premier (c'est elle
     // que les tâches hebdomadaires de la branche publiée rafraîchissent) ; sinon la branche Transports, puis la
     // branche principale et le site déployé en secours.
     const urls=[...new Set([deployedBase?deployedBase+file:null,base+file,
      'https://raw.githubusercontent.com/at374/convoyage-app/main/data/gtfs/'+file,'https://at374.github.io/convoyage-app/data/gtfs/'+file].filter(Boolean))];
     const {date,clock}=dateParts(when),resource={format:'GTFS',url:urls[0],fallbackUrls:urls.slice(1)};
     let promise=cache.get(id+'|'+date);
     if(!promise){
      promise=r.CPGTFSLoader.loadResource(resource,{fetcher,indexServiceDates:[date],retainSourceTables:false});
      cache.set(id+'|'+date,promise);
      promise.catch(()=>cache.delete(id+'|'+date));
     }
     const feed=await promise;
     if(signal?.aborted)return [];
     const rows=attachGTFSFares(feed,r.CPGTFSIndex.nearbyDirectTrips(feed.files,feed.index,date,pt(task.from),pt(task.to),3000),r.CPGTFSFares);
     const sec=t=>{const a=String(t||'').split(':').map(Number);return a.length===3&&a.every(Number.isFinite)?a[0]*3600+a[1]*60+a[2]:NaN;};
     // Select the best boarding/alighting stop pair for each actual vehicle
     // BEFORE imposing the mobile card limit. Otherwise 500 stop-pair variants
     // from a few vehicles can hide later distinct departures.
     const best=new Map(),directMeters=meters(pt(task.from),pt(task.to));
     for(const x of rows){
      if(!(w.arriveBy?sec(x.arrival)<=sec(clock):sec(x.departure)>=sec(clock)))continue;
      const key=String(x.tripId||'')+'|'+date;
      const access=Number(x.accessDistanceMeters),egress=Number(x.egressDistanceMeters);
      if(!key||!Number.isFinite(access)||!Number.isFinite(egress))continue;
      const score=access+egress,previous=best.get(key);
      // Même règle que walkDetour, appliquée AVANT la limite de 30 : sur un réseau dense (TCL), les 30 premiers
      // départs tenaient dans la même minute et 24 étaient des lignes sans rapport avec le trajet.
      if(directMeters>0&&score>=directMeters)continue;
      if(!previous||score<previous.score)best.set(key,{x,score});
     }
     const filtered=[...best.values()].map(({x})=>({...x,network:name,
       departure:toISO(date,x.departure),arrival:toISO(date,x.arrival)}))
      .filter(x=>x.departure&&x.arrival)
      // « Arriver avant » (Aller) : garder les 30 arrivées les plus proches de l'échéance, pas les 30 premiers
      // départs de la journée (bus de l'aube inutiles pour une mission à 10 h).
      .sort((a,b)=>w.arriveBy?Date.parse(b.arrival)-Date.parse(a.arrival):Date.parse(a.departure)-Date.parse(b.departure)).slice(0,30)
      .sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
     return fromGTFS(filtered,name);
    }};
  }
  // V306 : correspondances entre réseaux (ex. Taninges → Cluses en car Région à la demande, puis TER Cluses → Annecy).
  // Les réseaux qui touchent le départ ou l'arrivée + le flux SNCF sont chargés ; toutes les paires sont combinées (arrêts voisins ≤ 150 m,
  // 5 min minimum), et chaque réseau cherche aussi ses propres correspondances internes. Horaires théoriques, non confirmés.
  if(r.CPGTFSFederation?.crossNetworkTrips&&r.CPGTFSTime?.datedTrips&&r.CPGTFSIndex?.nearbyTransferTrips){
   const sncfFeed=['sncf_ter','SNCF (TER, TGV)','national-sncf-aura.zip',[44.0,3.6,46.7,7.4]];
   const area=b=>(b[2]-b[0])*(b[3]-b[1]);
   const feedFor=(id,name,file,date)=>{
    const key='x|'+id+'|'+date;let promise=cache.get(key);
    if(!promise){
     const urls=[...new Set([deployedBase?deployedBase+file:null,base+file,
      'https://raw.githubusercontent.com/at374/convoyage-app/main/data/gtfs/'+file,'https://at374.github.io/convoyage-app/data/gtfs/'+file].filter(Boolean))];
     promise=r.CPGTFSLoader.loadResource({format:'GTFS',url:urls[0],fallbackUrls:urls.slice(1),datasetId:id,network:name},{fetcher,indexServiceDates:[date],retainSourceTables:false});
     cache.set(key,promise);promise.catch(()=>cache.delete(key));
    }
    return promise;
   };
   const pickFeeds=task=>{
    const a=pt(task.from),b=pt(task.to);if(!a||!b)return [];
    const touching=[...localNetworks,sncfFeed].filter(n=>inBounds(a,n[3])||inBounds(b,n[3]));
    const score=n=>(n===sncfFeed?1:0)*0+(area(n[3])<0.5?0:1)*10+area(n[3]);
    return touching.sort((x,y)=>score(x)-score(y)).slice(0,4);
   };
   P.local_correspondances={name:'Correspondances entre réseaux (GTFS)',
    enabled:task=>!!queryWindow(task)&&pickFeeds(task).length>0,
    disabledReason:'trajet hors zone des réseaux locaux ou horaires manquants',
    run:async(task,signal)=>{
     const w=queryWindow(task),when=ms(w.when);
     if(!Number.isFinite(when))return [];
     const {date,clock}=dateParts(when);
     const nets=pickFeeds(task);
     const loaded=(await Promise.all(nets.map(n=>feedFor(n[0],n[1],n[2],date).catch(()=>null)))).filter(Boolean);
     if(signal?.aborted||loaded.length<1)return [];
     const from=pt(task.from),to=pt(task.to);
     const window={...(Number.isFinite(ms(task.earliestDeparture))?{earliestDeparture:task.earliestDeparture}:{}),
      ...(Number.isFinite(ms(task.latestArrival))?{latestArrival:task.latestArrival}:{}),marginMinutes:marginFor(task)};
     if(window.earliestDeparture===undefined&&window.latestArrival===undefined)return [];
     const rows=[];
     for(let i=0;i<loaded.length;i++){
      // Correspondances à l'intérieur d'un même réseau.
      try{
       const bounds=r.CPGTFSTime.serviceWindow(loaded[i].files,date,window);
       const t=r.CPGTFSIndex.nearbyTransferTrips(loaded[i].files,loaded[i].index,date,from,to,700,bounds);
       const dated=r.CPGTFSTime.datedTransferTrips(loaded[i].files,loaded[i].index,t.journeys,window);
       rows.push(...dated.map(x=>({...x,network:loaded[i].source.network,legs:x.legs?.map(l=>({...l,network:loaded[i].source.network}))})));
      }catch(_){}
      // Correspondances entre deux réseaux différents.
      for(let j=i+1;j<loaded.length;j++){
       if(signal?.aborted)return [];
       try{const c=r.CPGTFSFederation.crossNetworkTrips([loaded[i],loaded[j]],date,from,to,window,{});rows.push(...c.journeys);}catch(_){}
      }
     }
     const out=rows.filter(x=>x&&x.departure&&x.arrival).map(x=>({...x,onDemand:x.onDemand||!!x.legs?.some(l=>l&&l.onDemand)}))
      .sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
     // Garder les meilleurs d'abord : arrivée la plus tôt, puis départ le plus tôt ; 30 propositions au plus.
     const seen=new Set(),uniq=[];
     for(const x of out.sort((a,b)=>Date.parse(a.arrival)-Date.parse(b.arrival)||Date.parse(a.departure)-Date.parse(b.departure))){
      const k=String(x.tripId||'')+'|'+x.departure;if(seen.has(k))continue;seen.add(k);uniq.push(x);if(uniq.length>=30)break;
     }
     return fromGTFS(uniq.sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure)),'Correspondances');
    }};
  }
 }
 // National GTFS regional slices must be explicitly supplied by the application/server.
 // No direct download of full national feeds into Android and no invented ticket prices.
 if(r.CPNationalGTFSJourneys&&typeof r.CPNationalGTFSJourneys.loadAndSearch==='function'){
  const resources=opts.nationalGTFSResources||{};
  for(const operator of ['sncf','blablacarBus','flixbus']){
   const resource=resources[operator];
   if(!resource||!/^https:\/\//i.test(resource.url||''))continue;
   const name={sncf:'SNCF GTFS',blablacarBus:'BlaBlaCar Bus GTFS',flixbus:'FlixBus GTFS'}[operator];
   P['national_'+operator]={name,enabled:task=>!!pt(task.from)&&!!pt(task.to)&&!!queryWindow(task),
    disabledReason:'adresse GPS ou horaire de mission manquant',
    run:async(task,signal)=>{
     const window=queryWindow(task),when=ms(window.when);
     if(!Number.isFinite(when))return [];
     const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(when));
     const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
     const date=p.year+'-'+p.month+'-'+p.day;
     const clock=p.hour+':'+p.minute+':00';
     // Match the 3 km walking-search envelope used in the AURA coverage audit.
     // These are straight-line candidate stops, not verified pedestrian routes:
     // completeWalks must still calculate exact walking distances and times.
     const base={operator,resource:{...resource,format:'GTFS'},fetcher,signal,
      from:pt(task.from),to:pt(task.to),radiusMeters:3000,maxResults:20,includeTransfers:true};
     const searchParams={...base,date,...(window.arriveBy?{latestArrival:clock}:{earliestDeparture:clock})};
     let result=await r.CPNationalGTFSJourneys.loadAndSearch(searchParams);
     // A second, bounded stop search is useful when the closest coach terminal
     // is outside 3 km (e.g. Lyon Perrache/Gerland vs Part-Dieu).
     // Candidate radius is NOT a validated pedestrian distance: completeWalks
     // still verifies walking geometry, timing and mission margin.
     const initialRows=Array.isArray(result?.journeys)?result.journeys:[];
     // Coaches can have a distant terminal even when nearby indirect services
     // exist. Search farther for a DIRECT coach, not just when results are empty.
     // SNCF keeps the cheaper empty-only fallback to limit GTFS query load.
     const hasDirect=initialRows.some(j=>j&&(!Array.isArray(j.legs)||j.legs.length<=1));
     const needExpanded=!initialRows.length||
      (operator!=='sncf'&&!hasDirect);
     let rows=initialRows;
     if(needExpanded&&!signal?.aborted&&opts.nationalStopFallback!==false){
      // Un échec du repli ne doit jamais faire perdre les résultats à 3 km (constaté en navigateur réel le 14/11/2026 :
      // le rayon de 6 km était refusé par le moteur, limité à 5 km → « Invalid walking search radius » pour tout le fournisseur).
      const expanded=await r.CPNationalGTFSJourneys.loadAndSearch({...searchParams,radiusMeters:5000}).catch(e=>{if(signal?.aborted)throw e;return null;});
      if(Array.isArray(expanded?.journeys)&&expanded.journeys.length){
       const seen=new Set(rows.map(j=>JSON.stringify([j.tripId,j.line,j.departure,j.arrival,j.originStop?.stop_id||j.originStop?.name,j.destinationStop?.stop_id||j.destinationStop?.name])));
       for(const j of expanded.journeys){
        const key=JSON.stringify([j.tripId,j.line,j.departure,j.arrival,j.originStop?.stop_id||j.originStop?.name,j.destinationStop?.stop_id||j.destinationStop?.name]);
        if(!seen.has(key)){seen.add(key);rows.push(j);}
       }
      }
     }
     // After midnight, a service with GTFS time 24:30 belongs to yesterday's service date.
     // Query the previous service day as well, without inventing a new train or bus.
     if(Number(p.hour)<6){
      const previous=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
      const afterMidnight=(Number(p.hour)+24)+':'+p.minute+':00';
      const overnight=await r.CPNationalGTFSJourneys.loadAndSearch({
       ...base,date:previous,...(window.arriveBy?{earliestDeparture:'24:00:00',latestArrival:afterMidnight}
        :{earliestDeparture:afterMidnight})});
      rows=rows.concat(overnight.journeys||[]);
     }
     let out=fromNationalGTFS(rows,operator);
     // Cars FlixBus / BlaBlaCar Bus depuis les gares routières de Lyon (Part-Dieu, Perrache, Gerland) quand le départ ou l'arrivée
     // est trop loin pour y aller à pied (Corbas, Saint-Priest…) : l'accès est calculé ensuite par le serveur OTP2 (TCL), jamais estimé.
     if(operator!=='sncf'&&!signal?.aborted&&opts.lyonCoachAccess===true){
      for(const side of ['from','to']){
       const far=pt(task[side]);if(!far)continue;
       const near=LYON_COACH_ANCHORS.filter(a=>{const d=meters(far,a);return d>3500&&d<=25000;});
       if(!near.length)continue;
       const anchor=near.sort((a,b)=>meters(far,a)-meters(far,b))[0];
       const other=pt(task[side==='from'?'to':'from']);if(!other)continue;
       const extra=await r.CPNationalGTFSJourneys.loadAndSearch({...searchParams,[side]:{lat:anchor.lat,lon:anchor.lon},radiusMeters:3500}).catch(()=>null);
       const found=Array.isArray(extra?.journeys)?extra.journeys:[];
       if(found.length)out=out.concat(fromNationalGTFS(found,operator).map(j=>({...j,needsAccess:{side,anchor:anchor.name}})));
      }
     }
     return out;
    }};
  }
 }
 // OTP2 : uniquement si le propriétaire a configuré et activé son serveur HTTPS.
 // La requête GraphQL dépend du schéma exact de l'instance ; elle est fournie explicitement.
 if(r.CPOTPClient&&typeof r.CPOTPClient.search==='function')P.otp={
  name:'OpenTripPlanner (GTFS)',
  enabled:task=>opts.allowOTP===true&&typeof opts.otpEndpoint==='string'&&
   typeof opts.otpQuery==='function'&&!!queryWindow(task),
  disabledReason:'OTP2 non configuré : serveur HTTPS et requête GraphQL nécessaires',
  run:async(task,signal)=>{
   const w=queryWindow(task),request=opts.otpQuery(task,w);
   if(!request||typeof request.query!=='string'||!request.query.trim())return [];
   if(signal?.aborted)return [];
   const go=t=>r.CPOTPClient.search({
    enabled:true,endpoint:opts.otpEndpoint,query:request.query,
    variables:request.variables||{},fetch:fetcher,timeoutMs:t,signal
   });
   let response;
   try{response=await go(opts.otpTimeoutMs);}
   catch(e){
    // Démarrage à froid du serveur : la première requête le réveille, une seconde tentative aboutit souvent.
    if(signal?.aborted||!/délai dépassé/.test(String(e&&e.message||e)))throw e;
    response=await go(Math.min(60000,(Number(opts.otpTimeoutMs)||30000)+5000));
   }
   if(signal?.aborted)return [];
   return response.journeys;
  },
  timeoutMs:(Number(opts.otpTimeoutMs)||30000)*2+10000
 };
 if(r.CPTripGo&&typeof r.CPTripGo.plan==='function')P.tripgo={name:'TripGo',enabled:()=>{try{return opts.allowTripGo===true&&!!r.CPTripGo.getKey();}catch(_){return false;}},
  disabledReason:'TripGo désactivé : accès API entreprise requis ; non disponible pour Convoyage Ultra sans autorisation contractuelle',
  run:async(task,signal)=>{const w=queryWindow(task);if(!w)return [];
   const deadline=ms(task.latestArrival);
   const answer=await r.CPTripGo.plan({from:pt(task.from),to:pt(task.to),when:w.when,arriveBy:w.arriveBy,signal,fetcher,
    ...(!w.arriveBy&&Number.isFinite(deadline)&&deadline>ms(w.when)?{latestArrival:new Date(deadline).toISOString()}:{})});
   return fromTripGo(answer);}};
 if(r.CPSwissTransport&&typeof r.CPSwissTransport.plan==='function')P.swiss={name:'Suisse',
  enabled:task=>inSwissArea(pt(task.from))||inSwissArea(pt(task.to)),disabledReason:'trajet hors zone suisse et Grand Genève',
  run:async task=>{const w=queryWindow(task);if(!w)return [];const f=pt(task.from),t=pt(task.to);
   // Nouvelles tentatives après une coupure réseau (« fetch failed » observé en réel, parfois sur tout un passage) :
   // 3 essais au total, après 1,5 s puis 4 s, dans la limite du délai du moteur.
   const wait=ms=>new Promise(res=>setTimeout(res,ms));
   const once=o=>r.CPSwissTransport.plan(o).catch(()=>wait(1500).then(()=>r.CPSwissTransport.plan(o)))
    .catch(()=>wait(4000).then(()=>r.CPSwissTransport.plan(o)));
   let res=await once({from:f,to:t,when:w.when,arriveBy:w.arriveBy,limit:8,fetcher});
   // Coordonnée non reconnue (fréquent côté France) : nouvelle recherche de gare à gare, gares choisies par l'API elle-même.
   if((!res||!res.length)&&typeof r.CPSwissTransport.nearestStation==='function'){
    const [a,b]=await Promise.all([r.CPSwissTransport.nearestStation(f,fetcher),r.CPSwissTransport.nearestStation(t,fetcher)]);
    if(a&&b&&a.id!==b.id)res=await once({from:a.id,to:b.id,when:w.when,arriveBy:w.arriveBy,limit:8,fetcher});
   }
   return fromSwiss(res);}};
 // OJP (opentransportdata.swiss) : relais serveur uniquement (ojp-relais), jeton jamais côté app. Désactivé sans
 // session connectée ou hors zone suisse/Grand Genève. Noms de lieu (task.fromCity/toCity) requis : OJP résout
 // lui-même la référence exacte (StopPlaceRef/StopPointRef) ; aucune référence n'est fabriquée ici.
 if(r.CPTransportOJP&&typeof r.CPTransportOJP.tripRequest==='function')P.ojp={name:'OJP Suisse',
  enabled:task=>!!opts.ojpSession&&!!task.fromCity&&!!task.toCity&&(inSwissArea(pt(task.from))||inSwissArea(pt(task.to))),
  disabledReason:'relais OJP non connecté, communes inconnues, ou trajet hors zone suisse',
  run:async(task,signal)=>{
   const w=queryWindow(task);if(!w)return [];
   const O=r.CPTransportOJP,session=opts.ojpSession;
   const resolve=async name=>{
    if(!name)return null;
    let xml;try{xml=await O.relayPost(session,O.locationRequest(name),fetcher);}catch(_){return null;}
    const locs=O.parseLocations(xml).filter(l=>l.refType&&!l.reason);
    return locs[0]||null;
   };
   const [from,to]=await Promise.all([resolve(task.fromCity),resolve(task.toCity)]);
   if(signal?.aborted||!from||!to)return [];
   const body=O.tripRequest(from,to,w.when,{});
   if(!body)return [];
   let tripXml;try{tripXml=await O.relayPost(session,body,fetcher);}catch(_){return [];}
   if(signal?.aborted)return [];
   const trips=O.parseTrips(tripXml);
   if(!trips.length)return [];
   // OJP n'a pas de paramètre « arriver après »/« arriver avant » distinct (tripRequest ne prend qu'un seul
   // DepArrTime) : l'API peut renvoyer un trajet légèrement avant l'instant demandé (constaté en réel le 15/11/2026).
   // Sans danger (un tel trajet est de toute façon rejeté par assess()), mais filtré ici pour ne pas encombrer la
   // fiche mission d'un « Transport non confirmé » de plus que nécessaire — même logique que les fournisseurs GTFS
   // locaux/nationaux, qui filtrent déjà leurs candidats par la fenêtre demandée.
   const target=ms(w.when);
   const fitsWindow=trip=>{
    const timed=(trip.legs||[]).filter(l=>l&&l.kind==='timed');
    if(!timed.length)return false;
    const dep=ms(timed[0].departure),arr=ms(timed[timed.length-1].arrival);
    if(!Number.isFinite(dep)||!Number.isFinite(arr)||!Number.isFinite(target))return true; // doute : on garde, assess() tranchera
    return w.arriveBy?arr<=target+60000:dep>=target-60000;
   };
   const windowed=trips.filter(fitsWindow);
   if(!windowed.length)return [];
   const entries=await Promise.all(windowed.map(async trip=>{
    let price=null;
    const fareBody=O.fareRequest(trip,{});
    if(fareBody){
     try{const fareXml=await O.relayPost(session,fareBody,fetcher);price=O.parseFare(fareXml,trip,{}).price;}catch(_){/* prix indisponible : la portion restera « Prix à confirmer » */}
    }
    return {trip,price};
   }));
   if(signal?.aborted)return [];
   return fromOJP(entries,{origin:pt(task.from),destination:pt(task.to)});
  }};
 if(r.CPRegionalRouting&&typeof r.CPRegionalRouting.plan==='function')P.regional={name:'Mobilités M',
  enabled:task=>!!opts.regionalEndpoint||r.CPRegionalRouting.supportsPublic?.(pt(task.from),pt(task.to)),disabledReason:'hors agglomération grenobloise',
  run:async(task,signal)=>{const w=queryWindow(task);if(!w)return [];
   const answer=await r.CPRegionalRouting.plan({signal,endpoint:opts.regionalEndpoint,from:pt(task.from),to:pt(task.to),
    departure:w.arriveBy?undefined:w.when,arrivalDeadline:w.arriveBy?w.when:undefined,fetcher});
   return fromRegional(answer.itineraries,answer.source||'Mobilités M');}};
 if(r.CPSncfFallback&&typeof r.CPSncfFallback.plan==='function')P.sncf={name:'SNCF',
  enabled:task=>!!(task.fromName||pt(task.from))&&!!(task.toName||pt(task.to)),disabledReason:'communes inconnues',
  run:async(task,signal)=>{const w=queryWindow(task);if(!w)return [];
   // Trois recherches décalées (+0, +20, +60 min) puis un seul trajet par train de départ (le plus rapide) :
   // évite 8 variantes du même premier train, souvent manqué à cause de la marche jusqu'à la gare.
   const base=ms(w.when),offsets=w.arriveBy?[0,-20,-60]:[0,20,60];
   const answers=await Promise.all(offsets.map(m=>r.CPSncfFallback.plan({from:{name:task.fromCity||'',point:pt(task.from)},to:{name:task.toCity||'',point:pt(task.to)},
    when:new Date(base+m*60000).toISOString(),arriveBy:w.arriveBy,limit:10,signal,fetcher}).catch(()=>null)));
   const best=new Map();
   for(const a of answers.filter(Boolean))for(const it of a.itineraries||[]){
    const k=(it.legs?.[0]?.tripId||'')+'|'+it.departure,old=best.get(k);
    if(!old||Date.parse(it.arrival)<Date.parse(old.arrival))best.set(k,it);
   }
   const list=[...best.values()].sort((x,y)=>Date.parse(x.departure)-Date.parse(y.departure)).slice(0,10);
   return fromSNCF({itineraries:list,sourceVersion:answers.find(Boolean)?.sourceVersion});}};
 return P;
}

/* ---------- Accès aux gares routières éloignées (OTP2) ---------- */
async function accessFor(j,task,otp,signal){
 const side=j.needsAccess.side,legs=j.legs,gap=10*60000;
 const first=legs[0],last=legs[legs.length-1],miss=t=>({...j,needsAccess:undefined,missing:[...(j.missing||[]),t]});
 if(!otp||!otp.run||!(()=>{try{return otp.enabled(task);}catch(_){return false;}})())return miss('accès à la gare routière non calculé (serveur OTP2 non disponible)');
 let t2;
 if(side==='from'){const dep=ms(first.departure),target=pt(first.fromPoint);if(!Number.isFinite(dep)||!target||!pt(task.from))return miss('accès à la gare routière non calculable');
  t2={...task,label:task.label,from:task.from,to:target,toName:first.from,latestArrival:new Date(dep-gap).toISOString(),marginMinutes:10,walkMaxMeters:undefined};delete t2.windowKind;}
 else{const arr=ms(last.arrival),from=pt(last.toPoint);if(!Number.isFinite(arr)||!from||!pt(task.to))return miss('trajet depuis la gare routière non calculable');
  t2={...task,from,fromName:last.to,to:task.to,earliestDeparture:new Date(arr+gap).toISOString(),marginMinutes:10,walkMaxMeters:undefined};delete t2.windowKind;
  if(!Number.isFinite(ms(task.latestArrival)))delete t2.latestArrival;}
 let list=[];try{list=await otp.run(t2,signal)||[];}catch(e){return miss('accès à la gare routière non calculé ('+String(e&&e.message||e).slice(0,60)+')');}
 const ok=list.filter(a=>a&&Array.isArray(a.legs)&&a.legs.length&&a.legs.every(l=>l&&Number.isFinite(ms(l.departure))&&Number.isFinite(ms(l.arrival))));
 let best=null;
 if(side==='from'){const dep=ms(first.departure);const fit=ok.filter(a=>ms(a.legs[a.legs.length-1].arrival)<=dep-gap&&(!Number.isFinite(ms(task.earliestDeparture))||ms(a.legs[0].departure)>=ms(task.earliestDeparture)));
  best=fit.sort((a,b)=>ms(b.legs[b.legs.length-1].arrival)-ms(a.legs[a.legs.length-1].arrival))[0];}
 else{const arr=ms(last.arrival);const fit=ok.filter(a=>ms(a.legs[0].departure)>=arr+gap);best=fit.sort((a,b)=>ms(a.legs[a.legs.length-1].arrival)-ms(b.legs[b.legs.length-1].arrival))[0];}
 if(!best)return miss('aucun accès à la gare routière trouvé dans les horaires');
 const merged=side==='from'?[...best.legs,...legs]:[...legs,...best.legs];
 return {...j,needsAccess:undefined,legs:merged,sources:[...new Set([...(j.sources||[j.source]),...(best.sources||[best.source]).filter(Boolean)])],
  missing:[...(j.missing||[])],alerts:[...(j.alerts||[]),'Accès à la gare routière calculé par OpenTripPlanner (horaires théoriques).']};
}

/* ---------- Session ---------- */
function createSession({tasks=[],providers={},router=null,scooterRouter=null,scooter=null,fareFor=null,walkMaxKm=3,timeoutMs=25000,onUpdate=()=>{}}={}){
 tasks=tasks.map(t=>({...t,walkMaxMeters:Number.isFinite(t.walkMaxMeters)?t.walkMaxMeters:(Number.isFinite(walkMaxKm)&&walkMaxKm>0?walkMaxKm*1000:undefined)}));
 const state={},controller=new AbortController();let disposed=false;
 // Mises à jour regroupées (au plus une par 350 ms et par direction) : chaque résultat réseau ne reconstruit plus toute la fiche,
 // ce qui figeait l'écran au défilement quand plusieurs jours sont cherchés en parallèle.
 const lastEmit={},timers={};
 const emitNow=label=>{if(!disposed)try{onUpdate(label,view(label));}catch(_){}};
 const emit=label=>{
  if(disposed)return;
  const now=Date.now(),wait=350-(now-(lastEmit[label]||0));
  const finished=state[label]&&state[label].pending===0;
  if(finished){if(timers[label]){clearTimeout(timers[label]);timers[label]=null;}lastEmit[label]=now;emitNow(label);return;}
  if(wait<=0&&!timers[label]){lastEmit[label]=now;emitNow(label);return;}
  if(timers[label])return;
  timers[label]=setTimeout(()=>{timers[label]=null;lastEmit[label]=Date.now();emitNow(label);},Math.max(0,wait));
 };
 // Un trajet qui part avant la fin de la mission précédente (souvent à cause de la marche d'accès) est impossible,
 // pas « non confirmé » : il n'est plus affiché, seul son nombre est indiqué (178 cartes inutiles sur 1 013 au
 // diagnostic réel du 14/11/2026).
 function view(label){const s=state[label];
  const tooEarly=s.items.filter(j=>!j.computing&&(j.reasons.includes('départ avant la fin de la mission précédente')||j.reasons.includes('trajet hors plage de jour ou date de mission')||j.reasons.some(r=>r.startsWith('arrivée trop tôt pour le créneau choisi')||r.startsWith('marche trop longue'))));
  // Si la limite de marche (Paramètres) écarte TOUTES les propositions, on les montre quand même, clairement marquées « marche supérieure à la limite »,
  // plutôt qu'« Aucun trajet trouvé » : seul un trajet dont la marche est la seule objection est repris.
  const isLongOnly=j=>!j.computing&&j.reasons.some(r=>r.startsWith('marche trop longue'))&&!j.reasons.includes('départ avant la fin de la mission précédente')&&!j.reasons.includes('trajet hors plage de jour ou date de mission')&&!j.reasons.some(r=>r.startsWith('arrivée trop tôt pour le créneau choisi'));
  let shown=tooEarly.length?s.items.filter(j=>!tooEarly.includes(j)):s.items;
  let longShown=0;
  if(!shown.some(j=>!j.computing)&&s.pending===0){const back=tooEarly.filter(isLongOnly);if(back.length){shown=shown.concat(back);longShown=back.length;}}
  return {task:s.task,longShown,...rank(shown,s.task),hidden:{tooEarly:tooEarly.length-longShown,before:tooEarly.filter(j=>j.reasons.includes('départ avant la fin de la mission précédente')).length,early:tooEarly.filter(j=>j.reasons.some(r=>r.startsWith('arrivée trop tôt'))).length,longWalk:tooEarly.filter(j=>j.reasons.some(r=>r.startsWith('marche trop longue'))).length-longShown,night:tooEarly.filter(j=>j.reasons.includes('trajet hors plage de jour ou date de mission')).length},pending:s.pending,errors:{...s.errors},skipped:{...s.skipped},received:{...s.received},discarded:{...s.discarded},done:s.pending===0,
  diag:(()=>{const c={};let noTimes=0;for(const j of s.items){if(j.durationMinutes===null||j.durationMinutes===undefined)noTimes++;for(const r of [...(j.reasons||[]),...(j.missing||[])]){const k=String(r).replace(/\d+/g,'N').slice(0,90);c[k]=(c[k]||0)+1;}}
   return {evaluated:s.items.length,noTimes,reasons:Object.entries(c).sort((x,y)=>y[1]-x[1]).slice(0,5)};})()};}
 async function add(label,source,journeys){
  const s=state[label];if(!s||disposed)return;
  s.received[source]=(s.received[source]||0)+(Array.isArray(journeys)?journeys.length:0);
  const cancelled=x=>x&&(x.cancelled===true||x.canceled===true||/^(cancelled|canceled|annul)/i.test(String(x.status||'')));
  const usable=(Array.isArray(journeys)?journeys:[]).map(j=>renameEnds(j,s.task)).filter(j=>j&&!cancelled(j)&&Array.isArray(j.legs)&&j.legs.length&&
   !j.legs.some(l=>cancelled(l)||BOATS.test(l.mode+' '+(l.line||''))));
  // Point d'arrivée ou de départ approximatif (adresse trouvée seulement au niveau de la voie ou de la commune) : le test « marcher
  // directement serait aussi court » n'est pas fiable (l'écart de plusieurs km vient de l'approximation), on garde le trajet.
  let clean=usable.filter(j=>(s.task.approximateEndpoint||!walkDetour(j,s.task)||j.needsAccess)&&!excessiveDetour(j,s.task));
  // Cars depuis une gare routière éloignée : accès (TCL…) calculé par OTP2, 6 cars au plus par moteur ; sans accès calculé, le car reste signalé « accès non calculé ».
  if(clean.some(j=>j.needsAccess)){
   const withAccess=clean.filter(j=>j.needsAccess).sort((a,b)=>ms(a.departure||a.legs[0]?.departure)-ms(b.departure||b.legs[0]?.departure)).slice(0,6);
   const resolved=await Promise.all(withAccess.map(j=>accessFor(j,s.task,providers.otp,controller.signal)));
   clean=clean.filter(j=>!j.needsAccess).concat(resolved);
  }
  if(clean.length!==usable.length)s.discarded[source]=(s.discarded[source]||0)+usable.length-clean.length;
  // 1) Doublon d'un trajet déjà traité (autre moteur) : on ajoute la source, sans recalculer les marches.
  // 2) Trajet déjà hors délai sur ses seuls horaires : affiché « non confirmé » sans dépenser de marche.
  // 3) Les autres (8 au plus, les plus utiles d'abord) reçoivent leurs marches et s'affichent dès qu'ils sont prêts.
  const toWalk=[];
  for(const j of clean){
   const key=signature(j),known=key&&s.bySignature.get(key);
   if(known){known.sources=[...new Set([...known.sources,...(j.sources||[j.source])])];continue;}
   const quick=assess(j,s.task,fareFor);
   if(quick.reasons.some(r=>/arrivée après|marge insuffisante|départ avant|horaires incohérents|annulée/.test(r))){
    if(key)s.bySignature.set(key,quick);s.items.push(quick);continue;
   }
   toWalk.push({j,key,quick});
  }
  const isReturn=Number.isFinite(ms(s.task.earliestDeparture))&&!Number.isFinite(ms(s.task.latestArrival));
  // Priorité : prix connu d'abord (moins cher en tête), puis le plus utile (retour : départ le plus tôt ; aller : avance la plus juste).
  const pk=q=>q.price.status==='verified'||q.price.status==='free'?priceSortKey(q.price):Infinity;
  // Le budget de marches est partagé entre les moteurs. Sans priorité dédiée,
  // les premiers TER/bus locaux consomment les huit couples de points et les
  // cars longue distance restent indéfiniment « marches non calculées ».
  const coachPriority=t=>/(?:flixbus|blablacar\s*(?:bus|coach)|blablacarbus|ouibus)/i.test(
   [t.j.source,...(t.j.sources||[]),...(t.j.legs||[]).map(l=>l.provider||'')].join(' '))?0:1;
  toWalk.sort((a,b)=>coachPriority(a)-coachPriority(b)||
   (pk(a.quick)===pk(b.quick)?0:pk(a.quick)-pk(b.quick))||
   (isReturn?ms(a.quick.departure)-ms(b.quick.departure):(a.quick.slackMinutes??0)-(b.quick.slackMinutes??0))||a.quick.durationMinutes-b.quick.durationMinutes);
  // Affichage immédiat : chaque trajet apparaît tout de suite, « marches en cours de calcul », puis est remplacé.
  const pendingCard=new Map();
  for(const t of toWalk){
   const p=assess({...t.j,missing:[...(t.j.missing||[]),'marches en cours de calcul']},s.task,fareFor);p.computing=true;
   pendingCard.set(t,p);s.items.push(p);if(t.key)s.bySignature.set(t.key,p);
  }
  emit(label);
  const replace=(t,a)=>{const old=pendingCard.get(t);const i=s.items.indexOf(old);
   if(old)a.sources=[...new Set([...a.sources,...(old.sources||[])])];
   if(i>=0)s.items[i]=a;else s.items.push(a);if(t.key)s.bySignature.set(t.key,a);};
  const walkBatch=batch=>Promise.all(batch.map(t=>completeWalks(t.j,s.task,router,{enabled:!!(scooter&&scooter.enabled&&scooterRouter),router:scooterRouter,maxKm:scooter&&scooter.maxKm,speedKmh:scooter&&scooter.speedKmh}).then(x=>{
   if(disposed)return;replace(t,assess(x,s.task,fareFor));emit(label);
  }).catch(()=>{
   // Ne pas laisser une carte bloquée sur « marches en cours de calcul »
   // lorsqu'un fournisseur piéton échoue ou dépasse son délai.
   if(disposed)return;
   replace(t,assess({...t.j,missing:[...(t.j.missing||[]),'marche non calculée (erreur du moteur piéton)']},s.task,fareFor));
   emit(label);
  })));
  // Quota compté en couples de points réellement à calculer, pas en trajets : les départs successifs d'une même
  // ligne partagent leurs arrêts, donc leurs marches (cache). Avant le 14/11/2026 seuls 8 à 16 trajets par moteur
  // recevaient leurs marches, même quand tous utilisaient les deux mêmes arrêts (diagnostic réel : 53,7 % des
  // trajets évalués, pour seulement 155 requêtes piétonnes sur 23 axes).
  const seen=s.walkPairs,select=(list,budget)=>{const take=[],rest=[];
   for(const t of list){const fresh=walkPairs(t.j,s.task).filter(k=>!seen.has(k));
    if(fresh.length<=budget){budget-=fresh.length;fresh.forEach(k=>seen.add(k));take.push(t);}else rest.push(t);}
   return [take,rest];};
  // Réserver un petit budget par compagnie de cars : les autres moteurs
  // arrivent en parallèle et peuvent avoir déjà consommé le quota commun.
  // Un budget local ne doit pas dépendre de l'ordre des réponses réseau.
  const coachSource=/(?:flixbus|blablacar\s*(?:bus|coach)|blablacarbus|ouibus)/i.test(source);
  const coachKey=coachSource?(/flixbus/i.test(source)?'flixbus':'blablacarBus'):null;
  // Une réserve indépendante doit accepter les couples déjà vus sans
  // consommer de crédit supplémentaire et ne pas se bloquer après 4 couples.
  const coachBudget=coachKey?Math.max(0,4-(s.coachWalkPairs[coachKey]||0)):0;
  const before=s.walkPairs.size;
  let [batch,rest]=select(toWalk,coachSource?coachBudget:8);
  if(coachKey)s.coachWalkPairs[coachKey]=(s.coachWalkPairs[coachKey]||0)+s.walkPairs.size-before;
  await walkBatch(batch);
  // Recherche complémentaire : si rien n'est encore réalisable dans cette direction, 8 couples de plus.
  // Les cars ne doivent pas perdre leur marche parce qu'un TER est déjà
  // réalisable. Le second lot reste limité, sans dépasser le quota prévu.
  if(!disposed&&rest.length&&(coachSource||!s.items.some(x=>x.feasible))){
   // Quota total car : huit nouveaux couples au maximum, deux lots de quatre.
   // Décompter les couples déjà réservés au premier lot et ceux partagés
   // avec les autres moteurs, plutôt que réouvrir un quota illimité.
   const remaining=coachKey?Math.max(0,8-(s.coachWalkPairs[coachKey]||0)):8;
   const beforeSecond=s.walkPairs.size;
   [batch,rest]=select(rest,coachSource?Math.min(4,remaining):8);
   if(coachKey)s.coachWalkPairs[coachKey]=(s.coachWalkPairs[coachKey]||0)+s.walkPairs.size-beforeSecond;
   await walkBatch(batch);
  }
  for(const t of rest){ // au-delà : visibles, marches non calculées pour préserver le quota Valhalla
   replace(t,assess({...t.j,missing:[...(t.j.missing||[]),'marches non calculées (quota de la fiche)']},s.task,fareFor));
  }
  if(!disposed)emit(label);
 }
 // Jours non affichés (task.lazy) : leurs recherches ne démarrent qu'à l'ouverture de l'onglet (start(label)), pour ne pas saturer le téléphone.
 const lazy={};
 const launch=task=>{
  const label=task.label;
  if(!pt(task.from)||!pt(task.to)){state[label].errors.adresses='adresse GPS manquante';emit(label);return;}
  // Ne lancer aucun fournisseur ni marche si la fenêtre temporelle est impossible.
  if(!queryWindow(task)){
   state[label].errors.horaires='créneau impossible : livraison trop tardive pour arriver avec la marge requise, ou horaires absents';
   emit(label);return;
  }
  // Fenêtre d'arrivée large (ex. 08:00–19:00) : une seule recherche « arriver avant 19:00 » ne renvoie que les trajets de l'après-midi.
  // Une seconde recherche « arriver avant l'ouverture » (08:00) ramène les trajets du matin ; les deux se complètent dans la même liste.
  const variants=[task];
  if(task.windowKind==='arrival'&&Number.isFinite(task.windowStartMs)&&Number.isFinite(ms(task.latestArrival))&&ms(task.latestArrival)-task.windowStartMs>3*3600000){
   const open=parisDayParts(new Date(task.windowStartMs).toISOString());
   if(open&&open.minute>=375)variants.push({...task,latestArrival:new Date(task.windowStartMs).toISOString(),windowKind:undefined,windowStartMs:undefined,windowEndMs:undefined,_avantOuverture:true});
  }
  // Une recherche ne renvoie que les 5 à 10 trajets les plus proches de son heure : pour une fenêtre large, on ajoute des recherches
  // en milieu de journée (départs à 12:45 et 14:30, ou arrivées avant 12:30 et 15:00) afin que le début d'après-midi ne soit pas absent.
  if((task.windowKind==='departure'||task.windowKind==='arrival')&&Number.isFinite(task.windowStartMs)&&Number.isFinite(task.windowEndMs)){
   const startP=parisDayParts(new Date(task.windowStartMs).toISOString());
   if(startP)for(const minute of task.windowKind==='departure'?[765,870]:[750,900]){
    const at=task.windowStartMs+(minute-startP.minute)*60000;
    if(at<=task.windowStartMs+30*60000||at>=task.windowEndMs-30*60000)continue;
    const iso=new Date(at).toISOString();
    variants.push(task.windowKind==='departure'?{...task,earliestDeparture:iso,windowKind:undefined,windowStartMs:undefined,windowEndMs:undefined,_milieuJournee:true}
     :{...task,latestArrival:iso,windowKind:undefined,windowStartMs:undefined,windowEndMs:undefined,_milieuJournee:true});
   }
  }
  for(const variant of variants)for(const [key,p] of Object.entries(providers)){
   let ok=false;try{ok=p.enabled(variant)&&!!queryWindow(variant);}catch(_){}
   if(!ok){if(variant===task)state[label].skipped[p.name]=p.disabledReason||'non applicable';continue;}
   state[label].pending++;
   // Délai borné par moteur (idée reprise du module ChatGPT transport_mission_search.js).
   const limitMs=Number.isFinite(p.timeoutMs)&&p.timeoutMs>timeoutMs?p.timeoutMs:timeoutMs;
   const bounded=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('délai fournisseur dépassé ('+Math.round(limitMs/1000)+' s)')),limitMs);
    Promise.resolve().then(()=>p.run(variant,controller.signal)).then(v=>{clearTimeout(t);resolve(v);},e=>{clearTimeout(t);reject(e);});});
   bounded.then(js=>add(label,p.name,js)).catch(e=>{
    if(!disposed)state[label].errors[p.name]=String(e&&e.message||e).slice(0,140);
   }).finally(()=>{if(disposed)return;state[label].pending--;emit(label);});
  }
  state[label].pending++;
  walkOnly(task,router,walkMaxKm).then(w=>w&&state[label].items.push(assess(w,task,fareFor))).catch(()=>{})
   .finally(()=>{if(disposed)return;state[label].pending--;emit(label);});
  if(scooter&&scooter.enabled&&scooterRouter){
   state[label].pending++;
   scooterOnly(task,scooterRouter,{maxKm:scooter.maxKm,speedKmh:scooter.speedKmh}).then(w=>w&&state[label].items.push(assess(w,task,fareFor))).catch(()=>{})
    .finally(()=>{if(disposed)return;state[label].pending--;emit(label);});
  }
  emit(label);
 };
 for(const task of tasks){
  const label=task.label;state[label]={task,items:[],pending:0,errors:{},skipped:{},received:{},discarded:{},bySignature:new Map(),walkPairs:new Set(),coachWalkPairs:{flixbus:0,blablacarBus:0}};
  if(task.lazy){state[label].pending=1;lazy[label]=()=>{state[label].pending--;launch(task);};continue;}
  launch(task);
 }
 return {start:label=>{const f=lazy[label];if(f){delete lazy[label];if(!disposed)f();}},ingest:(label,source,journeys)=>add(label,source,journeys),view,
  dispose:()=>{disposed=true;controller.abort();},signal:controller.signal};
}

/* ---------- Affichage (cartes Android) ---------- */
function dayText(v){const t=ms(v);return Number.isFinite(t)?new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Paris'}).format(new Date(t)):'?';}
function clock(v){const t=ms(v);return Number.isFinite(t)?new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(new Date(t)):'?';}
function durationText(min){min=Math.round(min);return min>=60?Math.floor(min/60)+' h '+String(min%60).padStart(2,'0')+' min':min+' min';}
function signedDurationText(min){return min<0?'-'+durationText(Math.abs(min)):durationText(min);}
const ICON={Marche:'🚶',Trottinette:'🛴',Train:'🚆',Bus:'🚌',Car:'🚍',Tram:'🚊',Métro:'🚇',Funiculaire:'🚡',Transport:'🚏'};
function el(doc,tag,cls,text){const e=doc.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function mapSvg(doc,j){
 // Éviter la duplication de milliers de coordonnées GPS pour chaque carte.
 // Les géométries d'origine restent intactes ; seul le SVG est échantillonné.
 const pts=[];for(const l of j.legs){if(l.geometry&&l.geometry.length)pts.push(...l.geometry);else{if(l.fromPoint)pts.push(l.fromPoint);if(l.toPoint)pts.push(l.toPoint);}}
 if(pts.length<2)return null;
 // Projection Web Mercator, identique à celle des tuiles OpenStreetMap : le tracé se superpose exactement au fond de carte.
 const W=340,H=250,PAD=16,T=256;
 const mx=lon=>(lon+180)/360;
 const my=lat=>{const r=Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180;return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2;};
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(const p of pts){x0=Math.min(x0,mx(p.lon));x1=Math.max(x1,mx(p.lon));y0=Math.min(y0,my(p.lat));y1=Math.max(y1,my(p.lat));}
 const spanX=Math.max(x1-x0,1e-7),spanY=Math.max(y1-y0,1e-7);
 const z=Math.max(3,Math.min(17,Math.floor(Math.min(Math.log2((W-2*PAD)/(spanX*T)),Math.log2((H-2*PAD)/(spanY*T))))));
 const scale=T*Math.pow(2,z),cx=(x0+x1)/2*scale,cy=(y0+y1)/2*scale;
 const X=p=>W/2+(mx(p.lon)*scale-cx),Y=p=>H/2+(my(p.lat)*scale-cy);
 const NS='http://www.w3.org/2000/svg',svg=doc.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('class','cp-hub-map');svg.setAttribute('role','img');svg.setAttribute('aria-label','Carte OpenStreetMap des transports et tracés piétons disponibles, sans marche inventée.');
 const bg=doc.createElementNS(NS,'rect');bg.setAttribute('width',W);bg.setAttribute('height',H);bg.setAttribute('fill','#e8e6df');svg.appendChild(bg);
 // Fond de carte : tuiles OpenStreetMap (gratuites, attribution affichée). Hors ligne, le fond reste uni et le tracé visible.
 const n=Math.pow(2,z),txMin=Math.floor((cx-W/2)/T),txMax=Math.floor((cx+W/2)/T),tyMin=Math.max(0,Math.floor((cy-H/2)/T)),tyMax=Math.min(n-1,Math.floor((cy+H/2)/T));
 // Tuiles chargées seulement quand la carte arrive à l'écran (des dizaines de cartes par fiche ralentissaient le défilement du téléphone).
 const tileNodes=[];
 for(let tx=txMin;tx<=txMax;tx++)for(let ty=tyMin;ty<=tyMax;ty++){
  const im=doc.createElementNS(NS,'image');
  im.setAttribute('x',tx*T-cx+W/2);im.setAttribute('y',ty*T-cy+H/2);im.setAttribute('width',T);im.setAttribute('height',T);
  im.setAttribute('class','cp-hub-tile');
  const url='https://tile.openstreetmap.org/'+z+'/'+(((tx%n)+n)%n)+'/'+ty+'.png';
  tileNodes.push([im,url]);svg.appendChild(im);
 }
 const loadTiles=()=>{for(const [im,url] of tileNodes)im.setAttribute('href',url);tileNodes.length=0;};
 const IO=doc.defaultView&&doc.defaultView.IntersectionObserver;
 if(IO){try{const io=new IO(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();loadTiles();}},{rootMargin:'200px'});io.observe(svg);svg.__cpTiles=io;}catch(_){loadTiles();}}
 else loadTiles();
 for(const l of j.legs){
  const line=l.geometry&&l.geometry.length?l.geometry:(l.kind==='walk'||l.kind==='scooter'?[]:[l.fromPoint,l.toPoint].filter(Boolean));if(line.length<2)continue;
  // Maximum 500 sommets par tronçon à l'écran ; conserver départ et arrivée.
  const step=Math.max(1,Math.ceil((line.length-1)/499));
  const rendered=[];for(let i=0;i<line.length-1;i+=step)rendered.push(line[i]);
  rendered.push(line[line.length-1]);
  const coords=rendered.map(p=>X(p).toFixed(1)+','+Y(p).toFixed(1)).join(' ');
  // Liseré blanc sous le tracé pour qu'il reste lisible sur le fond de carte.
  const halo=doc.createElementNS(NS,'polyline');halo.setAttribute('points',coords);halo.setAttribute('fill','none');halo.setAttribute('stroke','#ffffff');halo.setAttribute('stroke-width',l.kind==='walk'?'7':'8');halo.setAttribute('stroke-linecap','round');halo.setAttribute('stroke-linejoin','round');svg.appendChild(halo);
  const pl=doc.createElementNS(NS,'polyline');pl.setAttribute('points',coords);
  pl.setAttribute('fill','none');pl.setAttribute('stroke',l.kind==='walk'?'#16a34a':l.kind==='scooter'?'#d97706':'#1d4ed8');pl.setAttribute('stroke-width',l.kind==='walk'?'4':'5');pl.setAttribute('stroke-linecap','round');pl.setAttribute('stroke-linejoin','round');
  if(l.kind==='walk'||l.kind==='scooter')pl.setAttribute('stroke-dasharray',l.kind==='walk'?'7 5':'2 6');svg.appendChild(pl);
 }
 for(const [p,color] of [[pts[0],'#16a34a'],[pts[pts.length-1],'#dc2626']]){const ci=doc.createElementNS(NS,'circle');ci.setAttribute('cx',X(p));ci.setAttribute('cy',Y(p));ci.setAttribute('r','7');ci.setAttribute('fill',color);ci.setAttribute('stroke','#ffffff');ci.setAttribute('stroke-width','2');svg.appendChild(ci);}
 const att=doc.createElementNS(NS,'text');att.setAttribute('x',W-4);att.setAttribute('y',H-5);att.setAttribute('text-anchor','end');att.setAttribute('font-size','9');att.setAttribute('fill','#333');att.textContent='© OpenStreetMap';svg.appendChild(att);
 return svg;
}
// Prix non connu : lien vers le site ou l'application officielle où acheter le billet (jamais un prix estimé).
// Adresses : sites des opérateurs nationaux et agency_url publiés dans les flux officiels (agrégat Oùra) ;
// les réseaux dont le flux ne donne pas de site voyageur renvoient vers le portail régional Oùra.
const TICKET_LINKS=[
 [/sncf|\bter\b|tgv|intercit|ouigo|l[ée]man express/i,'SNCF Connect','https://www.sncf-connect.com/'],
 [/flixbus/i,'FlixBus','https://www.flixbus.fr/'],
 [/blablacar(?:\s+bus|bus)|ouibus/i,'BlaBlaCar Bus','https://www.blablacar.fr/bus'],
 [/blablacar|covoiturage|carpool/i,'BlaBlaCar covoiturage','https://www.blablacar.fr/'],
 [/^(sbb|cff|ffs)\b|postauto|car postal|\bbls\b|\bmbc\b|\btl\b|travys|\btpn\b|\bcgn\b/i,'CFF','https://www.sbb.ch/fr'],
 [/\btpg\b|unireso|^but$|^afo$/i,'tpg','https://www.tpg.ch/fr/acheter'],
 [/l[ée]man pass/i,'Léman Pass','https://www.lemanpass.com/points-de-vente/'],
 [/\btcl\b/i,'TCL','https://www.tcl.fr/'],
 [/sibra/i,'Sibra','https://www.sibra.fr/'],
 [/m r[ée]so|mobilit[ée]s m|\btag\b|tougo/i,'M réso','https://www.reso-m.fr/'],
 [/\btac\b/i,'TAC','https://tac-mobilites.fr/'],
 [/synchro/i,'Synchro','https://synchro.grandchambery.fr'],
 [/ond[ée]a/i,'Ondéa','https://www.ondea-bus.fr'],
 [/star['’]?t|thonon/i,"Star't",'https://www.star-t.fr'],
 [/j.?y ?bus/i,"J'ybus",'https://www.jybus.fr/'],
 [/rubis/i,'Rubis','https://www.rubis.grandbourg.fr/'],
 [/[ée]va['’]?d|^evian$/i,"ÉVA'D",'https://www.evad.fr/'],
 [/chamonix/i,'Chamonix Bus','https://www.montblancbus.transdev.com/reseau/chamonix-bus/'],
 [/proxim ?iti/i,'Proxim iTi','https://www.proximiti.fr'],
 [/mobi['’]?vals/i,"Mobi'Vals",'https://www.mobivals.fr/'],
 [/\btra\b|albertville/i,'TRA Mobilité','https://savoie.transdev.com/'],
 [/duobus/i,'Duobus','https://www.duobus.fr/'],
 [/ruban/i,'Ruban','https://www.rubantransport.com/'],
 [/l['’]?va\b/i,"L'va",'http://www.lva-mobilite.fr'],
 [/colibri/i,'Colibri','https://www.cotiere-mobilite.com/colibri/le-reseau/'],
 [/coqueligo/i,'CoqueliGO','https://www.coqueligo.fr/'],
 [/tout['’]?enbus/i,"Tout'enbus",'https://www.toutenbus.fr'],
 [/trans['’]?cab/i,"Trans'Cab",'https://www.stabus.fr/fr/'],
 [/mont[ée]libus/i,'Montélibus','http://www.montelibus.fr'],
 [/maelis/i,'Maelis','https://www.maelis.eu'],
 [/t['’]?cap/i,"T'CAP",'https://www.t-cap.mobi/'],
 [/velay/i,'Mobilité en Velay','https://www.mobilite.lepuyenvelay.fr'],
 [/\brlv\b/i,'RLV Mobilités','https://rlv-mobilites.fr/'],
 [/star roanne/i,'Star Roanne','https://www.bus-star.com/'],
 [/tain-tournon/i,'Le Bus','https://www.archeagglo.fr/'],
 [/smtut|thiers/i,'SMTUT','http://www.bus-tut.com'],
 [/cit[ée]a|valence romans/i,'Citéa','https://www.citea.fr/'],
 [/\bstas\b|saint-[ée]tienne m[ée]tropole/i,'STAS','https://www.reseau-stas.fr/'],
 [/\bt2c\b|clermont auvergne m[ée]tropole/i,'T2C','https://www.t2c.fr/'],
 [/cars? r[ée]gion|\btam\b/i,'Cars Région','https://www.laregionvoustransporte.fr/']
];
// Prix officiels du titre « 1 voyage » TCL (ticket rechargeable), à partir du 01/09/2026 : guide tarifaire TCL mai 2026 (tcl.fr).
// La zone exacte d'un trajet n'est pas connue de l'application : les prix sont présentés par zones, jamais additionnés ni choisis à la place du voyageur.
const TCL_FARES={from:'2026-09-01',checkedAt:'2026-11-17',source:'https://www.tcl.fr/sites/default/files/2026-05/TCL_Campagne_Unification_Guide_Tarifaire_Mai2026_W.pdf',
 rows:[['Zones 1 et 2','2,10 €'],['2 zones voisines (sauf zone 1)','1,60 €'],['Toutes zones sauf zone 1','2,50 €'],['Toutes zones','3,70 €']]};
// Lien « navigation » : ouvre l'application de guidage du téléphone (Google Maps, voix et suivi en direct) avec départ et arrivée déjà remplis.
function navLink(doc,a,b,mode){
 const link=el(doc,'a','cp-hub-walk-map-link cp-hub-nav',mode==='bicycling'?'🧭 Guidage vocal (Google Maps, vélo)':'🧭 Guidage vocal (Google Maps, à pied)');
 link.href='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(a.lat+','+a.lon)+'&destination='+encodeURIComponent(b.lat+','+b.lon)+'&travelmode='+mode+'&dir_action=navigate';
 link.target='_blank';link.rel='noopener noreferrer';return link;
}
function ticketLink(provider){
 const name=String(provider||'').trim();if(!name)return null;
 // « Star Roanne » avant « Star't » : même racine.
 const hit=(/star roanne/i.test(name)?TICKET_LINKS.find(x=>x[1]==='Star Roanne'):null)||TICKET_LINKS.find(x=>x[0].test(name));
 return hit?{label:hit[1],url:hit[2]}:{label:'Oùra',url:'https://www.oura.com/'};
}
function ticketLinks(j){
 const seen=new Map();
 (j.legs||[]).forEach((l,i)=>{if(l.kind==='walk'||(j.price&&j.price.legFares&&j.price.legFares[i]))return;
  const t=ticketLink(l.provider);if(t&&!seen.has(t.url))seen.set(t.url,t);});
 return [...seen.values()];
}
function card(doc,j,labels,expanded=false){
 const c=el(doc,'details','cp-hub-card'+(j.feasible?' ok':j.scheduled?' sched':' warn'));
 if(expanded)c.open=true;
 const s=el(doc,'summary');
 if(labels&&labels.length)s.appendChild(el(doc,'span','cp-hub-chip',labels.join(' · ')));
 s.appendChild(el(doc,'strong','cp-hub-times',clock(j.departure)+' → '+clock(j.arrival)+' · '+durationText(j.durationMinutes)));
 // Prix affiché seulement s'il est réellement connu et vérifié : plus de mention « Prix à confirmer » ni de prix partiel.
 if(j.price.status!=='unknown')s.appendChild(el(doc,'span','cp-hub-price',j.price.label));
 if(j.price.status==='unknown')for(const t of ticketLinks(j)){
  const link=el(doc,'a','cp-hub-ticket','🎟️ '+t.label);link.href=t.url;link.target='_blank';link.rel='noopener noreferrer';
  link.title='Acheter le billet ou consulter le prix : '+t.label;link.setAttribute('aria-label','Acheter le billet sur '+t.label);
  if(link.addEventListener)link.addEventListener('click',e=>e.stopPropagation());s.appendChild(link);}
 s.appendChild(el(doc,'span','cp-hub-modes',j.legs.map(l=>(ICON[l.mode]||'🚏')+(l.kind==='walk'?' '+durationText(Math.max(1,Math.round((l.durationSeconds||0)/60))):(l.line?' '+l.line:''))).join(' › ')));
 s.appendChild(el(doc,'span','cp-hub-status',(j.feasible?'✅ ':j.scheduled?'🕒 ':'⚠️ ')+j.status+(j.slackMinutes!=null?' · avance '+signedDurationText(j.slackMinutes)+' (marge '+durationText(j.marginMinutes)+')':'')));
 if(!j.feasible)s.appendChild(el(doc,'small','cp-hub-reason',j.statusDetail));
 c.appendChild(s);
 // Le détail et les polylignes SVG sont construits uniquement à la première ouverture.
 // Les cartes fermées restent légères, même si les moteurs renvoient beaucoup de trajets.
 let bodyBuilt=false;
 const buildBody=()=>{
  if(bodyBuilt)return;
  bodyBuilt=true;
  const body=el(doc,'div','cp-hub-body');
  // Aide à la recherche de billet, juste sous le lien SNCF Connect (qui n'accepte pas de lien pré-rempli) :
  // noms exacts des gares à coller. Gare de départ = début du premier trajet SNCF, arrivée = fin du dernier.
  // Même aide pour tout réseau dont le billet s'achète sur un site (SNCF Connect, Cars Région, FlixBus, BlaBlaCar Bus…) : noms des arrêts à coller dans le site qui s'ouvre.
  const helpLabels=[...new Set(j.legs.filter((x,k)=>x.kind!=='walk'&&x.kind!=='scooter'&&!(j.price.legFares&&j.price.legFares[k])&&x.from&&x.to).map(x=>ticketLink(x.provider)?.label).filter(Boolean))];
  for(const netLabel of helpLabels){
   const netLegs=j.legs.filter((x,k)=>x.kind!=='walk'&&x.kind!=='scooter'&&!(j.price.legFares&&j.price.legFares[k])&&ticketLink(x.provider)?.label===netLabel&&x.from&&x.to);
   if(!netLegs.length||j.price.status!=='unknown')continue;
   const from=netLegs[0].from,to=netLegs[netLegs.length-1].to;
   const place=netLabel==='SNCF Connect'?['gare','gares']:['arrêt','arrêts'];
   if(netLabel==='TCL'&&String(netLegs[0].departure||'').slice(0,10)>=TCL_FARES.from){
    const tbox=el(doc,'div','cp-hub-search-help');
    tbox.appendChild(el(doc,'strong',null,'🎟️ Ticket TCL « 1 voyage » · prix selon les zones'));
    for(const [zone,price] of TCL_FARES.rows)tbox.appendChild(el(doc,'small',null,zone+' : '+price));
    const src=el(doc,'a','cp-hub-ticket','Grille officielle TCL (vérifiée le 17/11/2026)');src.href=TCL_FARES.source;src.target='_blank';src.rel='noopener noreferrer';tbox.appendChild(src);
    body.appendChild(tbox);continue;
   }
   const box=el(doc,'div','cp-hub-search-help');
   box.appendChild(el(doc,'strong',null,'🎟️ Chercher le prix sur '+netLabel));
   box.appendChild(el(doc,'small',null,'Départ « '+from+' » · arrivée « '+to+' » · '+dayText(netLegs[0].departure)+' vers '+clock(netLegs[0].departure)+'.'));
   for(const [label,text] of [['📋 Copier '+(netLabel==='SNCF Connect'?'la gare':'l’arrêt')+' de départ',from],['📋 Copier '+(netLabel==='SNCF Connect'?'la gare':'l’arrêt')+' d’arrivée',to]]){
    const b=el(doc,'button','cp-hub-copy',label);b.type='button';
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();
     try{const w=doc.defaultView,n=w&&w.navigator;
      if(n&&n.clipboard&&n.clipboard.writeText)n.clipboard.writeText(text).then(()=>{b.textContent='✅ Copié';},()=>{b.textContent='Copie impossible';});
      else{const t=doc.createElement('textarea');t.value=text;doc.body.appendChild(t);t.select();doc.execCommand('copy');t.remove();b.textContent='✅ Copié';}
     }catch(_){b.textContent='Copie impossible';}});
    box.appendChild(b);}
   body.appendChild(box);
  }
  const ol=el(doc,'ol','cp-hub-legs');
 for(const [legIndex,l] of j.legs.entries()){
  const li=el(doc,'li',l.kind==='walk'?'walk':'ride');
  li.appendChild(el(doc,'strong',null,(ICON[l.mode]||'🚏')+' '+(l.kind==='scooter'?'Trottinette'+(l.distanceMeters!=null?' '+(l.distanceMeters/1000).toFixed(1).replace('.',',')+' km':'')+(l.durationSeconds!=null?' · '+durationText(Math.max(1,Math.round(l.durationSeconds/60)))+' (estimé)':''):l.kind==='walk'?'Marche'+(l.distanceMeters!=null?' '+Math.round(l.distanceMeters)+' m':'')+(l.durationSeconds!=null?' · '+durationText(Math.max(1,Math.round(l.durationSeconds/60))):''):[l.mode,l.line,l.provider&&l.provider!==l.line?'('+l.provider+')':''].filter(Boolean).join(' '))));
  li.appendChild(el(doc,'div',null,clock(l.departure)+' '+(l.from||'?')+' → '+clock(l.arrival)+' '+(l.to||'?')+(l.delayMinutes?' · retard annoncé +'+durationText(l.delayMinutes):'')));
  if(l.kind==='scooter'){
   li.appendChild(el(doc,'small',null,'Tracé calculé (OpenStreetMap, mode vélo) · durée estimée à '+(l.speedKmh||j.scooterSpeedKmh||15)+' km/h : réglages de l’application'));
   const sm=mapSvg(doc,{legs:[l]});
   if(sm){sm.setAttribute('class','cp-hub-map cp-hub-walk-map');sm.setAttribute('aria-label','Carte du trajet en trottinette (OpenStreetMap)');li.appendChild(sm);}
   const sa=pt(l.fromPoint),sb=pt(l.toPoint);
   if(sa&&sb){const link=el(doc,'a','cp-hub-walk-map-link','🛴 Voir le trajet en trottinette');
    link.href='https://www.openstreetmap.org/directions?engine=fossgis_osrm_bike&route='+encodeURIComponent(sa.lat+','+sa.lon+';'+sb.lat+','+sb.lon);
    link.target='_blank';link.rel='noopener noreferrer';li.appendChild(link);
    li.appendChild(navLink(doc,sa,sb,'bicycling'));}
   if(Array.isArray(l.steps)&&l.steps.length){const guide=el(doc,'details','cp-hub-steps');
    guide.appendChild(el(doc,'summary',null,'🧭 Guidage · '+l.steps.length+' étape'+(l.steps.length>1?'s':'')));
    const st=el(doc,'ol',null);for(const x of l.steps)st.appendChild(el(doc,'li',null,x.text+(x.meters>0?' · '+(x.meters>=1000?(x.meters/1000).toFixed(1).replace('.',',')+' km':x.meters+' m'):'')));
    guide.appendChild(st);li.appendChild(guide);}
  }
  else if(l.kind==='walk'){
   li.appendChild(el(doc,'small',null,l.walkSource==='valhalla'?'Itinéraire piéton calculé (OpenStreetMap)':'Marche calculée par '+j.source));
   // Carte dédiée à cette marche, zoomée sur le trajet à pied (la carte d'ensemble est trop large pour voir les marches).
   const wm=mapSvg(doc,{legs:[l]});
   if(wm){wm.setAttribute('class','cp-hub-map cp-hub-walk-map');
    wm.setAttribute('aria-label','Carte de la marche '+(l.from||'départ')+' vers '+(l.to||'arrivée')+' (OpenStreetMap)');
    li.appendChild(wm);}
   // Bouton sous la carte de CHAQUE marche : ouvre cette marche en grand.
   const wa=pt(l.fromPoint),wb=pt(l.toPoint);
   if(wa&&wb){
    const walkNo=j.legs.slice(0,legIndex+1).filter(x=>x.kind==='walk').length;
    const link=el(doc,'a','cp-hub-walk-map-link','🚶 Voir la marche '+walkNo);
    link.href='https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route='+encodeURIComponent(wa.lat+','+wa.lon+';'+wb.lat+','+wb.lon);
    link.target='_blank';link.rel='noopener noreferrer';li.appendChild(link);
    li.appendChild(navLink(doc,wa,wb,'walking'));
   }
   if(Array.isArray(l.steps)&&l.steps.length){
   // Guidage pas à pas fourni par le service piéton OpenStreetMap (jamais reconstruit ni inventé).
   const guide=el(doc,'details','cp-hub-steps');guide.open=true;
   guide.appendChild(el(doc,'summary',null,'🧭 Guidage à pied · '+l.steps.length+' étape'+(l.steps.length>1?'s':'')));
   const steps=el(doc,'ol',null);
   for(const st of l.steps)steps.appendChild(el(doc,'li',null,st.text+(st.meters>0?' · '+(st.meters>=1000?(st.meters/1000).toFixed(1).replace('.',',')+' km':st.meters+' m'):'')));
   guide.appendChild(steps);li.appendChild(guide);
   }
  }
  else{const f=j.price.legFares?.[legIndex]||null;if(f)li.appendChild(el(doc,'small',null,'Tarif : '+f.amount.toFixed(2).replace('.',',')+(f.currency==='EUR'?' €':' CHF')+' · '+f.source));
   // Le carnet rechargeable Ondéa est utilisable sur les lignes 400–419, contrairement au M-ticket.
   // Ne pas présenter son prix d'achat comme le coût d'un trajet unique.
   if(!f&&/^ond[ée]a\b/i.test(String(l.provider||''))&&/^(?:40\d|41\d)$/.test(String(l.line||'').trim()))
    {const note=el(doc,'small','cp-hub-fare-option','Option : carnet de 10 voyages à 14,50 € sur carte Pass Ondéa. QR/M-ticket non acceptés sur ces lignes. ');
     const link=el(doc,'a',null,'Conditions officielles Ondéa');link.href='https://www.ondeagrandlac.fr/titres/titres-pour-tous-tarifs-applicables-du-1er-juillet-2026/titre-10-voyages';link.target='_blank';link.rel='noopener noreferrer';note.appendChild(link);li.appendChild(note);}
  }
  ol.appendChild(li);
 }
 body.appendChild(ol);
 // Accès à une vraie carte pour chaque marche : le schéma SVG n'est pas une carte de rues.
 const svg=j.scooterOnly?null:mapSvg(doc,j);if(svg)body.appendChild(svg);
 else if(!j.scooterOnly)body.appendChild(el(doc,'p','cp-hub-note','Schéma indisponible : tracé GPS insuffisant.'));
 if(j.price.status==='unknown')body.appendChild(el(doc,'p','cp-hub-note','Source tarifaire manquante : '+j.price.missingSources.join(', ')+'.'));
 if(j.delays.length)body.appendChild(el(doc,'p','cp-hub-note','Retards signalés : '+j.delays.join(', ')));
 if(j.alerts.length)body.appendChild(el(doc,'p','cp-hub-note','Alertes : '+j.alerts.join(' · ')));
 if(j.feasible)body.appendChild(el(doc,'p','cp-hub-note',j.statusDetail));
 body.appendChild(el(doc,'small','cp-hub-src','Sources : '+j.sources.join(', ')+(j.dataDate?' · données '+j.dataDate:'')));
  c.appendChild(body);
 };
 if(c.addEventListener)c.addEventListener('toggle',()=>{if(c.open)buildBody();});
 // Environnements DOM sans événement toggle : construction au clic sur le résumé.
 if(s.addEventListener)s.addEventListener('click',()=>{if(!bodyBuilt)buildBody();});
 // Une carte déjà ouverte à son insertion ne déclenche pas toujours toggle.
 // Construire immédiatement le contenu de la première proposition visible.
 if(c.open)buildBody();
 return c;
}
// Transports à la demande : information seulement (réservation obligatoire, aucun horaire ni prix affiché comme trajet).
const TAD=[
 {name:'Flexi (Synchro mobilités, Grand Chambéry)',bounds:[45.45,5.75,45.65,6.15],url:'https://synchro.grandchambery.fr/',note:'réservation par téléphone (04 79 68 73 73), appli ou site ; même tarif que le bus'},
 {name:'Cars Région Y92 / Y93 / Y94 à la demande (Cluses – Taninges – Morzine / Praz de Lys / Sixt)',bounds:[46.02,6.50,46.22,6.78],url:'https://www.laregionvoustransporte.fr/',note:'⚠️ à réserver 24 h à l’avance (la veille avant 16 h), 48 h ou plus pour un lundi (réserver le vendredi avant 16 h), 📞 numéro à appeler : 04 8000 7000 ; seuls les horaires de la fiche de ligne existent'},
 {name:'Mobéa (Ondéa Grand Lac)',bounds:[45.65,5.75,45.85,6.05],url:'https://www.ondeagrandlac.fr/',note:'réservation obligatoire'}
];
function tadFor(task){const pts=[pt(task?.from),pt(task?.to)].filter(Boolean);
 return TAD.filter(t=>pts.some(p=>p.lat>=t.bounds[0]&&p.lat<=t.bounds[2]&&p.lon>=t.bounds[1]&&p.lon<=t.bounds[3]));}
function viewFingerprint(v){
 const one=j=>j?[signature(j)||'',ms(j.departure),ms(j.arrival),j.computing?1:0,j.feasible?1:0,j.scheduled?1:0,(j.reasons||[]).length,(j.missing||[]).length,j.price&&j.price.status,(j.sources||[]).length,j.walkMeters].join(','):'';
 return [v.done?1:0,v.total,v.longShown,(v.picks||[]).map(p=>(p.labels||[]).join('+')+':'+one(p.journey)).join(';'),(v.others||[]).slice(0,8).map(one).join(';'),v.others&&v.others.length,
  Object.entries(v.errors||{}).map(([k,e])=>k+e).join('|'),Object.entries(v.received||{}).join('|')].join('#');
}
function render(host,v){
 const doc=host.ownerDocument;
 // Rien de changé depuis le dernier dessin : on ne reconstruit pas la liste (évite saccades et perte de position au défilement).
 {const fp=viewFingerprint(v);if(host.__cpFp===fp&&host.childNodes.length)return;host.__cpFp=fp;}
 // Préserver les cartes ouvertes lors des arrivées progressives des moteurs.
 // Sans cela, chaque résultat réseau referme les détails et recrée les SVG.
 const opened=new Set(Array.from(host.querySelectorAll('details.cp-hub-card[open]'))
   .map(node=>node.getAttribute('data-journey-key')).filter(Boolean));
 const moreOpen=!!host.querySelector('details.cp-hub-more[open]');
 host.textContent='';host.setAttribute('data-transport-hub',VERSION);
 const head=el(doc,'p','cp-hub-progress',v.done?(v.total?v.total+' proposition'+(v.total>1?'s':'')+' comparée'+(v.total>1?'s':''):'Aucun trajet trouvé'):'Recherche en cours… ('+v.total+' trouvée'+(v.total>1?'s':'')+')');
 host.appendChild(head);
 if(v.longShown)host.appendChild(el(doc,'p','cp-hub-note','⚠️ Aucune proposition ne respecte votre limite de marche (Paramètres) : les trajets ci-dessous demandent une marche plus longue que ce réglage. Vérifiez chaque marche avant de partir.'));
 const addCard=(parent,j,labels,expandFirst=false)=>{
  const key=signature(j)||(j.walkOnly?'walk|'+Math.round(ms(j.departure)/60000)+'|'+Math.round(ms(j.arrival)/60000)+'|'+Math.round(j.durationMinutes||0):'');
  // Construire immédiatement les détails si cette carte était déjà ouverte :
  // poser node.open après card() ne construit pas toujours le corps au rendu.
  const node=card(doc,j,labels,expandFirst||(key&&opened.has(key)));
  // La première proposition est ouverte, les suivantes restent paresseuses.
  // Une marche seule n'a pas de ligne de transport : sa signature classique est vide.
  // Identifier aussi ces trajets pour ne pas refermer leur carte à chaque résultat réseau.
  if(key)node.setAttribute('data-journey-key',key);
  parent.appendChild(node);
 };
 // Ouvrir automatiquement la première carte une seule fois par fiche.
 // Si le convoyeur la referme, une mise à jour réseau ne doit pas la rouvrir.
 const openInitial=false;   // 17/11/2026 : aucune carte n'est ouverte d'office, c'est le convoyeur qui ouvre celle qu'il veut
 if(openInitial)host.dataset.cpInitialCardOpened='true';
 for(const [i,p] of v.picks.entries())addCard(host,p.journey,p.labels,openInitial&&i===0);
 if(v.others.length){const more=el(doc,'details','cp-hub-more');more.appendChild(el(doc,'summary',null,'Autres propositions ('+Math.min(v.others.length,8)+' affichées'+(v.others.length>8?' sur '+v.others.length:'')+')'));
  for(const j of v.others.slice(0,8))addCard(more,j,null);
  more.open=moreOpen;host.appendChild(more);}
 // Ne montrer que les moteurs effectivement interrogés sur la direction choisie.
 // Les réseaux hors zone restent dans le diagnostic interne, pas dans la fiche mission.
 const errs=Object.entries(v.errors);
 const consulted=Object.entries(v.received||{}).filter(([n])=>!errs.some(([e])=>e===n));
 if(v.done&&(errs.length||consulted.length)){
  const d=el(doc,'details','cp-hub-diag');d.appendChild(el(doc,'summary',null,'Moteurs consultés ('+(errs.length+consulted.length)+')'));
  for(const [n,e] of errs)d.appendChild(el(doc,'div',null,'❌ '+n+' : '+e));
  for(const [n,count] of consulted)d.appendChild(el(doc,'div',null,'✅ '+n+' : '+count+' proposition'+(count>1?'s':'')+' reçue'+(count>1?'s':'')));
  host.appendChild(d);
 }
 // Transparence pour les cars longue distance : l'absence de carte ne doit pas
 // être confondue avec un moteur absent ou un billet indisponible.
 if(v.done){
  // Ne pas afficher un moteur hors zone ou non activé : seules les
  // compagnies réellement consultées (ou en échec après lancement) comptent.
  const coachNames=['BlaBlaCar Bus GTFS','FlixBus GTFS'].filter(name=>
   Object.prototype.hasOwnProperty.call(v.received||{},name)||
   Object.prototype.hasOwnProperty.call(v.errors||{},name));
  // Le rendu limite « Autres propositions » aux huit premières cartes.
  // Le compteur doit refléter les cartes réellement présentes, pas toutes
  // les propositions internes retenues par le classement.
  const visibleJourneys=[...(v.picks||[]).map(p=>p.journey),...(v.others||[]).slice(0,8)];
  const coachRows=coachNames.map(name=>{
   const operator=name.replace(' GTFS','');
   const visible=visibleJourneys.filter(j=>
    (j.sources||[]).concat(j.source||'',(j.legs||[]).map(l=>l.provider||''))
     .some(value=>String(value).toLowerCase().includes(operator.toLowerCase()))).length;
   const error=v.errors?.[name];
   const skipped=v.skipped?.[name];
   const count=v.received?.[name];
   return {name,visible,status:error?'Erreur de recherche : '+error:
    skipped?'Moteur non interrogé : '+skipped:
    Number.isFinite(count)?count===0?'Aucun horaire reçu pour ce trajet et cette date':
     count+' horaire(s) reçu(s) avant filtrage des horaires et marches (prix non fournis par le GTFS)':
    'Aucune réponse du moteur'};
  });
  if(coachRows.length){
  const info=el(doc,'details','cp-hub-coach-status');
  const summary=coachRows.map(entry=>{
   const count=v.received?.[entry.name];
   return entry.name.replace(' GTFS','')+' : '+(v.errors?.[entry.name]?'erreur':
    Number.isFinite(count)?count===0?'aucun horaire reçu':
     entry.visible+' proposition(s) affichée(s) / '+count+' horaire(s) reçu(s)':
    'aucune réponse');
  }).join(' · ');
  info.appendChild(el(doc,'summary',null,summary));
  for(const entry of coachRows){
   info.appendChild(el(doc,'p','cp-hub-note',entry.name+' — '+entry.status));
   if(entry.visible===0&&(v.received?.[entry.name]||0)>0)
    info.appendChild(el(doc,'p','cp-hub-note',
     'Aucune proposition '+entry.name.replace(' GTFS','')+' affichée : les horaires reçus ne constituent pas un trajet validé pour cette mission. Vérifier les dates, les correspondances et les accès piétons.'));
  }
  info.appendChild(el(doc,'small',null,'Seuls les trajets correspondant aux dates, aux horaires et aux marches vérifiées apparaissent dans les propositions. Aucun tarif n’est inventé.'));
  host.appendChild(info);
  }
 }
 const tads=tadFor(v.task);
 if(v.done&&v.hidden&&v.hidden.tooEarly)host.appendChild(el(doc,'p','cp-hub-note',v.hidden.tooEarly+' trajet'+(v.hidden.tooEarly>1?'s':'')+' non affiché'+(v.hidden.tooEarly>1?'s':'')+' : horaires incompatibles avec la mission (départ avant la fin de la mission précédente, arrivée trop tôt) ou marche plus longue que la limite réglée.'));
 if(v.done&&v.hidden&&v.hidden.tooEarly){const h=v.hidden,parts=[];if(h.longWalk)parts.push(h.longWalk+' à cause d’une marche trop longue (réglage Paramètres)');if(h.before)parts.push(h.before+' partent avant la fin de la mission précédente');if(h.early)parts.push(h.early+' arrivent trop tôt');if(h.night)parts.push(h.night+' hors plage de jour');if(parts.length)host.appendChild(el(doc,'p','cp-hub-note','Détail : '+parts.join(' · ')+'.'));}
 if(v.done&&!v.total&&v.diag&&v.diag.evaluated){const d=v.diag;host.appendChild(el(doc,'p','cp-hub-note','Diagnostic (version 17/11 k) : '+d.evaluated+' proposition'+(d.evaluated>1?'s':'')+' évaluée'+(d.evaluated>1?'s':'')+(d.noTimes?', dont '+d.noTimes+' sans horaires exploitables':'')+(d.reasons.length?' · motifs : '+d.reasons.map(r=>r[0]+' ('+r[1]+')').join(' ; '):'')+'.'));}
 if(v.done&&v.discarded){const n=Object.values(v.discarded).reduce((x,y)=>x+y,0);if(n)host.appendChild(el(doc,'p','cp-hub-note',n+' proposition'+(n>1?'s':'')+' écartée'+(n>1?'s':'')+' (détour excessif ou marche plus directe).'));}
 if(v.done&&tads.length){const p=el(doc,'p','cp-hub-note','Transport à la demande possible dans ce secteur (non intégré au classement) : ');
  tads.forEach((t,i)=>{const a=el(doc,'a',null,t.name);a.href=t.url;a.target='_blank';a.rel='noopener noreferrer';p.appendChild(a);p.appendChild(doc.createTextNode(' — '+t.note+(i<tads.length-1?' · ':'.')));});
  host.appendChild(p);}
 if(v.done&&!v.picks.some(p=>p.journey.feasible)&&v.picks.some(p=>p.journey.scheduled))host.appendChild(el(doc,'p','cp-hub-note','Aucun trajet confirmé en temps réel pour l’instant. Les propositions « Horaire programmé » suivent les horaires officiels publiés, avec marches et marge vérifiées : à confirmer le jour J.'));
 else if(v.done&&!v.picks.some(p=>p.journey.feasible))host.appendChild(el(doc,'p','cp-hub-none','Transport non confirmé : aucune proposition ne permet d’arriver avec la marge requise, ou une marche/correspondance n’a pas pu être calculée.'));
}

const api={VERSION,completeWalks,scooterOnly,accessFor,LYON_COACH_ANCHORS,ticketLink,ticketLinks,tadFor,cachedRouter,pt,meters,ms,fromSwiss,fromTripGo,fromRegional,fromSNCF,fromGTFS,ojpMode,fromOJP,attachGTFSFares,walkDetour,excessiveDetour,fromNationalGTFS,completeWalks,walkOnly,priceOf,assess,rank,
 marginFor,queryWindow,inSwissArea,makeProviders,createSession,render};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportHub=api;
})(typeof window!=='undefined'?window:globalThis);
