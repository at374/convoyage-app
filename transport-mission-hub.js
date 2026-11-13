/* Convoyage Ultra — Hub transports de mission.
 * Interroge automatiquement TripGo, la Suisse (transport.opendata.ch), Mobilités M et le
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
const SAME_POINT_M=30,PROVIDER_JOIN_M=60,TRANSFER_BUFFER_S=120;

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
  realtime:o.realtime===true,delayMinutes:finite(o.delayMinutes)?o.delayMinutes:null,
  cancelled:o.cancelled===true,fare:o.fare||null,ticketUrl:o.ticketUrl||null};
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
  return {...journey((r.network||network)+' (GTFS)',legs),
   // Static GTFS proves a scheduled service, not its live operation.
   // Never label the itinerary as confirmed until a live source validates it.
   missing:['horaire GTFS local non confirmé en temps réel',
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
    ...(transit.length>1?['correspondance GTFS non confirmée']:[]),
    ...(r.searchTruncated?['recherche des correspondances incomplète']:[])]};
 }).filter(j=>j.legs.length>0&&j.legs.every((l,i)=>{
  const departure=ms(l.departure),arrival=ms(l.arrival);
  return Number.isFinite(departure)&&Number.isFinite(arrival)&&arrival>=departure&&
   (i===0||departure>=ms(j.legs[i-1].arrival));
 }));
}

/* ---------- Marches ---------- */
function walkLeg(route,from,to,fromName,toName,depMs){
 return leg({kind:'walk',mode:'Marche',from:fromName,to:toName,fromPoint:from,toPoint:to,
  departure:new Date(depMs).toISOString(),arrival:new Date(depMs+route.durationSeconds*1000).toISOString(),
  distanceMeters:route.distanceMeters,durationSeconds:route.durationSeconds,walkSource:'valhalla',geometry:route.geometry});
}
async function completeWalks(j,task,router){
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
 // Ne jamais qualifier de « réalisable » une marche moteur sans durée, distance ou horaires cohérents.
 for(const l of legs)if(l.kind==='walk'&&(!finite(l.durationSeconds)||!finite(l.distanceMeters)||
  !Number.isFinite(ms(l.departure))||!Number.isFinite(ms(l.arrival))))
  missing.push('marche fournisseur sans durée, distance ou horaires vérifiables');
 // Approche : l'adresse GPS doit être reliée au début exact de la première portion.
 const first=legs[0];
 if(!from)missing.push('point GPS de départ inconnu');
 else if(!first.fromPoint)missing.push('position du début de la marche ou de l’arrêt inconnue');
 else if(meters(from,first.fromPoint)>SAME_POINT_M){
  const r=await call(from,first.fromPoint);
  const dep=ms(first.departure);
  if(r&&Number.isFinite(dep))
   legs.unshift(walkLeg(r,from,first.fromPoint,task.fromName||'Adresse de départ',first.from,dep-r.durationSeconds*1000));
  else missing.push('marche depuis l’adresse exacte de départ non calculée');
 }
 // Correspondances entre deux véhicules sans marche fournie.
 for(let i=1;i<legs.length;i++){
  const a=legs[i-1],b=legs[i];
  if(a.kind==='walk'||b.kind==='walk')continue;
  const gap=(ms(b.departure)-ms(a.arrival))/1000;
  if(a.toPoint&&b.fromPoint){
   if(meters(a.toPoint,b.fromPoint)<=SAME_POINT_M){
    if(gap<TRANSFER_BUFFER_S)missing.push('correspondance trop courte à '+(a.to||'l’arrêt')+' (2 min minimum)');
    continue;
   }
   const r=await call(a.toPoint,b.fromPoint);
   if(!r){missing.push('marche de correspondance à '+(a.to||'l’arrêt')+' non calculée');continue;}
   if(r.durationSeconds+TRANSFER_BUFFER_S>gap)missing.push('correspondance trop courte à '+(a.to||'l’arrêt')+' ('+Math.ceil(r.durationSeconds/60)+' min de marche)');
   legs.splice(i,0,walkLeg(r,a.toPoint,b.fromPoint,a.to,b.from,ms(a.arrival)));i++;
  }else missing.push('positions GPS de correspondance non vérifiées : '+(a.to||'?')+' → '+(b.from||'?'));
 }
 // Dernière marche : dernier point de la proposition vers l'adresse exacte d'arrivée.
 const last=legs[legs.length-1];
 if(!to)missing.push('point GPS d’arrivée inconnu');
 else if(!last.toPoint)missing.push('position de la fin de la marche ou de l’arrêt inconnue');
 else if(meters(last.toPoint,to)>SAME_POINT_M){
  const r=await call(last.toPoint,to);
  const arr=ms(last.arrival);
  if(r&&Number.isFinite(arr))
   legs.push(walkLeg(r,last.toPoint,to,last.to,task.toName||'Adresse d’arrivée',arr));
  else missing.push('marche jusqu’à l’adresse exacte d’arrivée non calculée');
 }
 return {...j,legs,missing};
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
  if(s){hits++;const r=Promise.resolve({status:'calculated',provider:'Valhalla pedestrian / OpenStreetMap (cache)',durationSeconds:s.d,distanceMeters:s.m,
   geometry:s.g||null,from:{...a},to:{...b},endpointsMatched:true,cached:true});memory.set(k,r);return r;}
  misses++;
  const r=Promise.resolve(router.route(round(a),round(b))).then(x=>{
   if(x&&x.status==='calculated'){
    // géométrie allégée (≤ 40 points) pour le stockage
    const g=Array.isArray(x.geometry)?x.geometry.filter((_,i,arr)=>i%Math.max(1,Math.ceil(arr.length/40))===0||i===arr.length-1).map(round):null;
    saved[k]={t:Date.now(),d:x.durationSeconds,m:x.distanceMeters,g};persist();
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
 let dep=Number.isFinite(earliest)?earliest:Number.isFinite(deadline)?deadline-margin*60000-r.durationSeconds*1000:NaN;
 if(!Number.isFinite(dep))return null;
 const j=journey('Marche (Valhalla / OpenStreetMap)',[walkLeg(r,from,to,task.fromName||'Départ',task.toName||'Arrivée',dep)]);
 return {...j,walkOnly:true,missing:[]};
}

/* ---------- Tarifs ---------- */
function priceOf(j,fareFor){
 if(j.walkOnly)return {status:'free',amounts:{EUR:0},label:'Gratuit (à pied)',missingSources:[]};
 const amounts={},missingSources=[],sources=[],legFares=[];
 let ticket=null; // titre en cours : {network,validUntilMs} — une correspondance dans la validité ne se repaie pas
 for(const l of j.legs){
  if(l.kind==='walk'){legFares.push(null);continue;}
  const isVerifiedFare=f=>!!(f&&finite(f.amount)&&f.amount>=0&&/^(EUR|CHF)$/.test(f.currency)&&f.source);
  const direct=isVerifiedFare(l.fare)?l.fare:null;
  const f=direct||(typeof fareFor==='function'?fareFor(l):null);
  legFares.push(isVerifiedFare(f)?f:null);
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

/* ---------- Évaluation ---------- */
function marginFor(task){
 const base=finite(task.marginMinutes)?Math.max(5,task.marginMinutes):15;
 return task.exactTarget===true&&task.allowShortMargin===true?Math.min(base,5):Math.max(15,base);
}
function assess(j,task,fareFor){
 const reasons=[...(j.missing||[])];
 const legs=j.legs;
 const dep=ms(legs[0]?.departure),arr=ms(legs[legs.length-1]?.arrival);
 let chrono=Number.isFinite(dep)&&Number.isFinite(arr)&&arr>=dep,prev=dep;
 for(const l of legs){const a=ms(l.departure),b=ms(l.arrival);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a||a<prev-60000){chrono=false;break;}prev=b;}
 if(!chrono)reasons.push('horaires incohérents');
 if(legs.some(l=>l.cancelled))reasons.push('course annulée signalée');
 const margin=marginFor(task),deadline=ms(task.latestArrival),earliest=ms(task.earliestDeparture);
 const slack=Number.isFinite(deadline)&&Number.isFinite(arr)?Math.floor((deadline-arr)/60000):null;
 if(Number.isFinite(earliest)&&Number.isFinite(dep)&&dep<earliest-60000)reasons.push('départ avant la fin de la mission précédente');
 if(slack!==null&&slack<margin)reasons.push(slack<0?'arrivée après l’heure de mission':'marge insuffisante ('+slack+' min, '+margin+' min requises)');
 const price=priceOf(j,fareFor);
 const delays=legs.filter(l=>finite(l.delayMinutes)&&l.delayMinutes>0).map(l=>(l.line||l.mode)+' +'+l.delayMinutes+' min');
 const feasible=reasons.length===0;
 return {...j,departure:Number.isFinite(dep)?new Date(dep).toISOString():null,arrival:Number.isFinite(arr)?new Date(arr).toISOString():null,
  durationMinutes:chrono?Math.ceil((arr-dep)/60000):null,slackMinutes:slack,marginMinutes:margin,price,reasons,delays,
  transfers:Math.max(0,legs.filter(l=>l.kind!=='walk').length-1),
  walkMeters:legs.filter(l=>l.kind==='walk').reduce((s,l)=>s+(l.distanceMeters||0),0),
  feasible,status:feasible?'Réalisable':'Transport non confirmé',
  statusDetail:feasible?(j.realtime?'Horaires temps réel du fournisseur':'Horaires théoriques : retards et annulations à surveiller le jour J'):reasons.join(' · ')};
}
function signature(j){
 return j.legs.filter(l=>l.kind!=='walk').map(l=>[String(l.line||'').replace(/\s+/g,'').toLowerCase(),Math.round(ms(l.departure)/60000),Math.round(ms(l.arrival)/60000)].join('|')).join(';');
}
function rank(items){
 const seen=new Map();
 for(const j of items){if(!j||j.durationMinutes===null)continue;const k=j.walkOnly?'walk':signature(j);
  const old=seen.get(k);
  if(!old){seen.set(k,j);continue;}
  // Fusion : garder la version la plus complète (marches, prix, temps réel) et cumuler les sources.
  const better=(j.feasible&&!old.feasible)||(j.reasons.length<old.reasons.length)||(j.price.status==='verified'&&old.price.status!=='verified')?j:old;
  seen.set(k,{...better,sources:[...new Set([...old.sources,...j.sources])]});
 }
 const all=[...seen.values()];
 const byFeasible=(a,b)=>Number(b.feasible)-Number(a.feasible);
 const fastest=[...all].sort((a,b)=>byFeasible(a,b)||a.durationMinutes-b.durationMinutes||priceSortKey(a.price)-priceSortKey(b.price))[0];
 const priced=all.filter(j=>j.price.status==='verified'||j.price.status==='free');
 const cheapest=[...priced].sort((a,b)=>byFeasible(a,b)||priceSortKey(a.price)-priceSortKey(b.price)||a.durationMinutes-b.durationMinutes)[0];
 const score=j=>(Number.isFinite(priceSortKey(j.price))?Math.min(priceSortKey(j.price),200):60)+j.durationMinutes/3+j.transfers*8+j.walkMeters/250+
  (j.slackMinutes===null?0:Math.max(0,30-j.slackMinutes));
 const compromise=[...all].sort((a,b)=>byFeasible(a,b)||score(a)-score(b))[0];
 const picks=[];
 for(const [label,j] of [['Moins cher',cheapest],['Meilleur compromis',compromise],['Plus rapide',fastest]])
  if(j){const found=picks.find(p=>p.journey===j);if(found)found.labels.push(label);else picks.push({labels:[label],journey:j});}
 const others=all.filter(j=>!picks.some(p=>p.journey===j)).sort((a,b)=>byFeasible(a,b)||ms(a.departure)-ms(b.departure));
 return {picks,others,total:all.length};
}

/* ---------- Requêtes par direction ---------- */
function inSwissArea(p){return !!p&&((p.lat>=SWISS_BOX.minLat&&p.lat<=SWISS_BOX.maxLat&&p.lon>=SWISS_BOX.minLon&&p.lon<=SWISS_BOX.maxLon&&
 // exclure la France au sud-ouest de Genève (hors frontière immédiate)
 !(p.lat<46.15&&meters(p,GENEVA)>30000))||meters(p,GENEVA)<=30000);}
function queryWindow(task){
 const margin=marginFor(task),deadline=ms(task.latestArrival),earliest=ms(task.earliestDeparture);
 if(Number.isFinite(earliest))return {when:new Date(earliest).toISOString(),arriveBy:false};
 if(Number.isFinite(deadline))return {when:new Date(deadline-margin*60000).toISOString(),arriveBy:true};
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
   ['jybus','J’y bus Rumilly','jybus-rumilly.zip',[45.80,5.85,45.93,6.05]],
   ['tam','TAM Ambérieu','tam-amberieu.zip',[45.90,5.28,46.04,5.43]]
  ];
  // Archives are published on the transport feature branch, not necessarily on
  // the deployed GitHub Pages site. Explicit HTTPS URLs avoid a silent 404
  // when the Android app is served from another origin or an older deployment.
  const base='https://raw.githubusercontent.com/at374/convoyage-app/feature/transports-aura-suisse/data/gtfs/';
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
     const {date,clock}=dateParts(when),resource={format:'GTFS',url:base+file};
     let promise=cache.get(id+'|'+date);
     if(!promise){
      promise=r.CPGTFSLoader.loadResource(resource,{fetcher,indexServiceDates:[date],retainSourceTables:false});
      cache.set(id+'|'+date,promise);
      promise.catch(()=>cache.delete(id+'|'+date));
     }
     const feed=await promise;
     if(signal?.aborted)return [];
     const rows=r.CPGTFSIndex.nearbyDirectTrips(feed.files,feed.index,date,pt(task.from),pt(task.to),3000);
     const sec=t=>{const a=String(t||'').split(':').map(Number);return a.length===3&&a.every(Number.isFinite)?a[0]*3600+a[1]*60+a[2]:NaN;};
     // Select the best boarding/alighting stop pair for each actual vehicle
     // BEFORE imposing the mobile card limit. Otherwise 500 stop-pair variants
     // from a few vehicles can hide later distinct departures.
     const best=new Map();
     for(const x of rows){
      if(!(w.arriveBy?sec(x.arrival)<=sec(clock):sec(x.departure)>=sec(clock)))continue;
      const key=String(x.tripId||'')+'|'+date;
      const access=Number(x.accessDistanceMeters),egress=Number(x.egressDistanceMeters);
      if(!key||!Number.isFinite(access)||!Number.isFinite(egress))continue;
      const score=access+egress,previous=best.get(key);
      if(!previous||score<previous.score)best.set(key,{x,score});
     }
     const filtered=[...best.values()].map(({x})=>({...x,network:name,
       departure:toISO(date,x.departure),arrival:toISO(date,x.arrival)}))
      .filter(x=>x.departure&&x.arrival)
      .sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure)).slice(0,30);
     return fromGTFS(filtered,name);
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
     const result=await r.CPNationalGTFSJourneys.loadAndSearch({
      ...base,date,...(window.arriveBy?{latestArrival:clock}:{earliestDeparture:clock})});
     let rows=result.journeys||[];
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
     return fromNationalGTFS(rows,operator);
    }};
  }
 }
 if(r.CPTripGo&&typeof r.CPTripGo.plan==='function')P.tripgo={name:'TripGo',enabled:()=>{try{return opts.allowTripGo===true&&!!r.CPTripGo.getKey();}catch(_){return false;}},
  disabledReason:'TripGo désactivé par défaut : accès contractuel à vérifier (activation explicite uniquement)',
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

/* ---------- Session ---------- */
function createSession({tasks=[],providers={},router=null,fareFor=null,walkMaxKm=3,timeoutMs=25000,onUpdate=()=>{}}={}){
 const state={},controller=new AbortController();let disposed=false;
 const emit=label=>{if(!disposed)try{onUpdate(label,view(label));}catch(_){}};
 function view(label){const s=state[label];return {task:s.task,...rank(s.items),pending:s.pending,errors:{...s.errors},skipped:{...s.skipped},received:{...s.received},done:s.pending===0};}
 async function add(label,source,journeys){
  const s=state[label];if(!s||disposed)return;
  s.received[source]=(s.received[source]||0)+(Array.isArray(journeys)?journeys.length:0);
  const cancelled=x=>x&&(x.cancelled===true||x.canceled===true||/^(cancelled|canceled|annul)/i.test(String(x.status||'')));
  const clean=(Array.isArray(journeys)?journeys:[]).filter(j=>j&&!cancelled(j)&&Array.isArray(j.legs)&&j.legs.length&&
   !j.legs.some(l=>cancelled(l)||BOATS.test(l.mode+' '+(l.line||''))));
  // 1) Doublon d'un trajet déjà traité (autre moteur) : on ajoute la source, sans recalculer les marches.
  // 2) Trajet déjà hors délai sur ses seuls horaires : affiché « non confirmé » sans dépenser de marche.
  // 3) Les autres (8 au plus, les plus utiles d'abord) reçoivent leurs marches et s'affichent dès qu'ils sont prêts.
  const toWalk=[];
  for(const j of clean){
   const key=signature(j),known=key&&s.bySignature.get(key);
   if(known){known.sources=[...new Set([...known.sources,...(j.sources||[j.source])])];continue;}
   const quick=assess({...j,missing:[]},s.task,fareFor);
   if(quick.reasons.some(r=>/arrivée après|marge insuffisante|départ avant|horaires incohérents|annulée/.test(r))){
    if(key)s.bySignature.set(key,quick);s.items.push(quick);continue;
   }
   toWalk.push({j,key,quick});
  }
  const isReturn=Number.isFinite(ms(s.task.earliestDeparture))&&!Number.isFinite(ms(s.task.latestArrival));
  // Priorité : prix connu d'abord (moins cher en tête), puis le plus utile (retour : départ le plus tôt ; aller : avance la plus juste).
  const pk=q=>q.price.status==='verified'||q.price.status==='free'?priceSortKey(q.price):Infinity;
  toWalk.sort((a,b)=>(pk(a.quick)===pk(b.quick)?0:pk(a.quick)-pk(b.quick))||
   (isReturn?ms(a.quick.departure)-ms(b.quick.departure):(a.quick.slackMinutes??0)-(b.quick.slackMinutes??0))||a.quick.durationMinutes-b.quick.durationMinutes);
  // Affichage immédiat : chaque trajet apparaît tout de suite, « marches en cours de calcul », puis est remplacé.
  const pendingCard=new Map();
  for(const t of toWalk){
   const p=assess({...t.j,missing:['marches en cours de calcul']},s.task,fareFor);p.computing=true;
   pendingCard.set(t,p);s.items.push(p);if(t.key)s.bySignature.set(t.key,p);
  }
  emit(label);
  const replace=(t,a)=>{const old=pendingCard.get(t);const i=s.items.indexOf(old);
   if(old)a.sources=[...new Set([...a.sources,...(old.sources||[])])];
   if(i>=0)s.items[i]=a;else s.items.push(a);if(t.key)s.bySignature.set(t.key,a);};
  const walkBatch=batch=>Promise.all(batch.map(t=>completeWalks(t.j,s.task,router).then(x=>{
   if(disposed)return;replace(t,assess(x,s.task,fareFor));emit(label);
  }).catch(()=>{})));
  await walkBatch(toWalk.slice(0,8));
  // Recherche complémentaire : si rien n'est encore réalisable dans cette direction, on complète 8 trajets de plus.
  let walked=8;
  if(!disposed&&!s.items.some(x=>x.feasible)){await walkBatch(toWalk.slice(8,16));walked=16;}
  for(const t of toWalk.slice(walked)){ // au-delà : visibles, marches non calculées pour préserver le quota Valhalla
   replace(t,assess({...t.j,missing:['marches non calculées (quota de la fiche)']},s.task,fareFor));
  }
  if(!disposed)emit(label);
 }
 for(const task of tasks){
  const label=task.label;state[label]={task,items:[],pending:0,errors:{},skipped:{},received:{},bySignature:new Map()};
  if(!pt(task.from)||!pt(task.to)){state[label].errors.adresses='adresse GPS manquante';emit(label);continue;}
  for(const [key,p] of Object.entries(providers)){
   let ok=false;try{ok=p.enabled(task);}catch(_){}
   if(!ok){state[label].skipped[p.name]=p.disabledReason||'non applicable';continue;}
   state[label].pending++;
   // Délai borné par moteur (idée reprise du module ChatGPT transport_mission_search.js).
   const bounded=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('délai fournisseur dépassé ('+Math.round(timeoutMs/1000)+' s)')),timeoutMs);
    Promise.resolve().then(()=>p.run(task,controller.signal)).then(v=>{clearTimeout(t);resolve(v);},e=>{clearTimeout(t);reject(e);});});
   bounded.then(js=>add(label,p.name,js)).catch(e=>{
    if(!disposed)state[label].errors[p.name]=String(e&&e.message||e).slice(0,140);
   }).finally(()=>{if(disposed)return;state[label].pending--;emit(label);});
  }
  state[label].pending++;
  walkOnly(task,router,walkMaxKm).then(w=>w&&state[label].items.push(assess(w,task,fareFor))).catch(()=>{})
   .finally(()=>{if(disposed)return;state[label].pending--;emit(label);});
  emit(label);
 }
 return {ingest:(label,source,journeys)=>add(label,source,journeys),view,
  dispose:()=>{disposed=true;controller.abort();},signal:controller.signal};
}

