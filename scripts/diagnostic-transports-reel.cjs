#!/usr/bin/env node
// v4 (13/11/2026) : + 7 axes de couverture ; v3 : SNCF en 3 recherches décalées, API suisse avec repli gare la plus proche et 2e tentative.
/* Convoyage Ultra — diagnostic RÉEL des transports sur les 8 axes, exécuté sur un serveur GitHub Actions (accès Internet).
 * Moteurs réellement interrogés : API suisse (transport.opendata.ch), Mobilités M, SNCF (fichiers officiels du dépôt),
 * GTFS officiels (data/gtfs + sources officielles), marche Valhalla (≈ 1 requête/s). TripGo seulement si CP_TRIPGO_KEY est fourni.
 * Aucune donnée inventée : un moteur indisponible est consigné comme erreur.
 * Sortie : docs/diagnostic-serveur.json et docs/DIAGNOSTIC-SERVEUR.md
 */
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const g=globalThis;g.window=g;
for(const f of ['transport-adapters.js','transport-fares.js','transport-y51-fares.js','transport-fare-grids.js','swiss-transport-api.js','regional-routing.js',
 'sncf-fallback.js','transport-tripgo.js','transport-walking.js','transport-gtfs-index.js','transport-gtfs-time.js','transport-catalogue.js',
 'transport-gtfs-loader.js','transport-gtfs-fares.js','transport-mission-hub.js','transport-coverage.js','transport-gtfs-agenda.js'])require(path.join(ROOT,f));
