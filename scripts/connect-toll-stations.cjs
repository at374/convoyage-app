// Offline join of existing tariff labels to the checked-in ministry station data.
// No fuzzy matching, geocoding, network requests, tariff changes or uncertainty removal.
const fs=require('node:fs'),path=require('node:path');
const normalize=name=>String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function candidates(base,overlay,ministry,aliases=[]){
 const known=new Set([...base.g.map(g=>normalize(g[0])),...overlay.gares.map(g=>normalize(g.nom))]);
 const labels=new Map();
 for(const q of overlay.paires)for(const name of q.slice(0,2)){
  const k=normalize(name);if(known.has(k))continue;
  if(!labels.has(k))labels.set(k,new Set());labels.get(k).add(name);
 }
 const official=new Map();
 for(const row of ministry.d){const k=normalize(row[0]);if(!official.has(k))official.set(k,[]);official.get(k).push(row);}
 const additions=[];
 for(const [k,names]of labels){
  // Distinct tariff labels with the same spelling key remain ambiguous.
  if(names.size!==1)continue;
  const name=[...names][0],alias=aliases.find(a=>a.tariffName===name);
  let rows=official.get(k);
  if(!rows&&alias){
   rows=ministry.d.filter(r=>alias.officialNames.includes(r[0])&&alias.routes.includes(r[1]));
   if(!alias.officialNames.every(n=>rows.some(r=>r[0]===n)))continue;
  }
  if(!rows?.length)continue;
  const points=[];
  if(rows.some(r=>!Number.isFinite(r[2])||!Number.isFinite(r[3])||r[2]<41||r[2]>52||r[3]<-6||r[3]>10))continue;
  for(const r of rows)if(!points.some(p=>p[0]===r[2]&&p[1]===r[3]))points.push([r[2],r[3]]);
  // Reject distant homonyms. Adjacent lanes of one station may be grouped.
  const [lat,lon]=points[0];
  if(points.some(p=>Math.hypot((p[0]-lat)*111,(p[1]-lon)*111*Math.cos(lat*Math.PI/180))>1))continue;
  additions.push({nom:name,points,...(alias?.barrierId?{barrierId:alias.barrierId}:{}),provenance:{source:'https://www.data.gouv.fr/datasets/gares-de-peage-du-reseau-routier-national-concede',local:'data/gares-peage-officiel.json',officialNames:[...new Set(rows.map(r=>r[0]))],routes:[...new Set(rows.map(r=>r[1]))],match:alias?'reviewed-name-and-road-alias; clustered-within-1km':'unique-normalized-name; clustered-within-1km',...(alias?{aliases:'data/toll-station-aliases.json'}:{}),crossingConfirmed:false}});
 }
 return additions.sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const base=read('peages-aprr.json'),overlay=read('peages-overlay.json'),ministry=read('data/gares-peage-officiel.json');
 const additions=candidates(base,overlay,ministry,read('data/toll-station-aliases.json').aliases);
 if(process.argv.includes('--write')){
  overlay.gares.push(...additions);
  fs.writeFileSync(path.join(root,'peages-overlay.json'),JSON.stringify(overlay)+'\n');
 }
 console.log(JSON.stringify({added:process.argv.includes('--write'),count:additions.length,stations:additions.map(x=>({name:x.nom,points:x.points.length,routes:x.provenance.routes}))},null,2));
}
module.exports={candidates,normalize};