/* ---------- Affichage (cartes Android) ---------- */
function clock(v){const t=ms(v);return Number.isFinite(t)?new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(new Date(t)):'?';}
function durationText(min){return min>=60?Math.floor(min/60)+' h '+String(min%60).padStart(2,'0'):min+' min';}
const ICON={Marche:'🚶',Train:'🚆',Bus:'🚌',Car:'🚍',Tram:'🚊',Métro:'🚇',Funiculaire:'🚡',Transport:'🚏'};
function el(doc,tag,cls,text){const e=doc.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function mapSvg(doc,j){
 const pts=[];for(const l of j.legs){if(l.geometry&&l.geometry.length)pts.push(...l.geometry.map(p=>({...p,w:true})));else{if(l.fromPoint)pts.push(l.fromPoint);if(l.toPoint)pts.push(l.toPoint);}}
 if(pts.length<2)return null;
 let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of pts){a=Math.min(a,p.lat);b=Math.max(b,p.lat);c=Math.min(c,p.lon);d=Math.max(d,p.lon);}
 const W=320,H=180,k=Math.cos((a+b)/2*Math.PI/180),sx=(d-c)*k||1e-4,sy=(b-a)||1e-4,s=Math.min((W-20)/sx,(H-20)/sy);
 const X=p=>10+((p.lon-c)*k)*s+((W-20)-sx*s)/2,Y=p=>H-10-(p.lat-a)*s-((H-20)-sy*s)/2;
 const NS='http://www.w3.org/2000/svg',svg=doc.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('class','cp-hub-map');svg.setAttribute('role','img');svg.setAttribute('aria-label','Schéma des transports et tracés piétons disponibles, sans marche en ligne droite');
 for(const l of j.legs){
  const line=l.geometry&&l.geometry.length?l.geometry:(l.kind==='walk'?[]:[l.fromPoint,l.toPoint].filter(Boolean));if(line.length<2)continue;
  const pl=doc.createElementNS(NS,'polyline');pl.setAttribute('points',line.map(p=>X(p).toFixed(1)+','+Y(p).toFixed(1)).join(' '));
  pl.setAttribute('fill','none');pl.setAttribute('stroke',l.kind==='walk'?'#16a34a':'#1d4ed8');pl.setAttribute('stroke-width',l.kind==='walk'?'3':'4');
  if(l.kind==='walk')pl.setAttribute('stroke-dasharray','5 4');svg.appendChild(pl);
 }
 for(const [p,color] of [[pts[0],'#16a34a'],[pts[pts.length-1],'#dc2626']]){const ci=doc.createElementNS(NS,'circle');ci.setAttribute('cx',X(p));ci.setAttribute('cy',Y(p));ci.setAttribute('r','6');ci.setAttribute('fill',color);svg.appendChild(ci);}
 return svg;
}
function card(doc,j,labels){
 const c=el(doc,'details','cp-hub-card'+(j.feasible?' ok':' warn'));
 const s=el(doc,'summary');
 if(labels&&labels.length)s.appendChild(el(doc,'span','cp-hub-chip',labels.join(' · ')));
 s.appendChild(el(doc,'strong','cp-hub-times',clock(j.departure)+' → '+clock(j.arrival)+' · '+durationText(j.durationMinutes)));
 const price=el(doc,'span','cp-hub-price'+(j.price.status==='unknown'?' unknown':''),j.price.status==='unknown'?
  'Prix à confirmer'+(j.price.partial?' (connu : '+j.price.partial+')':''):j.price.label);s.appendChild(price);
 s.appendChild(el(doc,'span','cp-hub-modes',j.legs.map(l=>(ICON[l.mode]||'🚏')+(l.kind==='walk'?' '+Math.max(1,Math.round((l.durationSeconds||0)/60))+' min':(l.line?' '+l.line:''))).join(' › ')));
 s.appendChild(el(doc,'span','cp-hub-status',(j.feasible?'✅ ':'⚠️ ')+j.status+(j.slackMinutes!=null?' · avance '+j.slackMinutes+' min (marge '+j.marginMinutes+' min)':'')));
 if(!j.feasible)s.appendChild(el(doc,'small','cp-hub-reason',j.statusDetail));
 c.appendChild(s);
 const body=el(doc,'div','cp-hub-body');
 const ol=el(doc,'ol','cp-hub-legs');
 for(const [legIndex,l] of j.legs.entries()){
  const li=el(doc,'li',l.kind==='walk'?'walk':'ride');
  li.appendChild(el(doc,'strong',null,(ICON[l.mode]||'🚏')+' '+(l.kind==='walk'?'Marche'+(l.distanceMeters!=null?' '+Math.round(l.distanceMeters)+' m':'')+(l.durationSeconds!=null?' · '+Math.max(1,Math.round(l.durationSeconds/60))+' min':''):[l.mode,l.line,l.provider&&l.provider!==l.line?'('+l.provider+')':''].filter(Boolean).join(' '))));
  li.appendChild(el(doc,'div',null,clock(l.departure)+' '+(l.from||'?')+' → '+clock(l.arrival)+' '+(l.to||'?')+(l.delayMinutes?' · retard annoncé +'+l.delayMinutes+' min':'')));
  if(l.kind==='walk')li.appendChild(el(doc,'small',null,l.walkSource==='valhalla'?'Itinéraire piéton calculé (OpenStreetMap)':'Marche calculée par '+j.source));
  else{const f=j.price.legFares?.[legIndex]||null;li.appendChild(el(doc,'small',null,f?'Tarif : '+f.amount.toFixed(2).replace('.',',')+(f.currency==='EUR'?' €':' CHF')+' · '+f.source:'Tarif : à confirmer'));
   // Le carnet rechargeable Ondéa est utilisable sur les lignes 400–419, contrairement au M-ticket.
   // Ne pas présenter son prix d'achat comme le coût d'un trajet unique.
   if(!f&&/^ond[ée]a\b/i.test(String(l.provider||''))&&/^(?:40\d|41\d)$/.test(String(l.line||'').trim()))
    {const note=el(doc,'small','cp-hub-fare-option','Option : carnet de 10 voyages à 14,50 € sur carte Pass Ondéa. QR/M-ticket non acceptés sur ces lignes. Prix du trajet à confirmer. ');
     const link=el(doc,'a',null,'Conditions officielles Ondéa');link.href='https://www.ondeagrandlac.fr/titres/titres-pour-tous-tarifs-applicables-du-1er-juillet-2026/titre-10-voyages';link.target='_blank';link.rel='noopener noreferrer';note.appendChild(link);li.appendChild(note);}
  }
  ol.appendChild(li);
 }
 body.appendChild(ol);
 const svg=mapSvg(doc,j);if(svg)body.appendChild(svg);
 if(j.price.status==='unknown')body.appendChild(el(doc,'p','cp-hub-note','Source tarifaire manquante : '+j.price.missingSources.join(', ')+'.'));
 if(j.delays.length)body.appendChild(el(doc,'p','cp-hub-note','Retards signalés : '+j.delays.join(', ')));
 if(j.alerts.length)body.appendChild(el(doc,'p','cp-hub-note','Alertes : '+j.alerts.join(' · ')));
 if(j.feasible)body.appendChild(el(doc,'p','cp-hub-note',j.statusDetail));
 body.appendChild(el(doc,'small','cp-hub-src','Sources : '+j.sources.join(', ')+(j.dataDate?' · données '+j.dataDate:'')));
 c.appendChild(body);return c;
}
// Transports à la demande : information seulement (réservation obligatoire, aucun horaire ni prix affiché comme trajet).
const TAD=[
 {name:'Flexi (Synchro mobilités, Grand Chambéry)',bounds:[45.45,5.75,45.65,6.15],url:'https://synchro.grandchambery.fr/',note:'réservation par téléphone (04 79 68 73 73), appli ou site ; même tarif que le bus'},
 {name:'Mobéa (Ondéa Grand Lac)',bounds:[45.65,5.75,45.85,6.05],url:'https://www.ondeagrandlac.fr/',note:'réservation obligatoire'}
];
function tadFor(task){const pts=[pt(task?.from),pt(task?.to)].filter(Boolean);
 return TAD.filter(t=>pts.some(p=>p.lat>=t.bounds[0]&&p.lat<=t.bounds[2]&&p.lon>=t.bounds[1]&&p.lon<=t.bounds[3]));}
