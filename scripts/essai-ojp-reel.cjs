#!/usr/bin/env node
// TEST RÉEL (API suisses, GitHub Actions) — OJP 1.0 + OJP Fare sur quatre trajets au départ de Genève.
// Les jetons viennent de l'environnement (secrets du dépôt) ; ils ne sont jamais affichés et aucune réponse
// brute n'est enregistrée : seul un résumé (noms, types de référence, horaires, opérateurs, prix) est écrit.
// Les tests simulés sont à part : tests/transport-ojp.test.cjs.
const fs=require('node:fs'),path=require('node:path');
const O=require(path.join(__dirname,'..','transport-ojp.js'));
const out=path.join(__dirname,'..','docs','essai-ojp-reel.md');
const tok1=process.env.OJP_1_API_KEY||process.env.OJP_API_KEY||'',tokFare=process.env.OJP_FARE_API_KEY||'';
const DESTINATIONS=['Lausanne','Nyon','Annemasse','Saint-Julien-en-Genevois'];
const lines=['# Test réel OJP 1.0 / OJP Fare — départs de Genève','','Exécuté le '+new Date().toISOString()+' (GitHub Actions, API réelles opentransportdata.swiss).',
 'Prix OJP Fare : **indicatifs** (système d’intégration, non contractuels, non réservables par cette API).','',
 '- Secret `OJP_1_API_KEY` (OJP 1.0, itinéraires) : '+(tok1?'présent':'**absent**'),'- Secret `OJP_FARE_API_KEY` (OJP Fare, prix) : '+(tokFare?'présent':'**absent**'),''];
const scrub=s=>[tok1,tokFare].filter(Boolean).reduce((t,k)=>t.split(k).join('***'),String(s));
const save=()=>{fs.writeFileSync(out,scrub(lines.join('\n'))+'\n');console.log(scrub(lines.join('\n')));};
const hm=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Zurich',hour:'2-digit',minute:'2-digit'}).format(d):'?';};
(async()=>{
 if(!tok1&&!tokFare){lines.push('Test impossible : aucun secret OJP dans le dépôt.');return save();}
 // Chaque couple (adresse, jeton) disponible est essayé dans l'ordre ; le premier qui répond est noté une fois.
 const routes=[tok1&&['adresse OJP 1.0 + jeton OJP 1.0',O.ENDPOINT,tok1],tokFare&&['adresse OJP Fare + jeton OJP Fare',O.FARE_ENDPOINT,tokFare]].filter(Boolean);
 const used=new Set(),errors=[];
 const ask=async body=>{let last;
  for(const [label,url,tok] of routes){try{const xml=await O.post(url,body,tok);used.add(label);return xml;}catch(e){last=e;errors.push(label+' — '+e.message);}}
  throw last;};
 const pick=async name=>{
  const locs=O.parseLocations(await ask(O.locationRequest(name)));
  lines.push('Lieux « '+name+' » : '+(locs.slice(0,4).map(l=>l.name+' ['+(l.refType||'type absent')+' '+(l.ref||'—')+(O.placeRefXml(l)?'':' — inutilisable : '+l.reason)+']').join(' ; ')||'aucun'));
  return locs.find(l=>O.placeRefXml(l))||null;
 };
 const from=await pick('Genève');lines.push('');
 const when=new Date(Date.now()+86400000);when.setUTCHours(7,0,0,0);
 const fareOf=async(t,halfFare)=>{try{return O.parseFare(await O.post(O.FARE_ENDPOINT,O.fareRequest(t,{halfFare}),tokFare),t,{halfFare});}catch(e){return {price:null,reason:'erreur API — '+e.message,offers:[]};}};
 const offers=f=>(f.offers||[]).map(o=>o.amount+' '+o.currency+' « '+o.name+' » '+(o.travelClass||'classe ?')+' [portions '+o.fromId+'–'+o.toId+(o.requiredCard?', carte '+o.requiredCard:'')+']').join(' ; ')||'aucune';
 for(const name of DESTINATIONS){
  lines.push('## Genève → '+name,'');
  try{
   const to=await pick(name);
   if(!from||!to){lines.push('**'+O.UNCONFIRMED+'** : référence de départ ou d’arrivée absente ou ambiguë.','');continue;}
   const trips=O.parseTrips(await ask(O.tripRequest(from,to,when)));
   lines.push('Références utilisées : '+from.refType+' '+from.ref+' → '+to.refType+' '+to.ref+'. Trajets reçus : '+trips.length+'.','');
   for(const t of trips){
    const timed=t.legs.filter(l=>l.kind==='timed');
    lines.push('- **'+hm(t.startTime)+' → '+hm(t.endTime)+'** ('+t.duration+', '+t.transfers+' correspondance(s))');
    for(const l of timed)lines.push('  - '+l.line+' ('+(l.mode||'?')+', opérateur '+(l.operator||l.operatorRef||'?')+') : '+l.from+' '+hm(l.departure)+' ['+l.fromRef+'] → '+l.to+' '+hm(l.arrival)+' ['+l.toRef+']');
    const ops=[...new Set(timed.map(l=>l.operatorRef||l.operator).filter(Boolean))];
    if(ops.length>1)lines.push('  - Passage entre opérateurs : '+ops.join(' → '));
    if(!tokFare){lines.push('  - Prix : non demandé (secret `OJP_FARE_API_KEY` absent).');continue;}
    const full=await fareOf(t,false),half=await fareOf(t,true);
    lines.push('  - Offres plein tarif reçues : '+offers(full));
    lines.push('  - Offres demi-tarif reçues : '+offers(half));
    lines.push('  - Plein tarif 2e classe retenu : '+(full.price?full.price.amount.toFixed(2)+' '+full.price.currency+' (« '+full.price.name+' », portions '+full.price.fromId+' à '+full.price.toId+' = trajet complet, indicatif)':'**Prix à consulter** — '+full.reason));
    lines.push('  - Demi-tarif 2e classe retenu : '+(half.price?half.price.amount.toFixed(2)+' '+half.price.currency+' (« '+half.price.name+' », indicatif)':'**Prix à consulter** — '+half.reason));
   }
  }catch(e){lines.push('**Erreur API** : '+(e&&e.message));}
  lines.push('');
 }
 lines.push('## Accès','','Accès ayant répondu : '+([...used].join(' ; ')||'aucun')+'.');
 if(errors.length)lines.push('','Erreurs API rencontrées :',...[...new Set(errors)].map(e=>'- '+e));
 save();
})().catch(e=>{lines.push('','**Erreur API** : '+(e&&e.message));save();process.exitCode=1;});
