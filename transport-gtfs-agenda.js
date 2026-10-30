/* Read-only Agenda integration. One official network/worker per open panel. */
(function(root){
'use strict';
const DEFAULT_RESOURCES=Object.freeze([Object.freeze({
 id:'oura-haute-savoie',datasetId:'oura-haute-savoie',network:'Cars Région Haute-Savoie',format:'GTFS',
 url:'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA',
 // Selection envelope only: does not assert coverage or actual walking access.
 bounds:[45.4,5.7,46.5,7.1],timeZone:'Europe/Paris'
}),Object.freeze({
 id:'80100',datasetId:'5bd9843e634f413220f7f04a',network:'Sibra',format:'GTFS',federate:true,
 url:'https://www.data.gouv.fr/api/1/datasets/r/8b12f6db-9aa7-43dc-a179-013998a1c4c0',resolveFromCatalogue:true,
 bounds:[45.7,5.9,46.1,6.5],timeZone:'Europe/Paris'
})]);
function validPoint(point){return !!point&&typeof point.lat==='number'&&typeof point.lon==='number'&&
 Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180;}
function selected(resource,task){
 const bounds=resource?.bounds;
 return resource?.format==='GTFS'&&/^https:\/\//.test(resource.url||'')&&validPoint(task?.from)&&validPoint(task?.to)&&Array.isArray(bounds)&&bounds.length===4&&
 bounds.every(Number.isFinite)&&[task.from,task.to].every(p=>p.lat>=bounds[0]&&p.lat<=bounds[2]&&p.lon>=bounds[1]&&p.lon<=bounds[3]);
}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value))return NaN;
 const day=Date.parse(value.slice(0,10)+'T12:00:00Z');
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==value.slice(0,10))return NaN;
 const clock=value.slice(11,19).split(/[Z+.-]/)[0].split(':').map(Number);
 if(clock[0]>23||clock[1]>59||(clock[2]??0)>59)return NaN;
 return Date.parse(value);
}
function searchWindow(task){
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
  marginMinutes:Number.isFinite(late)?task.marginMinutes??30:0};
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
function mount(panel,{tasks=[],resources=DEFAULT_RESOURCES,clientFactory=()=>root.CPGTFSWorker.createClient(),walkingRouterFactory=()=>root.CPTransportWalking?.createRouter()}={}){
 const doc=panel.ownerDocument||root.document;
 let client=null,walker=null,disposed=false,observer=null;const walkChecks=[];
 const dispose=()=>{if(disposed)return;disposed=true;observer?.disconnect();client?.dispose();walker?.dispose();client=null;walker=null;};
 const taskList=Array.isArray(tasks)?tasks:[];
 const resource=(Array.isArray(resources)?resources:[]).find(r=>taskList.some(t=>selected(r,t)));
 if(!resource)return {dispose,done:Promise.resolve()};
 const partners=resources.filter(r=>r!==resource&&r.federate&&taskList.some(task=>selected(resource,task)&&
  (selected(r,{...task,to:task.from})||selected(r,{...task,from:task.to})))).slice(0,1);
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
 const sheet=panel.closest?.('#feuille');
 if(root.MutationObserver){
  observer=new root.MutationObserver(()=>{if(!panel.isConnected||panel.hidden||sheet?.hidden)dispose();});
  observer.observe(sheet||doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 }
 const entries=taskList.map(task=>{
  const status=doc.createElement('div');status.className='doux';status.setAttribute('role','status');section.appendChild(status);
  status.textContent=task.label+' : '+(selected(resource,task)?'recherche des horaires…':'coordonnées manquantes ou hors sélection de ce réseau.');
  return {task,status};
 });
 const done=(async()=>{
  try{
   client=clientFactory();
   const dates=new Set();
   for(const task of taskList)if(selected(resource,task)){
    try{for(const date of serviceDates(searchWindow(task),resource.timeZone))dates.add(date);}catch(_){}
   }
   if(!dates.size)throw new Error('No valid mission window');
   const loadOptions={indexServiceDates:[...dates].sort()};
   const summary=partners.length&&typeof client.loadNetworks==='function'?
    await client.loadNetworks([resource,...partners],loadOptions):await client.load(resource,loadOptions);
   if(!active())return;
   const networks=summary.networks||[summary],loaded=networks.filter(n=>!n.error);
   source.href=loaded[0].source.url||resource.url;
   source.textContent='Source '+(loaded[0].source.network||resource.network);
   heading.textContent=loaded.map(n=>n.source.network||resource.network).join(' + ')+' — horaires aux arrêts';
   sourceStatus.textContent=networks.map(n=>n.error?(n.error.network+' : flux indisponible'):
    (n.source.network||resource.network)+' · téléchargé le '+new Intl.DateTimeFormat('fr-FR',{timeZone:resource.timeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(n.source.loadedAt))+
    ' · '+(n.source.updatedAt?'mise à jour producteur : '+n.source.updatedAt:'date de mise à jour du producteur non fournie')+
    ' · '+n.counts.stops+' arrêts').join(' ; ')+'. Circulation non confirmée.';
   if(summary.partial)sourceStatus.textContent+=' Recherche partielle : un réseau est indisponible.';
   if(loaded.length>1){
    warning.textContent+=' Changements entre réseaux : arrêts rapprochés à 150 m à vol d’oiseau au maximum ; aucun chemin ni temps de marche vérifié.';
    for(const other of loaded.slice(1)){const link=doc.createElement('a');link.href=other.source.url||partners[0].url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' · Source '+other.source.network;section.appendChild(link);}
   }
   for(const {task,status} of entries){
    if(!active())return;
    if(!selected(resource,task))continue;
    try{
     const window=searchWindow(task),dates=serviceDates(window,resource.timeZone),rows=[];let truncated=false;
     for(const date of dates){
      if(!active())return;
      const result=await client.query({method:'missionJourneys',date,origin:task.from,destination:task.to,
       window,limit:100,radiusMeters:700});
      if(!active())return;
      truncated=truncated||result.truncated;rows.push(...result.rows);
     }
     const unique=new Map(rows.map(row=>[JSON.stringify([row.networkId||null,row.tripId,row.from,row.to,row.departure,row.arrival,
      row.transferStopId||null,row.legs?.map(leg=>[leg.networkId||null,leg.tripId,leg.from,leg.to,leg.departure,leg.arrival])||null]),row]));
     const ordered=[...unique.values()].sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure));
     if(task.label==='Aller')ordered.reverse();
     const shown=ordered.slice(0,5);
     status.textContent=task.label+' : '+(shown.length?shown.length+' horaire(s) aux arrêts, accès à vérifier.':'aucun trajet direct ou avec une correspondance dans la fenêtre consultée ; cela ne prouve pas l’absence de transport.');
     const dateInfo=doc.createElement('p');dateInfo.textContent='Jours de service consultés : '+dates.join(', ');status.appendChild(dateInfo);
     if(truncated||ordered.length>shown.length){const note=doc.createElement('p');note.textContent='Affichage limité : d’autres horaires peuvent exister.';status.appendChild(note);}
     for(const row of shown){
      const line=doc.createElement('p');
      const format=iso=>new Intl.DateTimeFormat('fr-FR',{timeZone:row.timeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(iso));
      line.textContent=format(row.departure)+' → '+format(row.arrival)+' · '+(!row.interNetwork&&row.network?row.network+' ':'')+row.line+' · '+
       (row.originStop?.name||row.from)+' → '+(row.destinationStop?.name||row.to)+
       ' · distances à vol d’oiseau : '+row.accessDistanceMeters+' m / '+row.egressDistanceMeters+' m'+
       (row.interNetwork?' · changement de réseau : '+row.transferStop.name+' → '+row.transferDestinationStop.name+' · séparation à vol d’oiseau '+row.transferDistanceMeters+' m, marche non vérifiée · intervalle théorique '+row.transferMinutes+' min':
        row.legs?.length===2?' · correspondance à '+(row.transferStop?.name||row.transferStopId)+' · intervalle théorique '+row.transferMinutes+' min':' · direct')+
       ' · tarif inconnu · Transport non confirmé — vérifiez vous-même.';
      if(row.legs?.length===2){
       for(const leg of row.legs){const detail=doc.createElement('span');detail.textContent=' · '+(leg.network?leg.network+' ':'')+leg.line+' : '+format(leg.departure)+' → '+format(leg.arrival);line.appendChild(detail);}
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
     prefetch.push(walker.route(check.row.transferStop,check.row.transferDestinationStop));
    }
    await Promise.all(prefetch);
   }
   for(const check of walkChecks){
    if(!active())return;
    if(!walker||!root.CPTransportWalking?.checkJourney){check.element.textContent=' · Marche non calculée';continue;}
    try{
     check.element.textContent=' · Marche : calcul des parcours piétons…';
     const result=await root.CPTransportWalking.checkJourney(walker,check.row,check.task);
     if(!active())return;
     const descriptions=[];
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
    for(const {task,status} of entries)if(selected(resource,task))status.textContent=task.label+' : recherche GTFS indisponible. Les autres calculateurs restent consultables.';
   }
   client?.dispose();client=null;
  }
 })();
 return {dispose,done};
}
const api={DEFAULT_RESOURCES,selected,searchWindow,serviceDates,mount};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSAgenda=api;
})(typeof window!=='undefined'?window:globalThis);
