#!/usr/bin/env node
/* Convoyage Ultra — validation RÉELLE d'un serveur OTP2 local sur les axes AURA–Suisse.
 * Utilise exactement la requête de la fiche mission (CPOTPClient.buildQuery) et l'adaptateur de l'application.
 * Aucune donnée inventée : un axe sans réponse est consigné tel quel. Les prix viennent uniquement des
 * grilles officielles déjà vérifiées (transport-fare-grids.js) ; sinon « Prix non confirmé ».
 * Usage : OTP_URL=http://127.0.0.1:8080 TEST_DATE=2026-11-24 node scripts/otp-reel/valider_axes.cjs <dossier-données> <dossier-sortie>
 */
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const adapter=require(path.join(ROOT,'transport-otp-adapter.js'));
const client=require(path.join(ROOT,'transport-otp-client.js'));
let grids=null;try{grids=require(path.join(ROOT,'transport-fare-grids.js'));}catch(_){}
const BASE=process.env.OTP_URL||'http://127.0.0.1:8080';
const DAY=process.env.TEST_DATE;
const [dataDir='otp-data',outDir='docs/otp2-reel']=process.argv.slice(2);
if(!/^\d{4}-\d{2}-\d{2}$/.test(DAY||'')){console.error('TEST_DATE requis (AAAA-MM-JJ)');process.exit(2);}
const P={
 annecy:{lat:45.9017,lon:6.1219,name:'Annecy gare'},geneve:{lat:46.2102,lon:6.1424,name:'Genève Cornavin'},
 amberieu:{lat:45.9542,lon:5.3419,name:'Ambérieu-en-Bugey gare'},lyon:{lat:45.7606,lon:4.8593,name:'Lyon Part-Dieu'},
 chambery:{lat:45.5711,lon:5.9196,name:'Chambéry gare'},stjulien:{lat:46.1446,lon:6.0812,name:'Saint-Julien-en-Genevois gare'},
 annemasse:{lat:46.1993,lon:6.2366,name:'Annemasse gare'},archamps:{lat:46.1362,lon:6.1328,name:'Archamps Technopole'},
 lausanne:{lat:46.5167,lon:6.6291,name:'Lausanne gare'}
};
const AXES=[['amberieu','lyon'],['lyon','amberieu'],['chambery','stjulien'],['stjulien','chambery'],['annecy','geneve'],['geneve','annecy'],
 ['annecy','annemasse'],['annemasse','annecy'],['archamps','geneve'],['geneve','archamps'],['archamps','annecy'],['geneve','lausanne']]
 .map(([a,b])=>({id:a+'-'+b,name:P[a].name+' → '+P[b].name,from:P[a],to:P[b]}));
