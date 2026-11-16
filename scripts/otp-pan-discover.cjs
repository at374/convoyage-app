#!/usr/bin/env node
/* Découverte des GTFS officiels français via le PAN, sans télécharger d'archives.
 * Usage: node scripts/otp-pan-discover.cjs [mot-clé ...]
 * Ex: node scripts/otp-pan-discover.cjs Sibra Annecy Isère Savoie
 * API publique https://transport.data.gouv.fr/api/datasets (métadonnées).
 */
'use strict';
const URL='https://transport.data.gouv.fr/api/datasets';
const DEFAULT=['sibra','annecy','savoie','isere','isère','haute-savoie','ain','cars region','cars région','tac','annemasse','lyon','grenoble','chambery','chambéry'];
function discover(datasets,terms=DEFAULT){
 if(!Array.isArray(datasets))throw Error('PAN: liste de jeux de données invalide');
 const needle=terms.map(s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
 const result=[];
 for(const d of datasets){
  if(!d||typeof d!=='object')continue;
  const label=[d.title,d.slug,d.publisher?.name,d.description,d.aom?.name].filter(Boolean).join(' ');
  const normalized=label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matched=needle.filter(t=>normalized.includes(t));
  if(!matched.length)continue;
  for(const r of Array.isArray(d.resources)?d.resources:[]){
   if(!r||String(r.format||'').toUpperCase()!=='GTFS')continue;
   result.push({dataset:d.title||null,datasetId:d.id??null,datasetPage:d.page_url||null,
    publisher:d.publisher?.name||null,license:d.licence||d.license||null,
    resource:r.title||r.name||null,resourceId:r.id??null,format:r.format,
    url:typeof r.url==='string'&&/^https:\/\//.test(r.url)?r.url:null,
    updatedAt:r.updated_at||r.last_update||null,isAvailable:r.is_available??null,
    matchedTerms:matched});
  }
 }
 return result.sort((a,b)=>String(a.dataset).localeCompare(String(b.dataset),'fr'));
}
async function main(){
 const terms=process.argv.slice(2).length?process.argv.slice(2):DEFAULT;
 const response=await fetch(URL,{headers:{accept:'application/json'},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('PAN HTTP '+response.status);
 const datasets=await response.json();
 const matches=discover(datasets,terms);
 process.stdout.write(JSON.stringify({source:URL,checkedAt:new Date().toISOString(),terms,
  resourceCount:matches.length,resources:matches},null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={discover};
