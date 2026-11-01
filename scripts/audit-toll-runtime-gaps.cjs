'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {creerMoteur}=require('../peage-engine.js');
// Same strict resolution as routes-ui.js: no inferred motorway/exit aliases.
function resolver(gares){
 const exact=new Map(),normal=new Map();
 const key=n=>String(n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 gares.forEach((g,i)=>{if(!exact.has(g[0]))exact.set(g[0],i);const k=key(g[0]);normal.set(k,normal.has(k)?-1:i);});
 return name=>exact.has(name)?exact.get(name):(key(name)?normal.get(key(name))??-1:-1);
}
function audit(base,overlay,date){
 const gares=base.g.concat((overlay.gares||[]).filter(g=>!base.g.some(b=>b[0]===g.nom)).map(g=>[g.nom,g.points]));
 const ix=resolver(gares),unbound=new Map();let boundRows=0,unboundRows=0,invalidPriceRows=0;
 for(const row of overlay.paires||[]){
  const missing=[...new Set(row.slice(0,2).filter(n=>ix(n)<0))];
  if(missing.length)unboundRows++;else boundRows++;
  if([row[2],row[3]].some(v=>v==null||v===''||!Number.isFinite(Number(v))||Number(v)<0))invalidPriceRows++;
  for(const name of missing){if(!unbound.has(name))unbound.set(name,{name,affectedStoredRows:0,exampleCounterparts:[]});
   const item=unbound.get(name);item.affectedStoredRows++;for(const n of row.slice(0,2).filter(n=>n!==name))if(item.exampleCounterparts.length<3&&!item.exampleCounterparts.includes(n))item.exampleCounterparts.push(n);
  }
 }
 const engine=creerMoteur({versions:(overlay.tarifs||[]).map(t=>({barrier_station_id:t.b,vehicle_class:t.c,amount_eur:t.a,status:t.s,effective_from:t.f,effective_to:t.t,tariff_context:t.k,source_url:overlay.u[t.u]}))});
 const fixedClassGaps=(overlay.barrieres||[]).map(b=>({barrierId:b.id,missingClasses:[1,2].filter(c=>engine.barriere(b.id,c,date).amount==null)})).filter(b=>b.missingClasses.length);
 const unboundLabels=[...unbound.values()].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 const a79=unboundLabels.filter(g=>/^(LE MONTET|MONTBEUGNY|MOLINET)( |$)/.test(g.name));
 return {reviewedAt:date,scope:'Stored overlay endpoint labels and existing fixed-barrier class-1/2 availability under the current strict runtime resolver',
  nationalInventoryComplete:false,missingPhysicalTolls:null,missingNationalTariffs:null,
  counts:{loadedStationIdentities:gares.length,storedPairRows:overlay.paires.length,storedEndpointLabels:new Set(overlay.paires.flatMap(r=>r.slice(0,2))).size,
   boundEndpointRowsNotRouteCertified:boundRows,rowsWithUnboundEndpoints:unboundRows,unboundEndpointLabels:unboundLabels.length,rowsWithInvalidClass1Or2Amounts:invalidPriceRows,fixedBarrierClassGaps:fixedClassGaps.length},
  priorityA79:{unboundLabels:a79.map(g=>g.name),affectedStoredRows:(overlay.paires||[]).filter(r=>r.slice(0,2).some(n=>a79.some(g=>g.name===n))).length,
   note:'These are tariff labels, not a count of physical gantries. Branch geometry and conditional tariffs remain unverified.'},
  fixedClassGaps,unboundLabels,limitations:['A bound name does not certify price validity, distance, direction or road coverage.','Unbound labels can be alternate names or tariff boundaries, not missing physical tolls.','A fixed price requiring time, season or vehicle context can appear unconfirmed here; never replace it with zero.','This audit does not assess every published France/border price grid.']};
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const result=audit(read('peages-aprr.json'),read('peages-overlay.json'),'2026-11-01');
 result.inputSha256=Object.fromEntries(['peages-aprr.json','peages-overlay.json'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
 fs.writeFileSync(path.join(root,'docs/toll-runtime-gaps-2026-11-01.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({counts:result.counts,priorityA79:result.priorityA79,fixedClassGaps:result.fixedClassGaps},null,2));
}
module.exports={audit,resolver};
