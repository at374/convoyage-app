// node tests/transport-rapide.test.js
'use strict';
const assert=require('node:assert/strict');
const T=require('../transport-rapide.js');
const q={depart:'Annecy',arrivee:'Lyon',date:'2026-11-02',heure:'09:00'};
(async()=>{
 let appels=0;
 const source={nom:'Source test',rechercher:async()=>{appels++;return [
 {departAt:'2026-11-02T09:00:00+01:00',arriveeAt:'2026-11-02T11:00:00+01:00',prixEUR:12,source:'test',confirme:true},
 {departAt:'invalide',arriveeAt:'invalide',prixEUR:4},
 {departAt:'2026-11-02T09:00:00+01:00',arriveeAt:'2026-11-02T11:00:00+01:00',prixEUR:-1}
 ];}};
 const [a,b]=await Promise.all([T.rechercher(q,[source]),T.rechercher(q,[source])]);
 assert.equal(appels,1,'identical in-flight queries deduplicated');
 assert.equal(a.trajets.length,1,'invalid rows rejected');
 assert.equal(b.trajets.length,1,'shared query result');
 assert.equal(a.trajets[0].prixEUR,12,'real supplied fare retained');
 const cached=await T.rechercher(q,[source]);
 assert.equal(cached.cache,true,'cached answer identified');
 assert.equal(appels,1,'cached request avoids provider call');
 const notificationsCache=[];
 const repete=await T.rechercher(q,[source],{surResultat:r=>notificationsCache.push(r)});
 assert.equal(repete.cache,true,'cached callback response marked');
 assert.equal(notificationsCache.length,1,'cached search emits one provider callback');
 assert.equal(notificationsCache[0].trajets.length,1,'cached callback includes actual provider trips');
 const autre={nom:'Autre source',rechercher:async()=>[{departAt:'2026-11-02T10:00:00+01:00',arriveeAt:'2026-11-02T12:00:00+01:00',prixEUR:18}]};
 const nouveau=await T.rechercher(q,[autre]);
 assert.equal(nouveau.trajets[0].prixEUR,18,'different provider cannot inherit stale fare');
 let echecs=0;
 const instable={nom:'instable',rechercher:async()=>{if(++echecs===1)throw Error('temporaire');return [{departAt:'2026-11-02T09:00:00+01:00',arriveeAt:'2026-11-02T10:00:00+01:00',prixEUR:9}];}};
 await T.rechercher(q,[instable]);
 const repris=await T.rechercher(q,[instable]);
 assert.equal(repris.trajets[0].prixEUR,9,'failed provider must be retried');
 assert.equal(echecs,2,'failed provider response not cached');
 const annonces=[];
 const vite={nom:'rapide',rechercher:async()=>[{departAt:'2026-11-02T09:00:00+01:00',arriveeAt:'2026-11-02T10:00:00+01:00',prixEUR:6}]};
 const lent={nom:'lent',rechercher:async()=>{await new Promise(resolve=>setTimeout(resolve,40));return [{departAt:'2026-11-02T10:00:00+01:00',arriveeAt:'2026-11-02T11:00:00+01:00',prixEUR:8}];}};
 const progressif=await T.rechercher({...q,heure:'12:00'},[vite,lent],{surResultat:r=>annonces.push(r.fournisseur)});
 assert.equal(annonces[0],'rapide','fast provider announces first');
 assert.equal(annonces.length,2,'each successful provider announces results');
 assert.equal(progressif.trajets.length,2,'final response includes all providers');
 assert.equal(T.valider({departAt:'2026-11-02T09:00:00+01:00',arriveeAt:'2026-11-02T10:00:00+01:00',prixEUR:8,confirme:true}).confirme,false,'untraceable confirmation rejected');
 assert.equal(T.valider({departAt:'2026-11-02T09:00:00+01:00',arriveeAt:'2026-11-02T10:00:00+01:00',prixEUR:8,confirme:true,source:'Operateur',verifieLe:new Date().toISOString()}).confirme,true,'recent traceable confirmation retained');
 assert.equal(T.valider({departAt:'2026-11-02T09:00:00+01:00',arriveeAt:'2026-11-02T10:00:00+01:00',confirme:true,source:'Operateur',verifieLe:new Date(Date.now()-16*60*1000).toISOString()}).confirme,false,'stale verification rejected');
 assert.equal(T.valider({departAt:'2026-11-02T09:00:00+01:00',arriveeAt:'2026-11-02T10:00:00+01:00',confirme:true,source:'Operateur',verifieLe:new Date(Date.now()+60*1000).toISOString()}).confirme,false,'future verification rejected');
 const empty=await T.rechercher({...q,heure:'10:00'},[]);
 assert.equal(empty.trajets.length,0,'no provider never invents a trip');
 const timeout=await T.rechercher({...q,heure:'11:00'},[{nom:'lent',rechercher:()=>new Promise(()=>{})}],{timeoutMs:250});
 assert.equal(timeout.trajets.length,0,'timeout never invents a trip');
 assert.ok(timeout.sources[0].erreur,'timeout reported');
 assert.equal(T.valider({departAt:'2026-11-02T11:00:00+01:00',arriveeAt:'2026-11-02T09:00:00+01:00'}),null,'reverse times rejected');
 console.log('Transport rapide: 23 assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
