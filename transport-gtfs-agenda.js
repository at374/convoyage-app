/* Read-only Agenda integration. At most two official networks in one worker per open panel. */
(function(root){
'use strict';
// Flux préparés côté serveur (scripts/build_regional_gtfs.py, GitHub Actions) et servis par le site de l'application :
// même origine, donc pas de blocage CORS sur le téléphone. Hors HTTPS (tests locaux), adresse publique du site.
const LOCAL_GTFS=name=>{try{if(root.location&&root.location.protocol==='https:')return new URL('data/gtfs/'+name,root.location.href).href;}catch(_){}
 return 'https://at374.github.io/convoyage-app/data/gtfs/'+name;};
const DEFAULT_RESOURCES=Object.freeze([Object.freeze({
 // Réseaux extraits de l'agrégat officiel Oùra : utilisés seulement pour les trajets internes à leur ville
 // (pas de « federate ») afin de ne pas évincer les cars régionaux sur les liaisons interurbaines.
 id:'jybus-rumilly',datasetId:'jybus-rumilly',network:"J'y bus Rumilly",format:'GTFS',url:LOCAL_GTFS('jybus-rumilly.zip'),
 bounds:[45.80,5.85,45.93,6.05],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'tam-amberieu',datasetId:'tam-amberieu',network:'TAM Ambérieu-en-Bugey',format:'GTFS',url:LOCAL_GTFS('tam-amberieu.zip'),
 bounds:[45.90,5.28,46.02,5.45],timeZone:'Europe/Paris'
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
 // Ajouts 13/11/2026 (flux officiels du Point d'accès national ; à valider en conditions réelles sur téléphone).
 // TAC Annemasse : jeu 5ca4bcec634f4125a78fad26, Licence Ouverte 2.0, offre 31/08/2026 → 31/08/2027.
 id:'76779',datasetId:'5ca4bcec634f4125a78fad26',network:'TAC Annemasse',format:'GTFS',federate:true,
 url:LOCAL_GTFS('tac-annemasse.zip'),fallbackUrls:['https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/tp2a/exports/medias.zip'],
 // Réseau Genevois français Mobilités (Annemasse Agglo + CC du Genevois depuis 07/2025) : inclut Saint-Julien et Archamps.
 bounds:[46.1,5.98,46.27,6.42],timeZone:'Europe/Paris'
}),Object.freeze({
 // Synchro Bus Grand Chambéry (ODbL, attribution Grand Chambéry).
 id:'82272',datasetId:'synchro-chambery',network:'Synchro Bus Chambéry',format:'GTFS',federate:true,
 url:LOCAL_GTFS('synchro-chambery.zip'),fallbackUrls:['https://www.data.gouv.fr/api/1/datasets/r/a81cdf4b-5a70-43c9-8803-cef0430ed170'],
 bounds:[45.45,5.75,45.75,6.15],timeZone:'Europe/Paris'
}),Object.freeze({
 // Ondéa Grand Lac, Aix-les-Bains (etalab-2.0).
 id:'71223',datasetId:'ondea-grand-lac',network:'Ondéa Aix-les-Bains',format:'GTFS',federate:true,
 url:LOCAL_GTFS('ondea-grand-lac.zip'),fallbackUrls:['https://www.data.gouv.fr/api/1/datasets/r/b4e8d98c-e17a-4fb0-857f-8cb618039b2a'],
 bounds:[45.6,5.75,45.85,6.05],timeZone:'Europe/Paris'
}),Object.freeze({
 // Star't Thonon Agglomération (etalab-2.0).
 id:'82178',datasetId:'thonon-agglomeration-donnees-gtfs',network:"Star't Thonon",format:'GTFS',federate:true,
 url:LOCAL_GTFS('start-thonon.zip'),fallbackUrls:['https://www.data.gouv.fr/api/1/datasets/r/7cbb883b-d0cb-4bc7-b2e0-7537afdbc86e'],
 bounds:[46.25,6.3,46.45,6.65],timeZone:'Europe/Paris'
}),Object.freeze({
 // Cars Région Isère et Savoie (extraits de l'agrégat Oùra) : en dernier, seulement si aucun réseau plus précis ne couvre le trajet.
 id:'cars-region-isere',datasetId:'cars-region-isere',network:'Cars Région Isère',format:'GTFS',url:LOCAL_GTFS('cars-region-isere.zip'),broad:true,
 bounds:[44.69,4.74,45.89,6.36],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'cars-region-savoie',datasetId:'cars-region-savoie',network:'Cars Région Savoie',format:'GTFS',url:LOCAL_GTFS('cars-region-savoie.zip'),broad:true,
 // Savoie seulement (Annecy et la Haute-Savoie exclues).
 bounds:[45.05,5.62,45.80,7.19],timeZone:'Europe/Paris'
})]);
function validPoint(point){return !!point&&typeof point.lat==='number'&&typeof point.lon==='number'&&
 Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180;}
function selected(resource,task){
 const bounds=resource?.bounds;
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
function mount(panel,{tasks=[],resources=DEFAULT_RESOURCES,clientFactory=()=>root.CPGTFSWorker.createClient(),walkingRouterFactory=()=>root.CPTransportWalking?.createRouter(),getSibraPass=()=>null,onResults=()=>{}}={}){
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
 const resource=preferredAin||resourceList.find(r=>taskList.some(t=>selected(r,t)||resourceList.some(other=>crossEnvelopePair(r,other,t))));
 if(!resource)return {dispose,done:Promise.resolve()};
 const partners=resourceList.filter(r=>r!==resource&&r.federate&&taskList.some(task=>
  crossEnvelopePair(resource,r,task)||(selected(resource,task)&&
  (selected(r,{...task,to:task.from})||selected(r,{...task,from:task.to}))))).slice(0,1);
 const eligible=task=>selected(resource,task)||partners.some(r=>crossEnvelopePair(resource,r,task));
 const section=doc.createElement('div');section.className='bk';section.setAttribute('data-gtfs-agenda','');
 const heading=doc.createElement('h3');heading.textContent=resource.network+' — horaires aux arrêts';section.appendChild(heading);
 const sourceStatus=doc.createElement('p');sourceStatus.className='doux';sourceStatus.setAttribute('role','status');
 sourceStatus.textContent='Vérification du flux officiel…';section.appendChild(sourceStatus);
 const source=doc.createElement('a');source.href=resource.url;source.target='_blank';source.rel='noopener noreferrer';
 source.textContent='Source GTFS officielle';section.appendChild(source);
 const warning=doc.createElement('p');warning.className='doux';
 warning.textContent='Trajets directs ou avec une correspondance au même arrêt (intervalle de 5 à 120 min, non vérifié). Recherche limitée à 48 h au maximum et au jour de service précédent. Distances à vol d’oiseau ; marche et prix non vérifiés. Transport non confirmé — vérifiez vous-même.';
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
   const needsFederation=taskList.some(task=>!selected(resource,task)&&partners.some(partner=>crossEnvelopePair(resource,partner,task)));
   if(needsFederation&&typeof client.loadNetworks!=='function')throw new Error('Federated GTFS loading unavailable');
   const summary=partners.length&&typeof client.loadNetworks==='function'?
    await client.loadNetworks([resource,...partners],loadOptions):await client.load(resource,loadOptions);
   if(!active())return;
   const networks=Array.isArray(summary?.networks)?summary.networks:[summary],validNetwork=n=>n&&!n.error&&n.source&&Number.isFinite(Date.parse(n.source.loadedAt))&&n.counts&&Number.isInteger(n.counts.stops)&&n.counts.stops>=0,loaded=networks.filter(validNetwork);
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
     if(active())onResults({task,itineraries:shown});
     const marginNote=Number.isFinite(Date.parse(task.latestArrival))?' Marge avant mission : '+window.marginMinutes+' min minimum (marche et circulation à vérifier).':'';
     const incomplete=truncated||partialNetworks||invalidJourneys>0;
     const coverageNote=incomplete?' Recherche partielle : certains horaires ou réseaux n’ont pas pu être vérifiés.':'';
     status.textContent=task.label+' : '+(shown.length?shown.length+' horaire(s) aux arrêts, accès à vérifier.':incomplete?'aucun trajet dans les résultats partiels ; recherche incomplète (réseau ou horaires manquants), d’autres horaires peuvent exister.':'aucun trajet direct ou avec une correspondance dans la fenêtre consultée ; cela ne prouve pas l’absence de transport.' )+marginNote+coverageNote+(invalidJourneys?' '+invalidJourneys+' horaire(s) incohérent(s) écarté(s) ; recherche partielle.':'');
     const dateInfo=doc.createElement('p');dateInfo.textContent='Jours de service consultés : '+dates.join(', ');status.appendChild(dateInfo);
     if(truncated||distinct.length>shown.length){const note=doc.createElement('p');note.textContent='Affichage limité : d’autres horaires peuvent exister.';status.appendChild(note);}
     for(const row of shown){
      let tariff=null,tariffDescription='';
      try{tariff=root.CPTY51Fares;tariffDescription=tariff?.describe(tariff?.reference(row))||'';}catch(_){}
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
        const quote=doc.createElement('span');quote.setAttribute('data-y51-fare-reference','');quote.textContent=tariffDescription;line.appendChild(quote);
        const proof=doc.createElement('a');proof.href=tariff.SOURCE;proof.target='_blank';proof.rel='noopener noreferrer';proof.textContent=' · Voir le barème officiel';line.appendChild(proof);
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
    if(!walker||!root.CPTransportWalking?.checkJourney){check.element.textContent=' · Marche non calculée';continue;}
    try{
     check.element.textContent=' · Marche : calcul des parcours piétons…';
     const result=await root.CPTransportWalking.checkJourney(walker,check.row,check.task);
     if(!active())return;
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
    }catch(_){if(active())check.element.textContent=' · Marche non calculée ; transport non confirmé.';}
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
