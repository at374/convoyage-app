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
 if(!tokOJP&&!tokFare){lines.push('Essai impossible : aucun secret OJP dans le dépôt. Aucune validation réelle des API suisses.');return save();}
 // Sans jeton OJP 1.0 : la documentation indique que le service OJP Fare accepte aussi les OJPTripRequest.
 // On essaie donc, dans l'ordre, chaque couple (adresse, jeton) disponible et on note celui qui répond.
 const routes=[tokOJP&&['OJP 1.0 + jeton OJP 1.0',O.ENDPOINT,tokOJP],tokFare&&['OJP 1.0 + jeton OJP Fare',O.ENDPOINT,tokFare],tokFare&&['OJP Fare + jeton OJP Fare',O.FARE_ENDPOINT,tokFare]].filter(Boolean);
 const ask=async(what,body)=>{let last;
  for(const [label,url,tok] of routes){try{const xml=await O.post(url,body,tok);lines.push('- '+what+' : réponse par « '+label+' »');return xml;}
   catch(e){last=e;lines.push('- '+what+' : échec par « '+label+' » — '+e.message);}}
  throw last;};
 const pick=async name=>{
  const xml=await ask('Lieux « '+name+' »',O.locationRequest(name));
  const locs=O.parseLocations(xml);
  lines.push('## Lieux pour « '+name+' »','','| Nom | Type de référence (réponse) | Référence | Utilisable |','|---|---|---|---|',
   ...locs.map(l=>'| '+l.name+' | '+(l.refType||'—')+' | '+(l.ref||'—')+' | '+(O.placeRefXml(l)?'oui':'non ('+l.reason+')')+' |'),'');
  return locs.find(l=>O.placeRefXml(l))||null;
 };
 const from=await pick('Genève'),to=await pick('Lausanne');
 if(!from||!to){lines.push('**'+O.UNCONFIRMED+'** : référence de départ ou d’arrivée absente ou ambiguë.');return save();}
 const when=new Date(Date.now()+86400000);when.setUTCHours(7,0,0,0);
 const trips=O.parseTrips(await ask('Trajets',O.tripRequest(from,to,when)));
 lines.push('## Trajets ('+from.refType+' '+from.ref+' → '+to.refType+' '+to.ref+', départ après '+when.toISOString()+')','','Trajets reçus : '+trips.length,'');
 for(const t of trips){
  lines.push('- '+t.startTime+' → '+t.endTime+' ('+t.duration+', '+t.transfers+' correspondance(s)) : '+
   t.legs.filter(l=>l.kind==='timed').map(l=>l.line+' '+l.from+' '+l.departure+' → '+l.to+' '+l.arrival).join(' ; '));
  if(!tokFare){lines.push('  - Prix : non demandé (secret `OJP_FARE_API_KEY` absent).');continue;}
  try{
   const f=O.parseFare(await O.post(O.FARE_ENDPOINT,O.fareRequest(t),tokFare),t);
   lines.push('  - Offres reçues : '+((f.offers||[]).map(o=>o.amount+' '+o.currency+' « '+o.name+' » ['+o.fromId+'–'+o.toId+', '+o.travelClass+(o.requiredCard?', carte '+o.requiredCard:'')+']').join(' ; ')||'aucune'));
   lines.push('  - Prix : '+(f.price?f.price.amount.toFixed(2)+' '+f.price.currency+' ('+f.price.name+', '+f.price.authority+', portions '+f.price.fromId+' à '+f.price.toId+' = trajet complet)':
    'non affiché — '+f.reason+' ; offres reçues : '+((f.offers||[]).map(o=>o.amount+' '+o.currency+' ['+o.fromId+'–'+o.toId+(o.requiredCard?', carte '+o.requiredCard:'')+', '+o.travelClass+']').join(', ')||'aucune')));
  }catch(e){lines.push('  - Prix : erreur API — '+e.message);}
 }
 save();
})().catch(e=>{lines.push('','**Erreur API** : '+(e&&e.message));save();process.exitCode=1;});
