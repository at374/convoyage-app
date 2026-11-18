#!/usr/bin/env node
// Vérification de bout en bout des réseaux locaux : pour chaque réseau branché dans le hub, une vraie course (jour ouvré
// dans les 7 jours, entre deux arrêts de l'emprise) est redemandée au moteur de recherche (CPGTFSIndex) ; le réseau est
// « vérifié » seulement si le moteur retrouve cette course à l'heure prévue. Usage : node scripts/verifier-reseaux.cjs pairs.json [sortie.md]
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..');
const gtfs=require(path.join(ROOT,'transport-gtfs-index.js'));
const pairs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out=process.argv[3]||path.join(ROOT,'docs','VERIFICATION-RESEAUX.md');
const sec=h=>{const m=/^(\d+):(\d+):(\d+)$/.exec(h||'');return m?(+m[1])*3600+(+m[2])*60+(+m[3]):NaN};
const rows=[];
for(const p of pairs){
 const r={id:p.id,file:p.file,trips:p.trips,statut:'',detail:''};
 if(p.error){r.statut='ÉCHEC';r.detail=p.error;rows.push(r);continue;}
 try{
  const dir=fs.mkdtempSync('/tmp/vr-');
  cp.execFileSync('unzip',['-q','-o',path.join(ROOT,'data','gtfs',p.file),'-d',dir]);
  const files={};for(const n of fs.readdirSync(dir))if(n.endsWith('.txt'))files[n]=fs.readFileSync(path.join(dir,n),'utf8');
  fs.rmSync(dir,{recursive:true,force:true});
  const idx=gtfs.buildIndex(files);
  const res=gtfs.nearbyDirectTrips(files,idx,p.date,p.from,p.to,300);
  const list=Array.isArray(res)?res:(res&&res.journeys)||[];
  const want=sec(p.dep);
  const hit=list.find(j=>Math.abs(sec(j.departure)-want)<=60);
  if(hit){r.statut='OK';r.detail=p.date+' '+p.dep+' retrouvée ('+list.length+' départs proposés)';}
  else{r.statut='ÉCHEC';r.detail=p.date+' '+p.dep+' non retrouvée ('+list.length+' départs proposés)';}
 }catch(e){r.statut='ÉCHEC';r.detail=String(e.message).slice(0,120);}
 rows.push(r);
}
const ok=rows.filter(r=>r.statut==='OK').length;
const L=['# Vérification de bout en bout des réseaux locaux','','Généré le '+new Date().toISOString().slice(0,10)+' par `scripts/verifier-reseaux.cjs`. Pour chaque réseau, une vraie course est redemandée au moteur de recherche.','',
 '**'+ok+' / '+rows.length+' réseaux vérifiés.**','','| Réseau | Fichier | Courses | Statut | Détail |','|---|---|---|---|---|'];
for(const r of rows)L.push('| '+[r.id,r.file,r.trips||'',r.statut,r.detail].join(' | ')+' |');
fs.writeFileSync(out,L.join('\n')+'\n');
console.log(ok+'/'+rows.length+' OK');for(const r of rows.filter(r=>r.statut!=='OK'))console.log('ÉCHEC',r.id,r.detail);
process.exit(ok===rows.length?0:1);