const H=g.CPTransportHub,C=g.CPTransportCoverage,A=g.CPGTFSAgenda,L=g.CPGTFSLoader,I=g.CPGTFSIndex,T=g.CPGTFSTime;
// Les fichiers « data/… » de l'application sont lus dans le dépôt ; le reste part sur Internet.
const fetcher=async(url,init)=>{
 const u=String(url);
 const local=u.startsWith('data/')?u:(u.match(/\/convoyage-app\/(data\/.*)$/)||[])[1];
 if(local){const file=path.join(ROOT,local.split('?')[0]);
  if(!fs.existsSync(file))return new Response('absent',{status:404});
  return new Response(fs.readFileSync(file),{status:200,headers:{'content-type':file.endsWith('.json')?'application/json':'application/zip'}});}
 return fetch(u,{...init,headers:{...(init&&init.headers||{}),'User-Agent':'ConvoyageUltra-Diagnostic/1.0'}});
};
if(process.env.CP_TRIPGO_KEY)g.localStorage={getItem:k=>k==='cp_tripgo_key'?process.env.CP_TRIPGO_KEY:null,setItem(){},removeItem(){}};
const feeds=new Map();
async function feed(resource,dates){
 const key=resource.id;if(feeds.has(key))return feeds.get(key);
 const p=L.loadResource(resource,{fetcher,timeoutMs:120000,indexServiceDates:dates,retainSourceTables:true}).catch(e=>({error:e.message}));
 feeds.set(key,p);return p;
}
async function gtfsRows(axis,when){
 const day=when.slice(0,10),prev=new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 const window={earliestDeparture:when,latestArrival:new Date(Date.parse(when)+14*3600000).toISOString(),marginMinutes:0};
 const out={rows:[],networks:{},errors:{}};
 // Flux dont l'enveloppe couvre le trajet entier à lui seul, PLUS le flux principal + les partenaires
 // fédérés que l'application choisirait réellement (chooseResources) — un réseau local peut ne couvrir
 // qu'une extrémité (ex. Ondéa sur Chambéry → Aix) sans jamais satisfaire `selected()` seul.
 const picked=A.chooseResources(A.DEFAULT_RESOURCES,[{from:axis.from,to:axis.to}]);
 const chosen=picked.resource?[picked.resource,...picked.partners]:[];
 const candidates=[...new Set([...A.DEFAULT_RESOURCES.filter(r=>A.selected(r,{from:axis.from,to:axis.to})),...chosen])];
 for(const r of candidates){
  const f=await feed(r,[prev,day]);
  if(f.error){out.errors[r.network]=f.error;continue;}
  try{
   const direct=T.datedTrips(f.files,f.index,I.nearbyDirectTrips(f.files,f.index,day,axis.from,axis.to,700),window);
   const tr=I.nearbyTransferTrips(f.files,f.index,day,axis.from,axis.to,700,T.serviceWindow(f.files,day,window));
   const rows=[...direct,...T.datedTransferTrips(f.files,f.index,tr.journeys,window)]
    .sort((a,b)=>Date.parse(a.departure)-Date.parse(b.departure)).slice(0,40).map(x=>({...x,network:r.network}));
   out.networks[r.network]=rows.length;out.rows.push(...rows);
  }catch(e){out.errors[r.network]=e.message;}
 }
 return out;
}
(async()=>{
 const when=C.nextMonday8();
 const router=H.cachedRouter(g.CPTransportWalking.createRouter({fetcher,maxRequests:400,intervalMs:1100,timeoutMs:15000}));
 const providers=H.makeProviders(g,{fetcher});
 const report={at:new Date().toISOString(),when,source:'diagnostic serveur (GitHub Actions)',tripgo:!!process.env.CP_TRIPGO_KEY,axes:[],networks:{}};
 for(const axis of [...C.AXES,...C.AXES_COUVERTURE.map(a=>({...a,coverage:true}))]){
  const started=Date.now();let firstAt=null;
  const task={label:'Diag',from:axis.from,to:axis.to,fromName:axis.from.name,toName:axis.to.name,
   fromCity:axis.from.name.split(' ')[0],toCity:axis.to.name.split(' ')[0],earliestDeparture:when};
  const session=H.createSession({tasks:[task],providers,router,fareFor:l=>g.CPTransportFareGrids.fareFor(l),timeoutMs:90000,
   onUpdate:(l,v)=>{if(v.total&&firstAt===null)firstAt=Date.now()-started;}});
  const gt=await gtfsRows(axis,when);
  await session.ingest('Diag','GTFS local',H.fromGTFS(gt.rows));
  for(let i=0;i<600&&!session.view('Diag').done;i++)await new Promise(r=>setTimeout(r,500));
  const v=session.view('Diag');session.dispose();
  const all=[...v.picks.map(p=>p.journey),...v.others];
  if(axis.id==='voiron-grenoble')console.log('DEBUG-MRESO',JSON.stringify(all.flatMap(j=>(j.legs||[]).filter(l=>l.kind!=='walk').map(l=>({source:j.source,provider:l.provider,line:l.line,from:l.fromPoint,to:l.toPoint})))));
  const nets=C.attribute(all);
  for(const [id,o] of Object.entries(nets)){const r=report.networks[id]||(report.networks[id]={trips:0,priced:0,walked:0,at:report.at,axes:[],source:'serveur'});
   r.trips+=o.trips;r.priced+=o.priced;r.walked+=o.walked;r.axes.push(axis.id);}
  const walkedOk=j=>!(j.reasons||[]).some(r=>/marche|non calculée|quota|en cours/.test(r));
  // Réseaux que l'APPLICATION choisirait (flux principal + réseau partenaire, même logique que mount), pour détecter un mauvais choix de flux.
  const pick=A.chooseResources(A.DEFAULT_RESOURCES,[{from:axis.from,to:axis.to}]);
  const appFirst=pick.resource?[pick.resource,...pick.partners].map(r=>r.network).join(' + '):null;
  const tripgoJourneys=all.filter(j=>(j.sources||[]).some(s=>/tripgo/i.test(s)));
  const tripgoPriced=tripgoJourneys.filter(j=>j.price?.status==='verified').length;
  const tripgoTicketLegs=tripgoJourneys.reduce((n,j)=>n+j.legs.filter(l=>l.kind!=='walk'&&l.fare&&Number.isFinite(l.fare.amount)).length,0);
  // Un tarif de réseau connu peut être appliqué par la grille après TripGo.
  // Ne pas confondre « prix vérifié au total » avec « billet fourni par TripGo ».
  const tripgoPricedFromGrids=tripgoJourneys.filter(j=>j.price?.status==='verified'&&
   !j.legs.some(l=>l.kind!=='walk'&&l.fare&&/TripGo/i.test(String(l.fare.source||'')))).length;
  const tripgoMissingFareByOperator={};
  for(const j of tripgoJourneys)for(const l of j.legs){
   if(l.kind==='walk'||l.fare&&Number.isFinite(l.fare.amount))continue;
   const operator=String(l.provider||'opérateur inconnu').slice(0,80);
   tripgoMissingFareByOperator[operator]=(tripgoMissingFareByOperator[operator]||0)+1;
  }
  // Les portions sans prix, toutes sources confondues, sont regroupées pour
  // cibler les prochains raccordements tarifaires sans inventer de montant.
  const missingFareByOperator={};
  for(const j of all){
   if(j.price?.status!=='unknown')continue;
   for(const l of j.legs){
    if(l.kind==='walk')continue;
    // Même règle que priceOf : un tarif officiel issu de la grille compte
    // aussi, pas seulement un billet embarqué dans la réponse du moteur.
    const fare=l.fare||g.CPTransportFareGrids.fareFor(l);
    const hasFare=fare&&Number.isFinite(fare.amount)&&fare.amount>=0&&
     /^(EUR|CHF)$/.test(fare.currency)&&fare.source;
    if(hasFare)continue;
    const name=String(l.provider||'opérateur inconnu').slice(0,80);
    missingFareByOperator[name]=(missingFareByOperator[name]||0)+1;
   }
  }
  const a={id:axis.id,name:axis.name,coverage:!!axis.coverage,appGtfsChoice:appFirst,trips:all.length,priced:all.filter(j=>j.price.status==='verified').length,tripgoJourneys:tripgoJourneys.length,tripgoPriced,tripgoPricedFromGrids,tripgoTicketLegs,tripgoMissingFareByOperator,missingFareByOperator,walked:all.filter(walkedOk).length,
   feasible:all.filter(j=>j.feasible).length,firstResultMs:firstAt,totalMs:Date.now()-started,
   received:v.received,
   reasons:all.flatMap(j=>j.reasons||[]).reduce((m,r)=>{const k=r.replace(/\d+/g,'n').slice(0,70);m[k]=(m[k]||0)+1;return m;},{}),
   engines:{errors:{...v.errors,...Object.fromEntries(Object.entries(gt.errors).map(([k,e])=>['GTFS '+k,e]))},skipped:v.skipped,gtfs:gt.networks},
   sources:[...new Set(all.flatMap(j=>j.sources))],networksSeen:Object.keys(nets),expected:axis.expect,missingExpected:axis.expect.filter(id=>!nets[id]),
   examples:v.picks.slice(0,3).map(p=>({labels:p.labels,dep:p.journey.departure,arr:p.journey.arrival,legs:p.journey.legs.map(l=>(l.kind==='walk'?'marche '+Math.round(l.distanceMeters||0)+' m':(l.provider||'')+' '+(l.line||''))),price:p.journey.price.label,status:p.journey.status,detail:p.journey.statusDetail}))};
  report.axes.push(a);console.log(JSON.stringify({axe:a.name,trajets:a.trips,prix:a.priced,marches:a.walked,realisables:a.feasible,recus:a.received,raisons:a.reasons,sources:a.sources,erreurs:a.engines.errors}));
 }
 // Synthèse calculée sur les axes réellement testés, sans confondre itinéraires et réseaux.
 report.totals=report.axes.reduce((s,a)=>{s.axes++;s.trips+=a.trips;s.priced+=a.priced;s.walked+=a.walked;s.feasible+=a.feasible;return s;},{axes:0,trips:0,priced:0,walked:0,feasible:0});
 report.totals.tripgoJourneys=report.axes.reduce((n,a)=>n+a.tripgoJourneys,0);
 report.totals.tripgoPriced=report.axes.reduce((n,a)=>n+a.tripgoPriced,0);
 report.totals.tripgoTicketLegs=report.axes.reduce((n,a)=>n+a.tripgoTicketLegs,0);
 report.totals.tripgoPricedFromGrids=report.axes.reduce((n,a)=>n+a.tripgoPricedFromGrids,0);
 report.totals.missingFareByOperator={};
 for(const a of report.axes)for(const [name,count] of Object.entries(a.missingFareByOperator))report.totals.missingFareByOperator[name]=(report.totals.missingFareByOperator[name]||0)+count;
 report.totals.tripgoMissingFareByOperator={};
 for(const a of report.axes)for(const [name,count] of Object.entries(a.tripgoMissingFareByOperator))report.totals.tripgoMissingFareByOperator[name]=(report.totals.tripgoMissingFareByOperator[name]||0)+count;
 report.totals.pricedPct=report.totals.trips?Math.round(report.totals.priced*1000/report.totals.trips)/10:0;
 report.totals.walkedPct=report.totals.trips?Math.round(report.totals.walked*1000/report.totals.trips)/10:0;
 console.log('BILAN_GLOBAL '+JSON.stringify(report.totals));
 if(report.tripgo&&report.totals.tripgoJourneys>0&&report.totals.tripgoPriced===0)console.warn('::warning::TripGo fournit des trajets mais aucun de ces trajets ne possède un prix vérifié : contrôler les billets transmis par l’API.');
 report.router=router.stats?router.stats():null;
 fs.writeFileSync(path.join(ROOT,'docs','diagnostic-serveur.json'),JSON.stringify(report,null,1));
 const md=['# Diagnostic réel des transports — serveur GitHub Actions','',`Exécuté le ${report.at} ; départs à partir de ${report.when} ; TripGo : ${report.tripgo?'oui':'non (pas de clé)'}.`,'',
  `**Bilan : ${report.totals.trips} trajets sur ${report.totals.axes} axes, ${report.totals.priced} avec prix vérifié (${report.totals.pricedPct} %), ${report.totals.walked} avec marches calculées (${report.totals.walkedPct} %), ${report.totals.feasible} réalisables.**`,'',
  `**TripGo : ${report.totals.tripgoJourneys} trajets, ${report.totals.tripgoPriced} avec prix vérifié, ${report.totals.tripgoTicketLegs} portions avec billet chiffré.**`,'',
  'Portions TripGo sans prix par opérateur : '+(Object.entries(report.totals.tripgoMissingFareByOperator).map(([name,count])=>name+' ('+count+')').join(', ')||'aucune')+'.','',
  'Portions sans prix par opérateur (toutes sources) : '+(Object.entries(report.totals.missingFareByOperator).sort((a,b)=>b[1]-a[1]).map(([name,count])=>name+' ('+count+')').join(', ')||'aucune')+'.','',
  '| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | 1er résultat | Total | Sources | Erreurs | Attendus non vus |','|---|---|---|---|---|---|---|---|---|---|'];
 for(const a of report.axes)md.push('| '+[a.name,a.trips,a.priced,a.walked,a.feasible,a.firstResultMs==null?'—':(a.firstResultMs/1000).toFixed(1)+' s',(a.totalMs/1000).toFixed(1)+' s',
  a.sources.join(', ')||'—',Object.entries(a.engines.errors).map(([k,e])=>k+' : '+e).join(' ; ').replace(/\|/g,'/')||'—',a.missingExpected.join(', ')||'—'].join(' | ')+' |');
 md.push('','Exemples (3 meilleures propositions par axe) :','');
 for(const a of report.axes){md.push('**'+a.name+'**');for(const e of a.examples)md.push('- '+e.labels.join(' · ')+' : '+e.dep+' → '+e.arr+' · '+e.legs.join(' › ')+' · '+e.price+' · '+e.status+(e.status==='Réalisable'?'':' ('+e.detail+')'));md.push('');}
 fs.writeFileSync(path.join(ROOT,'docs','DIAGNOSTIC-SERVEUR.md'),md.join('\n')+'\n');
})().catch(e=>{console.error(e);process.exit(1);});
