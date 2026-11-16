#!/usr/bin/env node
/* Analyse de couverture des ressources GTFS PAN, sans téléchargement.
 * Usage: node scripts/otp-pan-coverage.cjs <rapport-otp-pan-discover.json>
 * Produit des candidats, et des avertissements de doublons potentiels.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const AXES={
 'Annecy–Genève':['annecy','sibra','geneve','genève','annemasse','tac'],
 'Ambérieu–Lyon':['amberieu','ambérieu','ain','lyon','ter','sncf'],
 'Chambéry–Saint-Julien-en-Genevois':['chambery','chambéry','savoie','saint-julien','genevois','ter'],
 'Archamps–Genève':['archamps','annemasse','tac','geneve','genève','leman','léman']
};
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function report(resources){
 if(!Array.isArray(resources))throw Error('Liste resources invalide');
 const valid=resources.filter(r=>r&&r.format==='GTFS'&&r.url&&/^https:\/\//.test(r.url));
 const axes=Object.fromEntries(Object.entries(AXES).map(([axis,terms])=>{
  const matched=valid.filter(r=>{const hay=norm([r.dataset,r.publisher,r.resource,...(r.matchedTerms||[])].join(' '));
   return terms.some(t=>hay.includes(norm(t)));});
  return [axis,{candidates:matched.map(r=>({dataset:r.dataset,url:r.url,license:r.license,
    updatedAt:r.updatedAt,isAvailable:r.isAvailable})),status:'candidats uniquement : trajets non vérifiés'}];
 }));
 const byUrl=new Map();
 for(const r of valid){const arr=byUrl.get(r.url)||[];arr.push(r.dataset);byUrl.set(r.url,arr);}
 const duplicatedUrls=[...byUrl].filter(([,items])=>items.length>1).map(([url,datasets])=>({url,datasets}));
 return {totalResources:resources.length,httpsGtfsCandidates:valid.length,
  missingUrls:resources.filter(r=>!r?.url).length,duplicatedUrls,axes,
  limitations:['La présence d’un flux ne prouve pas la couverture de la liaison.',
   'Vérifier les calendriers, arrêts, correspondances, doublons de courses et licences après téléchargement.',
   'Aucun tarif commercial n’est déduit des horaires GTFS.']};
}
if(require.main===module){
 try{const input=process.argv[2];if(!input)throw Error('Usage: node scripts/otp-pan-coverage.cjs <rapport.json>');
  const raw=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
  process.stdout.write(JSON.stringify(report(raw.resources),null,2)+'\n');
 }catch(e){console.error(e.message);process.exitCode=2;}
}
module.exports={report};
