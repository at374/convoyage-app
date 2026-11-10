/* Read-only Agenda integration. At most two official networks in one worker per open panel. */
(function(root){
'use strict';
const DEFAULT_RESOURCES=Object.freeze([Object.freeze({
 id:'pan-evad',datasetId:'donnees-du-reseau-evad-1',network:'ÉVA’D — Évian et vallée d’Abondance',format:'GTFS',federate:true,urban:true,
 // Keep separate from STAR’T urban resource 84108; shared school feed is another dataset.
 // Official producer GTFS; validity 04 Sep–20 Dec 2026. No fare tables or transfer rules in feed.
 // TAD and seasonal services require independent reservation/operating-day checks.
 url:'https://www.data.gouv.fr/api/1/datasets/r/429c8587-676a-4ed3-8279-e67403bc36f4',
 updatedAt:'2026-09-08',validFrom:'2026-09-04',validUntil:'2026-12-20',bounds:[46.18,6.30,46.49,6.91],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'pan-start-thonon',datasetId:'reseaux-urbains-start',network:'STAR’T — Thonon Agglomération',format:'GTFS',federate:true,urban:true,
 // Distinct urban STAR’T feed (PAN resource 84108). A different *school* GTFS
 // dataset from Thonon Agglomération is described as including ÉVA’D.
 // Do not suppress the separate ÉVA’D urban feed on that basis.
 // PAN official GTFS validated 1 Sep 2026, valid to 20 Dec 2026. No GTFS fare products.
 // Geographic envelope is a candidate filter, not proof of a served stop or route.
 url:'https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/84108/84108.20260901.002618.536834.zip',
 updatedAt:'2026-09-01',validFrom:'2026-09-01',validUntil:'2026-12-20',bounds:[46.18,6.30,46.48,6.78],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'pan-jybus',datasetId:'jybus-rumilly',network:'J’ybus — Rumilly Terre de Savoie',format:'GTFS',federate:true,urban:true,
 // Official PAN GTFS archive 7 Aug 2026; 5 lines including reservation-only TAD.
 // Service validity must be checked per trip; no fares are encoded in this GTFS.
 url:'https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/80092/80092.20260807.141107.062760.zip',
 updatedAt:'2026-08-07',bounds:[45.75,5.82,46.02,6.18],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'pan-synchro',datasetId:'synchro-chambery',network:'Synchro Bus — Grand Chambéry',format:'GTFS',federate:true,urban:true,
 // Official PAN archived GTFS; timetable coverage through 20 Dec 2026. Do not infer fares.
 url:'https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/82272/82272.20261006.181637.894741.zip',
 updatedAt:'2026-10-06',validFrom:'2026-10-06',validUntil:'2026-12-20',bounds:[45.48,5.78,45.72,6.10],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'pan-ondea',datasetId:'ondea-aix-les-bains',network:'Ondéa — Aix-les-Bains',format:'GTFS',federate:true,urban:true,
 // Official PAN archive, validity 17 Oct 2026–31 Mar 2027; timetable dates are checked in GTFS.
 url:'https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/71223/71223.20261016.181718.064517.zip',
 updatedAt:'2026-10-16',validFrom:'2026-10-17',validUntil:'2027-03-31',bounds:[45.61,5.82,45.79,6.03],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'pan-tam',datasetId:'tam-amberieu',network:'TAM — Ambérieu-en-Bugey',format:'GTFS',federate:true,urban:true,
 // Official PAN archive, validity 1 Dec 2025–31 Dec 2026.
 url:'https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/79865/79865.20251209.121558.543746.zip',
 updatedAt:'2025-12-09',validFrom:'2025-12-01',validUntil:'2026-12-31',bounds:[45.90,5.28,46.03,5.46],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'oura-haute-savoie',datasetId:'oura-haute-savoie',network:'Cars Région Haute-Savoie',format:'GTFS',
 url:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA',
 // Selection envelope only: does not assert coverage or actual walking access.
 bounds:[45.4,5.7,46.5,7.1],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'oura-ain',datasetId:'reseau-interurbain-cars-region-ain-01',network:'Cars Région Ain',format:'GTFS',federate:true,
 // Producer's OÙRA GTFS URL, documented by Transitland and the French mobility data catalogue.
 url:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=CARS_REGION_AIN&dataFormat=GTFS&dataProfil=OPENDATA',
 // Selection envelope only, not a guarantee of lines or cross-border service.
 bounds:[45.65,4.7,46.55,6.3],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'80100',datasetId:'5bd9843e634f413220f7f04a',network:'Sibra',format:'GTFS',federate:true,
 url:'https://www.data.gouv.fr/api/1/datasets/r/8b12f6db-9aa7-43dc-a179-013998a1c4c0',resolveFromCatalogue:true,
 bounds:[45.7,5.9,46.1,6.5],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'83459',datasetId:'5af03701b595081c1880a8a4',network:'M Réso — Métropole grenobloise',format:'GTFS',federate:true,
 url:'https://www.data.gouv.fr/api/1/datasets/r/b6ec7ba4-09bc-46df-b9a1-79a2c2668cf2',resolveFromCatalogue:true,
 // Local Grenoble/Crolles selection only, distinct from the Haute-Savoie envelope.
 bounds:[44.9,5.3,45.39,6.1],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'81794',datasetId:'5eb3510a4efd8f649ffe1b9f',network:'M Réso — Grésivaudan',format:'GTFS',federate:true,
 url:'https://www.data.gouv.fr/api/1/datasets/r/c1067233-c35e-4c53-93b3-050f707bf6a2',resolveFromCatalogue:true,
 bounds:[45.1,5.7,45.39,6.2],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'pan-tac',datasetId:'tac-annemasse',network:'TAC Mobilités',format:'GTFS',federate:true,urban:true,
 // Official PAN copy with browser CORS, byte-identical to the producer export at verification.
 url:'https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/76779/76779.20261103.121956.913263.zip',
 updatedAt:'2026-11-03',bounds:[46.105,6.055,46.265,6.345],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'oura-mobivals',datasetId:'mobivals-valserhone',network:'Mobi’Vals',format:'GTFS',federate:true,urban:true,
 url:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=MOBIVALS&dataFormat=GTFS&dataProfil=OPENDATA',
 bounds:[46.08,5.76,46.16,5.87],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'oura-duobus',datasetId:'duobus-oyonnax',network:'Duobus',format:'GTFS',federate:true,urban:true,
 url:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=OYONNAX&dataFormat=GTFS&dataProfil=OPENDATA',
 bounds:[46.20,5.59,46.34,5.70],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'oura-rubis',datasetId:'rubis-bourg-en-bresse',network:'Rubis',format:'GTFS',federate:true,urban:true,
 url:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=RUBIS&dataFormat=GTFS&dataProfil=OPENDATA',
 // This intentionally targets Bourg-en-Bresse and nearby urban communes.
 bounds:[46.16,5.17,46.25,5.30],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'oura-express',datasetId:'reseau-interurbain-cars-region-express',network:'Cars Région Express',format:'GTFS',federate:true,
 url:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=CARS_REGION_EXPRESS&dataFormat=GTFS&dataProfil=OPENDATA',
 // Envelope of the published stops, rounded outwards for the access radius.
 bounds:[44.35,2.79,46.78,6.15],timeZone:'Europe/Paris'
})]);
function validPoint(point){return !!point&&typeof point.lat==='number'&&typeof point.lon==='number'&&
 Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180;}
function selected(resource,task){
 const bounds=resource?.bounds;
 // Validate mission time windows for every feed, including undated GTFS.
 // A malformed or inverted interval must never produce a candidate.
 const early=task?.earliestDeparture,late=task?.latestArrival;
 const firstMs=early===undefined?NaN:timestamp(early);
 const lastMs=late===undefined?NaN:timestamp(late);
 if((early!==undefined&&!Number.isFinite(firstMs))||
    (late!==undefined&&!Number.isFinite(lastMs)))return false;
 if(Number.isFinite(firstMs)&&Number.isFinite(lastMs)&&firstMs>lastMs)return false;
 // Optional GTFS publication window: exclude expired seasonal feeds before fetching.
 // This is only a coarse filter; actual trip service dates remain GTFS-controlled.
 if(resource?.validFrom||resource?.validUntil){
  const from=resource.validFrom,to=resource.validUntil;
  const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
   Number.isFinite(Date.parse(value+'T12:00:00Z'))&&
   new Date(Date.parse(value+'T12:00:00Z')).toISOString().slice(0,10)===value;
  if((from&&!validDay(from))||(to&&!validDay(to))||(from&&to&&from>to))return false;
  // Reject only when the whole requested interval lies outside the feed.
  // A window spanning its first/last service day remains a candidate; GTFS
  // calendar/calendar_dates must then validate each individual departure.
  const first=typeof early==='string'?early.slice(0,10):null;
  const last=typeof late==='string'?late.slice(0,10):null;
  if((from&&last&&last<from)||(to&&first&&first>to))return false;
  if(!last&&from&&first&&first<from)return false;
  if(!first&&to&&last&&last>to)return false;
 }
 return resource?.format==='GTFS'&&/^https:\/\//.test(resource.url||'')&&validPoint(task?.from)&&validPoint(task?.to)&&Array.isArray(bounds)&&bounds.length===4&&
 bounds.every(Number.isFinite)&&[task.from,task.to].every(p=>p.lat>=bounds[0]&&p.lat<=bounds[2]&&p.lon>=bounds[1]&&p.lon<=bounds[3]);
}
// Candidate-only geographic pairing: both endpoints must be covered by the two official feeds.
// This does not establish a service, a transfer or a walkable connection.
function crossEnvelopePair(first,second,task){
 if(!first?.federate||!second?.federate||first===second)return false;
 if(!validPoint(task?.from)||!validPoint(task?.to))return false;
 return (selected(first,{...task,to:task.from})&&selected(second,{...task,from:task.to}))||
  (selected(second,{...task,to:task.from})&&selected(first,{...task,from:task.to}));
}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value))return NaN;
 const day=Date.parse(value.slice(0,10)+'T12:00:00Z');
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==value.slice(0,10))return NaN;
 const clock=value.slice(11,19).split(/[Z+.-]/)[0].split(':').map(Number);
 if(clock[0]>23||clock[1]>59||(clock[2]??0)>59)return NaN;
 return Date.parse(value);
}
function searchWindow(task){
 if(task.marginMinutes!==undefined&&(!Number.isFinite(task.marginMinutes)||task.marginMinutes<0||task.marginMinutes>240))throw new Error('Invalid mission margin');
 const early=timestamp(task.earliestDeparture),late=timestamp(task.latestArrival);
 if((task.earliestDeparture!==undefined&&!Number.isFinite(early))||
    (task.latestArrival!==undefined&&!Number.isFinite(late)))throw new Error('Invalid mission timestamp');
 if(!Number.isFinite(early)&&!Number.isFinite(late))throw new Error('Missing mission time');
 // Explicit finite horizon. This is a candidate search, never a coverage claim.
 const start=Number.isFinite(early)?early:late-24*3600000;
 const end=Math.min(Number.isFinite(late)?late:start+24*3600000,start+48*3600000);
 if(end<start)throw new Error('Inverted mission window');
 return {earliestDeparture:new Date(start).toISOString(),latestArrival:new Date(end).toISOString(),
  // The return horizon is not a mission deadline and gets no safety margin.
  marginMinutes:Number.isFinite(late)?Math.max(15,Number.isFinite(task.marginMinutes)?task.marginMinutes:15):0};
}
function serviceDates(window,timeZone){
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 const day=iso=>{
  const parts=Object.fromEntries(formatter.formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
  return Date.parse(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
 };
 const first=day(window.earliestDeparture)-86400000,last=day(window.latestArrival),dates=[];
 for(let at=first;at<=last;at+=86400000)dates.push(new Date(at).toISOString().slice(0,10));
 if(dates.length>5)throw new Error('GTFS service horizon exceeded');
 return dates;
}
function mount(panel,{tasks=[],resources=DEFAULT_RESOURCES,clientFactory=()=>root.CPGTFSWorker.createClient(),walkingRouterFactory=()=>root.CPTransportWalking?.createRouter(),getSibraPass=()=>null,onResults=()=>{},onWalking=()=>{}}={}){
 const doc=panel.ownerDocument||root.document;
 let client=null,walker=null,disposed=false,observer=null;const walkChecks=[],fareChecks=[];
 const dispose=()=>{if(disposed)return;disposed=true;observer?.disconnect();client?.dispose();walker?.dispose();client=null;walker=null;};
 const taskList=Array.isArray(tasks)?tasks:[];
 const resourceList=Array.isArray(resources)?resources:[];
 // The Haute-Savoie envelope overlaps much of Ain. Prefer the Ain feed only
 // for a journey fully inside its conservative western core, without changing
 // Grenoble/Grésivaudan or Annecy network precedence.
 const ainCore=task=>[task?.from,task?.to].every(p=>validPoint(p)&&p.lat>=45.9&&p.lat<=46.5&&p.lon>=4.7&&p.lon<=5.85);
 const ain=resourceList.find(r=>r.id==='oura-ain');
 const preferredAin=ain&&taskList.some(t=>ainCore(t)&&selected(ain,t))?ain:null;
 const express=resourceList.find(r=>r.id==='oura-express');
 // When urban envelopes overlap, prioritize the more local official feed.
 // This is only source ordering; stops and services still need GTFS validation.
 const envelopeArea=r=>(r.bounds[2]-r.bounds[0])*(r.bounds[3]-r.bounds[1]);
 // Distinguish the two overlapping Chablais urban feeds by their actual hubs.
 // Hubs only rank candidates; the GTFS stop/trip check remains authoritative.
 const urbanHubs={'pan-start-thonon':[46.37,6.48],'pan-evad':[46.40,6.59]};
 const hubDistance=(r,task)=>{
  const hub=urbanHubs[r.id];
  if(!hub)return Infinity;
  const points=[task?.from,task?.to].filter(validPoint);
  return points.length?Math.min(...points.map(p=>(p.lat-hub[0])**2+
   ((p.lon-hub[1])*Math.cos(hub[0]*Math.PI/180))**2)):Infinity;
 };
 const urbanResources=resourceList.filter(r=>r.urban&&taskList.some(t=>selected(r,t)))
  .sort((a,b)=>{
   if(urbanHubs[a.id]&&urbanHubs[b.id]){
    const distances=taskList.map(t=>[hubDistance(a,t),hubDistance(b,t)])
     .filter(pair=>pair.every(Number.isFinite));
    if(distances.length){
     const delta=Math.min(...distances.map(pair=>pair[0]))-
      Math.min(...distances.map(pair=>pair[1]));
     if(delta!==0)return delta;
    }
   }
   return envelopeArea(a)-envelopeArea(b);
  });
 const localResources=resourceList.filter(r=>r!==express&&!r.urban);
 // Prefer a matching urban GTFS over a broad departmental envelope. Otherwise
 // Haute-Savoie can shadow STAR’T/ÉVA’D and other local networks entirely.
 // A verified local envelope takes precedence over broad departmental feeds.
 // Otherwise urban TAM/Rubis missions are hidden by Cars Région Ain.
 const resource=urbanResources[0]||preferredAin||
  localResources.find(r=>taskList.some(t=>selected(r,t)||localResources.some(other=>crossEnvelopePair(r,other,t))))||
  (express&&taskList.some(t=>selected(express,t))?express:null);
 if(!resource)return {dispose,done:Promise.resolve()};
 const partnerCandidates=[...urbanResources,...localResources,...(express?[express]:[])].filter(r=>r!==resource&&taskList.some(task=>
  ((r===express||r.urban)&&selected(r,task))||crossEnvelopePair(resource,r,task)||(selected(resource,task)&&
  (selected(r,{...task,to:task.from})||selected(r,{...task,from:task.to})))));
 // Pick the partner that makes the largest number of mission windows eligible.
 // Stable source order resolves ties; this does not assert a served stop or trip.
 const partnerCoverage=r=>taskList.reduce((count,task)=>count+
  (selected(r,task)||crossEnvelopePair(resource,r,task)?1:0),0);
 const partners=partnerCandidates.filter(r=>r.federate)
  .sort((a,b)=>partnerCoverage(b)-partnerCoverage(a)).slice(0,1);
 const omittedPartners=partnerCandidates.length-partners.length;
 const nonFederatedPartners=partnerCandidates.filter(r=>!r.federate).length;
 const eligible=task=>selected(resource,task)||partners.some(r=>selected(r,task)||crossEnvelopePair(resource,r,task));
 const section=doc.createElement('div');section.className='bk';section.setAttribute('data-gtfs-agenda','');
 const heading=doc.createElement('h3');heading.textContent=resource.network+' — horaires aux arrêts';section.appendChild(heading);
 const sourceStatus=doc.createElement('p');sourceStatus.className='doux';sourceStatus.setAttribute('role','status');
 sourceStatus.textContent='Vérification du flux officiel…';section.appendChild(sourceStatus);
 const source=doc.createElement('a');source.href=resource.url;source.target='_blank';source.rel='noopener noreferrer';
 source.textContent='Source GTFS officielle';section.appendChild(source);
 const warning=doc.createElement('p');warning.className='doux';
 warning.textContent='Trajets directs ou avec une correspondance au même arrêt (intervalle de 5 à 120 min, non vérifié). Recherche limitée à 48 h au maximum et au jour de service précédent. Distances à vol d’oiseau ; marche et prix non vérifiés. Transport non confirmé — vérifiez vous-même.';
 if(omittedPartners>0)warning.textContent+=' Recherche incomplète : '+omittedPartners+' réseau(x) candidat(s) supplémentaire(s) non interrogé(s) (limite actuelle de deux flux ou fédération non disponible).';
 if(nonFederatedPartners>0)warning.textContent+=' Dont '+nonFederatedPartners+' réseau(x) sans fédération GTFS activée.';
 if(omittedPartners>0){
  const omitted=partnerCandidates.filter(r=>!partners.includes(r));
  warning.textContent+=' Réseaux non interrogés : '+omitted.map(r=>r.network).join(' ; ')+'.';
 }
 section.appendChild(warning);panel.appendChild(section);
 const active=()=>!disposed&&panel.isConnected;
 const refreshFares=()=>{
  if(!active())return;
  for(const {row,element} of fareChecks){
   try{
    const pass=root.CPSibraPass;
    element.textContent=pass?.assess&&pass?.describe?pass.describe(pass.assess(row,getSibraPass()))||' · Couverture SIBRA non vérifiée':' · Couverture SIBRA non vérifiable';
   }catch(_){element.textContent=' · Couverture SIBRA non vérifiable';}
  }
 };
 const sheet=panel.closest?.('#feuille');
 if(root.MutationObserver){
  observer=new root.MutationObserver(()=>{if(!panel.isConnected||panel.hidden||sheet?.hidden)dispose();});
  observer.observe(sheet||doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 }
 const entries=taskList.map(task=>{
  const status=doc.createElement('div');status.className='doux';status.setAttribute('role','status');section.appendChild(status);
  status.textContent=task.label+' : '+(eligible(task)?'recherche des horaires…':'coordonnées manquantes ou hors sélection de ce réseau.');
  return {task,status};
 });
 const done=(async()=>{
  try{
   client=clientFactory();
   const dates=new Set();
   for(const task of taskList)if(eligible(task)){
    try{for(const date of serviceDates(searchWindow(task),resource.timeZone))dates.add(date);}catch(_){}
   }
   if(!dates.size)throw new Error('No valid mission window');
   const loadOptions={indexServiceDates:[...dates].sort()};
   // A selected partner must never disappear silently when the client lacks
   // multi-network support, even if the primary envelope covers both endpoints.
   if(partners.length&&typeof client.loadNetworks!=='function')
    throw new Error('Federated GTFS loading unavailable');
   const summary=partners.length&&typeof client.loadNetworks==='function'?
    await client.loadNetworks([resource,...partners],loadOptions):await client.load(resource,loadOptions);
   if(!active())return;
   const networks=Array.isArray(summary?.networks)?summary.networks:[summary],validNetwork=n=>n&&!n.error&&n.source&&Number.isFinite(Date.parse(n.source.loadedAt))&&n.counts&&Number.isInteger(n.counts.stops)&&n.counts.stops>0,loaded=networks.filter(validNetwork);
   if(!loaded.length){
    sourceStatus.textContent='Flux GTFS indisponible : aucun réseau chargé. Transport non confirmé — vérifiez vous-même.';
    for(const {task,status} of entries)if(eligible(task))status.textContent=task.label+' : horaires indisponibles (aucun réseau chargé).';
    return;
   }
   source.href=loaded[0].source.url||resource.url;
   source.textContent='Source '+(loaded[0].source.network||resource.network);
   heading.textContent=loaded.map(n=>n.source.network||resource.network).join(' + ')+' — horaires aux arrêts';
   sourceStatus.textContent=networks.map(n=>!validNetwork(n)?((n?.error?.network||n?.source?.network||'Réseau GTFS')+' : flux indisponible'):
    (n.source.network||resource.network)+' · téléchargé le '+new Intl.DateTimeFormat('fr-FR',{timeZone:resource.timeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(n.source.loadedAt))+
    ' · '+(n.source.updatedAt?'mise à jour producteur : '+n.source.updatedAt:'date de mise à jour du producteur non fournie')+
    ' · '+n.counts.stops+' arrêts').join(' ; ')+'. Circulation non confirmée.';
   const partialNetworks=summary?.partial===true||networks.some(n=>!validNetwork(n));
   if(partialNetworks)sourceStatus.textContent+=' Recherche partielle : un réseau est indisponible.';
   if(loaded.length>1){
    warning.textContent+=' Changements entre réseaux : arrêts rapprochés à 150 m à vol d’oiseau au maximum ; aucun chemin ni temps de marche vérifié.';
    for(const other of loaded.slice(1)){const link=doc.createElement('a');link.href=other.source.url||partners[0].url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' · Source '+other.source.network;section.appendChild(link);}
   }
   for(const {task,status} of entries){
    if(!active())return;
    if(!eligible(task))continue;
    try{
     const window=searchWindow(task),dates=serviceDates(window,resource.timeZone),rows=[];let truncated=false,invalidJourneys=0;
     for(const date of dates){
      if(!active())return;
      const result=await client.query({method:'missionJourneys',date,origin:task.from,destination:task.to,
       window,connectionDates:dates,limit:100,radiusMeters:700,order:task.label==='Aller'?'latestDeparture':'earliestDeparture'});
      if(!active())return;
      if(!result||!Array.isArray(result.rows))throw new Error('Invalid GTFS journey response');
      truncated=truncated||result.truncated===true;
      for(const journey of result.rows){
       if(!journey||!Number.isFinite(timestamp(journey.departure))||!Number.isFinite(timestamp(journey.arrival))||
          Date.parse(journey.arrival)<Date.parse(journey.departure)||
          Date.parse(journey.departure)<Date.parse(window.earliestDeparture)||
          Date.parse(journey.arrival)>Date.parse(window.latestArrival)-window.marginMinutes*60000)
        {invalidJourneys++;continue;}
       if(journey.legs!==undefined){
        if(!Array.isArray(journey.legs)||journey.legs.length!==2){invalidJourneys++;continue;}
        const [first,second]=journey.legs;
        if(journey.legs.some(leg=>!leg||!Number.isFinite(timestamp(leg.departure))||!Number.isFinite(timestamp(leg.arrival))||
           Date.parse(leg.arrival)<Date.parse(leg.departure))||
           Date.parse(first.departure)!==Date.parse(journey.departure)||
           Date.parse(second.arrival)!==Date.parse(journey.arrival)||
           Date.parse(second.departure)-Date.parse(first.arrival)<5*60000||
           Date.parse(second.departure)-Date.parse(first.arrival)>120*60000)
          {invalidJourneys++;continue;}
       }
       rows.push(journey);
      }
     }
     const unique=new Map(rows.map(row=>[JSON.stringify([row.networkId||null,row.tripId,row.from,row.to,row.departure,row.arrival,
      row.transferStopId||null,row.legs?.map(leg=>[leg.networkId||null,leg.tripId,leg.from,leg.to,leg.departure,leg.arrival])||null]),row]));
     const ordered=[...unique.values()].sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
     if(task.label==='Aller')ordered.reverse();
     // Prefer different services at the same time instead of filling the panel with duplicates.
     const seenChoices=new Set(),distinct=[];
     for(const candidate of ordered){
      const key=JSON.stringify([candidate.networkId||candidate.network||'',candidate.line||'',
       candidate.interNetwork===true?'inter-network':'single-network',candidate.transferStopId||'',
       candidate.interNetwork===true?candidate.legs?.map(leg=>[leg.networkId||leg.network||'',leg.tripId||'',leg.from,leg.to]):null,
       candidate.interNetwork===true?candidate.transferDistanceMeters??null:null,
       candidate.originStop?.stopId||candidate.from,candidate.destinationStop?.stopId||candidate.to,
       candidate.departure,candidate.arrival]);
      if(seenChoices.has(key))continue;
      seenChoices.add(key);distinct.push(candidate);
     }
     const shown=distinct.slice(0,5);
     const marginNote=Number.isFinite(Date.parse(task.latestArrival))?' Marge avant mission : '+window.marginMinutes+' min minimum (marche et circulation à vérifier).':'';
     const incomplete=truncated||partialNetworks||invalidJourneys>0;
     if(active())onResults({task,itineraries:distinct,partial:incomplete});
     const coverageNote=incomplete?' Recherche partielle : certains horaires ou réseaux n’ont pas pu être vérifiés.':'';
     status.textContent=task.label+' : '+(shown.length?shown.length+' horaire(s) aux arrêts, accès à vérifier.':incomplete?'aucun trajet dans les résultats partiels ; recherche incomplète (réseau ou horaires manquants), d’autres horaires peuvent exister.':'aucun trajet direct ou avec une correspondance dans la fenêtre consultée ; cela ne prouve pas l’absence de transport.' )+marginNote+coverageNote+(invalidJourneys?' '+invalidJourneys+' horaire(s) incohérent(s) écarté(s) ; recherche partielle.':'');
     const dateInfo=doc.createElement('p');dateInfo.textContent='Jours de service consultés : '+dates.join(', ');status.appendChild(dateInfo);
     if(truncated||distinct.length>shown.length){const note=doc.createElement('p');note.textContent=truncated?'Recherche limitée : d’autres horaires peuvent exister.':'Les autres horaires figurent dans les cartes de résultats.';status.appendChild(note);}
     for(const row of shown){
      let tariffSource=null,tariffDescription='';
      try{
       const expressTariff=root.CPTransportExpressFares;
       const expressReference=expressTariff?.reference(row);
       const urbanReference=root.CPTransportFares?.urbanReference?.(row);
       const y51Tariff=root.CPTY51Fares;
       tariffDescription=expressReference?expressTariff.describe(expressReference):urbanReference?' · '+urbanReference.label:
        y51Tariff?.describe(y51Tariff.reference(row))||'';
       tariffSource=expressReference?.source||urbanReference?.source||y51Tariff?.SOURCE;
      }catch(_){}
      const line=doc.createElement('p');
      const safeZone=(()=>{try{new Intl.DateTimeFormat('fr-FR',{timeZone:row.timeZone||resource.timeZone});return row.timeZone||resource.timeZone;}catch(_){return resource.timeZone;}})();
      const format=iso=>new Intl.DateTimeFormat('fr-FR',{timeZone:safeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(iso));
      line.textContent=format(row.departure)+' → '+format(row.arrival)+' · '+(!row.interNetwork&&row.network?row.network+' ':'')+row.line+' · '+
       (row.originStop?.name||row.from)+' → '+(row.destinationStop?.name||row.to)+
       ' · distances à vol d’oiseau : '+row.accessDistanceMeters+' m / '+row.egressDistanceMeters+' m'+
       (row.interNetwork?' · changement de réseau : '+row.transferStop.name+' → '+row.transferDestinationStop.name+' · séparation à vol d’oiseau '+row.transferDistanceMeters+' m, marche non vérifiée · intervalle théorique '+row.transferMinutes+' min':
        row.legs?.length===2?' · correspondance à '+(row.transferStop?.name||row.transferStopId)+' · intervalle théorique '+row.transferMinutes+' min (minimum estimé '+row.minimumTransferMinutes+' min, marche non vérifiée)':' · direct')+
       ' · '+(tariffDescription?'prix actuel à revérifier (barème ci-dessous)':'tarif inconnu')+' · Transport non confirmé — vérifiez vous-même.';
      if(row.legs?.length===2){
       for(const leg of row.legs){const detail=doc.createElement('span');detail.textContent=' · '+(leg.network?leg.network+' ':'')+leg.line+' : '+format(leg.departure)+' → '+format(leg.arrival);line.appendChild(detail);}
      }
      const passCost=doc.createElement('span');passCost.setAttribute('data-sibra-pass-cost','');line.appendChild(passCost);
      fareChecks.push({row,element:passCost});refreshFares();
      if(tariffDescription){
        const quote=doc.createElement('span');quote.setAttribute(row.line==='Y51'?'data-y51-fare-reference':'data-published-fare-reference','');quote.textContent=tariffDescription;line.appendChild(quote);
        const proof=doc.createElement('a');proof.href=tariffSource;proof.target='_blank';proof.rel='noopener noreferrer';proof.textContent=' · Voir le barème officiel';line.appendChild(proof);
      }
      for(const [label,stop] of [['Départ',row.originStop],['Correspondance',row.transferStop],['Montée après changement',row.transferDestinationStop],['Arrivée',row.destinationStop]]){
       if(!validPoint(stop))continue;
       const link=doc.createElement('a');
       link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(stop.lat+','+stop.lon);
       link.target='_blank';link.rel='noopener noreferrer';
       link.textContent=' · '+label+' : voir l’arrêt'+(stop.description?' ('+stop.description+')':'');
       line.appendChild(link);
      }
      if(root.CPTransportWalking||walkingRouterFactory){
       const walking=doc.createElement('span');walking.textContent=' · Marche : en attente du calcul';line.appendChild(walking);
       walkChecks.push({row,task,element:walking});
      }
      status.appendChild(line);
     }
    }catch(error){if(active())status.textContent=task.label+' : recherche indisponible pour ces coordonnées ou horaires. Transport non confirmé — vérifiez vous-même.';}
   }
   try{walker=walkingRouterFactory?.();}catch(_){}
   if(walker){
    const attribution=doc.createElement('p');attribution.className='doux';attribution.textContent='Calcul piéton : Valhalla (FOSSGIS), durées indicatives ; accès réels et horaires d’ouverture à vérifier · ';
    const osm=doc.createElement('a');osm.href='https://www.openstreetmap.org/copyright';osm.target='_blank';osm.rel='noopener noreferrer';osm.textContent='© OpenStreetMap contributors';
    attribution.appendChild(osm);section.appendChild(attribution);
   }
   walkChecks.sort((a,b)=>Number(!!b.row.interNetwork)-Number(!!a.row.interNetwork));
   if(walker?.route){
    const pairs=new Set(),prefetch=[];
    for(const check of walkChecks){
     if(!check.row.interNetwork||pairs.size>=3)continue;
     const key=JSON.stringify([check.row.transferStop?.lat,check.row.transferStop?.lon,check.row.transferDestinationStop?.lat,check.row.transferDestinationStop?.lon]);
     if(pairs.has(key))continue;pairs.add(key);
     prefetch.push(Promise.resolve().then(()=>walker.route(check.row.transferStop,check.row.transferDestinationStop)));
    }
    // A pedestrian provider error must not replace already rendered GTFS results.
    await Promise.allSettled(prefetch);
   }
   for(const check of walkChecks){
    if(!active())return;
    if(!walker||!root.CPTransportWalking?.checkJourney){
     check.element.textContent=' · Marche non calculée';
     onWalking({row:check.row,task:check.task,result:null});continue;
    }
    try{
     check.element.textContent=' · Marche : calcul des parcours piétons…';
     const result=await root.CPTransportWalking.checkJourney(walker,check.row,check.task);
     if(!active())return;
     onWalking({row:check.row,task:check.task,result});
     const descriptions=[];
     const addressTime=(value,round)=>new Intl.DateTimeFormat('fr-FR',{timeZone:check.row.timeZone,dateStyle:'short',timeStyle:'short'})
      .format(new Date(round(Date.parse(value)/60000)*60000));
     if(result.doorDeparture)descriptions.push('Départ estimé à l’adresse : ≈ '+addressTime(result.doorDeparture,Math.floor));
     if(result.doorArrival)descriptions.push('Arrivée estimée à l’adresse : ≈ '+addressTime(result.doorArrival,Math.ceil));
     for(const [key,label] of [['access','Approche'],['transfer','Changement'],['egress','Sortie']]){
      const route=result.walks[key];
      if(route?.status==='not_required')continue;
      if(route?.status==='calculated'){
       descriptions.push(label+' : ≈ '+(route.durationSeconds===0?0:Math.max(1,Math.round(route.durationSeconds/60)))+' min, '+Math.round(route.distanceMeters)+' m à pied (calcul Valhalla/OSM)'+
        (!route.endpointsMatched?' ; extrémités à vérifier ('+Math.ceil(route.startGapMeters)+' m / '+Math.ceil(route.endGapMeters)+' m hors tracé)':''));
      }else descriptions.push(label+' : '+({budget_exceeded:'non calculé automatiquement',unavailable:'service piéton indisponible',route_unavailable:'calcul impossible pour ces points',rate_limited:'service piéton momentanément limité',invalid_coordinates:'coordonnées manquantes',same_stop_unverified:'déplacement dans l’arrêt non vérifié'}[route?.status]||'non calculé'));
     }
     const labels={departure_too_early:'Le parcours calculé ne permet pas de rejoindre ce départ après la livraison.',
      arrival_too_late:'Le parcours calculé dépasse la prochaine prise en charge avec la marge.',
      transfer_too_short:'Intervalle insuffisant pour le parcours de changement calculé et 5 min de sécurité.',
      fits_calculated_walks:'Horaires compatibles avec les parcours calculés ; adresses, accès réels et circulation restent à vérifier.',
      partial:'Calcul piéton partiel ; trajet complet non confirmé.',unknown:'Horaires ou données piétonnes insuffisants.'};
     check.element.textContent=' · '+descriptions.join(' · ')+' · '+(labels[result.status]||labels.unknown)+' Transport non confirmé — vérifiez vous-même.';
    }catch(_){if(active()){
     check.element.textContent=' · Marche non calculée ; transport non confirmé.';
     onWalking({row:check.row,task:check.task,result:null});
    }}
   }
  }catch(error){
   if(active()){
    sourceStatus.textContent='Flux officiel indisponible (réseau, navigateur ou archive). Aucun horaire récent confirmé.';
    for(const {task,status} of entries)if(eligible(task))status.textContent=task.label+' : recherche GTFS indisponible. Les autres calculateurs restent consultables.';
   }
   client?.dispose();client=null;
  }
 })();
 return {dispose,done,refreshFares};
}
const api={DEFAULT_RESOURCES,selected,crossEnvelopePair,searchWindow,serviceDates,mount};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSAgenda=api;
})(typeof window!=='undefined'?window:globalThis);
