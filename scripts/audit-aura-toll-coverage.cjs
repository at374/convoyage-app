'use strict';
const fs=require('node:fs'),path=require('node:path');
const {normalize}=require('./connect-toll-stations.cjs'),{creerMoteur}=require('../peage-engine.js');
const DEPARTMENTS=new Set(['01','03','07','15','26','38','42','43','63','69','73','74']);
function audit(base,overlay,ministry,aliases,date){
 const overrides=(overlay.gares||[]).filter(g=>g.positionOverride===true&&g.provenance?.local==='data/gares-peage-officiel.json'&&g.points.every(p=>ministry.d.some(r=>g.provenance.officialNames.includes(r[0])&&g.provenance.routes.includes(r[1])&&r[2]===p[0]&&r[3]===p[1])));
 const stations=base.g.map(g=>{const o=overrides.find(o=>o.nom===g[0]);return o?[g[0],o.points]:g;}).concat((overlay.gares||[]).filter(g=>!base.g.some(b=>b[0]===g.nom)).map(g=>[g.nom,g.points]));
 const engine=creerMoteur({versions:overlay.tarifs.map(t=>({id:t.id,barrier_station_id:t.b,vehicle_class:t.c,amount_eur:t.a,status:t.s,effective_from:t.f,effective_to:t.t||null,tariff_context:t.k||null,source_url:overlay.u[t.u]}))});
 const grouped=new Map(),distance=(a,b)=>Math.hypot((a[0]-b[0])*111.32,(a[1]-b[1])*111.32*Math.cos(a[0]*Math.PI/180));
 for(const r of ministry.d){if(!DEPARTMENTS.has(r[1].slice(0,2)))continue;const key=r[1]+'|'+normalize(r[0]);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
 const groups=[];
 for(const rows of grouped.values()){
  const r=rows[0],points=rows.map(r=>[r[2],r[3]]),item={name:r[0],ministryRoute:r[1],points};
  const fixed=(overlay.barrieres||[]).filter(b=>points.every(p=>b.points.some(q=>p[0]===q[0]&&p[1]===q[1])));
  if(fixed.length===1){const prices=[1,2].map(c=>engine.barriere(fixed[0].id,c,date));Object.assign(item,{status:prices.every(p=>p.amount!=null)?'fixed_gate_prices_present':'fixed_gate_price_unconfirmed',barrierId:fixed[0].id,class1:prices[0].amount,class2:prices[1].amount});}
  else{
   const names=stations.filter(s=>normalize(s[0])===normalize(r[0])||aliases.some(a=>a.tariffName===s[0]&&a.officialNames.includes(r[0])&&a.routes.includes(r[1]))||overrides.some(o=>o.nom===s[0]&&o.provenance.officialNames.includes(r[0])&&o.provenance.routes.includes(r[1])));
   const checked=names.filter(s=>points.every(p=>s[1].some(q=>distance(p,q)<=.1)));
   if(checked.length===1)Object.assign(item,{status:'named_station_position_matched',catalogueNames:[checked[0][0]]});
   else{const near=stations.filter(s=>points.some(p=>s[1].some(q=>distance(p,q)<=.5))).map(s=>s[0]);Object.assign(item,{status:names.length?'named_station_position_to_verify':near.length?'nearby_identity_to_verify':'unresolved',catalogueNames:names.map(s=>s[0]),nearbyCandidates:near});}
  }
  groups.push(item);
 }
 const statusCounts={};for(const g of groups)statusCounts[g.status]=(statusCounts[g.status]||0)+1;
 return {reviewedAt:date,scope:'AURA records in the checked-in ministry station dataset, not an exhaustive physical-toll inventory',source:'data/gares-peage-officiel.json',sourceDatasetYear:2025,regionalMinistryGroups:groups.length,statusCounts,missingRegionalTariffs:null,nationalCompletenessVerified:false,notes:['Matched names or nearby points do not prove all route tariffs or access.','Entry/exit and lane records are not counted as distinct missing physical tolls.','Fixed prices are reported only for the supplied day and classes 1/2; subscription eligibility is not inferred.'],groups};
}
if(require.main===module){const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const result=audit(read('peages-aprr.json'),read('peages-overlay.json'),read('data/gares-peage-officiel.json'),read('data/toll-station-aliases.json').aliases,'2026-11-01');
 fs.writeFileSync(path.join(root,'docs/toll-aura-coverage-2026-11-01.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({groups:result.regionalMinistryGroups,statusCounts:result.statusCounts,unresolved:result.groups.filter(g=>g.status==='unresolved').map(g=>g.name)}));}
module.exports={audit};
