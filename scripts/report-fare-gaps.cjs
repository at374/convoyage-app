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
 lines.push('','Aucun montant manquant ne doit être remplacé par une estimation. La rentabilité de mission reste masquée tant que le prix total du transport n’est pas vérifié.','');
 return lines.join('\n');
}
if(require.main===module){const d=JSON.parse(fs.readFileSync(input,'utf8'));fs.writeFileSync(output,build(d));console.log('Rapport créé : '+output);}
module.exports={build};
