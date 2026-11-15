#!/usr/bin/env node
// Essai réel OJP 1.0 + OJP Fare (opentransportdata.swiss) : Genève → Lausanne.
// Les jetons viennent de l'environnement (secrets du dépôt) ; ils ne sont jamais affichés et aucune réponse
// brute n'est enregistrée : seul un résumé (noms, types de référence, horaires, prix) est écrit.
const fs=require('node:fs'),path=require('node:path');
const O=require(path.join(__dirname,'..','transport-ojp.js'));
const out=path.join(__dirname,'..','docs','essai-ojp-reel.md');
const tokOJP=process.env.OJP_API_KEY||'',tokFare=process.env.OJP_FARE_API_KEY||'';
const lines=['# Essai réel OJP 1.0 / OJP Fare — Genève → Lausanne','','Exécuté le '+new Date().toISOString()+' (GitHub Actions).','',
 '- Jeton OJP 1.0 (`OJP_API_KEY`) : '+(tokOJP?'présent':'**absent**'),'- Jeton OJP Fare (`OJP_FARE_API_KEY`) : '+(tokFare?'présent':'**absent**'),''];
const scrub=s=>[tokOJP,tokFare].filter(Boolean).reduce((t,k)=>t.split(k).join('***'),String(s));
const save=()=>{fs.writeFileSync(out,scrub(lines.join('\n'))+'\n');console.log(scrub(lines.join('\n')));};
(async()=>{
 if(!tokOJP){lines.push('Essai impossible : le secret `OJP_API_KEY` n’existe pas dans le dépôt. Aucune validation réelle des API suisses.');return save();}
 const pick=async name=>{
  const xml=await O.post(O.ENDPOINT,O.locationRequest(name),tokOJP);
  const locs=O.parseLocations(xml);
  lines.push('## Lieux pour « '+name+' »','','| Nom | Type de référence (réponse) | Référence | Utilisable |','|---|---|---|---|',
   ...locs.map(l=>'| '+l.name+' | '+(l.refType||'—')+' | '+(l.ref||'—')+' | '+(O.placeRefXml(l)?'oui':'non ('+l.reason+')')+' |'),'');
  return locs.find(l=>O.placeRefXml(l))||null;
 };
 const from=await pick('Genève'),to=await pick('Lausanne');
 if(!from||!to){lines.push('**'+O.UNCONFIRMED+'** : référence de départ ou d’arrivée absente ou ambiguë.');return save();}
 const when=new Date(Date.now()+86400000);when.setUTCHours(7,0,0,0);
 const trips=O.parseTrips(await O.post(O.ENDPOINT,O.tripRequest(from,to,when),tokOJP));
 lines.push('## Trajets ('+from.refType+' '+from.ref+' → '+to.refType+' '+to.ref+', départ après '+when.toISOString()+')','','Trajets reçus : '+trips.length,'');
 for(const t of trips){
  lines.push('- '+t.startTime+' → '+t.endTime+' ('+t.duration+', '+t.transfers+' correspondance(s)) : '+
   t.legs.filter(l=>l.kind==='timed').map(l=>l.line+' '+l.from+' '+l.departure+' → '+l.to+' '+l.arrival).join(' ; '));
  if(!tokFare){lines.push('  - Prix : non demandé (secret `OJP_FARE_API_KEY` absent).');continue;}
  try{
   const f=O.parseFare(await O.post(O.FARE_ENDPOINT,O.fareRequest(t),tokFare),t);
   lines.push('  - Prix : '+(f.price?f.price.amount.toFixed(2)+' '+f.price.currency+' ('+f.price.name+', '+f.price.authority+', portions '+f.price.fromId+' à '+f.price.toId+' = trajet complet)':
    'non affiché — '+f.reason+' ; offres reçues : '+((f.offers||[]).map(o=>o.amount+' '+o.currency+' ['+o.fromId+'–'+o.toId+(o.requiredCard?', carte '+o.requiredCard:'')+', '+o.travelClass+']').join(', ')||'aucune')));
  }catch(e){lines.push('  - Prix : erreur API — '+e.message);}
 }
 save();
})().catch(e=>{lines.push('','**Erreur API** : '+(e&&e.message));save();process.exitCode=1;});
