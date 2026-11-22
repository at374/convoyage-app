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
// Parking des loueurs P21 (Genève, secteur France) : point GPS donné par Laurent. Seule la MARCHE vers/depuis P21 passe par l'intérieur
// de l'aéroport (sécurité puis douane française) : la consigne s'affiche sur cette marche uniquement (19/11/2026).
const P21_POINT={lat:46.237722,lon:6.117667};
function nearP21(p){return !!p&&Math.abs(p.lat-P21_POINT.lat)<0.004&&Math.abs(p.lon-P21_POINT.lon)<0.006;}
// Pour P21 (secteur France), l'arrêt passagers est « Genève-Aéroport, Terminal » : au-delà, le bus continue parfois
// un arrêt de trop derrière la douane (ex. Grand-Saconnex, Fret), chemin non praticable à pied (signalé le 19/11/2026).
function sansAccents(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'');}
function estArretAeroportGeneve(nom){return /^gen[e]ve[-\s]+a[e]roport\b/i.test(sansAccents(nom));}
// Retaille un itinéraire suisse touchant P21 pour qu'il s'arrête (ou reparte) à Genève-Aéroport, Terminal :
// la marche réelle (complétée ensuite par completeWalks, avec l'avertissement douane/sécurité déjà affiché pour
// P21) couvre alors la vraie dernière portion, au lieu d'un arrêt supplémentaire inaccessible à pied.
function retaillerP21(j,task){
 if(!j||!Array.isArray(j.legs)||!j.legs.length||!task)return j;
 const versP21=nearP21(pt(task.to)),depuisP21=nearP21(pt(task.from));
 if(!versP21&&!depuisP21)return j;
 let legs=j.legs;
 if(versP21){
  let coupe=-1;
  for(let i=0;i<legs.length;i++)if(legs[i]&&estArretAeroportGeneve(legs[i].to))coupe=i;
  if(coupe>=0&&coupe<legs.length-1)legs=legs.slice(0,coupe+1);
 }
 if(depuisP21){
  let coupe=-1;
  for(let i=0;i<legs.length;i++)if(legs[i]&&estArretAeroportGeneve(legs[i].from)){coupe=i;break;}
  if(coupe>0)legs=legs.slice(coupe);
 }
 if(legs===j.legs||!legs.length)return j; // rien à couper, ou coupe impossible sans tout retirer : on garde l'original
 return {...j,legs};
}
const LYON_COACH_ANCHORS=[{name:'Lyon Part-Dieu',lat:45.7605,lon:4.8590},{name:'Lyon Perrache',lat:45.7487,lon:4.8262},{name:'Lyon Gerland',lat:45.7290,lon:4.8300}];
// 21/11/2026 (demande Laurent) : 2 minutes de battement était trop court pour descendre d'un véhicule,
// marcher jusqu'à un arrêt voisin et monter dans le suivant (vu réel : SNCF bus L1 arrivée Thonon-les-Bains
// 08:29 → Star't Thonon ligne T départ Les Arts 08:30, un seul écart de 1 min). Minimum porté à 5 minutes.
const SAFE_TRANSFER_MIN=10,SAME_POINT_M=30,PROVIDER_JOIN_M=60,TRANSFER_BUFFER_S=300;
// Au-delà de cette distance, une marche « de bord à bord » (ex. gare → commune voisine) doit d'abord être
// comparée à un bus/tram local (Mobilités M à Grenoble…) avant d'être acceptée telle quelle : signalé le
// 19/11/2026 (marches de 4,7 et 5,4 km vers Seyssins alors que le réseau M dessert la zone).
const REGIONAL_WALK_THRESHOLD_M=800;
// 22/11/2026 : attente maximale acceptable à l'arrêt de correspondance avant/après un bus/tram local de
// substitution (voir footLeg ci-dessous) — au-delà, la marche directe est préférée à une attente démesurée.
const REGIONAL_ACCESS_MAX_WAIT_S=45*60;

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
 return {kind:o.kind||'transit',mode:o.mode||'',line:o.line||null,headsign:String(o.headsign||'').replace(/_/g,' ').replace(/^\s*direction\s*[:\-]?\s*/i,'').replace(/\s+/g,' ').trim()||null,provider:o.provider||null,
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
// 22/11/2026 (Laurent : « toujours indiquer l'adresse exacte de la fin de marche, pour qu'il n'y ait pas
// d'erreur ») : quand l'adresse de la mission est absente (approximateFrom/approximateTo), l'extrémité d'une
// marche d'approche ou finale n'affiche qu'un nom de ville (ex. « Thonon-les-Bains, 74 ») alors que le point GPS
// réellement utilisé pour calculer la marche est, lui, précis. On interroge la Base Adresse Nationale (IGN,
// même API déjà utilisée ailleurs dans l'appli pour retrouver une commune) pour obtenir l'adresse la plus proche
// de ce point GPS et l'afficher, en la marquant clairement comme estimée (reverse-geocoding, jamais l'adresse
// officielle de la mission). Résultat mis en cache (mémoire + ce téléphone) par coordonnée arrondie au mètre
// pour ne pas réinterroger à chaque ouverture de carte.
const reverseGeocodeCache=new Map();
async function reverseGeocodeFR(win,lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 const key=lat.toFixed(5)+','+lon.toFixed(5);
 if(reverseGeocodeCache.has(key))return reverseGeocodeCache.get(key);
 const promise=(async()=>{
  try{
   let cached=null;try{cached=win.localStorage.getItem('cp_revgeo_'+key);}catch(_){}
   if(cached)return JSON.parse(cached);
   const fetcher=win&&win.fetch?win.fetch.bind(win):null;
   if(!fetcher)return null;
   const resp=await fetcher('https://data.geopf.fr/geocodage/reverse?limit=1&lon='+lon+'&lat='+lat);
   if(!resp||!resp.ok)return null;
   const data=await resp.json();
   const f=data&&Array.isArray(data.features)?data.features[0]:null,p=f&&f.properties;
   if(!p)return null;
   const label=p.label||[p.housenumber,p.street||p.name].filter(Boolean).join(' ')+
    (p.postcode||p.city?' '+[p.postcode,p.city].filter(Boolean).join(' '):'');
   const out=label&&label.trim()?{label:label.trim(),distanceMeters:Number.isFinite(p.distance)?Math.round(p.distance):null}:null;
   if(out){try{win.localStorage.setItem('cp_revgeo_'+key,JSON.stringify(out));}catch(_){}}
   return out;
  }catch(_){return null;}
 })();
 reverseGeocodeCache.set(key,promise);
 return promise;
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
   const out=leg({mode:'Bus',line:l.line||r.line,headsign:l.headsign||(r.legs?.length?'':r.headsign),provider:l.network||r.network||network,from:start?.name||l.from,to:end?.name||l.to,
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
async function completeWalks(j,task,router,scooter,regional){
 // Filet de sécurité P21 pour toutes les sources (pas seulement « Suisse ») : cf. retaillerP21 ci-dessus.
 j=retaillerP21(j,task);
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
 // Renvoie toujours un tableau de portions (une marche/trottinette seule, ou la chaîne bus/tram locale trouvée).
 // 22/11/2026 (Laurent : marche de 39 min en fin de trajet OTP2 à Thonon-les-Bains alors que le réseau
 // local Star't Thonon dessert un arrêt à 2 min de l'adresse — cette comparaison avec le bus/tram local
 // n'était tentée QUE sur les marches que completeWalks() calcule elle-même (approche, correspondance,
 // sortie) ; une marche déjà fournie telle quelle par un moteur (OTP2, correspondances entre réseaux…)
 // n'était jamais réévaluée. Extrait en fonction indépendante pour pouvoir aussi l'appliquer à ces
 // marches déjà présentes dans j.legs (cf. boucle juste après la définition de footLeg).
 const trySubstituteLongWalk=async(a,b,fromName,toName,{startMs,endMs})=>{
  if(!regional||typeof regional.run!=='function')return null;
  // 21/11/2026 : la fenêtre de recherche du bus/tram de substitution partait pile de l'heure d'arrivée
  // précédente (ou pile avant l'heure limite), sans tenir compte du temps de descendre et de rejoindre
  // l'arrêt suivant — un bus dont les horaires tombaient 1 min après était accepté tel quel. On décale
  // la fenêtre du même battement minimal que pour une correspondance ordinaire (TRANSFER_BUFFER_S).
  const bufferMs=TRANSFER_BUFFER_S*1000;
  const subTask=Number.isFinite(endMs)?{from:a,to:b,fromName,toName,latestArrival:new Date(endMs-bufferMs).toISOString(),marginMinutes:0}
   :Number.isFinite(startMs)?{from:a,to:b,fromName,toName,earliestDeparture:new Date(startMs+bufferMs).toISOString(),marginMinutes:0}:null;
  if(!subTask)return null;
  // 22/11/2026 (Laurent : correspondance bus à Thonon-les-Bains — la ligne C part de l'arrêt « Les Arts »,
  // à 100 m de la gare, directement vers Saint-Disdille (la zone de l'adresse de livraison), mais .find()
  // retenait le PREMIER itinéraire renvoyé par le moteur local, souvent un bus à 1 km de marche d'approche
  // sur un arrêt sans rapport (ex. « Église des Vallées ») simplement parce qu'il arrivait en tête de liste)
  // : on ne garde plus le premier itinéraire avec un transport, mais celui qui minimise la marche totale
  // (accès + sortie) vers les deux points réels, à égalité le plus tôt arrivé.
  const pickClosest=list=>{
   const candidates=(Array.isArray(list)?list:[]).filter(it=>it&&Array.isArray(it.legs)&&it.legs.length&&it.legs.some(l=>l&&l.kind!=='walk'));
   if(!candidates.length)return null;
   const walkTotal=it=>{
    const head=it.legs[0],tail=it.legs[it.legs.length-1];
    const access=head&&head.fromPoint?meters(a,head.fromPoint):Infinity;
    const egress=tail&&tail.toPoint?meters(tail.toPoint,b):Infinity;
    return access+egress;
   };
   const arrivalOf=it=>ms(it.legs[it.legs.length-1]?.arrival);
   return candidates.sort((x,y)=>walkTotal(x)-walkTotal(y)||arrivalOf(x)-arrivalOf(y))[0];
  };
  let ok=false;try{ok=regional.enabled(subTask);}catch(_){}
  if(!ok)return null;
  let answer=null;try{answer=await regional.run(subTask);}catch(_){answer=null;}
  let best=pickClosest(answer);
  let tight=false;
  // 22/11/2026 (Laurent : train réel arrivant 08h29 à Thonon, correspondance bus T réelle à 08h30 juste à
  // côté — disparue de l'appli) : quand AUCUN départ n'existe après le battement de sécurité, on ne
  // retombe plus directement sur la marche complète sans revérifier : on retente sans le battement, pour
  // distinguer « aucun bus avant longtemps » (marche justifiée) de « un bus existe mais la fenêtre de
  // sécurité l'exclut de justesse » (correspondance tendue à signaler, pas un trajet à faire disparaître).
  if(!best){
   const tightTask=Number.isFinite(endMs)?{from:a,to:b,fromName,toName,latestArrival:new Date(endMs).toISOString(),marginMinutes:0}
    :Number.isFinite(startMs)?{from:a,to:b,fromName,toName,earliestDeparture:new Date(startMs).toISOString(),marginMinutes:0}:null;
   if(tightTask){
    let tightOk=false;try{tightOk=regional.enabled(tightTask);}catch(_){}
    if(tightOk){
     let tightAnswer=null;try{tightAnswer=await regional.run(tightTask);}catch(_){tightAnswer=null;}
     best=pickClosest(tightAnswer);
     if(best)tight=true;
    }
   }
  }
  // 22/11/2026 (Laurent : Y51 l'après-midi — 12:18, 13:58, 14:48… — toujours écartés « avant la fin de la
  // mission précédente » malgré un earliestDeparture cohérent) : pickClosest() ne borne que le WALK total
  // (accès+sortie), jamais l'ATTENTE à l'arrêt. Si la seule ligne locale desservant cet arrêt ne passe
  // qu'une fois par jour très tôt (ex. 06:59), elle était retenue pour CHAQUE départ Y51 de la journée
  // (12:18 comme 18:48), avec plusieurs heures d'attente avant d'embarquer — et legs[0].departure (la
  // marche/le bus avant ce même 06:59) tombait alors bien avant midi, faisant passer des Y51 parfaitement
  // réalisables pour « avant la fin de la mission précédente ». On plafonne maintenant l'attente à l'arrêt
  // de correspondance : au-delà, on revient à la marche directe (signalée « trop longue » si besoin, un
  // motif déjà géré et visible) plutôt que de chaîner un bus local sans rapport avec un trou de plusieurs
  // heures avant le vrai transport recherché.
  if(best){
   const waitS=Number.isFinite(endMs)?(endMs-ms(best.legs[best.legs.length-1].arrival))/1000:
    Number.isFinite(startMs)?(ms(best.legs[0].departure)-startMs)/1000:0;
   if(!(waitS<=REGIONAL_ACCESS_MAX_WAIT_S))best=null;
  }
  if(!best)return null;
  if(tight)missing.push('correspondance tendue à '+(fromName||'l’arrêt')+' avec le bus/tram local (moins de '+Math.round(TRANSFER_BUFFER_S/60)+' min) : à vérifier le jour J');
  let chosen=best.legs.slice();
  const headLeg=chosen[0],tailLeg=chosen[chosen.length-1];
  // 21/11/2026 (Laurent : le bus EVA'D 02 dépose à Thuyset Ouest, à 1,5-2 km du 89 avenue de
  // Saint-Disdille, sans aucune marche ensuite jusqu'à l'adresse réelle) : le bus/tram de
  // substitution dessert SON arrêt le plus proche de a/b, pas forcément a ou b exactement —
  // contrairement à une marche directe, qui elle arrive toujours pile au point visé. Ajouter les
  // marches résiduelles aux deux bouts quand elles existent, au lieu de laisser le trajet s'arrêter
  // à l'arrêt de bus/tram.
  if(tailLeg&&tailLeg.toPoint&&meters(tailLeg.toPoint,b)>SAME_POINT_M){
   const tailArr=ms(tailLeg.arrival);
   if(Number.isFinite(tailArr)){let tail=null;try{tail=await call(tailLeg.toPoint,b);}catch(_){}
    if(tail)chosen=[...chosen,walkLeg(tail,tailLeg.toPoint,b,tailLeg.to||fromName,toName,tailArr)];}
  }
  if(headLeg&&headLeg.fromPoint&&meters(a,headLeg.fromPoint)>SAME_POINT_M){
   const headDep=ms(headLeg.departure);
   if(Number.isFinite(headDep)){let head=null;try{head=await call(a,headLeg.fromPoint);}catch(_){}
    if(head)chosen=[walkLeg(head,a,headLeg.fromPoint,fromName,headLeg.from||toName,headDep-head.durationSeconds*1000),...chosen];}
  }
  return renameEnds({...best,legs:chosen},{fromName,toName}).legs;
 };
 const footLeg=async(a,b,fromName,toName,{startMs,endMs})=>{
  const r=await call(a,b);if(!r)return null;
  const walkMax=Number.isFinite(task.walkMaxMeters)?task.walkMaxMeters:null;
  // Marche longue dans une zone desservie par un réseau local (Mobilités M à Grenoble…) : comparer d'abord
  // au bus/tram plutôt que d'imposer silencieusement une marche d'une heure (signalé le 19/11/2026,
  // marches de 4,7 et 5,4 km vers Seyssins alors que le réseau M dessert la zone).
  if(r.distanceMeters>REGIONAL_WALK_THRESHOLD_M){
   const sub=await trySubstituteLongWalk(a,b,fromName,toName,{startMs,endMs});
   if(sub)return sub;
  }
  if(walkMax!==null&&r.distanceMeters>walkMax&&scooter&&scooter.enabled&&scooter.router){
   let sr=null;try{sr=await scooter.router.route(a,b);}catch(_){}
   const limit=(finite(scooter.maxKm)&&scooter.maxKm>0?scooter.maxKm:8)*1000,speed=finite(scooter.speedKmh)&&scooter.speedKmh>0?Math.min(30,Math.max(5,scooter.speedKmh)):15;
   if(sr&&sr.status==='calculated'&&finite(sr.distanceMeters)&&sr.distanceMeters>=0&&sr.distanceMeters<=limit){
    const seconds=Math.max(60,Math.round(sr.distanceMeters/(speed/3.6)));
    const start=Number.isFinite(startMs)?startMs:endMs-seconds*1000;
    return [leg({kind:'scooter',mode:'Trottinette',from:fromName,to:toName,fromPoint:a,toPoint:b,
     departure:new Date(start).toISOString(),arrival:new Date(start+seconds*1000).toISOString(),distanceMeters:sr.distanceMeters,durationSeconds:seconds,
     walkSource:'valhalla-bicycle',geometry:sr.geometry,steps:sr.steps,speedKmh:speed})];
   }
  }
  const start=Number.isFinite(startMs)?startMs:endMs-r.durationSeconds*1000;
  return [walkLeg(r,a,b,fromName,toName,start)];
 };
 // 22/11/2026 (Laurent : trajet 07h12→10h07 via OTP2 avec une marche finale de 39 min, alors qu'un trajet
 // voisin montre que le bus « C » de Star't Thonon dépose à 2 min de la même adresse) : une marche déjà
 // fournie par un moteur (OTP2, correspondances entre réseaux…) n'était jamais comparée au bus/tram local
 // — seules les marches que completeWalks() calcule elle-même (approche/correspondance/sortie) l'étaient.
 // On réévalue maintenant chaque marche déjà présente et trop longue, avant toute autre étape, en
 // l'ancrant sur le véhicule voisin (arrivée du précédent, ou départ du suivant) pour garder la même
 // fenêtre horaire que le trajet d'origine.
 for(let i=0;i<legs.length;i++){
  const l=legs[i];
  if(l.kind!=='walk'||!finite(l.distanceMeters)||l.distanceMeters<=REGIONAL_WALK_THRESHOLD_M)continue;
  if(!l.fromPoint||!l.toPoint)continue;
  const prev=legs[i-1],next=legs[i+1];
  const anchor=prev&&prev.kind!=='walk'&&Number.isFinite(ms(prev.arrival))?{startMs:ms(prev.arrival)}:
   next&&next.kind!=='walk'&&Number.isFinite(ms(next.departure))?{endMs:ms(next.departure)}:
   Number.isFinite(ms(l.departure))?{startMs:ms(l.departure)}:
   Number.isFinite(ms(l.arrival))?{endMs:ms(l.arrival)}:null;
  if(!anchor)continue;
  let sub=null;try{sub=await trySubstituteLongWalk(l.fromPoint,l.toPoint,l.from,l.to,anchor);}catch(_){sub=null;}
  if(sub&&sub.length){legs.splice(i,1,...sub);i+=sub.length-1;}
 }
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
  if(w&&w.length)legs.unshift(...w);
  else missing.push('marche depuis l’adresse exacte de départ non calculée');
 }
 // Correspondances entre deux véhicules sans marche fournie.
 for(let i=1;i<legs.length;i++){
  const a=legs[i-1],b=legs[i];
  if(isFoot(a)||isFoot(b))continue;
  const gap=(ms(b.departure)-ms(a.arrival))/1000;
  if(a.toPoint&&b.fromPoint){
   if(meters(a.toPoint,b.fromPoint)<=SAME_POINT_M){
    // 22/11/2026 : le message disait « 2 min minimum » alors que TRANSFER_BUFFER_S exige 5 min (300 s) — texte
    // corrigé pour refléter le vrai seuil appliqué (trouvé en expliquant à Laurent pourquoi une correspondance
    // bus→train à 2 min de marche restait « non confirmée » malgré des départs Y51 bien présents l'après-midi).
    if(gap<TRANSFER_BUFFER_S)missing.push('correspondance trop courte à '+(a.to||'l’arrêt')+' ('+Math.round(TRANSFER_BUFFER_S/60)+' min minimum)');
    continue;
   }
   const w=await footLeg(a.toPoint,b.fromPoint,a.to,b.from,{startMs:ms(a.arrival)});
   if(!w||!w.length){missing.push('marche de correspondance à '+(a.to||'l’arrêt')+' non calculée');continue;}
   const wStart=ms(w[0].departure),wEnd=ms(w[w.length-1].arrival),
    wDurationSeconds=Number.isFinite(wStart)&&Number.isFinite(wEnd)?(wEnd-wStart)/1000:NaN;
   if(!Number.isFinite(wDurationSeconds)||wDurationSeconds+TRANSFER_BUFFER_S>gap)
    missing.push('correspondance trop courte à '+(a.to||'l’arrêt')+' ('+(Number.isFinite(wDurationSeconds)?Math.ceil(wDurationSeconds/60)+' min':'durée inconnue')+')');
   legs.splice(i,0,...w);i+=w.length;
  }else missing.push('positions GPS de correspondance non vérifiées : '+(a.to||'?')+' → '+(b.from||'?'));
 }
 // Dernière marche : dernier point de la proposition vers l'adresse exacte d'arrivée.
 const last=legs[legs.length-1];
 if(!to)missing.push('point GPS d’arrivée inconnu');
 else if(!last.toPoint)missing.push('position de la fin de la marche ou de l’arrêt inconnue');
 else if(meters(last.toPoint,to)>SAME_POINT_M){
  const arr=ms(last.arrival);
  const w=Number.isFinite(arr)?await footLeg(last.toPoint,to,last.to,task.toName||'Adresse d’arrivée',{startMs:arr}):null;
  if(w&&w.length)legs.push(...w);
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
 // 20/11/2026 (demande Laurent) : une arrivée après 19h00 reste proposée jusqu'à minuit (23:59), au lieu d'être
 // exclue dès 19h00. Au-delà de minuit, le trajet change de jour calendaire et reste écarté par dep.day!==arr.day
 // ci-dessous (jamais présenté comme une arrivée « le jour même »).
 const last=Number.isFinite(task.dayEndMinutes)?task.dayEndMinutes:1439;
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
 // 21/11/2026 : un point « approximatif » (centre-ville en guise d'adresse) désactivait complètement la limite de
 // marche, quelle que soit la distance — un trajet à 6,5 km de marche passait alors comme « à vérifier » et pouvait
 // être choisi comme meilleur compromis (il arrive plus tôt qu'une correspondance de bus), alors qu'une correspondance
 // bien plus courte à pied existait. Repéré avec une adresse de livraison Hiflow dont les coordonnées sont en réalité
 // le centre-ville (réutilisées à l'identique sur plusieurs adresses différentes d'Albertville). Une imprécision GPS
 // n'explique que quelques centaines de mètres d'écart, pas plusieurs kilomètres : au-delà d'une marge de tolérance
 // (1,5 km de plus que la limite réglée), la marche reste « trop longue » et le trajet est écarté même si le point
 // de départ ou d'arrivée est approximatif.
 // 21/11/2026 : approximateEndpoint ne distinguait pas QUEL bout (départ ou arrivée) est approximatif, et la
 // tolérance s'appliquait alors à n'importe quelle marche du trajet — y compris la marche finale vers une adresse
 // pourtant exacte (le domicile), laissant passer une vraie marche de 6,5 km uniquement parce que l'AUTRE bout
 // (ex. adresse de livraison Hiflow, en réalité un centre-ville) était approximatif. On ne tolère plus que la
 // marche adjacente au bout réellement approximatif (première jambe = départ, dernière = arrivée) ; une marche de
 // correspondance au milieu du trajet (entre deux arrêts GTFS connus) n'est jamais approximative.
 const APPROX_TOLERANCE_M=1500;
 const walkIndex=longWalk?legs.indexOf(longWalk):-1;
 const approxHere=longWalk&&((walkIndex===0&&task.approximateFrom)||(walkIndex===legs.length-1&&task.approximateTo)||
  (task.approximateFrom===undefined&&task.approximateTo===undefined&&task.approximateEndpoint));
 const longWalkTolerated=longWalk&&approxHere&&longWalk.distanceMeters<=walkMax+APPROX_TOLERANCE_M;
 if(longWalk&&longWalkTolerated)reasons.push('marche longue à vérifier ('+(longWalk.distanceMeters/1000).toFixed(1).replace('.',',')+' km, point GPS approximatif)');
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
  durationMinutes:chrono?Math.ceil((arr-dep)/60000):null,slackMinutes:slack,marginMinutes:margin,
  // 20/11/2026 : pour une fenêtre de prise en charge/livraison étalée sur plusieurs jours, un jour intermédiaire
  // utilise une heure limite ESTIMÉE (agence/parc supposé fermé, jamais après 19:00), pas l'heure réelle de fin de
  // fenêtre annoncée par la plateforme. Garder trace de cette estimation pour ne pas afficher une marge comme si
  // elle était calculée par rapport à l'horaire officiel.
  deadlineEstimated:task.deadlineEstimated===true,deadlineMs:Number.isFinite(deadline)?deadline:null,price,reasons,delays,
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
// (Annecy → Genève par La Roche-sur-Foron ≈ 1,6 fois) et les petits trajets urbains. GPS absent : trajet conservé
// (sauf repli durée ci-dessous).
function excessiveDetour(j,task){
 const from=pt(task&&task.from),to=pt(task&&task.to);if(!from||!to||!j||!Array.isArray(j.legs))return false;
 const rides=j.legs.filter(l=>l&&!isFoot(l));if(!rides.length)return false;
 const direct=meters(from,to);if(direct<=0)return false;
 let path=0,pointsOk=true;
 for(const l of rides){const a=pt(l.fromPoint),b=pt(l.toPoint);if(!a||!b){pointsOk=false;break;}path+=meters(a,b);}
 if(pointsOk)return path>=3*direct&&path-direct>=30000;
 // 21/11/2026 : sans coordonnées sur chaque jambe (GTFS national, correspondances inter-réseaux), le détour
 // n'était jamais détecté. Constaté en réel : Annecy → Aix-les-Bains (~30 km, moins de 2 h normalement)
 // proposé en ~5 h via un aller-retour par Genève. Repli : comparer la durée programmée totale à une durée
 // raisonnable pour la distance à vol d'oiseau (20 km/h de moyenne, large pour ne pas écarter de vraies
 // correspondances longues) ; au moins 3 fois cette durée ET au moins 90 min de plus.
 const dep=ms(j.legs[0]?.departure),arr=ms(j.legs[j.legs.length-1]?.arrival);
 if(!Number.isFinite(dep)||!Number.isFinite(arr)||arr<=dep)return false;
 const durationMinutes=(arr-dep)/60000,reasonableMinutes=Math.max(30,(direct/1000)*3);
 return durationMinutes>=3*reasonableMinutes&&durationMinutes-reasonableMinutes>=90;
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
 let all=[...seen.values()].filter(j=>!Array.isArray(j.reasons)||!(j.reasons.includes('trajet hors plage de jour ou date de mission')||j.reasons.some(r=>String(r).startsWith('marche trop longue'))));
 // 21/11/2026 : un même véhicule réel (même ligne GTFS, même course, même date) ressort parfois de
 // plusieurs moteurs à la fois (trajet direct, correspondance même réseau, correspondance inter-réseaux),
 // chacun avec sa propre fiche — signature() les traite comme des itinéraires différents puisque la suite
 // du trajet diffère. Repéré avec le Y51 d'Albertville : la version « direct » et la version « correspondance
 // même réseau » du MÊME départ Y51 s'affichaient toutes les deux à côté de la version « correspondance Sibra »,
 // avec plusieurs kilomètres de marche en trop, alors qu'il s'agit du même choix (monter dans CE bus) en moins
 // bon. On ne garde, par course GTFS réellement empruntée en premier, que celle qui arrive le plus tôt (marche
 // totale la plus courte à égalité) ; les versions strictement moins bonnes du même véhicule disparaissent.
 // Le premier élément de j.legs est souvent une marche d'approche ajoutée par completeWalks() (de l'adresse
 // exacte jusqu'à l'arrêt) : c'est le premier véhicule (isFoot==false) qu'il faut identifier, pas legs[0].
 const boardingKey=j=>{const first=(j.legs||[]).find(l=>!isFoot(l)),g=first?.gtfsRaw;
  return g&&g.tripId?[String(g.network||first.provider||'').trim().toLowerCase(),String(g.tripId),String(g.date||'')].join('|'):null;};
 const byBoarding=new Map(),unboarded=[];
 for(const j of all){
  const k=boardingKey(j);
  if(!k){unboarded.push(j);continue;}
  const old=byBoarding.get(k);
  if(!old||ms(j.arrival)<ms(old.arrival)||(ms(j.arrival)===ms(old.arrival)&&(j.walkMeters||0)<(old.walkMeters||0)))byBoarding.set(k,j);
 }
 all=[...byBoarding.values(),...unboarded];
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
 // 21/11/2026 (Laurent : "l'affichage bloque pendant la lecture et le défilement") : depuis que la recherche
 // de bus local couvre tout le territoire (et pas seulement Grenoble), une même fiche peut légitimement
 // trouver des dizaines de trajets différents. render() reconstruit TOUTE la liste à chaque mise à jour
 // réseau (plusieurs fois par seconde) — même les cartes repliées dans « Voir plus » étaient reconstruites
 // en entier. La cause principale (le calcul des correspondances sur le fil principal) est maintenant
 // déplacée dans le Web Worker ; ce plafond ne reste qu'un garde-fou technique très large, pas une limite
 // métier. ATTENTION : 40 coupait déjà les départs Y51 Albertville→Annecy de l'après-midi (le tri garde
 // les plus matinaux en premier), régression repérée et corrigée le jour même — ne jamais redescendre ce
 // chiffre sans compter d'abord les trajets réels d'une ligne dense sur une journée complète.
 // 21/11/2026 (Laurent : « Y51 après 13h01 s'affiche au début puis disparaît ») : une fois les correspondances
 // entre réseaux réellement opérationnelles (bug d'identifiant réseau corrigé le même jour), le nombre réel de
 // candidats pour UNE SEULE relation peut dépasser 300 sur une journée complète (une correspondance distincte
 // par paire de courses Y51 × Sibra effectivement enchaînable, pas des doublons). Le tri garde les plus
 // matinaux, donc tout dépassement de 300 coupait déjà l'après-midi en silence. Comme les cartes repliées
 // dans « Voir plus » ne sont construites qu'à l'ouverture (depuis le 21/11/2026), ce plafond ne coûte plus
 // rien en affichage : relevé à 1000, large marge au-dessus du cas réel observé.
 const MAX_OTHERS=1000,othersOverflow=Math.max(0,others.length-MAX_OTHERS);
 return {picks,others:others.slice(0,MAX_OTHERS),othersOverflow,total:all.length};
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
 // Vitesse : les fichiers d'horaires (data/gtfs/*.zip) sont gardés sur le téléphone (Cache Storage) pendant 12 h ; au lieu de les retélécharger à chaque recherche.
 const rawFetch=opts.fetcher||((...a)=>r.fetch(...a));
 const fetcher=opts.fetcher?rawFetch:async(url,init)=>{
  const u=typeof url==='string'?url:(url&&url.url)||'';
  const store=r.caches;
  if(!store||!/\/data\/gtfs\/[^/?]+\.zip(\?|$)/.test(u))return rawFetch(url,init);
  try{
   const c=await store.open('cp-gtfs-zips'),hit=await c.match(u);
   if(hit){const at=Number(hit.headers.get('x-cp-saved'));if(Number.isFinite(at)&&Date.now()-at<12*3600*1000)return hit;}
   const resp=await rawFetch(url,init);
   if(resp&&resp.ok){try{const b=await resp.clone().arrayBuffer();
    await c.put(u,new Response(b,{status:200,headers:{'content-type':'application/zip','x-cp-saved':String(Date.now())}}));}catch(_){}}
   return resp;
  }catch(e){return rawFetch(url,init);}
 };
 const P={};
 // 22/11/2026 (Laurent : blocages répétés de 30-40 s mesurés sur son téléphone, réseau très lent — 0 à 5 Ko/s
 // vu sur ses captures) : un seul incident du worker (erreur réseau pendant un téléchargement GTFS sur une
 // connexion instable, par exemple) mettait __cpHubWorkerOff à true DÉFINITIVEMENT pour le reste de la
 // session. Chaque recherche suivante retombait alors sur le calcul synchrone sur le fil principal — et
 // décompresser/analyser un flux GTFS de plusieurs Mo en JS bloque réellement l'écran plusieurs dizaines de
 // secondes, ce qui correspond exactement aux mesures (toujours ~36-41 s, cohérent avec la taille des flux).
 // Le diagnostic confirmait d'ailleurs « fil principal » sur un des moteurs. Un incident réseau isolé ne doit
 // pas condamner tout le reste de la session au calcul synchrone : on retente un nouveau worker à chaque
 // appel, avec juste un court répit (10 s) après un échec pour éviter de boucler sur un worker réellement cassé.
 // 22/11/2026 (Laurent : « ça bloque encore », mesuré en direct dans le navigateur — tâches synchrones de
 // 400 ms à 3 s répétées, cohérent avec un calcul GTFS sur le fil principal) : la cause RÉELLE trouvée ici,
 // jamais corrigée jusqu'à présent — cette condition excluait le worker dès qu'un « fetcher » personnalisé
 // était fourni à makeProviders(), et app.js en fournit TOUJOURS un (regionalFetch) à chaque recherche réelle.
 // Résultat : le worker n'a jamais tourné une seule fois en production, malgré toute la logique de reprise et
 // de diagnostic ci-dessous — chaque recherche retombait systématiquement sur le calcul synchrone qui bloque
 // l'écran. Le worker ne reçoit de toute façon jamais ce fetcher (non clonable vers un Worker ; il utilise son
 // propre fetch et son propre cache hors ligne) — regionalFetch n'étant qu'un simple relais de window.fetch
 // sans aucune logique propre, rien n'empêche le worker de s'activer même quand un fetcher est fourni.
 const canWorker=()=>typeof r.Worker==='function'&&!(r.__cpHubWorkerOffUntil&&Date.now()<r.__cpHubWorkerOffUntil);
 // 22/11/2026 (Laurent : blocage encore à ~40 s après le correctif du répit de 10 s, sans amélioration visible) :
 // le code précédent remplaçait systématiquement la vraie erreur du worker par un message générique ('worker'),
 // impossible à diagnostiquer à distance. On garde maintenant la vraie raison (message du navigateur, ou
 // exception de construction si le Worker est bloqué d'emblée — ex. CSP — ce qui ne déclenchait même pas
 // onerror et n'était donc jamais compté comme un échec) dans un diagnostic visible, pour savoir enfin si le
 // worker échoue à chaque recherche (et pourquoi) ou seulement de temps en temps.
 const noteWorkerFail=reason=>{r.__cpHubWorkerLastError=reason+' ('+new Date().toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris'})+')';r.__cpHubWorkerFailCount=(r.__cpHubWorkerFailCount||0)+1;};
 const workerCall=payload=>new Promise((resolve,reject)=>{
  let w=r.__cpHubWorker;
  if(!w){
   try{w=r.__cpHubWorker=new r.Worker('transport-hub-local-worker.js');}
   catch(e){r.__cpHubWorkerOffUntil=Date.now()+10000;noteWorkerFail('construction: '+(e&&e.message||e));reject(e);return;}
   r.__cpHubWorkerPending=new Map();
   const fail=e=>{r.__cpHubWorkerOffUntil=Date.now()+10000;r.__cpHubWorker=null;for(const q of r.__cpHubWorkerPending.values())q.reject(e);r.__cpHubWorkerPending.clear();try{w.terminate();}catch(_){}};
   w.onerror=e=>{noteWorkerFail('erreur: '+(e&&(e.message||e.type)||'?'));fail(new Error('worker'));};
   w.onmessageerror=()=>{noteWorkerFail('message illisible');fail(new Error('worker'));};
   w.onmessage=({data})=>{const q=r.__cpHubWorkerPending.get(data&&data.id);if(!q)return;r.__cpHubWorkerPending.delete(data.id);clearTimeout(q.t);
    if(data.error)q.reject(new Error(data.error));else q.resolve(data);};
  }
  const id=(r.__cpHubWorkerSeq=(r.__cpHubWorkerSeq||0)+1);
  const t=setTimeout(()=>{r.__cpHubWorkerPending.delete(id);noteWorkerFail('délai dépassé (90 s)');reject(new Error('timeout'));},90000);
  r.__cpHubWorkerPending.set(id,{resolve,reject,t});
  try{w.postMessage({id,...payload});}catch(e){r.__cpHubWorkerPending.delete(id);clearTimeout(t);noteWorkerFail('postMessage: '+(e&&e.message||e));reject(e);}
 });
 const workerRows=(key,urls,date,from,to,extra)=>workerCall({key,urls,date,from,to,radius:3000,...extra}).then(d=>d.rows);
 // 21/11/2026 (Laurent : « l'écran se fige pendant la recherche ») : la recherche de correspondances
 // (nearbyTransferTrips même réseau + CPGTFSFederation.crossNetworkTrips entre réseaux, jusqu'à 28 paires
 // de réseaux) est le calcul le plus lourd de toute la recherche transport et tournait sur le fil principal.
 // Déplacée dans le même worker que les trajets directs (local_<id>) : voir transport-hub-local-worker.js.
 const workerCorrespondances=payload=>workerCall({op:'correspondances',...payload}).then(d=>d.rows);
 // 21/11/2026 (Laurent : « ça bloque toujours ») : SNCF (TER/TGV)/FlixBus/BlaBlaCar Bus (national_<id>
 // plus bas) appelaient CPNationalGTFSJourneys.loadAndSearch directement sur le fil principal — jusqu'à
 // 4 recherches par mission sur le plus gros flux GTFS de tous (réseau SNCF national). Déplacée dans le
 // même worker (transport-hub-local-worker.js importe aussi transport-national-gtfs-journeys.js).
 const workerNationalSearch=(operator,resource,searchOptions)=>workerCall({op:'national',operator,resource,searchOptions}).then(d=>d.result);
 // Regional GTFS archives already hosted by the project. These are scheduled
 // candidates only; the pedestrian router and confirmation checks still apply.
 if(r.CPGTFSLoader?.loadResource&&r.CPGTFSIndex?.nearbyDirectTrips){
  // 21/11/2026 : audit systématique après le bug Y51/Albertville (bounds trop étroites qui désactivaient
  // silencieusement tout un réseau pour une mission touchant son propre terminus). 13 réseaux avaient le même
  // défaut (zone déclarée ne couvrant pas un bout réel de ligne, écart >8 km mesuré sur les arrêts réels du
  // GTFS) : synchro, cars_isere, cars_haute_savoie, ondea, ginko_besancon, zoom_chalon, grandole_dole,
  // altigo_briancon, fil_bleu_tours, lia_le_havre, trema_macon, cars_ain, cars_ardeche — bounds recalculées
  // sur l'étendue réelle des arrêts (marge ~3 km). Les réseaux urbains « 5 métropoles / villes de France »
  // ajoutés le 20/11 ont un écart résiduel de 10-12 % (quelques km, suburbs) jugé mineur, non corrigé ici.
  const localNetworks=[
   ['tac','TAC Annemasse','tac-annemasse.zip',[46.1,5.98,46.27,6.42]],
   ['synchro','Synchro Chambéry','synchro-chambery.zip',[45.494,5.814,45.779,6.196]],
   ['tcl','TCL Lyon','tcl-lyon.zip',[45.55,4.6,46.02,5.1]],
   ['cars_isere','Cars Région Isère','cars-region-isere.zip',[44.534,4.728,45.913,6.308]],
   ['cars_savoie','Cars Région Savoie','cars-region-savoie.zip',[45.05,5.62,45.80,7.19]],
   // 18/11/2026 : Cars Région Haute-Savoie (Y02, Y51, Y91-Y94 à la demande…) découpé sur Faucigny / Giffre / Chablais.
   // 21/11/2026 : bbox élargie vers le sud/ouest — la ligne Y51 (Albertville ↔ Annecy) a son terminus à
   // Albertville (lat ≈ 45,675), hors de l'ancienne emprise (min lat 45,90) : le fournisseur n'était donc
   // jamais activé (enabled exige task.from ET task.to dans bounds) pour toute mission touchant Albertville,
   // malgré un GTFS cars-region-haute-savoie.zip qui contient bien la ligne en entier (extract() ne filtre
   // pas par bbox, seulement par agence). Nouvelle limite sud alignée sur celle de TRA Albertville.
   ['cars_haute_savoie','Cars Région Haute-Savoie','cars-region-haute-savoie.zip',[45.639,5.792,46.409,6.957]],
   // 18/11/2026 : réseaux présents dans data/gtfs mais absents de ce moteur (audit de couverture).
   ['mreso_grenoble','M Réso Grenoble','mreso-grenoble.zip',[45.0,5.5,45.45,6.0]],
   ['mreso_gresivaudan','M Réso Grésivaudan','mreso-gresivaudan.zip',[45.15,5.7,45.5,6.15]],
   ['ondea','Ondéa Aix-les-Bains (Grand Lac)','ondea-grand-lac.zip',[45.54,5.749,45.989,6.042]],
   ['sibra','Sibra Annecy','sibra-annecy.zip',[45.7,5.9,46.1,6.5]],
   ['start_thonon','Star’t Thonon','start-thonon.zip',[46.25,6.3,46.45,6.65]],
   ['ginko_besancon','Ginko (Besançon)','ginko-besancon.zip',[47.086,5.76,47.402,6.231]],
   ['zoom_chalon','Zoom (Chalon-sur-Saône)','zoom-chalon.zip',[46.625,4.604,46.986,5.024]],
   ['grandole_dole','Grandole Mobilités (Dole)','grandole-dole.zip',[46.92,5.295,47.315,5.681]],
   ['evolity_montbeliard','évolitY (Montbéliard)','evolity-montbeliard.zip',[47.4,6.65,47.6,6.95]],
   ['orizo_avignon','Orizo (Grand Avignon)','orizo-avignon.zip',[43.85,4.65,44.07,5.05]],
   ['agglo_bus_gap','L’Agglo en Bus (Gap)','agglo-bus-gap.zip',[44.4,5.95,44.75,6.25]],
   ['altigo_briancon','Altigo (Briançonnais)','altigo-briancon.zip',[44.827,6.253,45.087,6.756]],
   ['divia_dijon','Divia Mobilités (Dijon)','divia-dijon.zip',[47.2,4.95,47.45,5.2]],
   ['tango_nimes','Tango (Nîmes Métropole)','tango-nimes.zip',[43.65,4.11,44.0,4.59]],
   ['alesy_ales',"Ales'y (Alès)",'alesy-ales.zip',[43.89,3.81,44.42,4.4]],
   ['sankeo_perpignan','Sankéo (Perpignan)','sankeo-perpignan.zip',[42.59,2.59,42.89,3.06]],
   ['beemob_beziers','beeMob (Béziers Méditerranée)','beemob-beziers.zip',[43.22,3.15,43.49,3.4]],
   ['citibus_narbonne','Citibus (Narbonne)','citibus-narbonne.zip',[42.82,2.8,43.34,3.25]],
   ['lebus_frejus',"Le Bus (Estérel Côte d'Azur : Fréjus, Saint-Raphaël)",'lebus-frejus.zip',[43.3,6.6,43.57,6.97]],
   ['envibus_antibes','Envibus (Antibes Sophia Antipolis)','envibus-antibes.zip',[43.52,6.95,43.72,7.17]],
   ['ge_le_fil','Le Fil (Syndicat Mixte des transports du Pays du Bassin de Briey)','ge-le-fil.zip',[49.12,5.76,49.39,6.06]],
   ['ge_pays_du_sel_vermois','CC des Pays du Sel et du Vermois (bus)','ge-pays-du-sel-vermois.zip',[48.57,6.26,48.66,6.39]],
   ['ge_le_sit','Le SIT (CC du Bassin de Pompey)','ge-le-sit.zip',[48.7,6.02,48.82,6.25]],
   ['ge_bus_pont_a_mousson','Le Bus (Pont-à-Mousson)','ge-bus-pont-a-mousson.zip',[48.77,5.92,48.99,6.18]],
   ['ge_sub','SUB (SMT Suburbains de Nancy)','ge-sub.zip',[48.58,6.06,48.81,6.37]],
   ['ge_linggo_en_ville','Linggo En Ville (PETR du pays de Langres)','ge-linggo-en-ville.zip',[47.81,5.29,47.9,5.38]],
   ['ge_riv_connect','Riv\'Connect (CC Rives de Moselle)','ge-riv-connect.zip',[49.16,6.12,49.27,6.26]],
   ['ge_lulu_en_bus','Lulu en bus (PETR du Pays du Lunevillois)','ge-lulu-en-bus.zip',[48.55,6.46,48.63,6.55]],
   ['ge_forbus','Forbus (Agglomération de Forbach)','ge-forbus.zip',[49.01,6.69,49.26,7.1]],
   ['ge_ritmo','Ritmo (CA de Haguenau)','ge-ritmo.zip',[48.69,7.59,48.87,7.89]],
   ['ge_tum','TUM (Commune de Sainte-Ménéhould)','ge-tum.zip',[49.06,4.86,49.13,5.02]],
   ['ge_stan','STAN (Métropole du Grand Nancy)','ge-stan.zip',[48.59,6.09,48.75,6.29]],
   ['ge_cmonbus','Cmonbus (CA de Chaumont)','ge-cmonbus.zip',[48.05,4.98,48.14,5.18]],
   ['ge_rezo','REZO (CA du Grand Verdun)','ge-rezo.zip',[49.1,5.28,49.2,5.44]],
   ['ge_colibri','Colibri (CC Terres Touloises)','ge-colibri.zip',[48.6,5.7,48.86,6.05]],
   ['ge_sitac','SITAC (CA de Châlons-en-Champagne)','ge-sitac.zip',[48.69,4.09,49.21,4.49]],
   ['ge_t_mm','T\'MM (CC Moselle et Madon)','ge-t-mm.zip',[48.51,6.01,48.67,6.23]],
   ['ge_isibus','Isibus (CC Sarrebourg Moselle Sud)','ge-isibus.zip',[48.7,7.01,48.77,7.12]],
   ['ge_temo_b','Temo\'b (SMT Urbains Thionville-Fensch)','ge-temo-b.zip',[49.27,5.9,49.52,6.36]],
   ['ge_grand_reims_mobilites','Grand Reims Mobilités (CU du Grand Reims)','ge-grand-reims-mobilites.zip',[49.15,3.66,49.41,4.39]],
   ['ge_mouveo','Mouvéo (CA Epernay Coteaux et Plaine de Champagne)','ge-mouveo.zip',[48.88,3.9,49.09,4.07]],
   ['ge_ticea','TICEA (CA de St Dizier, Der et Blaise)','ge-ticea.zip',[48.47,4.85,48.68,5.01]],
   ['ge_trace','TRACE (Colmar Agglomération)','ge-trace.zip',[47.98,7.2,48.15,7.47]],
   ['ge_pass_o','Pass\'O (Ville d\'Obernai)','ge-pass-o.zip',[48.43,7.44,48.49,7.54]],
   ['ge_imagine','Imagine (CA d\'Epinal)','ge-imagine.zip',[47.93,6.02,48.43,6.56]],
   ['ge_elsa','ELSA (PETR Sélestat Alsace Centrale)','ge-elsa.zip',[48.21,7.16,48.33,7.56]],
   ['ge_tac','TAC (CA Ardenne Métropole)','ge-tac.zip',[49.63,4.59,49.88,5.01]],
   ['ge_cabus','CABUS (CA Sarreguemines Confluences)','ge-cabus.zip',[48.93,6.85,49.18,7.21]],
   ['ge_le_met','Le MET (CA Metz Métropole)','ge-le-met.zip',[48.96,5.98,49.22,6.34]],
   ['ge_transavold','Transavold (CA Saint-Avold Synergie)','ge-transavold.zip',[48.9,6.56,49.19,6.8]],
   ['ge_solea','Soléa (CA Mulhouse Alsace Agglomération)','ge-solea.zip',[47.65,7.07,47.89,7.57]],
   ['ge_distribus','Distribus (CA Saint-Louis Agglomération)','ge-distribus.zip',[47.48,7.22,47.71,7.65]],
   ['ge_tcat','TCAT (CA Troyes Champagne Métropole)','ge-tcat.zip',[48.16,3.89,48.42,4.26]],
   ['ge_sylvia','SYLVIA (CA Saint Dié des Vosges)','ge-sylvia.zip',[48.1,6.76,48.53,7.17]],
   ['ge_tub','TUB (CA Bar-le-Duc Sud Meuse)','ge-tub.zip',[48.61,5.01,48.86,5.41]],
   ['twisto_caen','Twisto (Caen la mer)','twisto-caen.zip',[49.05,-0.58,49.33,-0.15]],
   ['setram_lemans','SETRAM (Le Mans Métropole)','setram-lemans.zip',[47.89,0.05,48.1,0.37]],
   ['transurbain_evreux','Transurbain (Évreux Portes de Normandie)','transurbain-evreux.zip',[48.94,1.04,49.1,1.21]],
   ['choletbus','Choletbus (Cholet Agglomération)','choletbus.zip',[46.98,-1.05,47.22,-0.35]],
   ['dkbus_dunkerque','DK\'Bus (Dunkerque)','dkbus-dunkerque.zip',[50.92,2.08,51.1,2.62]],
   ['simouv_valenciennes','Transvilles / SIMOUV (Valenciennes)','simouv-valenciennes.zip',[50.22,3.23,50.53,3.71]],
   ['pastel_saint_quentin','Pastel (Saint-Quentin)','pastel-saint-quentin.zip',[49.8,3.23,49.89,3.35]],
   ['bibus_brest','Bibus (Brest Métropole)','bibus-brest.zip',[48.32,-4.64,48.48,-4.33]],
   ['astuce_rouen','Astuce (Métropole Rouen Normandie)','astuce-rouen.zip',[49.24,0.71,49.56,1.28]],
   ['izilo_lorient','Izilo (Lorient Agglomération)','izilo-lorient.zip',[47.61,-3.55,48.04,-3.05]],
   ['tul_laval','TUL (Laval Agglomération)','tul-laval.zip',[47.97,-1.09,48.2,-0.61]],
   ['sitac_calais','Sitac (Calais)','sitac-calais.zip',[50.84,1.69,51.01,2.0]],
   ['tic_compiegne','TIC (Compiègne)','tic-compiegne.zip',[49.36,2.74,49.47,2.91]],
   ['envia_arles','Envia (Arles, Tarascon)','envia-arles.zip',[43.33,4.35,43.89,4.84]],
   ['zest_menton','Zest (Menton, Riviera Française)','zest-menton.zip',[43.71,7.38,44.14,7.69]],
   ['libebus_salon','Libébus (Salon-de-Provence)','libebus-salon.zip',[43.41,4.93,43.77,5.37]],
   ['agglobus_aubagne',"Lignes de l'Agglo (Aubagne)",'agglobus-aubagne.zip',[43.25,5.48,43.45,5.75]],
   ['ulysse_istres','Ulysse (Istres, Fos, Miramas)','ulysse-istres.zip',[43.31,4.77,43.72,5.46]],
   ['tedbus_draguignan','TEDbus (Draguignan, Dracénie)','tedbus-draguignan.zip',[43.3,6.2,43.7,6.7]],
   ['libellus_castres','Libellus (Castres)','libellus-castres.zip',[43.46,2.17,43.65,2.43]],
   ['alliance_auch','Alliance bus (Auch)','alliance-auch.zip',[43.59,0.54,43.73,0.65]],
   ['tlp_tarbes','TLP Mobilités (Tarbes, Lourdes)','tlp-tarbes-lourdes.zip',[43.06,-0.1,43.31,0.14]],
   ['tempo_agen','Tempo Bus (Agen)','tempo-agen.zip',[44.04,0.46,44.33,0.91]],
   ['agglobus_foix',"L'agglo-Bus (Foix, Varilhes)",'agglobus-foix.zip',[42.9,1.54,43.1,1.67]],
   ['idelis_pau','Idelis (Pau Béarn Pyrénées)','idelis-pau.zip',[43.2,-0.5,43.43,-0.22]],
   ['libeo_brive','Libéo (Brive)','libeo-brive.zip',[45.07,1.39,45.22,1.61]],
   ['tulle_agglo','Tulle Agglo (bus urbains)','tulle-agglo.zip',[45.22,1.72,45.31,1.8]],
   ['na_val_de_garonne','CA Val de Garonne (Marmande, bus)','na-val-de-garonne.zip',[44.37,0.08,44.55,0.34]],
   ['na_bergeracoise','CA Bergeracoise (Bergerac, bus)','na-bergeracoise.zip',[44.81,0.36,44.89,0.56]],
   ['na_saintes','CA Saintes (bus)','na-saintes.zip',[45.7,-0.7,45.78,-0.58]],
   ['na_limoges','Limoges Métropole (bus, trolleybus)','na-limoges.zip',[45.73,1.06,45.99,1.44]],
   ['na_rochefort','CA Rochefort Océan (bus)','na-rochefort.zip',[45.77,-1.14,46.06,-0.75]],
   ['na_perigueux','Grand Périgueux (bus)','na-perigueux.zip',[44.93,0.52,45.61,0.96]],
   ['na_pays_basque','CA Pays Basque (Bayonne, Biarritz, bus)','na-pays-basque.zip',[43.05,-1.68,43.54,-0.84]],
   ['na_grand_dax','Grand Dax (bus)','na-grand-dax.zip',[43.65,-1.13,43.8,-0.97]],
   ['na_libournais','CA du Libournais (bus)','na-libournais.zip',[44.8,-0.41,45.08,0.05]],
   ['na_grand_cognac','Grand Cognac (bus)','na-grand-cognac.zip',[45.5,-0.44,45.82,0.03]],
   ['na_grand_angouleme','Grand Angoulême (bus)','na-grand-angouleme.zip',[45.49,-0.04,45.8,0.41]],
   ['na_la_rochelle','La Rochelle (bus)','na-la-rochelle.zip',[46.0,-1.24,46.27,-0.9]],
   ['na_chatellerault','Grand Châtellerault (bus)','na-chatellerault.zip',[46.63,0.31,47.02,0.83]],
   ['na_niortais','CA du Niortais (bus)','na-niortais.zip',[46.13,-0.73,46.41,-0.34]],
   ['na_marsan','CA du Marsan (Mont-de-Marsan, bus)','na-marsan.zip',[43.84,-0.55,43.95,-0.42]],
   ['na_royan','Royan Atlantique (bus)','na-royan.zip',[45.43,-1.2,45.87,-0.7]],
   ['na_bressuirais','CA du Bocage Bressuirais (bus)','na-bressuirais.zip',[46.61,-0.92,47.1,-0.27]],
   ['rtca_carcassonne','RTCA (Carcassonne Agglo)','rtca-carcassonne.zip',[43.0,2.1,43.45,2.75]],
   ['sam_sete','Sète Agglopôle Mobilité','sam-sete.zip',[43.25,3.45,43.57,3.87]],
   ['tisseo_toulouse','Tisséo (Toulouse)','tisseo-toulouse.zip',[43.37,1.13,43.85,1.71]],
   ['mistral_toulon','Réseau Mistral (Toulon)','mistral-toulon.zip',[43.0,5.75,43.25,6.22]],
   // 20/11/2026 : réseaux urbains présents dans data/gtfs mais absents de ce moteur (audit de couverture).
   // CTS Strasbourg, STAR Rennes, TBM Bordeaux et TAO Orléans ont depuis été ajoutés plus bas (horizon réduit).
   ['agglobus_bourges',"Agglobus (Bourges)",'agglobus-bourges.zip',[47.035,2.321,47.134,2.459]],
   ['ametis_amiens',"Ametis (Amiens Métropole)",'ametis-amiens.zip',[49.846,2.235,49.939,2.391]],
   ['artis_arras',"Artis (CU d'Arras)",'artis-arras.zip',[50.261,2.714,50.326,2.838]],
   ['axeo_saint_brieuc',"Axéo (Saint-Brieuc)",'axeo-saint-brieuc.zip',[48.369,-2.982,48.631,-2.664]],
   ['eveole_douai',"Evéole (Douaisis)",'eveole-douai.zip',[50.281,3.037,50.431,3.188]],
   ['fil_bleu_tours',"Fil Bleu (Tours)",'fil-bleu-tours.zip',[47.31,0.591,47.489,0.878]],
   ['filibus_chartres',"Filibus (Chartres)",'filibus-chartres.zip',[48.344,1.337,48.545,1.602]],
   ['ilevia_lille',"ilévia (Lille)",'ilevia-lille.zip',[50.569,2.876,50.74,3.193]],
   ['irigo_angers',"Irigo (Angers)",'irigo-angers.zip',[47.396,-0.667,47.537,-0.428]],
   ['kiceo_vannes',"KICEO (Vannes)",'kiceo-vannes.zip',[47.524,-2.922,47.788,-2.57]],
   ['lia_le_havre',"LiA (Le Havre)",'lia-le-havre.zip',[49.429,0.039,49.735,0.463]],
   ['vitalis_poitiers',"Vitalis (Poitiers)",'vitalis-poitiers.zip',[46.522,0.263,46.682,0.434]],
   ['aixenbus_aix','Aix en Bus','aixenbus-aix.zip',[43.41,5.29,43.65,5.56]],
   ['tam_montpellier','TaM (Montpellier, urbain et suburbain)','tam-montpellier.zip',[43.45,3.5,43.95,4.15]],
   ['palmbus_cannes','Palmbus (Cannes Pays de Lérins)','palmbus-cannes.zip',[43.45,6.85,43.7,7.15]],
   ['lignes_azur_nice',"Lignes d'Azur (Nice)",'lignes-azur-nice.zip',[43.63,7.06,43.9,7.4]],
   ['rtm_marseille','RTM (Marseille)','rtm-marseille.zip',[43.23,5.33,43.36,5.48]],
   ['trema_macon','TréMA (Mâcon)','trema-macon.zip',[46.092,4.401,46.537,4.945]],
   ['lio_occitanie_nord','liO Occitanie (Gard, Lozère)','lio-occitanie-nord.zip',[44.0,3.3,44.95,4.7]],
   ['mobigo_bfc_jura','Mobigo Bourgogne-Franche-Comté (Jura)','mobigo-bfc-jura.zip',[46.2,5.3,47.1,6.3]],
   ['zou_express_nord','ZOU ! Express (Alpes du Sud)','zou-express-nord.zip',[44.0,5.0,45.2,7.2]],
   ['zou_proximite_nord','ZOU ! Proximité (Hautes-Alpes, Vaucluse nord)','zou-proximite-nord.zip',[44.0,5.0,45.0,7.0]],
   ['cars_ain','Cars Région Ain','cars-region-ain.zip',[45.535,4.688,46.527,6.09]],
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
   ['cars_ardeche', "Cars Région Ardèche", 'cars-region-ardeche.zip', [43.893,3.824,45.402,4.925]],
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
   ['t2c', "T2C (Clermont Auvergne Métropole)", 't2c-clermont.zip', [45.72,3.00,45.85,3.20]],
   // 20/11/2026 : 5 grandes métropoles encore absentes de ce moteur alors que leur extraction GTFS
   // était déjà prévue (voire déjà publiée) côté scripts/build_regional_gtfs.py — entrées ajoutées
   // ici pour que les fiches mission les utilisent réellement (mêmes emprises que le script).
   ['cts_strasbourg', "CTS (Strasbourg Eurométropole)", 'cts-strasbourg.zip', [48.48,7.60,48.68,7.82]],
   ['ilevia_lille', "ilévia (Métropole Européenne de Lille)", 'ilevia-lille.zip', [50.55,2.85,50.75,3.20]],
   ['star_rennes', "STAR (Rennes Métropole)", 'star-rennes.zip', [47.98,-1.85,48.22,-1.55]],
   // naolib_nantes volontairement absent : même avec un horizon réduit à 14 j, l'archive réelle décompresse
   // à 178 Mo de stop_times.txt (réseau très dense, ~12,7 Mo/j), largement au-delà des 64 Mo maxFileBytes du
   // moteur — « Expanded GTFS exceeds size limit » constaté en réel le 20/11/2026. La câbler demanderait un
   // horizon de 4-5 j, trop court pour un cron hebdomadaire (voir transport-coverage.js pour le suivi).
   ['tbm_bordeaux', "TBM (Bordeaux Métropole)", 'tbm-bordeaux.zip', [44.75,-0.70,44.95,-0.45]],
   // TAO Orléans Métropole : horizon réduit à 15 j (scripts/build_regional_gtfs.py) ; archive réelle
   // mesurée à 37,35 Mo (confortablement sous les 64 Mo maxFileBytes), ajoutée le 20/11/2026.
   ['tao_orleans', "TAO (Orléans Métropole)", 'tao-orleans.zip', [47.80,1.78,47.95,2.05]],
   // Île-de-France Mobilités (Paris intra-muros UNIQUEMENT — pas Roissy/Orly/La Défense/banlieue) :
   // réseau si dense (métro+bus+RER) qu'il a fallu descendre l'horizon à 1 seul jour (après 5j puis 2j,
   // tous deux encore au-dessus des 64 Mo maxFileBytes) pour que stop_times.txt tienne à 61,72 Mo — marge
   // serrée (2,3 Mo), à resurveiller si le cron hebdomadaire fait grossir l'extrait. Ajouté le 21/11/2026.
   ['idfm_paris', "Île-de-France Mobilités (Paris intra-muros)", 'idfm-paris.zip', [48.81,2.22,48.91,2.43]],
   // SNCF Transilien/RER Île-de-France : dataset distinct d'IDFM, horizon réduit à 21 j (pas de limite au
   // départ, stop_times.txt dépassait les 64 Mo à 66,53 Mo) ; mesuré ensuite à 30,01 Mo. Ajouté le 21/11/2026.
   ['transilien_idf', "SNCF Transilien / RER (Île-de-France)", 'transilien-idf.zip', [48.05,1.35,49.25,3.60]],
   // 21/11/2026 : 10 réseaux Bourgogne-Franche-Comté / Cherpa (escargot AURA→BFC), GTFS déjà publiés par
   // build-regional-gtfs.yml (commit 0224953). Emprises calculées directement depuis l'extension réelle de
   // stops.txt de chaque archive (min/max lat/lon, arrondi au millième vers l'extérieur), pas d'estimation.
   ['cherpa_issoire', "Cherpa (Issoire)", 'cherpa-issoire.zip', [45.541,3.215,45.551,3.267]],
   ['cotebus_beaune', "Côt'Bus (Beaune)", 'cotebus-beaune.zip', [46.904,4.626,47.078,4.890]],
   ['intercom_sens', "Intercom'Sens (Sens)", 'intercom-sens.zip', [48.044,3.210,48.260,3.463]],
   ['leo_auxerre', "Léo (Auxerre)", 'leo-auxerre.zip', [47.697,3.418,47.881,3.694]],
   ['monrezo_creusot', "Monrézo (Le Creusot – Montceau-les-Mines)", 'monrezo-creusot.zip', [46.641,4.289,46.811,4.499]],
   ['moova_vesoul', "Moova (Vesoul)", 'moova-vesoul.zip', [47.523,6.034,47.670,6.241]],
   ['optymo_belfort', "Optymo (Belfort)", 'optymo-belfort.zip', [47.445,6.771,47.821,7.118]],
   ['tallis_lons', "Tallis (Lons-le-Saunier)", 'tallis-lons.zip', [46.664,5.524,46.692,5.584]],
   ['taneo_nevers', "Taneo (Nevers)", 'taneo-nevers.zip', [46.903,3.037,47.107,3.228]],
   ['tea_autun', "TEA (Autun)", 'tea-autun.zip', [46.948,4.284,46.967,4.316]]
  ];
  // Archives are published on the transport feature branch, not necessarily on
  // the deployed GitHub Pages site. Explicit HTTPS URLs avoid a silent 404
  // when the Android app is served from another origin or an older deployment.
  const base='https://raw.githubusercontent.com/at374/convoyage-app/feature/transports-aura-suisse/data/gtfs/';
  let deployedBase=null;
  try{const l=r.location;if(l&&l.protocol==='https:'&&/(^|\.)github\.io$/.test(l.hostname))deployedBase=new URL('data/gtfs/',l.href).href;}catch(_){}
  // Les réseaux déjà lus restent en mémoire d'une recherche à l'autre (10 au maximum) : la 2e recherche et les actualisations de 5 min sont instantanées.
  const cache=r.__cpHubFeedCache||(r.__cpHubFeedCache=new Map());
  if(!cache.__w){const o=cache.set.bind(cache);cache.set=(k,v)=>{o(k,v);while(cache.size>10)cache.delete(cache.keys().next().value);return cache;};cache.__w=true;}
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
  // Web Worker unique (réutilisé) : lecture et recherche des réseaux locaux hors du fil de l'écran.
  for(const [id,name,file,bounds] of localNetworks){
   P['local_'+id]={name:name+' GTFS',
    enabled:task=>!!queryWindow(task)&&inBounds(pt(task.from),bounds)&&inBounds(pt(task.to),bounds),
    disabledReason:'trajet hors zone du réseau local ou horaires manquants',
    // Préparation à l'avance : seulement le téléchargement (gardé sur le téléphone), sans lecture du fichier, pour ne jamais figer l'écran.
    prefetch:async()=>{
     const urls=[...new Set([deployedBase?deployedBase+file:null,base+file,
      'https://raw.githubusercontent.com/at374/convoyage-app/main/data/gtfs/'+file,'https://at374.github.io/convoyage-app/data/gtfs/'+file].filter(Boolean))];
     for(const u of urls){try{const x=await fetcher(u);if(x&&x.ok){await x.arrayBuffer();return true;}}catch(_){}}
     return false;
    },
    run:async(task,signal)=>{
     const w=queryWindow(task),when=ms(w.when);
     if(!Number.isFinite(when))return [];
     // Publication sans retouche : sur le site déployé (GitHub Pages), la copie du site passe en premier (c'est elle
     // que les tâches hebdomadaires de la branche publiée rafraîchissent) ; sinon la branche Transports, puis la
     // branche principale et le site déployé en secours.
     const urls=[...new Set([deployedBase?deployedBase+file:null,base+file,
      'https://raw.githubusercontent.com/at374/convoyage-app/main/data/gtfs/'+file,'https://at374.github.io/convoyage-app/data/gtfs/'+file].filter(Boolean))];
     const {date,clock}=dateParts(when),resource={format:'GTFS',url:urls[0],fallbackUrls:urls.slice(1)};
     // 21/11/2026 : bug Y51/Albertville réel — l'adresse de livraison exacte et le domicile sont tous deux
     // à plus de 3 km à vol d'oiseau du plus proche arrêt Y51 (confirmé : 0 candidat à 3000 m, 126 à 5000 m,
     // sur les coordonnées réelles de la mission), alors que la marche réelle (calculée plus tard par le
     // routeur) reste dans la limite réglée par l'utilisateur. Ce rayon n'est qu'un PRÉ-FILTRE large et
     // approximatif (vol d'oiseau) ; le filtre de marche réelle (completeWalks/walkDetour/excessiveDetour)
     // s'applique ensuite et reste la seule limite qui compte pour l'affichage. Aligné sur le rayon de
     // 5000 m déjà utilisé par OpenTripPlanner (ligne ~1270), qui lui trouvait bien ce trajet.
     const radiusMeters=Math.max(5000,Number.isFinite(task.walkMaxMeters)&&task.walkMaxMeters>0?task.walkMaxMeters*1.5:5000);
     // Calcul hors du fil de l'écran (Web Worker) ; en cas d'échec du worker, ancien calcul sur le fil principal (même résultat).
     let rows=null,_viaWorker=false,_feedInfo=null;
     if(canWorker()){_viaWorker=true;try{rows=await workerRows(id+'|'+date,urls,date,pt(task.from),pt(task.to),{clock,arriveBy:!!w.arriveBy,directMeters:meters(pt(task.from),pt(task.to)),radius:radiusMeters});}catch(e){if(!(r.__cpHubWorkerOffUntil&&Date.now()<r.__cpHubWorkerOffUntil))throw e;rows=null;}}
     if(rows===null){
      _viaWorker=false;
      let promise=cache.get(id+'|'+date);
      if(!promise){
       promise=r.CPGTFSLoader.loadResource(resource,{fetcher,indexServiceDates:[date],retainSourceTables:false});
       cache.set(id+'|'+date,promise);
       promise.catch(()=>cache.delete(id+'|'+date));
      }
      const feed=await promise;
      _feedInfo={archiveBytes:feed.archiveBytes,expandedBytes:feed.expandedBytes,trips:feed.files?.trips?.length??null,stopTimes:feed.files?.stop_times?.length??null};
      rows=attachGTFSFares(feed,r.CPGTFSIndex.nearbyDirectTrips(feed.files,feed.index,date,pt(task.from),pt(task.to),radiusMeters),r.CPGTFSFares);
     }
     // 21/11/2026 : diagnostic temporaire (bug Y51 « 0 proposition reçue » en direct, non reproduit en simulation) —
     // capture la taille réelle du flux et le nombre de candidats bruts pour voir où ça diverge sur le téléphone.
     // 22/11/2026 (Laurent : « 8 propositions reçues » mais « kept=0 » dans le diagnostic — contradiction trouvée) :
     // launch() appelle CE moteur plusieurs fois pour la MÊME mission (une fois par « variante » de fenêtre horaire —
     // milieu de journée, avant ouverture…), et le total « propositions reçues » additionne tous les appels
     // (s.received[source]+=…), alors que ce diagnostic REMPLAÇAIT l'entrée à chaque appel : la dernière variante
     // (parfois vide) écrasait le kept d'une variante précédente qui avait pourtant trouvé des trajets. On conserve
     // maintenant le kept cumulé de TOUTES les variantes pour ce réseau, comme le fait déjà le total affiché.
     // 22/11/2026 (Laurent : liste « départs retenus » incohérente, mélangeant des horaires d'une tout autre
     // recherche) : la clé n'était QUE le nom du réseau, jamais remise à zéro — ce diagnostic accumulait donc
     // pour toujours, sur toute la durée de la session, les départs de TOUTES les recherches passées (autres
     // missions, autres dates), au lieu des seules variantes de LA recherche en cours. On préfixe désormais la
     // clé par le label de la mission (label|réseau), et launch() vide l'entrée au DÉBUT de chaque nouvelle
     // recherche pour ce label (voir plus bas) — seules les variantes de la recherche en cours s'accumulent.
     const dbgKey=task.label+'|'+name+' GTFS';
     try{const map=r.__cpGtfsDebug||(r.__cpGtfsDebug=new Map());const prev=map.get(dbgKey);
      map.set(dbgKey,{at:Date.now(),date,clock,from:pt(task.from),to:pt(task.to),radiusMeters,url:urls[0],viaWorker:_viaWorker,rawCandidates:Array.isArray(rows)?rows.length:null,feed:_feedInfo,kept:(prev&&Array.isArray(prev.kept))?prev.kept:[]});}catch(_){}
     if(signal?.aborted)return [];
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
      // Même règle que walkDetour : le filtre accès+sortie contre la marche directe élimine déjà le bruit
      // (sur un réseau dense comme TCL, des dizaines de variantes d'arrêt pour le même véhicule).
      if(directMeters>0&&score>=directMeters)continue;
      if(!previous||score<previous.score)best.set(key,{x,score});
     }
     // 20/11/2026 : demande de Laurent — garder TOUS les départs du jour qui répondent à la mission, pas
     // seulement les meilleurs (ex. Y51 Albertville→Annecy : 25 départs officiels, l'ancien plafond de 30
     // suffisait ici mais coupait sur des réseaux plus riches). SAFETY_MAX reste un garde-fou technique très
     // large, pas une limite métier : l'affichage (render) gère la lisibilité via « Voir plus ».
     // 22/11/2026 : ce plafond-ci porte sur TOUT le flux GTFS du réseau dans le rayon de marche (donc
     // potentiellement plusieurs lignes mélangées), pas seulement sur Y51 — 300 candidats/jour pour tout
     // un réseau est vite dépassé et coupait encore les départs Y51 de l'après-midi malgré les deux autres
     // plafonds déjà relevés (rank() et local_correspondances). Relevé à 1000 pour la même raison.
     const SAFETY_MAX=1000;
     // 21/11/2026 (demande Laurent) : networkId/networkUrls/serviceDate conservés sur chaque ligne —
     // nécessaires pour le bouton « Tous les horaires » (dayScheduleForLeg) qui refait une requête GTFS
     // complète sur CE réseau précis, pour CETTE ligne et CES arrêts, sans le filtre « après maintenant ».
     const filtered=[...best.values()].map(({x})=>({...x,network:name,networkId:id,networkUrls:urls,serviceDate:date,
       departure:toISO(date,x.departure),arrival:toISO(date,x.arrival)}))
      .filter(x=>x.departure&&x.arrival)
      .sort((a,b)=>w.arriveBy?Date.parse(b.arrival)-Date.parse(a.arrival):Date.parse(a.departure)-Date.parse(b.departure)).slice(0,SAFETY_MAX)
      .sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
     // 22/11/2026 (Laurent : Y51 a bien des départs l'après-midi dans le flux officiel — 12h15, 12h30, 13h30…
     // vérifiés — mais aucun n'atteint l'affichage) : on ne savait pas QUELS horaires ce moteur retenait
     // réellement après le filtre géographique (meilleur arrêt par véhicule), seulement leur nombre. On garde
     // maintenant la liste des départs retenus, pour voir s'ils sont bien après midi ou si le filtre
     // géographique/horaire les élimine déjà à cette étape, avant même la vérification de marge.
     try{const dbg=r.__cpGtfsDebug&&r.__cpGtfsDebug.get(dbgKey);if(dbg)dbg.kept=(Array.isArray(dbg.kept)?dbg.kept:[]).concat(filtered.map(x=>x.departure));}catch(_){}
     return fromGTFS(filtered,name);
    }};
  }
  // V306 : correspondances entre réseaux (ex. Taninges → Cluses en car Région à la demande, puis TER Cluses → Annecy).
  // Les réseaux qui touchent le départ ou l'arrivée + le flux SNCF sont chargés ; toutes les paires sont combinées (arrêts voisins ≤ 150 m,
  // 5 min minimum), et chaque réseau cherche aussi ses propres correspondances internes. Horaires théoriques, non confirmés.
  if(r.CPGTFSFederation?.crossNetworkTrips&&r.CPGTFSTime?.datedTrips&&r.CPGTFSIndex?.nearbyTransferTrips){
   const sncfFeed=['sncf_ter','SNCF (TER, TGV)','national-sncf-aura.zip',[44.0,3.6,46.7,7.4]];
   const area=b=>(b[2]-b[0])*(b[3]-b[1]);
   const urlsFor=file=>[...new Set([deployedBase?deployedBase+file:null,base+file,
     'https://raw.githubusercontent.com/at374/convoyage-app/main/data/gtfs/'+file,'https://at374.github.io/convoyage-app/data/gtfs/'+file].filter(Boolean))];
   const feedFor=(id,name,file,date)=>{
    const key='x|'+id+'|'+date;let promise=cache.get(key);
    if(!promise){
     const urls=urlsFor(file);
     promise=r.CPGTFSLoader.loadResource({format:'GTFS',url:urls[0],fallbackUrls:urls.slice(1),datasetId:id,network:name},{fetcher,indexServiceDates:[date],retainSourceTables:false});
     cache.set(key,promise);promise.catch(()=>cache.delete(key));
    }
    return promise;
   };
   const pickFeeds=task=>{
    const a=pt(task.from),b=pt(task.to);if(!a||!b)return [];
    const touching=[...localNetworks,sncfFeed].filter(n=>inBounds(a,n[3])||inBounds(b,n[3]));
    const score=n=>(n===sncfFeed?1:0)*0+(area(n[3])<0.5?0:1)*10+area(n[3]);
    // 20/11/2026 : 4 réseaux pouvait écarter un réseau local pertinent à la frontière de plusieurs bbox
    // (couverture nationale élargie = davantage de réseaux voisins qui se chevauchent). Relevé à 8.
    return touching.sort((x,y)=>score(x)-score(y)).slice(0,8);
   };
   P.local_correspondances={name:'Correspondances entre réseaux (GTFS)',
    enabled:task=>!!queryWindow(task)&&pickFeeds(task).length>0,
    disabledReason:'trajet hors zone des réseaux locaux ou horaires manquants',
    run:async(task,signal)=>{
     const w=queryWindow(task),when=ms(w.when);
     if(!Number.isFinite(when))return [];
     const {date,clock}=dateParts(when);
     const nets=pickFeeds(task);
     const from=pt(task.from),to=pt(task.to);
     const window={...(Number.isFinite(ms(task.earliestDeparture))?{earliestDeparture:task.earliestDeparture}:{}),
      ...(Number.isFinite(ms(task.latestArrival))?{latestArrival:task.latestArrival}:{}),marginMinutes:marginFor(task)};
     if(window.earliestDeparture===undefined&&window.latestArrival===undefined)return [];
     // 21/11/2026 : même bug que le moteur direct Y51 — 700 m était trop juste pour l'arrêt
     // réel (ex. "Ecole Saint-François" à 1034 m). On élargit avec la même formule, et on
     // respecte le plafond de crossNetworkTrips (radiusMeters <= 5000, sinon il lève une erreur).
     const sameNetworkRadius=Math.max(5000,Number.isFinite(task.walkMaxMeters)&&task.walkMaxMeters>0?task.walkMaxMeters*1.5:5000);
     // 21/11/2026 : crossNetworkTrips (ex. Y51 → réseau urbain Sibra) a son propre budget de
     // candidats (maxJourneys/maxPairs) qui sature vite — un réseau urbain dense (Sibra) a des
     // dizaines d'arrêts proches de n'importe quel point, et sameNetworkRadius (5000 m, pensé pour
     // le cas SANS réseau relais) noie les bonnes correspondances (ex. Épagny/Tuilerie à 696 m) sous
     // des milliers de variantes d'arrêts lointains avant d'y arriver, et la recherche s'arrête
     // (searchTruncated) sans jamais les atteindre. Vérifié avec les coordonnées réelles : à 2000 m
     // la correspondance Gare Routière → Y51 → Sibra → Tuilerie (696 m du domicile) ressort bien ;
     // au-delà (2500 m+) elle redisparaît, noyée par la saturation. 2000 m reste largement au-dessus
     // des arrêts réels les plus proches ici (≈1000-1300 m côté Albertville, ≈350-700 m côté Épagny).
     const crossNetworkRadius=2000;
     // 21/11/2026 : la vraie saturation venait d'ici, pas seulement du rayon — par défaut (120 min),
     // la recherche garde TOUTE correspondance possible dans les 2h suivant chaque arrivée du premier
     // véhicule, donc pour UN SEUL départ Y51 elle énumère déjà des dizaines de bus Sibra différents
     // et épuise le budget de candidats avant de passer au départ Y51 suivant. Résultat vérifié : sur
     // les coordonnées réelles, un seul des ~20 départs Y51 du jour obtenait une correspondance Sibra.
     // Une attente de correspondance de 30 min reste largement suffisante (ce n'est qu'un horaire
     // théorique « à confirmer »), et permet à la recherche d'atteindre les 20 départs Y51 du jour :
     // vérifié, chacun obtient alors la même bonne correspondance (Ecole Saint-François → Sibra →
     // Tuilerie, 1736 m de marche totale) au lieu d'un seul.
     const maxWaitMinutes=30;
     // 22/11/2026 (Laurent : « ça bloque toujours », et les horaires Y51 qui disparaissent par intermittence) :
     // sans heure limite d'arrivée (ex. « retour au domicile » après une mission, sans contrainte derrière),
     // window.latestArrival restait absent → missionBounds()/serviceWindow() bornent alors la recherche à
     // l'INFINI (toute la journée de service, parfois 20h+). nearbyTransferTrips/crossNetworkTrips scannent
     // alors des dizaines de départs Y51 et des milliers de combinaisons d'arrêts Sibra avant d'atteindre leur
     // plafond de candidats (maxPairs/maxJourneys) — c'est là le calcul le plus lourd de toute la recherche,
     // ET la cause du classement instable (quels départs survivent dépend de l'ordre de scan, pas de la
     // pertinence). On borne d'abord la recherche à un créneau glissant de quelques heures après le départ au
     // plus tôt — largement suffisant pour plusieurs départs Y51 (toutes les heures) — et on ne retombe sur la
     // recherche complète (non bornée) que si ce créneau ne donne RIEN (ex. tôt le matin avant le 1er bus).
     const CORRESPONDANCE_HORIZON_MS=3*3600000;
     const scanWindow=(window.latestArrival===undefined&&Number.isFinite(ms(window.earliestDeparture)))
      ?{...window,latestArrival:new Date(ms(window.earliestDeparture)+CORRESPONDANCE_HORIZON_MS).toISOString()}
      :window;
     const runPass=async(scanW)=>{
      // 21/11/2026 (Laurent : « l'écran se fige pendant la recherche ») : cette double boucle (jusqu'à 28
      // paires de réseaux, chacune examinant jusqu'à 100 000 combinaisons d'horaires via crossNetworkTrips)
      // est le calcul le plus lourd de toute la recherche transport. Elle tournait entièrement sur le fil
      // principal et figeait l'affichage pendant son exécution. Calcul hors du fil de l'écran (Web Worker,
      // même worker que les trajets directs locaux) ; en cas d'échec du worker, ancien calcul sur le fil
      // principal (même résultat) en secours.
      let rows=null;
      if(canWorker()){
       try{rows=await workerCorrespondances({nets:nets.map(n=>({id:n[0],name:n[1],urls:urlsFor(n[2])})),date,from,to,window:scanW,realWindow:window,sameNetworkRadius,crossNetworkRadius,maxWaitMinutes});}
       catch(e){if(!(r.__cpHubWorkerOffUntil&&Date.now()<r.__cpHubWorkerOffUntil))throw e;rows=null;}
      }
      if(rows===null){
       const loaded=(await Promise.all(nets.map(n=>feedFor(n[0],n[1],n[2],date).catch(()=>null)))).filter(Boolean);
       if(signal?.aborted||loaded.length<1)return [];
       // 21/11/2026 : « Tous les horaires » (Y22) manquait sur les trajets de correspondance — fromGTFS()
       // lit networkUrls/serviceDate par JAMBE (r.legs[i]), jamais attachés ici (seul le moteur direct le
       // faisait). On les attache désormais, par réseau réel de chaque jambe (une correspondance entre deux
       // réseaux a deux jambes de réseaux différents, chacune avec ses propres URLs GTFS).
       const netUrls=new Map(nets.map(n=>[n[0],urlsFor(n[2])]));
       rows=[];
       for(let i=0;i<loaded.length;i++){
        // Correspondances à l'intérieur d'un même réseau.
        try{
         const bounds=r.CPGTFSTime.serviceWindow(loaded[i].files,date,scanW);
         const t=r.CPGTFSIndex.nearbyTransferTrips(loaded[i].files,loaded[i].index,date,from,to,sameNetworkRadius,{...bounds,maxWaitMinutes});
         const dated=r.CPGTFSTime.datedTransferTrips(loaded[i].files,loaded[i].index,t.journeys,window);
         const urls=netUrls.get(nets[i][0])||[];
         rows.push(...dated.map(x=>({...x,network:loaded[i].source.network,
          legs:x.legs?.map(l=>({...l,network:loaded[i].source.network,networkUrls:urls,serviceDate:l.date||date}))})));
        }catch(_){}
        // Correspondances entre deux réseaux différents.
        for(let j=i+1;j<loaded.length;j++){
         if(signal?.aborted)return [];
         // 22/11/2026 (Laurent : « ça se fige », blocage ~40 s qui persiste même après le correctif du worker —
         // le worker échoue peut-être systématiquement ici, quelle qu'en soit la raison) : cette boucle peut
         // enchaîner jusqu'à 28 paires de réseaux sur le fil principal sans jamais rendre la main au navigateur,
         // d'où un seul blocage continu de plusieurs dizaines de secondes. On rend la main avant CHAQUE paire
         // (même coût total, mais le navigateur peut peindre/réagir entre deux) : l'écran ne doit plus se figer
         // d'un bloc, que le worker fonctionne ou non.
         await new Promise(res=>setTimeout(res,0));
         if(signal?.aborted)return [];
         try{
          const c=r.CPGTFSFederation.crossNetworkTrips([loaded[i],loaded[j]],date,from,to,scanW,{radiusMeters:crossNetworkRadius,maxWaitMinutes});
          const uI=netUrls.get(nets[i][0])||[],uJ=netUrls.get(nets[j][0])||[];
          rows.push(...c.journeys.map(x=>({...x,legs:x.legs.map(l=>({...l,
           networkUrls:(l.networkId===loaded[j].source.datasetId?uJ:uI),serviceDate:l.date||date}))})));
         }catch(_){}
        }
       }
      }
      return rows;
     };
     let rows=await runPass(scanWindow);
     if(signal?.aborted)return [];
     if((!Array.isArray(rows)||rows.length===0)&&scanWindow!==window)rows=await runPass(window);
     if(signal?.aborted)return [];
     const out=rows.filter(x=>x&&x.departure&&x.arrival).map(x=>({...x,onDemand:x.onDemand||!!x.legs?.some(l=>l&&l.onDemand)}));
     // 21/11/2026 : bug Y51/correspondances — un même véhicule (A) relié à un même véhicule (B) peut
     // techniquement « correspondre » à n'importe quel arrêt commun qu'ils desservent tous les deux (des
     // dizaines, le long de toute la ligne), ce qui produit des milliers de doublons du MÊME trajet logique
     // (même paire de courses, même horaires), seul l'arrêt de montée/correspondance/descente affiché change.
     // Un premier correctif (même date) dédoublonnait par tripId+horaires — mais l'horaire affiché (departure/
     // arrival du trajet complet) DÉPEND justement de l'arrêt de montée/descente choisi : Hôtel de Ville
     // (43 m de l'adresse réelle, car Y51 s'y arrête 10 min avant Thénésol) et Thénésol (6,4 km) donnent deux
     // horaires de départ différents pour LE MÊME bus, donc deux clés différentes — aucun des deux n'écrasait
     // l'autre et le candidat à 6,4 km de marche pouvait rester seul affiché. L'identité stable d'un même choix
     // de véhicule est son (ses) trip_id GTFS + la date de service, pas l'horaire dérivé de l'arrêt choisi. On
     // choisit désormais, pour chaque PAIRE DE VÉHICULES réellement empruntée, celui dont la marche totale
     // (accès + sortie) est la plus courte, avant le dédoublonnage final — même logique que le moteur direct
     // (ligne ~1140).
     const best=new Map();
     for(const x of out){
      const key=String(x.tripId||'')+'|'+(x.date||x.serviceDate||'');
      const access=Number(x.accessDistanceMeters),egress=Number(x.egressDistanceMeters);
      const score=Number.isFinite(access)&&Number.isFinite(egress)?access+egress:Infinity;
      const previous=best.get(key);
      if(!previous||score<previous.score)best.set(key,{x,score});
     }
     // 20/11/2026 : demande de Laurent — toutes les correspondances réalisables du jour, pas seulement les
     // 30 meilleures ; garde-fou technique très large (SAFETY_MAX), l'affichage gère la lisibilité.
     // 21/11/2026 : même règle que MAX_OTHERS dans rank() — 300 coupait déjà l'après-midi d'une relation dense
     // une fois les correspondances Y51×Sibra réellement enchaînées (une entrée par paire de courses
     // effectivement correspondante, pas des doublons). Relevé à 1000 pour la même raison.
     const seen=new Set(),uniq=[],SAFETY_MAX=1000;
     for(const {x} of [...best.values()].sort((a,b)=>Date.parse(a.x.arrival)-Date.parse(b.x.arrival)||Date.parse(a.x.departure)-Date.parse(b.x.departure))){
      const k=String(x.tripId||'')+'|'+x.departure;if(seen.has(k))continue;seen.add(k);uniq.push(x);if(uniq.length>=SAFETY_MAX)break;
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
   // Calcul hors du fil de l'écran (Web Worker) ; fetcher/signal ne sont pas clonables vers le worker
   // (le worker utilise son propre cache hors ligne, et n'a jamais pris en charge l'annulation, comme
   // pour les trajets directs locaux ci-dessus) ; en cas d'échec du worker, ancien calcul sur le fil
   // principal (même résultat).
   const nationalSearch=async params=>{
    const {operator:op,resource:res,fetcher:_f,signal:_s,...rest}=params;
    if(canWorker()){
     try{return await workerNationalSearch(op,res,rest);}
     catch(e){if(!(r.__cpHubWorkerOffUntil&&Date.now()<r.__cpHubWorkerOffUntil))throw e;}
    }
    return r.CPNationalGTFSJourneys.loadAndSearch(params);
   };
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
     let result=await nationalSearch(searchParams);
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
      const expanded=await nationalSearch({...searchParams,radiusMeters:5000}).catch(e=>{if(signal?.aborted)throw e;return null;});
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
      const overnight=await nationalSearch({
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
       const extra=await nationalSearch({...searchParams,[side]:{lat:anchor.lat,lon:anchor.lon},radiusMeters:3500}).catch(()=>null);
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
   // 20/11/2026 : 8 -> 16 (demande de Laurent : ne plus couper les résultats avant le classement).
   let res=await once({from:f,to:t,when:w.when,arriveBy:w.arriveBy,limit:16,fetcher});
   // Coordonnée non reconnue (fréquent côté France) : nouvelle recherche de gare à gare, gares choisies par l'API elle-même.
   if((!res||!res.length)&&typeof r.CPSwissTransport.nearestStation==='function'){
    const [a,b]=await Promise.all([r.CPSwissTransport.nearestStation(f,fetcher),r.CPSwissTransport.nearestStation(t,fetcher)]);
    if(a&&b&&a.id!==b.id)res=await once({from:a.id,to:b.id,when:w.when,arriveBy:w.arriveBy,limit:16,fetcher});
   }
   return fromSwiss(res).map(j=>retaillerP21(j,task)).filter(Boolean);}};
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
   // 20/11/2026 : 10 -> 20 (demande de Laurent : ne plus couper les résultats avant le classement).
   const answers=await Promise.all(offsets.map(m=>r.CPSncfFallback.plan({from:{name:task.fromCity||'',point:pt(task.from)},to:{name:task.toCity||'',point:pt(task.to)},
    when:new Date(base+m*60000).toISOString(),arriveBy:w.arriveBy,limit:20,signal,fetcher}).catch(()=>null)));
   const best=new Map();
   for(const a of answers.filter(Boolean))for(const it of a.itineraries||[]){
    const k=(it.legs?.[0]?.tripId||'')+'|'+it.departure,old=best.get(k);
    if(!old||Date.parse(it.arrival)<Date.parse(old.arrival))best.set(k,it);
   }
   const list=[...best.values()].sort((x,y)=>Date.parse(x.departure)-Date.parse(y.departure)).slice(0,20);
   return fromSNCF({itineraries:list,sourceVersion:answers.find(Boolean)?.sourceVersion});}};
 return P;
}

/* ---------- Accès aux gares routières éloignées (OTP2) ---------- */
// 22/11/2026 (Laurent : un trajet d'accès à un car longue distance — ex. marche+Y22 arrivant 06:11 à la gare
// routière d'Annecy pour un BlaBlaCar Bus à 09:45, soit 3h34 d'attente — était proposé comme « programmé »
// alors que ce n'est pas praticable pour le convoyeur. Le choix « marche minimale » du 21/11/2026 reste
// nécessaire (évite de préférer une longue marche à un bus local), mais sans plafond sur l'attente, l'option
// la moins marchante peut être un bus arrivant des heures trop tôt. On borne maintenant la fenêtre d'accès
// acceptable à [dep-gap-COACH_ACCESS_MAX_WAIT_MIN, dep-gap] (et symétriquement pour la sortie du car) : au-delà,
// l'accès n'est plus considéré comme trouvé plutôt que de proposer une attente démesurée.
const COACH_ACCESS_MAX_WAIT_MIN=20;
// 22/11/2026 (Laurent : « tous les moteurs et fichiers locaux doivent être complémentaires… et se contrôler
// les uns les autres ») : l'accès à la gare routière d'un car longue distance ne passait que par OTP2, jamais
// par les réseaux locaux (Sibra, Star't Thonon…) déjà utilisés ailleurs (completeWalks) pour la même tâche —
// un OTP2 absent/lent/sans la bonne ligne faisait manquer un accès qu'un moteur local aurait trouvé, et
// inversement. accessFor() interroge maintenant les deux familles de sources en parallèle et garde la
// meilleure option tous horizons confondus (comme pickClosest/trySubstituteLongWalk le font déjà pour les
// marches de substitution).
async function accessFor(j,task,otp,localAccess,signal){
 const side=j.needsAccess.side,legs=j.legs,gap=10*60000,maxWait=COACH_ACCESS_MAX_WAIT_MIN*60000;
 const first=legs[0],last=legs[legs.length-1],miss=t=>({...j,needsAccess:undefined,missing:[...(j.missing||[]),t]});
 const otpOk=!!(otp&&otp.run&&(()=>{try{return otp.enabled(task);}catch(_){return false;}})());
 const localOk=!!(localAccess&&localAccess.run&&(()=>{try{return localAccess.enabled(task);}catch(_){return false;}})());
 if(!otpOk&&!localOk)return miss('accès à la gare routière non calculé (ni serveur OTP2 ni réseau local disponible)');
 let t2;
 // 22/11/2026 (suite, demande Laurent : « la recherche doit obligatoirement trouver un bus qui arrive 10 min
 // max avant le départ du car ») : marginFor() impose un plancher de 15 min dès que exactTarget/allowShortMargin
 // ne sont pas tous deux vrais — avec marginMinutes:10 ici, la requête OTP demandait donc une arrivée au plus
 // tard dep-gap-15min (25 min avant le car), au lieu de dep-gap-10min visée, ratant les correspondances qui
 // arrivent entre ces deux bornes. exactTarget+allowShortMargin ramène ce plancher à 5 min (marginFor gère le
 // min(base,5)), pour que la fenêtre réellement demandée à OTP colle à celle qu'accessFor() accepte ensuite.
 if(side==='from'){const dep=ms(first.departure),target=pt(first.fromPoint);if(!Number.isFinite(dep)||!target||!pt(task.from))return miss('accès à la gare routière non calculable');
  t2={...task,label:task.label,from:task.from,to:target,toName:first.from,latestArrival:new Date(dep-gap).toISOString(),marginMinutes:5,exactTarget:true,allowShortMargin:true,walkMaxMeters:undefined};delete t2.windowKind;}
 else{const arr=ms(last.arrival),from=pt(last.toPoint);if(!Number.isFinite(arr)||!from||!pt(task.to))return miss('trajet depuis la gare routière non calculable');
  t2={...task,from,fromName:last.to,to:task.to,earliestDeparture:new Date(arr+gap).toISOString(),marginMinutes:5,exactTarget:true,allowShortMargin:true,walkMaxMeters:undefined};delete t2.windowKind;
  if(!Number.isFinite(ms(task.latestArrival)))delete t2.latestArrival;}
 let otpErr=null,localErr=null;
 const [otpList,localList]=await Promise.all([
  otpOk?otp.run(t2,signal).catch(e=>{otpErr=e;return [];}):Promise.resolve([]),
  localOk?localAccess.run(t2).catch(e=>{localErr=e;return [];}):Promise.resolve([])
 ]);
 const list=[...(Array.isArray(otpList)?otpList:[]),...(Array.isArray(localList)?localList:[])];
 // Une source qui échoue (délai dépassé, erreur réseau…) ne doit pas faire taire l'autre : on ne signale
 // l'erreur que si, au final, aucune des deux n'a produit de proposition exploitable.
 if(!list.length&&(otpErr||localErr)){
  const e=otpErr||localErr;
  return miss('accès à la gare routière non calculé ('+String(e&&e.message||e).slice(0,60)+')');
 }
 const ok=list.filter(a=>a&&Array.isArray(a.legs)&&a.legs.length&&a.legs.every(l=>l&&Number.isFinite(ms(l.departure))&&Number.isFinite(ms(l.arrival))));
 let best=null;
 // 21/11/2026 : parmi les accès compatibles avec l'horaire, le plus proche de l'heure limite était toujours choisi —
 // ce qui favorise mécaniquement une longue marche (qui consomme toute la marge) plutôt qu'un bus local (Sibra…)
 // arrivant plus tôt avec de la marge. Repéré en réel : 37 min de marche proposées au départ du domicile alors
 // qu'un bus Sibra existait. On choisit maintenant l'option qui marche le moins, l'heure ne servant qu'à départager
 // les options à marche égale.
 const walkOf=a=>(a.legs||[]).filter(isFoot).reduce((s,l)=>s+(Number(l.distanceMeters)||0),0);
 if(side==='from'){const dep=ms(first.departure);
  const fit=ok.filter(a=>{const arr=ms(a.legs[a.legs.length-1].arrival);return arr<=dep-gap&&arr>=dep-gap-maxWait&&(!Number.isFinite(ms(task.earliestDeparture))||ms(a.legs[0].departure)>=ms(task.earliestDeparture));});
  best=fit.sort((a,b)=>walkOf(a)-walkOf(b)||ms(b.legs[b.legs.length-1].arrival)-ms(a.legs[a.legs.length-1].arrival))[0];}
 else{const arr=ms(last.arrival);
  const fit=ok.filter(a=>{const dep=ms(a.legs[0].departure);return dep>=arr+gap&&dep<=arr+gap+maxWait;});
  best=fit.sort((a,b)=>walkOf(a)-walkOf(b)||ms(a.legs[a.legs.length-1].arrival)-ms(b.legs[b.legs.length-1].arrival))[0];}
 // 22/11/2026 : attente excessive (au-delà de COACH_ACCESS_MAX_WAIT_MIN) plutôt qu'aucun accès du tout — message
 // distinct pour que le convoyeur comprenne que la ligne existe mais n'offre aucune correspondance praticable,
 // au lieu de croire qu'aucun transport n'existe pour cette portion.
 if(!best){
  const anyArriving=side==='from'?ok.some(a=>Number.isFinite(ms(a.legs[a.legs.length-1].arrival))&&ms(a.legs[a.legs.length-1].arrival)<=ms(first.departure)-gap):
   ok.some(a=>Number.isFinite(ms(a.legs[0].departure))&&ms(a.legs[0].departure)>=ms(last.arrival)+gap);
  return miss(anyArriving?'accès à la gare routière trouvé mais avec une attente de plus de '+COACH_ACCESS_MAX_WAIT_MIN+' min (correspondance trop lâche)':'aucun accès à la gare routière trouvé dans les horaires');
 }
 const merged=side==='from'?[...best.legs,...legs]:[...legs,...best.legs];
 const accessSource=best.sources?.[0]||best.source||'un moteur local';
 return {...j,needsAccess:undefined,legs:merged,sources:[...new Set([...(j.sources||[j.source]),...(best.sources||[best.source]).filter(Boolean)])],
  missing:[...(j.missing||[])],alerts:[...(j.alerts||[]),'Accès à la gare routière calculé par '+accessSource+' (horaires théoriques).']};
}

/* ---------- Session ---------- */
function createSession({tasks=[],providers={},router=null,scooterRouter=null,scooter=null,fareFor=null,walkMaxKm=3,timeoutMs=25000,onUpdate=()=>{}}={}){
 tasks=tasks.map(t=>({...t,walkMaxMeters:Number.isFinite(t.walkMaxMeters)?t.walkMaxMeters:(Number.isFinite(walkMaxKm)&&walkMaxKm>0?walkMaxKm*1000:undefined)}));
 const state={},controller=new AbortController();let disposed=false;
 // 21/11/2026 : une longue marche d'approche/sortie n'était comparée à un bus/tram local que dans
 // l'agglomération grenobloise (Mobilités M, providers.regional) — ailleurs (Thonon/Star't, Annecy/Sibra…),
 // completeWalks() ne proposait jamais qu'une marche pure, même quand le réseau local dessert exactement
 // les deux bouts de cette marche (ex. marche de 3,4 km en bout de trajet SNCF à Thonon-les-Bains, alors que
 // Star't Thonon dessert la gare et l'adresse de livraison). Les moteurs locaux (providers['local_<id>'])
 // existent déjà et savent répondre à un couple de points + une fenêtre horaire (mêmes enabled()/run() que
 // pour une mission complète) : on les réutilise ici pour UNE SEULE marche, sans les ajouter comme moteurs
 // de premier niveau (ce qui les ferait apparaître en double dans « Moteurs consultés »). Mobilités M reste
 // essayé en premier (compatibilité), les réseaux locaux ne sont tentés que si aucun résultat exploitable
 // n'en est ressorti.
 const localNetworkIds=Object.keys(providers).filter(k=>k.startsWith('local_')&&k!=='local_correspondances');
 // 22/11/2026 (Laurent : « tu vérifies avec les moteurs de la Suisse aussi ») : providers.swiss (transport.opendata.ch)
 // et providers.ojp (OJP opentransportdata.swiss) ont la même interface enabled(task)/run(task) qu'un réseau
 // local — mais leurs clés ne commencent pas par « local_ », donc localNetworkIds (filtre sur ce préfixe) les
 // ignorait complètement : une marche longue ou un accès de car près de la frontière (Grand Genève, Chablais,
 // Jura, Bâle…) n'était jamais comparée aux transports suisses. On les ajoute explicitement à la liste des
 // sources complémentaires.
 const complementIds=[...localNetworkIds,...['swiss','ojp'].filter(k=>providers[k])];
 const hasTransit=list=>Array.isArray(list)&&list.some(it=>it&&Array.isArray(it.legs)&&it.legs.length&&it.legs.some(l=>l&&l.kind!=='walk'));
 // 22/11/2026 (Laurent : « tous les moteurs et fichiers locaux doivent être complémentaires… et se contrôler
 // les uns les autres ») : run() s'arrêtait au PREMIER réseau local renvoyant un résultat exploitable,
 // sans comparer aux autres réseaux locaux pertinents pour la même tâche — à la frontière de deux réseaux
 // (ex. Thonon/Star't et un réseau voisin desservant tous les deux la même zone), le réseau essayé en
 // premier pouvait masquer une correspondance bien meilleure trouvée par un autre. pickClosest(), appelé
 // ensuite par trySubstituteLongWalk(), compare déjà toutes les options d'une même liste sur la marche
 // totale puis l'horaire : on lui fournit maintenant l'union de TOUTES les sources locales pertinentes
 // (Mobilités M, réseaux locaux français, et Suisse/OJP près de la frontière) au lieu de s'arrêter au
 // premier qui répond.
 const anyLocalBus={
  enabled:task=>{
   try{if(providers.regional&&providers.regional.enabled(task))return true;}catch(_){}
   return complementIds.some(k=>{try{return providers[k].enabled(task);}catch(_){return false;}});
  },
  run:async task=>{
   const runners=[];
   try{if(providers.regional&&providers.regional.enabled(task))runners.push(providers.regional.run(task).catch(()=>[]));}catch(_){}
   for(const k of complementIds){
    let ok=false;try{ok=providers[k].enabled(task);}catch(_){ok=false;}
    if(ok)runners.push(providers[k].run(task).catch(()=>[]));
   }
   if(!runners.length)return [];
   const results=await Promise.all(runners);
   const merged=results.flat().filter(it=>it&&Array.isArray(it.legs)&&it.legs.length);
   return hasTransit(merged)?merged:[];
  }
 };
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
  // 22/11/2026 (Laurent : « toujours pas de Y51 après 13h01 », quasi tous les trajets écartés comme « avant la fin
  // de la mission précédente » malgré une fenêtre earliestDeparture cohérente affichée) : le seul compteur ne
  // permettait pas de savoir SUR QUEL calcul ce rejet se basait réellement (horaire du véhicule lui-même, ou
  // horaire de la marche d'accès prépendue, parfois faussée par une distance de marche aberrante). On garde un
  // échantillon (source + horaire du véhicule + horaire retenu après marche) des trajets rejetés pour cette seule
  // raison, pour voir directement où l'écart se situe au lieu de deviner encore.
  const beforeList=tooEarly.filter(j=>j.reasons.includes('départ avant la fin de la mission précédente'));
  const beforeSamples=beforeList.slice(0,6).map(j=>{
   const vehicleLeg=(j.legs||[]).find(l=>l&&l.kind!=='walk');
   return (j.source||j.sources?.[0]||'?')+' : véhicule '+(vehicleLeg?.departure?new Date(vehicleLeg.departure).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}):'—')+
    ' → départ retenu (après marche) '+(j.departure?new Date(j.departure).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}):'—');
  });
  return {task:s.task,longShown,...rank(shown,s.task),hidden:{tooEarly:tooEarly.length-longShown,before:beforeList.length,beforeSamples,early:tooEarly.filter(j=>j.reasons.some(r=>r.startsWith('arrivée trop tôt'))).length,longWalk:tooEarly.filter(j=>j.reasons.some(r=>r.startsWith('marche trop longue'))).length-longShown,night:tooEarly.filter(j=>j.reasons.includes('trajet hors plage de jour ou date de mission')).length},pending:s.pending,errors:{...s.errors},skipped:{...s.skipped},received:{...s.received},discarded:{...s.discarded},done:s.pending===0,
  // 20/11/2026 (demande Laurent) : pouvoir suggérer la trottinette électrique quand des trajets sont écartés
  // uniquement pour une marche trop longue — seulement si l'option n'est pas déjà activée dans les Réglages.
  scooterEnabled:!!(scooter&&scooter.enabled),
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
  // Cars depuis une gare routière éloignée : accès (TCL…) calculé par OTP2, 12 cars au plus par moteur (20/11/2026 :
  // 6 -> 12, demande de Laurent) ; sans accès calculé, le car reste signalé « accès non calculé ».
  if(clean.some(j=>j.needsAccess)){
   const withAccess=clean.filter(j=>j.needsAccess).sort((a,b)=>ms(a.departure||a.legs[0]?.departure)-ms(b.departure||b.legs[0]?.departure)).slice(0,12);
   const resolved=await Promise.all(withAccess.map(j=>accessFor(j,s.task,providers.otp,anyLocalBus,controller.signal)));
   clean=clean.filter(j=>!j.needsAccess).concat(resolved);
  }
  if(clean.length!==usable.length)s.discarded[source]=(s.discarded[source]||0)+usable.length-clean.length;
  // 1) Doublon d'un trajet déjà traité (autre moteur) : on ajoute la source, sans recalculer les marches.
  // 2) Trajet déjà hors délai sur ses seuls horaires : affiché « non confirmé » sans dépenser de marche.
  // 3) Les autres (8 au plus, les plus utiles d'abord) reçoivent leurs marches et s'affichent dès qu'ils sont prêts.
  const toWalk=[];
  for(const j of clean){
   const key=signature(j),known=key&&s.bySignature.get(key);
   if(known){known.sources=[...new Set([...known.sources,...(j.sources||[j.source])])];
    // 22/11/2026 (Laurent : le bouton « Tous les horaires » manque sur certaines lignes d'un trajet, alors
    // qu'il existe pour d'autres lignes identiques ailleurs) : quand le MÊME trajet est retrouvé par plusieurs
    // moteurs (ex. OpenTripPlanner ET le moteur GTFS de correspondances), seul le premier arrivé était gardé —
    // si ce premier moteur ne pose pas gtfsRaw/routeId sur ses jambes (OTP ne le fait pas), le bouton restait
    // absent même quand un AUTRE moteur avait bien ces métadonnées pour le même trajet. On complète maintenant
    // les jambes déjà affichées avec le gtfsRaw d'un doublon plus tard, quand celui qui est déjà affiché n'en a pas.
    if(Array.isArray(known.legs)&&Array.isArray(j.legs)&&known.legs.length===j.legs.length)
     for(let i=0;i<known.legs.length;i++)if(!known.legs[i].gtfsRaw&&j.legs[i]&&j.legs[i].gtfsRaw)known.legs[i].gtfsRaw=j.legs[i].gtfsRaw;
    continue;}
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
  const walkBatch=batch=>Promise.all(batch.map(t=>completeWalks(t.j,s.task,router,{enabled:!!(scooter&&scooter.enabled&&scooterRouter),router:scooterRouter,maxKm:scooter&&scooter.maxKm,speedKmh:scooter&&scooter.speedKmh},providers?anyLocalBus:null).then(x=>{
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
  // 22/11/2026 : vide le diagnostic « départs retenus » de CE label avant de relancer sa recherche, pour qu'il
  // ne mélange plus les horaires d'une recherche précédente (autre heure, autre jour) avec celle en cours —
  // voir le commentaire détaillé sur dbgKey plus haut dans ce fichier.
  try{if(r.__cpGtfsDebug)for(const k of [...r.__cpGtfsDebug.keys()])if(k.startsWith(label+'|'))r.__cpGtfsDebug.delete(k);}catch(_){}
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
// 21/11/2026 (demande Laurent) : « pour chaque ligne régionale ou locale qui apparaît dans un trajet, une
// icône doit montrer tous ses horaires de la journée de mission » — généralise le bouton qui n'existait
// jusqu'ici que pour Y51 Albertville (fiche mission, app.js, données préparées à part). Fonctionne pour
// toute ligne dont les horaires viennent d'un réseau GTFS local/régional câblé (localNetworks) : SNCF,
// FlixBus, BlaBlaCar Bus, l'API suisse, TripGo/OJP et les correspondances inter-réseaux n'ont pas cette
// métadonnée et n'affichent donc pas ce bouton (portée assumée, pas un oubli).
const dayScheduleTablesCache=new Map();
async function gtfsTablesForDaySchedule(raw){
 const key=(raw.networkUrls||[])[0]+'|'+raw.serviceDate;
 let promise=dayScheduleTablesCache.get(key);
 if(!promise){
  promise=(async()=>{
   const loader=root.CPGTFSLoader,pl=root.CPSibraPlanner;
   if(!loader||typeof loader.loadResource!=='function'||!pl||typeof pl.parseGtfsCsv!=='function')return null;
   const feed=await loader.loadResource({format:'GTFS',url:raw.networkUrls[0],fallbackUrls:raw.networkUrls.slice(1)},
    {indexServiceDates:[raw.serviceDate],retainSourceTables:true});
   const csv=name=>pl.parseGtfsCsv(feed.files?.[name]||'')||[];
   return {stops:csv('stops.txt'),trips:csv('trips.txt'),routes:csv('routes.txt'),
    stop_times:csv('stop_times.txt'),calendar:csv('calendar.txt'),calendar_dates:csv('calendar_dates.txt')};
  })();
  dayScheduleTablesCache.set(key,promise);
  promise.catch(()=>dayScheduleTablesCache.delete(key));
 }
 return promise;
}
// Tous les départs du jour de CETTE ligne entre les DEUX arrêts de CETTE étape — même mécanique que le
// bouton Y51 historique (sibra-planner.js::datedInterurbanRides), généralisée à tout réseau GTFS câblé.
async function dayScheduleForLeg(raw){
 if(!raw||!Array.isArray(raw.networkUrls)||!raw.networkUrls.length||!raw.routeId||!raw.from||!raw.to||!raw.serviceDate)return [];
 const tables=await gtfsTablesForDaySchedule(raw);
 const pl=root.CPSibraPlanner;
 if(!tables||!pl||typeof pl.datedInterurbanRides!=='function')return [];
 const rows=pl.datedInterurbanRides(tables,raw.serviceDate,String(raw.routeId),String(raw.from),String(raw.to));
 return [...new Map(rows.map(r=>[r.trip_id+':'+r.departureSeconds,r])).values()]
  .sort((a,b)=>a.departureSeconds-b.departureSeconds);
}
function hmFromSeconds(sec){
 if(!Number.isFinite(sec))return '?';
 return String(Math.floor(sec/3600)%24).padStart(2,'0')+':'+String(Math.floor(sec/60)%60).padStart(2,'0');
}
function card(doc,j,labels,expanded=false,task=null){
 const c=el(doc,'details','cp-hub-card'+(j.feasible?' ok':j.scheduled?' sched':' warn'));
 if(expanded)c.open=true;
 const s=el(doc,'summary');
 if(labels&&labels.length)s.appendChild(el(doc,'span','cp-hub-chip',labels.join(' · ')));
 s.appendChild(el(doc,'strong','cp-hub-times',clock(j.departure)+' → '+clock(j.arrival)+' · '+durationText(j.durationMinutes)));
 // 22/11/2026 (Laurent : « marquer en petit en dessous de l'heure l'adresse exacte de départ et d'arrivée, pour
 // éviter toute erreur de trajet ») : jusqu'ici le nom des extrémités n'apparaissait que dans le détail de
 // chaque étape, une fois la carte ouverte. On le reprend ici, visible dès le titre de la carte (fermée ou
 // non) — c'est déjà l'adresse la plus précise connue (celle de la mission, ou la marche GPS précise ci-dessous
 // si l'adresse de la mission est approximative).
 if(j.legs&&j.legs.length){
  const startName=j.legs[0]&&j.legs[0].from,endName=j.legs[j.legs.length-1]&&j.legs[j.legs.length-1].to;
  if(startName||endName)s.appendChild(el(doc,'small','cp-hub-endpoints',(startName||'?')+' → '+(endName||'?')));
 }
 // Prix affiché seulement s'il est réellement connu et vérifié : plus de mention « Prix à confirmer » ni de prix partiel.
 if(j.price.status!=='unknown')s.appendChild(el(doc,'span','cp-hub-price',j.price.label));
 if(j.price.status==='unknown')for(const t of ticketLinks(j)){
  const link=el(doc,'a','cp-hub-ticket','🎟️ '+t.label);link.href=t.url;link.target='_blank';link.rel='noopener noreferrer';
  link.title='Acheter le billet ou consulter le prix : '+t.label;link.setAttribute('aria-label','Acheter le billet sur '+t.label);
  if(link.addEventListener)link.addEventListener('click',e=>e.stopPropagation());s.appendChild(link);}
 s.appendChild(el(doc,'span','cp-hub-modes',j.legs.map(l=>(ICON[l.mode]||'🚏')+(l.kind==='walk'?' '+durationText(Math.max(1,Math.round((l.durationSeconds||0)/60))):(l.line?' '+l.line:''))).join(' › ')));
 s.appendChild(el(doc,'span','cp-hub-status',(j.feasible?'✅ ':j.scheduled?'🕒 ':'⚠️ ')+j.status+(j.slackMinutes!=null?' · '+(j.deadlineEstimated?'avance avant fermeture estimée de l’agence ('+clock(j.deadlineMs)+')':'avance')+' '+signedDurationText(j.slackMinutes)+' (marge '+durationText(j.marginMinutes)+')':'')));
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
  li.appendChild(el(doc,'strong',null,(ICON[l.mode]||'🚏')+' '+(l.kind==='scooter'?'Trottinette'+(l.distanceMeters!=null?' '+(l.distanceMeters/1000).toFixed(1).replace('.',',')+' km':'')+(l.durationSeconds!=null?' · '+durationText(Math.max(1,Math.round(l.durationSeconds/60)))+' (estimé)':''):l.kind==='walk'?'Marche'+(l.distanceMeters!=null?' '+Math.round(l.distanceMeters)+' m':'')+(l.durationSeconds!=null?' · '+durationText(Math.max(1,Math.round(l.durationSeconds/60))):''):[l.mode,l.line,l.provider&&l.provider!==l.line?'('+l.provider+')':'',l.headsign&&l.headsign!==l.line?'→ direction '+l.headsign:''].filter(Boolean).join(' '))));
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
   // 22/11/2026 (Laurent : « enlever tout le texte à partir de Départ jusqu'à la carte ») : le bloc
   // Départ/Arrivée (géocodage inverse de chaque extrémité de marche) est supprimé — on passe directement
   // à la carte ci-dessous, qui montre déjà le trajet exact.
   if(nearP21(pt(l.toPoint))||nearP21(pt(l.fromPoint))){
    const n=el(doc,'div','cp-hub-p21',null);
    n.setAttribute('style','border:1px solid #f5b400;border-radius:10px;padding:8px 10px;margin:8px 0;background:rgba(245,180,0,.12)');
    n.appendChild(el(doc,'strong',null,'⚠️ Marche vers/depuis le parking P21 (Genève, secteur France)'));
    n.appendChild(el(doc,'p',null,'À pied : il faut passer à l’intérieur de l’aéroport, par l’agent de sécurité puis la douane française. Montrez impérativement le contrat de convoyage et une pièce d’identité.'));
    n.appendChild(el(doc,'p',null,'Autre solution, plus coûteuse : prendre un taxi devant l’aéroport, qui vous emmène jusqu’au sous-sol du parking P21.'));
    li.appendChild(n);}
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
   const guide=el(doc,'details','cp-hub-steps');
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
   // 21/11/2026 (demande Laurent) : bouton « tous les horaires » pour chaque ligne régionale/locale GTFS —
   // généralisé à toute fiche mission, plus seulement Y51 Albertville. Nécessite les métadonnées GTFS
   // brutes (networkUrls/routeId/arrêts/date) posées par fromGTFS() sur les trajets locaux (localNetworks).
   const raw=l.gtfsRaw;
   if(raw&&Array.isArray(raw.networkUrls)&&raw.networkUrls.length&&raw.routeId&&raw.from&&raw.to&&raw.serviceDate){
    const dayBtn=el(doc,'button','cp-hub-dayline','🕒 Tous les horaires '+(l.line||l.mode)+' du '+dayText(l.departure||raw.serviceDate));
    dayBtn.type='button';
    const dayRes=el(doc,'div','cp-hub-dayline-result');dayRes.setAttribute('aria-live','polite');
    let dayOpen=false;
    dayBtn.addEventListener('click',e=>{
     e.preventDefault();e.stopPropagation();
     if(dayBtn.disabled)return;
     // 21/11/2026 : deuxième clic doit replier (le clic ne faisait que relancer la même requête sans jamais
     // vider dayRes, donc le bouton semblait ne « rien faire » au second clic — signalé par Laurent).
     if(dayOpen){dayOpen=false;dayRes.textContent='';dayRes.replaceChildren();return;}
     dayOpen=true;
     dayBtn.disabled=true;dayRes.textContent='Chargement des horaires…';
     dayScheduleForLeg(raw).then(rows=>{
      dayRes.textContent='';
      if(!rows.length){dayRes.textContent='Aucune autre course trouvée ce jour entre ces deux arrêts (données GTFS officielles).';return;}
      dayRes.appendChild(el(doc,'strong',null,rows.length+' départ'+(rows.length>1?'s':'')+' le '+raw.serviceDate+' :'));
      const ul=el(doc,'ul',null);
      for(const row of rows)ul.appendChild(el(doc,'li',null,hmFromSeconds(row.departureSeconds)+' → '+hmFromSeconds(row.arrivalSeconds)));
      dayRes.appendChild(ul);
      dayRes.appendChild(el(doc,'small',null,'Horaires théoriques officiels (GTFS '+(l.provider||raw.network||'')+'). Circulation réelle non vérifiée.'));
     }).catch(()=>{dayRes.textContent='Horaires indisponibles pour cette date.';})
      .finally(()=>{dayBtn.disabled=false;});
    });
    li.appendChild(dayBtn);li.appendChild(dayRes);
   }
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
 // 22/11/2026 (Laurent : aucun moyen de voir pourquoi un trajet est « Transport non confirmé » — le résumé
 // masque volontairement cp-hub-reason depuis le 20/11/2026 (style.css : .cp-hub-card>summary .cp-hub-reason
 // {display:none!important}), et jusqu'ici la raison n'était montrée dans le corps déplié QUE pour un trajet
 // réalisable. Résultat : un trajet non confirmé n'affichait sa raison NULLE PART dans l'interface, même
 // déplié — obligeant à deviner. On l'affiche maintenant dans le corps déplié pour un trajet non confirmé
 // aussi, clairement préfixé pour ne pas le confondre avec les horaires théoriques/temps réel.
 else if(!j.scheduled&&j.statusDetail)body.appendChild(el(doc,'p','cp-hub-note cp-hub-reason-body','⚠️ Non confirmé : '+j.statusDetail));
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
let ordreInverse=false;try{ordreInverse=localStorage.getItem('cp_hub_ordre')==='desc';}catch(_){}
function viewFingerprint(v){
 const one=j=>j?[signature(j)||'',ms(j.departure),ms(j.arrival),j.computing?1:0,j.feasible?1:0,j.scheduled?1:0,(j.reasons||[]).length,(j.missing||[]).length,j.price&&j.price.status,(j.sources||[]).length,j.walkMeters].join(','):'';
 return [v.done?1:0,v.total,v.longShown,(v.picks||[]).map(p=>(p.labels||[]).join('+')+':'+one(p.journey)).join(';'),(v.others||[]).map(one).join(';'),v.others&&v.others.length,
  Object.entries(v.errors||{}).map(([k,e])=>k+e).join('|'),Object.entries(v.received||{}).join('|'),ordreInverse?'desc':'asc'].join('#');
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
 if(v.longShown)host.appendChild(el(doc,'p','cp-hub-note','⚠️ Aucune proposition ne respecte votre limite de marche (Paramètres) : les trajets ci-dessous demandent une marche plus longue que ce réglage. Vérifiez chaque marche avant de partir.'+(v.scooterEnabled?'':' Vous pouvez aussi activer la trottinette électrique (Paramètres) pour couvrir une partie du trajet à sa place.')));
 const addCard=(parent,j,labels,expandFirst=false)=>{
  const key=signature(j)||(j.walkOnly?'walk|'+Math.round(ms(j.departure)/60000)+'|'+Math.round(ms(j.arrival)/60000)+'|'+Math.round(j.durationMinutes||0):'');
  // Construire immédiatement les détails si cette carte était déjà ouverte :
  // poser node.open après card() ne construit pas toujours le corps au rendu.
  const node=card(doc,j,labels,expandFirst||(key&&opened.has(key)),v.task);
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
 // 20/11/2026 : une seule liste, tous les trajets (choix recommandés + autres propositions) par heure de départ croissante,
 // puis heure d'arrivée. Plus d'étiquettes « Moins cher / Meilleur compromis / Plus rapide » : les tarifs réels n'existent plus, tous les horaires trouvés sont listés.
 const timeline=[...(v.picks||[]).map(p=>({journey:p.journey,labels:null})),...(v.others||[]).map(j=>({journey:j,labels:null}))]
  .sort((x,y)=>(ms(x.journey.departure)||0)-(ms(y.journey.departure)||0)||(ms(x.journey.arrival)||0)-(ms(y.journey.arrival)||0));
 if(ordreInverse)timeline.reverse();
 if(timeline.length>1){
  // 20/11/2026 : bouton pour inverser l'ordre (départ le plus tôt en premier ↔ départ le plus tard en premier), choix gardé sur ce téléphone.
  const btn=el(doc,'button','cp-hub-ordre',ordreInverse?'↕ Ordre décroissant (toucher pour passer en croissant)':'↕ Ordre croissant (toucher pour passer en décroissant)');
  btn.type='button';
  btn.onclick=()=>{ordreInverse=!ordreInverse;try{localStorage.setItem('cp_hub_ordre',ordreInverse?'desc':'asc');}catch(_){}host.__cpFp=null;render(host,v);};
  host.appendChild(btn);
 }
 // 20/11/2026 : demande de Laurent — ne plus couper la liste, mais la replier pour rester fluide sur téléphone :
 // les premiers trajets restent visibles directement, le reste se déplie au clic sur « Voir plus ».
 const VISIBLE_FIRST=8;
 const firstRows=timeline.slice(0,VISIBLE_FIRST),restRows=timeline.slice(VISIBLE_FIRST);
 for(const [i,p] of firstRows.entries())addCard(host,p.journey,p.labels,openInitial&&i===0);
 if(restRows.length){
  // Une carte déjà ouverte par le convoyeur (même au-delà des 8 premières) ne doit pas disparaître de la vue
  // à la prochaine mise à jour réseau : on déplie alors le bloc « Voir plus » automatiquement.
  const hasOpenedInside=restRows.some(p=>{const k=signature(p.journey)||(p.journey.walkOnly?'walk|'+Math.round(ms(p.journey.departure)/60000)+'|'+Math.round(ms(p.journey.arrival)/60000)+'|'+Math.round(p.journey.durationMinutes||0):'');return k&&opened.has(k);});
  const more=el(doc,'details','cp-hub-more');
  const moreSummary=el(doc,'summary',null,'Voir plus ('+restRows.length+' autre'+(restRows.length>1?'s':'')+' trajet'+(restRows.length>1?'s':'')+')');
  more.appendChild(moreSummary);
  // 21/11/2026 (Laurent : « le défilement bloque encore ») : ces cartes étaient construites à CHAQUE mise à
  // jour réseau même repliées (invisibles) — sur une ligne dense (Y51…), jusqu'à 300 cartes reconstruites
  // plusieurs fois par seconde pendant que la recherche tourne, rien que pour rester cachées dans « Voir
  // plus ». Construites maintenant seulement à l'ouverture (ou immédiatement si déjà ouvertes/une carte à
  // l'intérieur était ouverte) : repliées, cette section ne coûte quasiment plus rien à chaque rafraîchissement.
  let built=false;
  const buildMore=()=>{if(built)return;built=true;for(const p of restRows)addCard(more,p.journey,p.labels,false);};
  if(moreOpen||hasOpenedInside){more.open=true;buildMore();}
  else{
   if(more.addEventListener)more.addEventListener('toggle',()=>{if(more.open)buildMore();});
   if(moreSummary.addEventListener)moreSummary.addEventListener('click',()=>{if(!built)buildMore();});
  }
  host.appendChild(more);
 }
 // 21/11/2026 : trajets au-delà de la limite MAX_OTHERS de rank() — jamais construits, juste comptés,
 // pour que l'écran reste fluide même quand des dizaines de bus locaux sont trouvés.
 if(v.othersOverflow)host.appendChild(el(doc,'p','cp-hub-note',v.othersOverflow+' autre'+(v.othersOverflow>1?'s':'')+' trajet'+(v.othersOverflow>1?'s':'')+' trouvé'+(v.othersOverflow>1?'s':'')+(v.othersOverflow>1?', non affichés':', non affiché')+' pour garder l’affichage fluide.'));
 // Ne montrer que les moteurs effectivement interrogés sur la direction choisie.
 // Les réseaux hors zone restent dans le diagnostic interne, pas dans la fiche mission.
 const errs=Object.entries(v.errors);
 const consulted=Object.entries(v.received||{}).filter(([n])=>!errs.some(([e])=>e===n));
 if(v.done&&(errs.length||consulted.length)){
  const d=el(doc,'details','cp-hub-diag');d.appendChild(el(doc,'summary',null,'Moteurs consultés ('+(errs.length+consulted.length)+')'));
  for(const [n,e] of errs)d.appendChild(el(doc,'div',null,'❌ '+n+' : '+e));
  for(const [n,count] of consulted){
   // 21/11/2026 : diagnostic temporaire — détail du téléchargement GTFS affiché seulement quand un
   // moteur local renvoie 0 proposition, pour voir en direct où ça bloque (taille du flux, candidats bruts).
   let detail='';
   const dbgN=v.task&&v.task.label?v.task.label+'|'+n:n;
   if(count===0){
    const dbg=root.__cpGtfsDebug&&root.__cpGtfsDebug.get(dbgN);
    if(dbg)detail=' [diag : date '+(dbg.date??'?')+' '+(dbg.clock??'?')+' · de '+(dbg.from?dbg.from.lat+','+dbg.from.lon:'?')+' à '+(dbg.to?dbg.to.lat+','+dbg.to.lon:'?')+' · rayon '+(dbg.radiusMeters??'?')+' m · '+(dbg.viaWorker?'worker':'fil principal')+(dbg.feed?' · flux '+(dbg.feed.archiveBytes??'?')+' o compressé / '+(dbg.feed.expandedBytes??'?')+' o décompressé, '+(dbg.feed.trips??'?')+' trips':'')+' · candidats bruts : '+(dbg.rawCandidates??'?')+']';
   }
   // 22/11/2026 : même quand count>0, afficher les départs réellement retenus par ce moteur (avant assess()) —
   // sert à voir si les trajets de l'après-midi existent déjà à ce stade ou sont déjà absents avant la
   // vérification de marge/mission précédente.
   if(count>0){
    const dbg=root.__cpGtfsDebug&&root.__cpGtfsDebug.get(dbgN);
    // 22/11/2026 (Laurent : « rien de changé », le diagnostic précédent restait invisible même après plusieurs
    // essais espacés de 10+ min — trop long pour un simple décalage de mise en ligne) : on affiche maintenant
    // TOUJOURS ce diagnostic quand count>0, même sans aucun départ retenu ou sans entrée dbg du tout, pour
    // distinguer enfin « le code n'est pas encore en ligne », « dbg absent » et « kept vide » au lieu de deviner.
    if(dbg&&Array.isArray(dbg.kept)&&dbg.kept.length)detail+=' [départs retenus : '+dbg.kept.map(t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}):'?';}).join(', ')+']';
    else detail+=' [diag retenus : '+(dbg?('dbg ok, kept='+(Array.isArray(dbg.kept)?dbg.kept.length:typeof dbg.kept)):'dbg absent')+']';
   }
   d.appendChild(el(doc,'div',null,'✅ '+n+' : '+count+' proposition'+(count>1?'s':'')+' reçue'+(count>1?'s':'')+detail));
  }
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
  // Toutes les propositions sont affichées (liste unique triée par heure de départ).
  const visibleJourneys=[...(v.picks||[]).map(p=>p.journey),...(v.others||[])];
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
 if(v.done&&v.hidden&&v.hidden.tooEarly){const h=v.hidden,parts=[];if(h.longWalk)parts.push(h.longWalk+' à cause d’une marche trop longue (réglage Paramètres)');if(h.before)parts.push(h.before+' partent avant la fin de la mission précédente');if(h.early)parts.push(h.early+' arrivent trop tôt');if(h.night)parts.push(h.night+' hors plage de jour');
  // 20/11/2026 (demande Laurent) : si des trajets sont écartés pour une marche trop longue et que la trottinette
  // électrique n'est pas déjà activée, le suggérer explicitement plutôt que de laisser "Aucun trajet trouvé" sans piste.
  if(parts.length)host.appendChild(el(doc,'p','cp-hub-note','Détail : '+parts.join(' · ')+'.'+(h.longWalk&&!v.scooterEnabled?' Une partie du trajet pourrait être couverte en trottinette électrique : activez-la dans Paramètres pour l’essayer.':'')));
  // 22/11/2026 (Laurent : « toujours pas de Y51 après 13h01 », quasi tous les trajets reçus écartés comme
  // « avant la fin de la mission précédente ») : affiche la fenêtre earliestDeparture/latestArrival réellement
  // utilisée pour CETTE recherche, pour voir directement si elle est décalée (mauvais jour, mauvaise heure)
  // au lieu de deviner encore.
  if(h.before)host.appendChild(el(doc,'p','cp-hub-note','🩺 fenêtre utilisée pour cette recherche : départ au plus tôt '+(v.task&&v.task.earliestDeparture?new Date(v.task.earliestDeparture).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'—')+' · arrivée au plus tard '+(v.task&&v.task.latestArrival?new Date(v.task.latestArrival).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'—')));
  // 22/11/2026 (suite) : échantillon des trajets réellement écartés pour ce motif — horaire du véhicule lui-même
  // vs horaire retenu après ajout de la marche d'accès, pour voir si l'écart vient du véhicule (horaire GTFS
  // incohérent) ou de la marche (distance/durée aberrante calculée par le routeur piéton).
  if(h.before&&Array.isArray(h.beforeSamples)&&h.beforeSamples.length)host.appendChild(el(doc,'p','cp-hub-note','🩺 exemples écartés : '+h.beforeSamples.join(' · ')));}
 // 22/11/2026 (Laurent : blocage toujours ~40 s malgré le correctif du répit de 10 s après échec du worker) :
 // on affiche la vraie raison du dernier échec du worker de calcul (au lieu du message générique 'worker' affiché
 // avant), pour savoir enfin si le worker échoue systématiquement ici (réseau, sécurité, autre) plutôt que de
 // deviner encore — un échec systématique expliquerait un blocage constant malgré le répit de 10 s.
 if(v.done&&root.__cpHubWorkerLastError)host.appendChild(el(doc,'p','cp-hub-note','🔧 worker de calcul : en échec ('+root.__cpHubWorkerFailCount+' fois) — dernière raison : '+root.__cpHubWorkerLastError+(root.__cpHubWorkerOffUntil&&Date.now()<root.__cpHubWorkerOffUntil?' · désactivé encore '+Math.ceil((root.__cpHubWorkerOffUntil-Date.now())/1000)+' s':'')));
 // 22/11/2026 (Laurent : Y51 après 13h toujours invisible alors que certains trajets S'AFFICHENT pour la
 // même mission) : ce diagnostic complet (tous les motifs de rejet, pas seulement « avant la fin de la
 // mission précédente ») ne s'affichait QUE quand AUCUN trajet n'était affiché du tout (!v.total). Si ne
 // serait-ce qu'un seul trajet passe (ex. un car de nuit), Y51 peut être écarté pour un AUTRE motif
 // (marge insuffisante, correspondance manquante…) sans que ce diagnostic ne le révèle jamais. On l'affiche
 // désormais aussi dès qu'il reste des trajets non affichés, même quand d'autres trajets sont visibles.
 if(v.done&&(!v.total||(v.hidden&&v.hidden.tooEarly))&&v.diag&&v.diag.evaluated){const d=v.diag;host.appendChild(el(doc,'p','cp-hub-note','Diagnostic (version 17/11 k) : '+d.evaluated+' proposition'+(d.evaluated>1?'s':'')+' évaluée'+(d.evaluated>1?'s':'')+(d.noTimes?', dont '+d.noTimes+' sans horaires exploitables':'')+(d.reasons.length?' · motifs : '+d.reasons.map(r=>r[0]+' ('+r[1]+')').join(' ; '):'')+'.'));}
 if(v.done&&v.discarded){const n=Object.values(v.discarded).reduce((x,y)=>x+y,0);if(n)host.appendChild(el(doc,'p','cp-hub-note',n+' proposition'+(n>1?'s':'')+' écartée'+(n>1?'s':'')+' (détour excessif ou marche plus directe).'));}
 if(v.done&&tads.length){const p=el(doc,'p','cp-hub-note','Transport à la demande possible dans ce secteur (non intégré au classement) : ');
  tads.forEach((t,i)=>{const a=el(doc,'a',null,t.name);a.href=t.url;a.target='_blank';a.rel='noopener noreferrer';p.appendChild(a);p.appendChild(doc.createTextNode(' — '+t.note+(i<tads.length-1?' · ':'.')));});
  host.appendChild(p);}
 if(v.done&&!v.picks.some(p=>p.journey.feasible)&&v.picks.some(p=>p.journey.scheduled))host.appendChild(el(doc,'p','cp-hub-note','Aucun trajet confirmé en temps réel pour l’instant. Les propositions « Horaire programmé » suivent les horaires officiels publiés, avec marches et marge vérifiées : à confirmer le jour J.'));
 else if(v.done&&!v.picks.some(p=>p.journey.feasible))host.appendChild(el(doc,'p','cp-hub-none','Transport non confirmé : aucune proposition ne permet d’arriver avec la marge requise, ou une marche/correspondance n’a pas pu être calculée.'));
}

const api={VERSION,nearP21,completeWalks,scooterOnly,accessFor,LYON_COACH_ANCHORS,ticketLink,ticketLinks,tadFor,cachedRouter,pt,meters,ms,fromSwiss,fromTripGo,fromRegional,fromSNCF,fromGTFS,ojpMode,fromOJP,attachGTFSFares,walkDetour,excessiveDetour,fromNationalGTFS,completeWalks,walkOnly,priceOf,assess,rank,
 marginFor,queryWindow,inSwissArea,makeProviders,createSession,render,dayScheduleForLeg,gtfsTablesForDaySchedule,hmFromSeconds};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportHub=api;
})(typeof window!=='undefined'?window:globalThis);
