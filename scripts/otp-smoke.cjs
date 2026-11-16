#!/usr/bin/env node
/* Convoyage Ultra — vérification OTP2 hors production.
 * Usage : node scripts/otp-smoke.cjs <reponse-otp.json>
 * Aucun serveur ni compte requis ; aucune requête réseau.
 * Pour une validation réelle, enregistrer une réponse JSON issue d'un serveur OTP2
 * puis exécuter cette commande sur le fichier obtenu.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {parse}=require('../transport-otp-adapter.js');
const filename=process.argv[2];
if(!filename){
 console.error('Usage: node scripts/otp-smoke.cjs <reponse-otp.json>');
 process.exit(2);
}
try{
 const raw=JSON.parse(fs.readFileSync(path.resolve(filename),'utf8'));
 const items=parse(raw);
 const report={
  input:path.basename(filename),
  itineraries:items.length,
  scheduled:items.length,
  confirmedRealtime:0,
  faresVerified:0,
  journeys:items.map((it,i)=>({
   number:i+1,
   departure:it.legs[0]?.departure,
   arrival:it.legs[it.legs.length-1]?.arrival,
   legs:it.legs.length,
   modes:it.legs.map(l=>l.mode),
   walkMeters:it.legs.filter(l=>l.kind==='walk').reduce((a,l)=>a+l.distanceMeters,0),
   status:'Transport non confirmé : horaires GTFS, marches et tarifs à vérifier'
  }))
 };
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(!items.length)process.exitCode=1;
}catch(err){
 console.error('Impossible de vérifier la réponse OTP2 : '+err.message);
 process.exitCode=2;
}