function render(host,v){
 const doc=host.ownerDocument;host.textContent='';host.setAttribute('data-transport-hub',VERSION);
 const head=el(doc,'p','cp-hub-progress',v.done?(v.total?v.total+' proposition'+(v.total>1?'s':'')+' comparée'+(v.total>1?'s':''):'Aucun trajet trouvé'):'Recherche en cours… ('+v.total+' trouvée'+(v.total>1?'s':'')+')');
 host.appendChild(head);
 for(const p of v.picks)host.appendChild(card(doc,p.journey,p.labels));
 if(v.others.length){const more=el(doc,'details','cp-hub-more');more.appendChild(el(doc,'summary',null,'Autres propositions ('+v.others.length+')'));
  for(const j of v.others.slice(0,8))more.appendChild(card(doc,j,null));host.appendChild(more);}
 const errs=Object.entries(v.errors),skip=Object.entries(v.skipped);
 if(v.done&&(errs.length||skip.length)){
  const d=el(doc,'details','cp-hub-diag');d.appendChild(el(doc,'summary',null,'Moteurs consultés'));
  for(const [n,e] of errs)d.appendChild(el(doc,'div',null,'❌ '+n+' : '+e));
  for(const [n,e] of skip)d.appendChild(el(doc,'div',null,'⏭️ '+n+' : '+e));
  host.appendChild(d);
 }
 const tads=tadFor(v.task);
 if(v.done&&tads.length){const p=el(doc,'p','cp-hub-note','Transport à la demande possible dans ce secteur (non intégré au classement) : ');
  tads.forEach((t,i)=>{const a=el(doc,'a',null,t.name);a.href=t.url;a.target='_blank';a.rel='noopener noreferrer';p.appendChild(a);p.appendChild(doc.createTextNode(' — '+t.note+(i<tads.length-1?' · ':'.')));});
  host.appendChild(p);}
 if(v.done&&!v.picks.some(p=>p.journey.feasible))host.appendChild(el(doc,'p','cp-hub-none','Transport non confirmé : aucune proposition ne permet d’arriver avec la marge requise, ou une marche/correspondance n’a pas pu être calculée.'));
}

const api={VERSION,tadFor,cachedRouter,pt,meters,ms,fromSwiss,fromTripGo,fromRegional,fromSNCF,fromGTFS,fromNationalGTFS,completeWalks,walkOnly,priceOf,assess,rank,
 marginFor,queryWindow,inSwissArea,makeProviders,createSession,render};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportHub=api;
})(typeof window!=='undefined'?window:globalThis);