const hm=iso=>new Date(iso).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'});
async function post(url,body){
 const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 const text=await r.text();let json=null;try{json=JSON.parse(text);}catch(_){}
 return {status:r.status,json,text:json?null:text.slice(0,300)};
}
async function main(){
 const report={generatedAt:new Date().toISOString(),testDate:DAY,departure:'08:00 Europe/Paris',server:{},axes:[]};
 try{const r=await fetch(BASE+'/otp',{signal:AbortSignal.timeout(20000)});report.server.info=(await r.text()).slice(0,600);}catch(e){report.server.infoError=e.message;}
 let endpoint=null;
 for(const candidate of ['/otp/gtfs/v1','/otp/routers/default/index/graphql']){
  try{const r=await post(BASE+candidate,{query:'{__typename}'});if(r.status===200&&r.json&&r.json.data){endpoint=candidate;break;}}catch(_){}
 }
 report.server.graphqlEndpoint=endpoint;
 if(endpoint){
  try{const r=await post(BASE+endpoint,{query:'{feeds{feedId agencies{name}}}'});
   report.server.feeds=(r.json?.data?.feeds||[]).map(f=>({feedId:f.feedId,agencies:(f.agencies||[]).length}));}catch(e){report.server.feedsError=e.message;}
 }
 // 08:00 heure de Paris (UTC+1 l'hiver, UTC+2 l'été) calculée, pas supposée.
 const guess=new Date(DAY+'T08:00:00Z');
 const parisHour=Number(guess.toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',hour12:false}).slice(0,2));
 const when=new Date(guess.getTime()-(parisHour-8)*3600000).toISOString();
 for(const axis of AXES){
  const row={id:axis.id,name:axis.name,from:axis.from,to:axis.to,when,raw:0,accepted:0,itineraries:[]};
  report.axes.push(row);
  if(!endpoint){row.error='aucun point d’accès GraphQL OTP2 joignable';continue;}
  const request=client.buildQuery({from:axis.from,to:axis.to},{when,arriveBy:false});
  try{
   const r=await post(BASE+endpoint,request);
   row.http=r.status;
   if(r.json?.errors?.length){row.error='GraphQL : '+r.json.errors.map(e=>e.message).join(' | ').slice(0,500);continue;}
   if(!r.json){row.error='réponse non JSON : '+r.text;continue;}
   row.raw=(r.json.data?.planConnection?.edges||[]).length;
   const journeys=adapter.parse(r.json);
   row.accepted=journeys.length;
   if(!row.raw){
    try{const d=await post(BASE+endpoint,{query:request.query.replace(/\{edges\{.*$/,'{routingErrors{code description}}}')});
     row.routingErrors=d.json?.data?.planConnection?.routingErrors||d.json?.errors?.map(e=>e.message)||null;}catch(_){}
   }
   for(const j of journeys){
    const legs=j.legs.map(l=>{
     let fare=null;
     if(l.kind==='transit'&&grids){try{fare=grids.fareFor(l)||null;}catch(_){}}
     return {kind:l.kind,mode:l.mode,line:l.line,provider:l.provider,from:l.from,to:l.to,departure:l.departure,arrival:l.arrival,
      distanceMeters:l.distanceMeters==null?null:Math.round(l.distanceMeters),
      walkGeometryPoints:l.kind==='walk'&&l.geometry?l.geometry.length:null,
      fare:fare?{amount:fare.amount,currency:fare.currency,source:fare.source}:null};
    });
    const transit=legs.filter(l=>l.kind==='transit');
    const priced=transit.filter(l=>l.fare).length;
    row.itineraries.push({departure:j.legs[0].departure,arrival:j.legs[j.legs.length-1].arrival,
     durationMinutes:Math.round((Date.parse(j.legs[j.legs.length-1].arrival)-Date.parse(j.legs[0].departure))/60000),
     transfers:Math.max(0,transit.length-1),walkMeters:legs.filter(l=>l.kind==='walk').reduce((s,l)=>s+(l.distanceMeters||0),0),
     priceStatus:!transit.length?'marche seule':priced===transit.length?'tous les segments ont un tarif vérifié':priced?'tarif partiel':'Prix non confirmé',
     legs});
   }
   // Même segment (mode, horaires, extrémités) fourni par deux exploitants différents = doublon de flux GTFS probable.
   const seen=new Map();row.duplicateSegments=[];
   for(const it of row.itineraries)for(const l of it.legs){
    if(l.kind!=='transit')continue;
    const key=[l.mode,l.departure,l.arrival].join('|');
    const prev=seen.get(key);
    if(prev&&prev!==l.provider&&!row.duplicateSegments.includes(key+' : '+prev+' / '+l.provider))row.duplicateSegments.push(key+' : '+prev+' / '+l.provider);
    else seen.set(key,l.provider);
   }
  }catch(e){row.error=e.name+' : '+e.message;}
  console.log(axis.id,'brut',row.raw,'retenus',row.accepted,row.error||'');
 }
 const read=f=>{try{return JSON.parse(fs.readFileSync(path.join(dataDir,f),'utf8'));}catch(_){return null;}};
 report.sources=read('sources.json');report.osm=read('osm.json');report.build=read('build.json');
 fs.mkdirSync(outDir,{recursive:true});
 fs.writeFileSync(path.join(outDir,'rapport-otp2-reel.json'),JSON.stringify(report,null,1));
 const md=[];
 md.push('# OTP2 réel — graphe AURA–Suisse construit et interrogé','',
  'Généré automatiquement le '+report.generatedAt+' sur un serveur GitHub Actions (gratuit, aucun déploiement).',
  'Jour testé : **'+DAY+'**, départ à partir de 08:00 (heure de Paris). Horaires GTFS planifiés, pas de temps réel.','');
 if(report.build){const b=report.build;md.push('## Construction du graphe','',
  '- Image OTP2 : `'+b.image+'`','- Durée de construction : '+b.buildSeconds+' s','- Mémoire maximale observée : '+(b.buildMaxMemory||'non mesurée'),
  '- Taille du graphe : '+(b.graphBytes?(b.graphBytes/1048576).toFixed(0)+' Mo':'inconnue'),'- Plus petit tas Java testé qui charge le graphe et répond : '+(b.serveHeap?'-Xmx'+b.serveHeap:'non mesuré')+' (essais 3g, 4g, 6g, 8g)',
  '- Mémoire du serveur après chargement : '+(b.serveMemory||'non mesurée')+' ; après les recherches : '+(b.serveMemoryAfterQueries||'non mesurée'),'');}
 if(report.osm)md.push('## OpenStreetMap','',...report.osm.files.map(f=>'- '+f.url+' — '+(f.bytes/1048576).toFixed(0)+' Mo, SHA-256 `'+f.sha256+'`, modifié '+(f.lastModified||'?')),
  '- Extrait utilisé : '+(report.osm.extractBytes/1048576).toFixed(0)+' Mo (rectangle '+report.osm.bbox+', voies et quais seulement). Licence ODbL, © contributeurs OpenStreetMap.','');
 if(report.sources){md.push('## Flux GTFS','','| Flux | État | Validité | Courses le jour testé | Tarifs dans le flux | SHA-256 de l’archive officielle |','|---|---|---|---|---|---|');
  for(const f of report.sources.feeds)md.push('| '+f.id+' | '+(f.status||'?')+(f.error?' — '+String(f.error).slice(0,120):'')+' | '+
   (f.validity?(f.validity.from||'?')+' → '+(f.validity.to||'?'):'')+' | '+(f.tripsActiveOnTestDate??'')+' | '+(f.faresInFeed==null?'':f.faresInFeed?'oui':'non')+' | '+(f.sha256?'`'+f.sha256.slice(0,16)+'…`':'')+' |');
  md.push('','Adresses complètes, tailles et empreintes : `rapport-otp2-reel.json`.','');}
 md.push('## Axes testés','','| Axe | Itinéraires OTP2 | Retenus par l’application | Meilleure durée | Erreur |','|---|---|---|---|---|');
 for(const a of report.axes)md.push('| '+a.name+' | '+a.raw+' | '+a.accepted+' | '+(a.itineraries.length?Math.min(...a.itineraries.map(i=>i.durationMinutes))+' min':'—')+' | '+(a.error||(a.routingErrors?JSON.stringify(a.routingErrors).slice(0,160):''))+' |');
 md.push('');
 const dups=report.axes.flatMap(a=>(a.duplicateSegments||[]).map(d=>a.name+' — '+d));
 md.push('Segments identiques fournis par deux exploitants (doublons de flux probables) : '+(dups.length?dups.length:'aucun détecté sur ces recherches')+'.','',...dups.slice(0,20).map(d=>'- '+d),'');
 const all=report.axes.flatMap(a=>a.itineraries),count=s=>all.filter(i=>i.priceStatus===s).length;
 md.push('Prix sur '+all.length+' itinéraires : '+count('tous les segments ont un tarif vérifié')+' entièrement tarifés (grilles officielles), '+count('tarif partiel')+' partiellement, '+count('Prix non confirmé')+' sans prix confirmé. Aucun prix estimé.','');
 for(const a of report.axes){if(!a.itineraries.length)continue;md.push('### '+a.name,'');
  a.itineraries.forEach((it,i)=>{md.push((i+1)+'. **'+hm(it.departure)+' → '+hm(it.arrival)+'** ('+it.durationMinutes+' min, '+it.transfers+' correspondance(s), '+it.walkMeters+' m à pied) — '+it.priceStatus);
   for(const l of it.legs)md.push('   - '+(l.kind==='walk'?'Marche '+(l.distanceMeters??'?')+' m'+(l.walkGeometryPoints?' (tracé OpenStreetMap, '+l.walkGeometryPoints+' points)':' (sans tracé)'):
    l.mode+' '+(l.line||'')+' — '+l.provider+(l.fare?' — '+l.fare.amount.toFixed(2)+' '+l.fare.currency:' — prix non confirmé'))+' : '+l.from+' '+hm(l.departure)+' → '+l.to+' '+hm(l.arrival));});
  md.push('');}
 fs.writeFileSync(path.join(outDir,'RAPPORT-OTP2-REEL.md'),md.join('\n')+'\n');
 console.log('Axes avec au moins un itinéraire retenu :',report.axes.filter(a=>a.accepted).length+'/'+report.axes.length);
}
main().catch(e=>{console.error(e);process.exit(1);});
