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
 const empty=await T.rechercher({...q,heure:'10:00'},[]);
 assert.equal(empty.trajets.length,0,'no provider never invents a trip');
 const timeout=await T.rechercher({...q,heure:'11:00'},[{nom:'lent',rechercher:()=>new Promise(()=>{})}],{timeoutMs:250});
 assert.equal(timeout.trajets.length,0,'timeout never invents a trip');
 assert.ok(timeout.sources[0].erreur,'timeout reported');
 assert.equal(T.valider({departAt:'2026-11-02T11:00:00+01:00',arriveeAt:'2026-11-02T09:00:00+01:00'}),null,'reverse times rejected');
 console.log('Transport rapide: 10 assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
