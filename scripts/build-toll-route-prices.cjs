'use strict';
// Strict offline binding: same normalized name, published motorway and all catalogue
// points within 60 m of ministry points. No abbreviation expansion or new geometry.
const fs=require('node:fs'),path=require('node:path');
const {normalize}=require('./connect-toll-stations.cjs');
function build(base,overlay,ministry,snapshots){
 const gares=base.g.concat((overlay.gares||[]).filter(x=>!base.g.some(g=>g[0]===x.nom)).map(x=>[x.nom,x.points]));
 const byName=new Map(),official=new Map();
 for(const g of gares){const k=normalize(g[0]);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(g);}
 for(const r of ministry.d){const m=/A9(\d{3})/.exec(r[1]);if(!m)continue;const k='A'+Number(m[1])+'|'+normalize(r[0]);if(!official.has(k))official.set(k,[]);official.get(k).push(r);}
 const distance=(p,q)=>Math.hypot((p[0]-q[0])*111.32,(p[1]-q[1])*111.32*Math.cos(p[0]*Math.PI/180));
 const stations=[],sources=[],rows=[],ambiguous=new Map();
 for(const s of snapshots){
  if(s.format!=='od')continue;
  const h=s.headers,at=n=>h.indexOf(n),bindings=new Map(),sourceIndex=sources.length;
  sources.push({id:s.sourceId,url:s.sourceUrl,effectiveFrom:s.effectiveFrom,checkedOn:s.checkedOn,verifiedYear:s.verifiedYear,rawSha256:s.rawSha256});
  for(const r of s.rows)for(const end of ['entree','sortie']){
   const road=r[at('autoroute_'+end)],publishedName=r[at('nom_'+end)],key=road+'|'+publishedName;if(bindings.has(key))continue;
   const gs=byName.get(normalize(publishedName)),records=official.get(road+'|'+normalize(publishedName));
   if(gs?.length!==1||!records?.length||records.some(r=>distance([r[2],r[3]],[records[0][2],records[0][3]])>1)||!gs[0][1].length||!gs[0][1].every(p=>records.some(r=>distance(p,[r[2],r[3]])<=.06)))continue;
   const name=gs[0][0],index=stations.length;bindings.set(key,index);
   stations.push({name,road,publishedName,points:gs[0][1],ministryRoutes:[...new Set(records.map(r=>r[1]))]});
   if(!ambiguous.has(name))ambiguous.set(name,new Set());ambiguous.get(name).add(road);
  }
  for(const r of s.rows){const a=bindings.get(r[at('autoroute_entree')]+'|'+r[at('nom_entree')]),b=bindings.get(r[at('autoroute_sortie')]+'|'+r[at('nom_sortie')]);
   if(a==null||b==null||a===b||stations[a].name===stations[b].name)continue;
   rows.push([a,b,r[at('classe1')],r[at('classe2')],sourceIndex]);
  }
 }
 return {schemaVersion:1,scope:'Directed source prices for already positioned, strictly bound stations; no route completeness certificate',ministrySource:base.ministrySource||'data/gares-peage-officiel.json',sources,stations,
  rows:rows.filter(r=>ambiguous.get(stations[r[0]].name).size===1&&ambiguous.get(stations[r[1]].name).size===1)};
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const result=build(read('peages-aprr.json'),read('peages-overlay.json'),read('data/gares-peage-officiel.json'),['asf','escota','cofiroute-arcour'].map(id=>read('data/tolls/official/'+id+'.json')));
 fs.writeFileSync(path.join(root,'data/tolls/route-prices.json'),JSON.stringify(result)+'\n');
 console.log(JSON.stringify({stations:result.stations.length,directedRows:result.rows.length,sources:result.sources.map(s=>s.id)}));
}
module.exports={build};
