#!/usr/bin/env node
// Vérifie, sur les archives réelles data/gtfs, que chaque moteur régional des fiches mission rend des trajets
// pour un couple départ/arrivée tiré d'une course officielle des 30 prochains jours (scripts/moteurs_regionaux_paires.py).
// Usage : python3 -I scripts/moteurs_regionaux_paires.py paires.json && node scripts/verifier-moteurs-regionaux.cjs paires.json
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
const hub=require(path.join(root,'transport-mission-hub.js')),loader=require(path.join(root,'transport-gtfs-loader.js')),index=require(path.join(root,'transport-gtfs-index.js'));
// Flux officiels publiés sans calendrier exploitable : signalés, non bloquants.
const KNOWN_EMPTY=new Set(['proximiti']);
const fetcher=async url=>{const b=fs.readFileSync(path.join(root,'data/gtfs',String(url).split('/').pop()));
 return new Response(b,{headers:{'content-type':'application/zip','content-length':String(b.length)}});};
const P=hub.makeProviders({CPGTFSLoader:loader,CPGTFSIndex:index,fetch:fetcher},{fetcher});
(async()=>{let bad=0;const rows=[];
 for(const p of JSON.parse(fs.readFileSync(process.argv[2],'utf8'))){
  let state,detail='';
  try{
   const pr=P['local_'+p.id];
   if(p.error){state='SANS COURSE';detail=p.error;}
   else if(!pr){state='ABSENT';}
   else{const task={from:p.from,to:p.to,earliestDeparture:p.date+'T05:00:00+01:00'};
    if(!pr.enabled(task))state='HORS ZONE';
    else{const r=await pr.run(task);state=r.length?'OK':'ZÉRO';detail=r.length+' trajets le '+p.date;}}
  }catch(e){state='ERREUR';detail=String(e&&e.message).slice(0,160);}
  if(state!=='OK'&&!KNOWN_EMPTY.has(p.id))bad++;
  rows.push(p.id+' | '+state+' | '+detail);
 }
 console.log(rows.join('\n'));console.log(rows.length+' moteurs régionaux, '+bad+' en défaut');
 if(bad)process.exitCode=1;
})();
