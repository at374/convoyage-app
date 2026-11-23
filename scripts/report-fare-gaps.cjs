'use strict';
// Report observed fare gaps from a diagnostic snapshot; never invent prices.
const fs=require('node:fs');
const input=process.argv[2]||'docs/diagnostic-serveur.json';
const output=process.argv[3]||'docs/COUVERTURE-TARIFS-DIAGNOSTIC.md';
function build(d){
 if(!d||!Array.isArray(d.axes))throw Error('Invalid diagnostic: axes missing');
 const axes=d.axes.map(a=>{
  const missing=Object.entries(a.missingFareByOperator||{}).filter(([,n])=>Number.isFinite(n)&&n>0).sort((a,b)=>b[1]-a[1]);
  return {name:String(a.name||a.id||'?').replace(/[|\r\n]/g,' '),trips:Number(a.trips)||0,priced:Number(a.priced)||0,missing};
 }).sort((a,b)=>(b.trips-b.priced)-(a.trips-a.priced));
 const lines=['# Couverture tarifaire — diagnostic automatique','',
  'Source : '+String(d.source||'diagnostic').replace(/[\r\n]/g,' ')+' ; relevé : '+String(d.at||'inconnu')+' ; scénario : '+String(d.when||'inconnu')+'.','',
  'Ce rapport est un **instantané de diagnostic**, pas une confirmation de tarifs ou de disponibilité commerciale.','',
  '| Axe | Trajets | Entièrement tarifés | À compléter | Opérateurs sans prix |','|---|---:|---:|---:|---|'];
 for(const a of axes)lines.push('| '+a.name+' | '+a.trips+' | '+a.priced+' | '+Math.max(0,a.trips-a.priced)+' | '+(a.missing.map(([k,v])=>String(k).replace(/[|\r\n]/g,' ')+' ('+v+' portions)').join(', ')||'—')+' |');
 const byOperator=new Map();
 for(const a of axes)for(const [name,n] of a.missing)byOperator.set(name,(byOperator.get(name)||0)+n);
 lines.push('','## Portions sans prix par opérateur','',
  'Les nombres ci-dessous sont des **occurrences par axe**, pas des billets uniques ni des trajets distincts.','',
  '| Opérateur | Occurrences |','|---|---:|');
 for(const [name,n] of [...byOperator].sort((a,b)=>b[1]-a[1]))lines.push('| '+String(name).replace(/[|\r\n]/g,' ')+' | '+n+' |');
 const blockers=[];
 for(const a of d.axes){
  for(const [operator,rawLines] of Object.entries(a.partialMissingLineSamples||{})){
   if(!Array.isArray(rawLines)||!rawLines.length)continue;
   const names=[...new Set(rawLines.filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim().replace(/[|\r\n]/g,' ')))];
   if(names.length)blockers.push({axis:String(a.name||a.id||'?').replace(/[|\r\n]/g,' '),operator:String(operator).replace(/[|\r\n]/g,' '),lines:names});
  }
 }
 if(blockers.length){
  lines.push('','## Lignes à rechercher en priorité','',
   'Exemples observés sur des trajets partiellement tarifés : liste non exhaustive, sans tarif présumé.','',
   '| Axe | Opérateur | Lignes sans tarif vérifié |','|---|---|---|');
  for(const item of blockers)lines.push('| '+item.axis+' | '+item.operator+' | '+item.lines.join(', ')+' |');
 }
 const totals=d.totals||{};
 if(Number.isFinite(totals.trips)&&Number.isFinite(totals.priced)&&totals.trips>=0&&totals.priced>=0&&totals.priced<=totals.trips){
  const pct=totals.trips?(100*totals.priced/totals.trips).toFixed(1):'0.0';
  lines.push('','## Couverture globale','',totals.priced+' trajets entièrement tarifés sur '+totals.trips+' ('+pct+' %).');
 }
 if(Number.isFinite(totals.trips)&&Number.isFinite(totals.priced)&&Number.isFinite(totals.feasible)){
  lines.push('','## Distinction indispensable : prix et faisabilité','',
   'Trajets avec prix complet : '+totals.priced+' / '+totals.trips+'.',
   'Trajets déclarés faisables par le diagnostic : '+totals.feasible+' / '+totals.trips+'.',
   'Ces deux compteurs sont indépendants : un trajet tarifé peut rester non réalisable (horaires, correspondances, confirmation). Leur intersection n’est pas calculée ici ; ne pas présenter '+totals.priced+' comme le nombre de trajets réalisables.');
 }
 if(Number.isFinite(totals.partialPricedJourneys)){
  lines.push('','## Trajets partiellement tarifés','',
   totals.partialPricedJourneys+' trajets possèdent au moins un tarif, mais pas de prix total vérifié. Ils restent exclus du calcul de rentabilité.');
 }
 const partial=Object.entries(totals.partialMissingByOperator||{}).filter(([,n])=>Number.isFinite(n)&&n>0).sort((a,b)=>b[1]-a[1]);
 if(partial.length){
  lines.push('','## Priorité : portions bloquant les trajets partiellement tarifés','',
   'Ces occurrences sont déjà incluses dans les manques par opérateur ; elles ne doivent pas être additionnées aux autres comptes.','',
   '| Opérateur | Occurrences bloquantes |','|---|---:|');
  for(const [name,n] of partial)lines.push('| '+String(name).replace(/[|\r\n]/g,' ')+' | '+n+' |');
 }
 lines.push('','Aucun montant manquant ne doit être remplacé par une estimation. La rentabilité de mission reste masquée tant que le prix total du transport n’est pas vérifié.','');
 return lines.join('\n');
}
if(require.main===module){const d=JSON.parse(fs.readFileSync(input,'utf8'));fs.writeFileSync(output,build(d));console.log('Rapport créé : '+output);}
module.exports={build};
