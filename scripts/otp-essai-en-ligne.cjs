#!/usr/bin/env node
/* Convoyage Ultra — essai RÉEL du serveur OTP2 en ligne avec le client de l'application (HTTPS, mêmes garde-fous).
 * Mesure : pré-vérification CORS (appel depuis le site de l'application), délai du premier appel, recherches réelles.
 * Usage : OTP_ENDPOINT=https://…/otp/gtfs/v1 TEST_DATE=2026-11-24 node scripts/otp-essai-en-ligne.cjs <dossier-sortie>
 */
'use strict';
const fs=require('fs'),path=require('path');
const client=require('../transport-otp-client.js');
const ENDPOINT=process.env.OTP_ENDPOINT,DAY=process.env.TEST_DATE,out=process.argv[2]||'docs/otp2-reel/en-ligne';
const ORIGIN='https://at374.github.io';
const P={annecy:{lat:45.9017,lon:6.1219},geneve:{lat:46.2102,lon:6.1424},amberieu:{lat:45.9542,lon:5.3419},lyon:{lat:45.7606,lon:4.8593},
 chambery:{lat:45.5711,lon:5.9196},stjulien:{lat:46.1446,lon:6.0812},annemasse:{lat:46.1993,lon:6.2366},archamps:{lat:46.1362,lon:6.1328}};
const AXES=[['amberieu','lyon'],['chambery','stjulien'],['annecy','geneve'],['annecy','annemasse'],['archamps','geneve']];
(async()=>{
 const report={generatedAt:new Date().toISOString(),endpoint:ENDPOINT,origin:ORIGIN,testDate:DAY,axes:[]};
 let t=Date.now();
 try{
  const r=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json',origin:ORIGIN},body:'{"query":"{__typename}"}',signal:AbortSignal.timeout(300000)});
  report.firstCall={status:r.status,ms:Date.now()-t,allowOrigin:r.headers.get('access-control-allow-origin')};
 }catch(e){report.firstCall={error:e.message,ms:Date.now()-t};}
 try{
  const r=await fetch(ENDPOINT,{method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'POST','access-control-request-headers':'content-type'},signal:AbortSignal.timeout(60000)});
  report.preflight={status:r.status,allowOrigin:r.headers.get('access-control-allow-origin'),allowMethods:r.headers.get('access-control-allow-methods'),allowHeaders:r.headers.get('access-control-allow-headers')};
 }catch(e){report.preflight={error:e.message};}
 const when=new Date(DAY+'T07:00:00Z').toISOString();
 for(const [a,b] of AXES){
  const row={id:a+'-'+b};report.axes.push(row);t=Date.now();
  try{
   const q=client.buildQuery({from:P[a],to:P[b]},{when,arriveBy:false});
   // Mêmes réglages que la fiche mission : délai par défaut du client (8 s).
   const res=await client.search({enabled:true,endpoint:ENDPOINT,query:q.query,variables:q.variables,fetch});
   row.ms=Date.now()-t;row.journeys=res.journeys.length;
   row.walkLegsWithPath=res.journeys.flatMap(j=>j.legs).filter(l=>l.kind==='walk'&&l.geometry).length;
   row.walkLegs=res.journeys.flatMap(j=>j.legs).filter(l=>l.kind==='walk').length;
  }catch(e){row.ms=Date.now()-t;row.error=e.message;}
  console.log(row);
 }
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'essai-client.json'),JSON.stringify(report,null,1));
 console.log(JSON.stringify({firstCall:report.firstCall,preflight:report.preflight}));
})().catch(e=>{console.error(e);process.exit(1);});
