const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'routes-ui.js'), 'utf8');
const fixture = require('./fixtures/tolls-saint-vulbas-la-ciotat-2026-10-31.json');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const exposed = source.replace('  let rafale = false;', '  window.audit={portiquesCandidats,appliquerPositionsVerifiees,routeDatee,dateTarifDepart,chargerTarifsOfficiels,attacherTarifsOfficiels,prixOfficiel,indexGares,garesFixes,tarifsEnConflit,conflitsDuTrace,calculPeage,chargerPeages,prixExact,garesManquantes,barrieresTraversees,dec6,CODE_WORKER,estimerPeage};let rafale = false;');
function load() {
  const ctx = {window:{CPPeage:require('../peage-engine.js')},document:{documentElement:{},body:{offsetHeight:0}},MutationObserver:class{observe(){}},performance:{now:()=>0},AbortController,setInterval:()=>0,
    setTimeout:(fn,ms)=>ms<10?setTimeout(fn,ms):0,clearTimeout,URL,
    fetch:async url=>({ok:true,json:async()=>read(new URL(String(url),'https://test.local/').pathname.slice(1))})};
  vm.createContext(ctx); vm.runInContext(exposed,ctx);
  assert.ok(ctx.window.audit,'test seam must match actual closure');
  return {api:ctx.window.audit,ctx};
}
const plain = value => JSON.parse(JSON.stringify(value));
test('indicative gantry proximity respects segments, sampling gaps, windows and source status',()=>{
 const {api}=load(),s=read('data/tolls/reviewed/free-flow-gantries-2025.json'),g=s.records.find(g=>g.nom==='Portique flux libre Le Montet Ouest'),p=g.point;
 const o={candidatSource:s.source,candidats:[g]},sh=[[p[0]-.002,p[1]],[p[0]+.002,p[1]]];
 assert.deepEqual(plain(api.portiquesCandidats(o,sh,0,1)),[g]);
 assert.deepEqual(plain(api.portiquesCandidats(o,sh.slice().reverse(),0,1)),[g]);
 assert.equal(api.portiquesCandidats(o,[[p[0]-.02,p[1]],[p[0]+.02,p[1]]],0,1).length,0);
 assert.equal(api.portiquesCandidats(o,sh.map(q=>[q[0],q[1]+.005]),0,1).length,0);
 assert.equal(api.portiquesCandidats(o,[p,...sh.map(q=>[q[0],q[1]+.005])],1,2).length,0);
 assert.equal(api.portiquesCandidats({...o,candidatSource:{...s.source,officialSurvey:true}},sh,0,1).length,0);
 assert.equal(api.portiquesCandidats(null,sh,0,1).length,0);
 assert.equal(api.portiquesCandidats({...o,candidats:[{...g,point:[NaN,3]}]},sh,0,1).length,0);
});
test('unpriced A79 component names its indicative gantry without quoting a total or certifying passage',async()=>{
 const {api,ctx}=load(),s=read('data/tolls/reviewed/free-flow-gantries-2025.json'),p=s.records.find(g=>g.nom==='Portique flux libre Le Montet Ouest').point;
 const sh=[[p[0]-.0006,p[1]],p,[p[0]+.0006,p[1]]],tms=[{begin_shape_index:0,end_shape_index:2,toll:true,length:.2}];
 const key=[...sh[0],...sh[2]].map(n=>Number(n).toFixed(3)).join('|');
 ctx.window.CPValP={[key]:Promise.resolve({trip:{legs:[{shape:encode6(sh),maneuvers:tms}]}})};
 let html='';const zone={set innerHTML(s){html=s;},closest:()=>({classList:{add(){}}})};
 await api.estimerPeage({pts:sh.map(p=>[p[1],p[0]])},{querySelector:()=>zone});
 assert.match(html,/Repères de péage à vérifier/);assert.match(html,/Le Montet Ouest/);assert.match(html,/2025-10-25/);assert.match(html,/Maxime Lopes/);
 assert.match(html,/ne confirme ni le passage ni son prix/);assert.match(html,/Aucun total partiel/);assert.doesNotMatch(html,/Classe 1|Classe 2|Aucun péage/);
 // A straight Google fallback is not a provider road trace for this diagnostic.
 ctx.window.CPValP={[key]:Promise.resolve({trip:{legs:[]}})};
 const fetchBase=ctx.fetch;ctx.fetch=async url=>String(url).includes('valhalla1.openstreetmap.de')?{ok:true,json:async()=>({trip:{legs:[]}})}:fetchBase(url);
 await api.estimerPeage({pts:sh.map(p=>[p[1],p[0]])},{querySelector:()=>zone});assert.doesNotMatch(html,/Repères de péage à vérifier/);
});
function route(api) {
  const sh=api.dec6(fixture.shape), tms=fixture.maneuvers.filter(m=>m.toll);
  return {sh,tms,i0:tms[0].begin_shape_index,i1:tms.at(-1).end_shape_index};
}
test('station resolver accepts unique spelling variants, preserves qualifiers and rejects ambiguity',()=>{
  const {api}=load(), ix=api.indexGares([['Saint-Étienne A7'],['ST ETIENNE A8'],['La Boisse'],['LA-BOISSE']]);
  assert.equal(ix('SAINT ETIENNE A7'),0);
  assert.equal(ix('Saint Etienne A8'),-1);
  assert.equal(ix('la boisse'),-1);
  assert.equal(ix('La Boisse'),2);
  assert.equal(ix('LA-BOISSE'),3);
  assert.equal(ix(''),-1);
});
test('real overlay prices are loaded for normalized names without replacing original rates',async()=>{
  const {api}=load(), p=await api.chargerPeages(), base=read('peages-aprr.json'), overlay=read('peages-overlay.json');
  const ix=api.indexGares(p.g), originals=new Map();
  for(const s of base.p.split(';')) {const [a,b,c1,c2,d]=s.split(','),x=parseInt(a,36),y=parseInt(b,36); originals.set(Math.min(x,y)*1000+Math.max(x,y),[c1/10,c2/10,Number(d)]);}
  for(const [k,v] of originals) assert.deepEqual(plain(p.prix.get(k)),v);
  let recovered=0;
  for(const q of overlay.paires){const x=ix(q[0]),y=ix(q[1]);if(x<0||y<0)continue; const k=Math.min(x,y)*1000+Math.max(x,y); assert.ok(p.prix.has(k));if(!originals.has(k)&&(!p.g.some(g=>g[0]===q[0])||!p.g.some(g=>g[0]===q[1])))recovered++;}
  assert.ok(recovered>0,'normalization must recover actual previously skipped tariff rows');
});
test('La Cotiere on A42 is not the La Boisse open-system barrier on A432',()=>{
  const {api}=load(), o={b:read('peages-overlay.json').barrieres}, id='aprr-area-ouvert-boisse-systeme-ouvert';
  assert.equal(api.barrieresTraversees(o,[[45.83411,5.03244]],0,0).some(b=>b.id===id),false);
  assert.equal(api.barrieresTraversees(o,[[45.82868,5.03099]],0,0).some(b=>b.id===id),true);
  const {sh,i0,i1}=route(api);
  assert.equal(api.barrieresTraversees(o,sh,i0,i1).some(b=>b.id===id),false);
});
test('public Saint-Vulbas / La Ciotat trace exposes unresolved southern sections and refuses partial total',async()=>{
  const {api}=load(),p=await api.chargerPeages(),{sh,tms,i0,i1}=route(api);
  const missing=plain(api.garesManquantes(sh,i0,i1));
  assert.ok(missing.includes('La Ciotat BPV'));
  assert.ok(missing.includes('La Barque BPV'));
  assert.equal(api.prixExact(p,sh,tms,fixture.summary.length),null);
});
test('actual generated worker matches direct loader and unresolved-station diagnostics',async()=>{
  const {api,ctx}=load(),{sh,tms,i0,i1}=route(api),p=await api.chargerPeages(); let reply;
  const worker={AbortController,setTimeout,clearTimeout,fetch:ctx.fetch,postMessage:v=>{reply=v;}};
  vm.createContext(worker); vm.runInContext(api.CODE_WORKER(),worker);
  await worker.onmessage({data:{id:7,base:'https://test.local/',sh,tms,i0,i1}});
  assert.equal(reply.err,undefined);
  assert.equal(reply.x,null);
  assert.deepEqual(plain(reply.missing),plain(api.garesManquantes(sh,i0,i1)));
  assert.deepEqual(plain(reply.conflicts),plain(api.conflitsDuTrace(p,sh,i0,i1)));
  assert.deepEqual(plain(vm.runInContext('[...P.conflits]',worker)),plain([...p.conflits]));
  assert.deepEqual(plain(vm.runInContext('[...P.prix]',worker)),plain([...p.prix]));
  assert.deepEqual(plain(vm.runInContext('P.g',worker)),plain(p.g));
});
test('rendered toll explanation names missing sections without claiming a total',async()=>{
  const {api,ctx}=load(),{sh}=route(api),a=sh[0],b=sh.at(-1);
  ctx.window.CPValP={[ [...a,...b].map(n=>Number(n).toFixed(3)).join('|') ]:Promise.resolve({trip:{legs:[fixture]}})};
  let html='',state;
  const zone={set innerHTML(s){html=s;},closest:()=>({classList:{add:s=>{state=s;}}})};
  await api.estimerPeage({pts:[[a[1],a[0]],[b[1],b[0]]]}, {querySelector:()=>zone});
  assert.match(html,/La Ciotat BPV/);
  assert.match(html,/Aucun total partiel/);
  assert.doesNotMatch(html,/Aprr Area Ouvert Boisse|Classe 1|rd gros/);
  assert.equal(state,'bkRenKo');
});
test('ministry join preserves uncertainty, rejects distant homonyms and is idempotent',()=>{
  const {candidates}=require('../scripts/connect-toll-stations.cjs');
  const base={g:[]},o={gares:[],paires:[['TEST','OTHER',1,2,10]]};
  assert.equal(candidates(base,o,{d:[['Test','A1',48,2],['TEST','A2',49,3]]}).length,0);
  assert.equal(candidates(base,o,{d:[['Test','A1',null,2]]}).length,0);
  const small={d:[['Test','A1',48,2],['Test','A1',48.0001,2.0001]]};
  const added=candidates(base,o,small);assert.equal(added.length,1);
  assert.equal(added[0].provenance.crossingConfirmed,false);
  assert.equal(candidates(base,{...o,gares:added},small).length,0);
  assert.equal(candidates(read('peages-aprr.json'),read('peages-overlay.json'),read('data/gares-peage-officiel.json')).length,0);
});
test('all 13 connected stations retain exact ministry coordinates and stored tariff references',async()=>{
  const o=read('peages-overlay.json'),m=read('data/gares-peage-officiel.json'),{api}=load(),p=await api.chargerPeages(),ix=api.indexGares(p.g);
  const added=o.gares.filter(g=>g.provenance?.match==='unique-normalized-name; clustered-within-1km');
  assert.equal(added.length,13);
  for(const g of added){
    assert.ok(ix(g.nom)>=0);
    assert.equal(g.provenance.crossingConfirmed,false);
    for(const point of (g.provenance.ministryPoints||g.points))assert.ok(m.d.some(r=>r[2]===point[0]&&r[3]===point[1]&&g.provenance.officialNames.includes(r[0])));
    assert.ok(o.paires.some(q=>q.slice(0,2).includes(g.nom)),'station must retain a stored tariff: '+g.nom);
  }
  // Merely adding Cassis coordinates cannot override the unresolved route guard.
  const {sh,tms}=route(api);assert.equal(api.prixExact(p,sh,tms,fixture.summary.length),null);
});
test('reviewed aliases require all expected names on the specified road',()=>{
  const {candidates}=require('../scripts/connect-toll-stations.cjs');
  const base={g:[]},overlay={gares:[],paires:[['BONNEVILLE EST','OTHER',1,2,10]]};
  const alias={tariffName:'BONNEVILLE EST',officialNames:['Bonneville Est Entrée','Bonneville Est Sortie'],routes:['A40']};
  const rows=[['Bonneville Est Entrée','A40',46.07,6.425],['Bonneville Est Sortie','A40',46.0701,6.4251]];
  assert.equal(candidates(base,overlay,{d:rows},[alias]).length,1);
  assert.equal(candidates(base,overlay,{d:rows.slice(0,1)},[alias]).length,0);
  assert.equal(candidates(base,overlay,{d:rows},[{...alias,routes:['A41']}]).length,0);
  assert.equal(candidates(base,overlay,{d:rows},[{...alias,tariffName:'BONNEVILLE OUEST'}]).length,0);
});
test('reviewed aliases reproduce 7 stations from the ministry and retain Bonneville Est/Ouest distinction',async()=>{
  const {candidates}=require('../scripts/connect-toll-stations.cjs'),o=read('peages-overlay.json'),base=read('peages-aprr.json'),m=read('data/gares-peage-officiel.json'),aliases=read('data/toll-station-aliases.json').aliases;
  const existing=o.gares.filter(g=>g.provenance?.aliases==='data/toll-station-aliases.json');
  assert.equal(existing.length,7);
  const regenerated=candidates(base,{...o,gares:o.gares.filter(g=>!existing.includes(g))},m,aliases);
  assert.deepEqual(regenerated,existing);
  assert.equal(candidates(base,o,m,aliases).length,0);
  const {api}=load(),p=await api.chargerPeages(),ix=api.indexGares(p.g),a=ix('BONNEVILLE EST'),b=ix('SCIENTRIER');
  assert.ok(a>=0);assert.notEqual(a,ix('BONNEVILLE OUEST'));
  // Scientrier is a tariff boundary without a verified station position here.
  // Locating Bonneville must not invent that missing endpoint.
  assert.equal(b,-1);
  assert.deepEqual(o.paires.find(q=>q[0]==='BONNEVILLE EST'&&q[1]==='SCIENTRIER'),['BONNEVILLE EST','SCIENTRIER',1.7,3.1,12]);
});
test('only explicit fixed-barrier links at identical coordinates exclude ticket stations',()=>{
  const {api}=load(),g=[['Gate',[[46,6]]]],o={gares:[{nom:'Gate',points:[[46,6]],barrierId:'fixed'}],barrieres:[{id:'fixed',points:[[46,6]]}]};
  assert.deepEqual([...api.garesFixes(g,o)],[0]);
  assert.equal(api.garesFixes(g,{...o,barrieres:[]}).size,0);
  assert.equal(api.garesFixes(g,{...o,gares:[{...o.gares[0],barrierId:'other'}]}).size,0);
  assert.equal(api.garesFixes([['Gate',[[46.0001,6]]]],o).size,0);
});
function encode6(points){let lat=0,lon=0,text='';const put=n=>{let v=n<0?~(n<<1):n<<1;while(v>=32){text+=String.fromCharCode((32|(v&31))+63);v>>=5;}text+=String.fromCharCode(v+63);};for(const p of points){const a=Math.round(p[0]*1e6),b=Math.round(p[1]*1e6);put(a-lat);put(b-lon);lat=a;lon=b;}return text;}
test('Saint Exupery A432 fixed gate is not also treated as an unexplained ticket station',async()=>{
 const {api}=load(),o=read('peages-overlay.json'),point=o.barrieres.find(b=>b.id==='aprr-area-ouvert-saint-exupery').points[0];
 const gate=o.gares.find(g=>g.nom==='SAINT EXUPERY'),ministry=read('data/gares-peage-officiel.json');
 assert.equal(gate.provenance.sourceStationCode,'03070');
 assert.deepEqual(gate.points,ministry.d.filter(r=>r[0]==='Saint Exupery'&&r[1]==='A0432').map(r=>[r[2],r[3]]));
 const p=await api.chargerPeages(),ix=api.indexGares(p.g);
 assert.ok(p.verifiedGatePositions.has(ix('SAINT EXUPERY')));
 for(const name of ['LA BOISSE','LA COTIERE'])assert.equal(p.fixes.has(ix(name)),false);
 const sh=[[point[0]-.0006,point[1]],point,[point[0]+.0006,point[1]]],tms=[{begin_shape_index:0,end_shape_index:2,toll:true,length:.2}];
 const r=await api.calculPeage(sh,tms,.2,false,'2026-11-02');
 assert.equal(r.n,0);assert.equal(r.x,null);
});
for(const [name,barrierId,c1,c2]of [['BONNEVILLE EST','atmb-bonneville-zi',1.7,3.1],['BONNEVILLE OUEST','atmb-bonneville-centre',1.3,2.3],['SAINT EXUPERY','aprr-area-ouvert-saint-exupery',2.3,3.6]]){
 test(name+' single-gate component renders its existing fixed tariffs, direct and actual worker agree',async()=>{
  const {api,ctx}=load(),p=await api.chargerPeages(),o=read('peages-overlay.json'),g=o.gares.find(g=>g.nom===name),point=g.points[0];
  assert.ok(p.fixes.has(api.indexGares(p.g)(name)));
  // Synthetic component trace at surveyed gate, not a public-road itinerary or mission.
  const sh=[[point[0]-.0006,point[1]],point,[point[0]+.0006,point[1]]],tms=[{begin_shape_index:0,end_shape_index:2,toll:true,length:0.2}];
  const r=await api.calculPeage(sh,tms,0.2,false);assert.equal(r.n,0);assert.equal(r.x,null);assert.deepEqual(plain(r.missing),[]);
  let reply;const wk={AbortController,setTimeout,clearTimeout,fetch:ctx.fetch,postMessage:v=>{reply=v;}};vm.createContext(wk);vm.runInContext(api.CODE_WORKER(),wk);
  await wk.onmessage({data:{id:4,sh,tms,i0:0,i1:2,base:'https://test.local/'}});
  assert.equal(reply.err,undefined);assert.equal(reply.n,0);assert.deepEqual(plain(vm.runInContext('[...P.fixes]',wk)),plain([...p.fixes]));
  assert.deepEqual(plain(api.barrieresTraversees({b:o.barrieres},sh,0,2).map(b=>b.id)),[barrierId]);
  const key=[...sh[0],...sh[2]].map(n=>Number(n).toFixed(3)).join('|');
  ctx.window.CPValP={[key]:Promise.resolve({trip:{legs:[{shape:encode6(sh),maneuvers:tms}]}})};
  let html='',state;const zone={set innerHTML(s){html=s;},closest:()=>({classList:{add:s=>{state=s;}}})};
  await api.estimerPeage({pts:sh.map(p=>[p[1],p[0]])},{querySelector:()=>zone});
  assert.match(html,/Classe 1/);assert.match(html,/Classe 2/);assert.match(html,new RegExp(c1.toFixed(2).replace('.',',')));assert.match(html,new RegExp(c2.toFixed(2).replace('.',',')));
  assert.doesNotMatch(html,/Prix exact non disponible|Aucun péage/);assert.equal(state,'bkRenOk');
 });
}
test('merged southern station names stay unique and retain precise ministry points',async()=>{
 const {normalize}=require('../scripts/connect-toll-stations.cjs'),{api}=load(),p=await api.chargerPeages(),ix=api.indexGares(p.g),o=read('peages-overlay.json');
 for(const name of ['CASSIS','CARNOULES','CAGNES EST']){
  const matches=p.g.filter(g=>normalize(g[0])===normalize(name));assert.equal(matches.length,1,name);
  assert.ok(ix(name)>=0);const data=o.gares.find(g=>normalize(g.nom)===normalize(name));
  assert.ok(data.provenance.ministryPoints.every(point=>data.points.some(p=>p[0]===point[0]&&p[1]===point[1])));
 }
});
test('recorded public Bonneville / Annemasse trace uses fixed gates without inventing Scientrier',async()=>{
 const f=require('./fixtures/tolls-bonneville-annemasse-2026-11-01.json'),{api}=load(),sh=api.dec6(f.shape),tms=f.maneuvers.filter(m=>m.toll);
 const result=await api.calculPeage(sh,tms,f.summary.length,false);
 assert.equal(result.n,0);assert.equal(result.x,null);assert.deepEqual(plain(result.missing),[]);
 const o=read('peages-overlay.json'),bars=api.barrieresTraversees({b:o.barrieres},sh,tms[0].begin_shape_index,tms.at(-1).end_shape_index);
 assert.deepEqual(plain(bars.map(b=>b.id)),['atmb-bonneville-centre','atmb-nangy']);
 const p=await api.chargerPeages();assert.equal(api.indexGares(p.g)('SCIENTRIER'),-1);
 assert.equal(f.summary.length,23.371);
});
test('conflicting spellings and class-2 prices cannot silently win by loading order',()=>{
 const {api}=load(),gares=[['Alpha',[[48,2.5]]],['Bêta',[[48,2.52]]]],base=new Map([[1,[1,2,2]]]);
 assert.equal(api.tarifsEnConflit(gares,base,[['ALPHA','BETA',1,2,2]]).size,0);
 assert.deepEqual([...api.tarifsEnConflit(gares,base,[['ALPHA','BETA',1,3,2]])],[1]);
 const rows=[['Alpha','Bêta',1,2,2],['ALPHA','BETA',4,5,2]];
 assert.deepEqual([...api.tarifsEnConflit(gares,new Map(),rows)],[1]);
 assert.deepEqual([...api.tarifsEnConflit(gares,new Map(),[...rows].reverse())],[1]);
 assert.deepEqual(base.get(1),[1,2,2]);
 assert.deepEqual([...api.tarifsEnConflit(gares,new Map(),[['Alpha','Bêta',null,2,2]])],[1]);
});
test('a disputed pair is refused while an independent coherent route remains priced',()=>{
 const {api}=load(),g=[['Alpha',[[48,2.5]]],['Beta',[[48,2.52]]],['Gamma',[[48.1,2.5]]],['Delta',[[48.1,2.52]]]],prix=new Map([[1,[1,2,2]],[2003,[3,4,2]]]);
 const p={g,prix},tms=[{begin_shape_index:0,end_shape_index:1}];
 assert.equal(api.prixExact(p,[g[0][1][0],g[1][1][0]],tms,2).c1,1);
 p.conflits=api.tarifsEnConflit(g,prix,[['ALPHA','BETA',2,2,2]]);
 assert.equal(api.prixExact(p,[g[0][1][0],g[1][1][0]],tms,2),null);
 assert.equal(api.prixExact(p,[g[2][1][0],g[3][1][0]],tms,2).c1,3);
 assert.deepEqual(plain(api.conflitsDuTrace(p,[g[0][1][0],g[1][1][0]],0,1)),['Alpha → Beta']);
 assert.deepEqual(plain(api.conflitsDuTrace(p,[g[2][1][0],g[3][1][0]],0,1)),[]);
});
test('stored La Saulce / La Ciotat contradictions are exposed without replacing either source',async()=>{
 const {api}=load(),p=await api.chargerPeages(),o=read('peages-overlay.json'),ix=api.indexGares(p.g),a=ix('LA SAULCE'),b=ix('LA CIOTAT');
 assert.ok(a>=0&&b>=0);
 assert.ok(p.conflits.has(Math.min(a,b)*1000+Math.max(a,b)));
 assert.ok(o.paires.some(q=>q[0]==='La Ciotat'&&q[1]==='La Saulce'&&q[2]===20&&q[3]===28.6));
 assert.ok(o.paires.some(q=>q[0]==='LA SAULCE'&&q[1]==='LA CIOTAT'&&q[2]===18.6&&q[3]===26.4));
});
test('the renderer explains a tariff contradiction and never presents the first price as exact',async()=>{
 const f=require('./fixtures/tolls-conflicting-fares.json'),{api,ctx}=load();
 ctx.fetch=async url=>({ok:true,json:async()=>plain(String(url).includes('peages-aprr.json')?f.base:f.overlay)});
 const sh=api.dec6(f.leg.shape),key=[...sh[0],...sh.at(-1)].map(n=>Number(n).toFixed(3)).join('|');
 ctx.window.CPValP={[key]:Promise.resolve({trip:{legs:[f.leg]}})};
 let html='',state;const zone={set innerHTML(s){html=s;},closest:()=>({classList:{add:s=>{state=s;}}})};
 await api.estimerPeage({pts:sh.map(p=>[p[1],p[0]])},{querySelector:()=>zone});
 assert.match(html,/Tarifs contradictoires/);assert.match(html,/Alpha → Beta/);
 assert.doesNotMatch(html,/Classe 1|Classe 2|Aucun péage/);assert.equal(state,'bkRenKo');
});
function pendingCatalogue(ctx){
 const f=require('./fixtures/tolls-conflicting-fares.json');let release,entered;
 const waiting=new Promise(ok=>{release=ok;}),started=new Promise(ok=>{entered=ok;}),calls={base:0,overlay:0};
 ctx.fetch=async url=>({ok:!String(url).includes('route-prices.json'),json:async()=>{
  if(String(url).includes('peages-aprr.json')){calls.base++;return plain(f.base);}
  calls.overlay++;entered();await waiting;return plain(f.overlay);
 }});
 return {f,calls,release,started};
}
test('concurrent direct requests await the complete checked catalogue and share one download',async()=>{
 const {api,ctx}=load(),gate=pendingCatalogue(ctx);let secondResolved=false;
 const first=api.chargerPeages();await gate.started;
 const second=api.chargerPeages().then(p=>{secondResolved=true;return p;});
 try{await Promise.resolve();await Promise.resolve();assert.equal(secondResolved,false);}
 finally{gate.release();}
 const [a,b]=await Promise.all([first,second]);assert.equal(a,b);assert.ok(a.conflits.has(1));
 assert.deepEqual(gate.calls,{base:1,overlay:1});assert.equal(await api.chargerPeages(),a);
 assert.deepEqual(gate.calls,{base:1,overlay:1});
});
test('concurrent actual worker messages share the fully checked catalogue',async()=>{
 const {api,ctx}=load(),gate=pendingCatalogue(ctx),replies=[];
 const worker={fetch:(...args)=>ctx.fetch(...args),postMessage:r=>replies.push(r)};vm.createContext(worker);vm.runInContext(api.CODE_WORKER(),worker);
 const sh=api.dec6(gate.f.leg.shape),data={base:'https://test.local/',sh,tms:gate.f.leg.maneuvers,i0:0,i1:1};
 const first=worker.onmessage({data:{...data,id:1}});await gate.started;
 const second=worker.onmessage({data:{...data,id:2}});
 try{await Promise.resolve();await Promise.resolve();assert.equal(replies.length,0);}
 finally{gate.release();}
 await Promise.all([first,second]);assert.deepEqual(gate.calls,{base:1,overlay:1});
 assert.equal(replies.length,2);
 for(const r of replies){assert.equal(r.err,undefined);assert.equal(r.x,null);assert.deepEqual(plain(r.conflicts),['Alpha → Beta']);}
});
test('failed base downloads can be retried by both direct and worker loaders',async()=>{
 for(const useWorker of [false,true]){
  const {api,ctx}=load(),f=require('./fixtures/tolls-conflicting-fares.json');let fail=true;
  ctx.fetch=async url=>{if(fail){fail=false;throw new Error('fixture network failure');}return{ok:true,json:async()=>plain(String(url).includes('peages-aprr.json')?f.base:f.overlay)};};
  if(!useWorker){await assert.rejects(api.chargerPeages(),/fixture network failure/);assert.ok((await api.chargerPeages()).conflits.has(1));}
  else{
   const replies=[],worker={fetch:(...args)=>ctx.fetch(...args),postMessage:r=>replies.push(r)};vm.createContext(worker);vm.runInContext(api.CODE_WORKER(),worker);
   const data={base:'https://test.local/',sh:api.dec6(f.leg.shape),tms:f.leg.maneuvers,i0:0,i1:1};
   await worker.onmessage({data:{...data,id:1}});assert.match(replies[0].err,/fixture network failure/);
   await worker.onmessage({data:{...data,id:2}});assert.equal(replies[1].err,undefined);assert.deepEqual(plain(replies[1].conflicts),['Alpha → Beta']);
  }
 }
});

test('four recovered SAPN prices retain their official source and unknown distance',async()=>{
 const {api}=load(),p=await api.chargerPeages(),ix=api.indexGares(p.g),o=read('peages-overlay.json'),report=read('docs/validation-sapn-a131-2026-11-01.json');
 const expected=[['INCARVILLE N°19',5.8,9.4],['HEUDEBOUVILLE N°18',5.9,9.4],['CHAUFOUR N°15 À GAILLON N°17',7.9,12.6],['POISSY/ORGEVAL N°7 À MANTES-SUD N°12',10.9,17.5]];
 assert.equal(report.status,'official-extract-column-verified');assert.equal(report.routeVerified,false);
 for(const [name,c1,c2]of expected){
  const a=ix(name),b=ix('TANCARVILLE (A131)');assert.ok(a>=0&&b>=0,name);
  const key=Math.min(a,b)*1000+Math.max(a,b);assert.deepEqual(plain(p.prix.get(key)),[c1,c2,null]);
  assert.equal(p.conflits.has(key),false);
  const proof=o.paires_preuves.find(r=>r.entree===name&&r.sortie==='TANCARVILLE (A131)');
  assert.equal(proof.source_extract_sha256,report.sourceExtractSha256);assert.equal(proof.route_verified,false);
  assert.equal(proof.distance_tarifaire_km,null);assert.deepEqual(proof.source_pages,[2,3]);
 }
});
test('an official amount without a checked distance cannot fabricate a complete route',()=>{
 const {api}=load(),p={g:[['A',[[48,2.5]]],['B',[[48,2.52]]]],prix:new Map([[1,[5.8,9.4,null]]])};
 assert.equal(api.prixExact(p,[[48,2.5],[48,2.52]],[{begin_shape_index:0,end_shape_index:1}],2),null);
});


test('uninterpreted tariff conditions cannot become unconditional exact prices',()=>{
  const {contexteApplique,creerMoteur}=require('../peage-engine.js');
  for(const ctx of ['09h-15h29 semaine', '', false, [], {}, {direction:'FR-IT'}, {periode:'01/01-31/12',heure:'09:00'}]){
    assert.equal(contexteApplique(ctx,'2026-11-01'),false,JSON.stringify(ctx));
    const m=creerMoteur({versions:[{id:'conditional',barrier_station_id:'x',vehicle_class:1,
      amount_eur:4.4,status:'PROUVE',effective_from:'2026-01-01',tariff_context:ctx}]});
    assert.equal(m.barriere('x',1,'2026-11-01').amount,null);
  }
  assert.equal(contexteApplique(null,'2026-11-01'),true);
  assert.equal(contexteApplique({periode:'invalid'},'2026-11-01'),false);
});
test('both Millau station identities use official seasonal fares at every boundary',()=>{
  const {creerMoteur}=require('../peage-engine.js'),j=read('peages-overlay.json');
  const versions=j.tarifs.map(t=>({id:t.id,barrier_station_id:t.b,vehicle_class:t.c,amount_eur:t.a,
    status:t.s,effective_from:t.f,tariff_context:t.k??null}));
  const m=creerMoteur({versions});
  for(const id of ['cevm-saint-germain','viaduc-millau'])
    for(const [date,prices] of [['2026-06-14',[11.3,17]],['2026-06-15',[13.8,20.7]],
      ['2026-09-15',[13.8,20.7]],['2026-09-16',[11.3,17]],['2026-12-31',[11.3,17]],['2027-01-01',[11.3,17]]])
      for(const c of [1,2]) assert.equal(m.barriere(id,c,date).amount,prices[c-1],id+' '+date+' classe '+c);
});
test('ARCOS prose schedules remain stored but cannot assert a date-only exact price',()=>{
  const {creerMoteur}=require('../peage-engine.js'),j=read('peages-overlay.json');
  const versions=j.tarifs.filter(t=>t.b?.startsWith('arcos-')).map(t=>({id:t.id,
    barrier_station_id:t.b,vehicle_class:t.c,amount_eur:t.a,status:t.s,effective_from:t.f,tariff_context:t.k}));
  assert.equal(versions.length,4);
  const m=creerMoteur({versions});
  for(const id of ['arcos-ittenheim-barriere','arcos-ittenheim-gare-laterale'])
    for(const c of [1,2]) assert.equal(m.barriere(id,c,'2026-11-01').amount,null);
});
function officialCase(){
 const f=read('tests/fixtures/tolls-official-directed-prices.json'),{api,ctx}=load();
 ctx.Date=class extends Date{constructor(...a){super(...(a.length?a:['2026-11-01T12:00:00Z']));}};
 const p={g:f.base.g,prix:new Map([[1,[1,2,2]]])};api.attacherTarifsOfficiels(p,f.official);
 return {api,ctx,p,f,sh:api.dec6(f.leg.shape),tms:f.leg.maneuvers};
}
test('dated directed official prices reach the route calculation without changing legacy amounts',()=>{
 const {api,p,sh,tms}=officialCase();
 const x=api.prixExact(p,sh,tms,2,'2026-11-01');assert.equal(x.c1,3.25);assert.equal(x.c2,5.5);assert.equal(x.sources[0].id,'synthetic-official');
 assert.equal(api.prixExact(p,[...sh].reverse(),tms,2,'2026-11-01').c1,4.25);
 assert.deepEqual(plain(p.prix.get(1)),[1,2,2]);
 p.conflits=new Set([1]);assert.equal(api.prixExact(p,sh,tms,2,'2026-11-01'),null);
});
test('stale, future, unavailable or contradictory official records cannot silently fall back to an old fare',()=>{
 for(const change of [j=>{j.sources[0].checkedOn='2026-10-01';},j=>{j.sources[0].checkedOn='2026-11-02';},
  j=>{j.rows[0][2]=null;},j=>{j.rows.push([0,1,9,10,0]);},j=>{j.sources[0].url='https://example.com/';}]){
  const {api,p,f,sh,tms}=officialCase();change(f.official);api.attacherTarifsOfficiels(p,f.official);
  assert.equal(api.prixExact(p,sh,tms,2,'2026-11-01'),null);
 }
 const {api,p,sh,tms}=officialCase();
 for(const date of ['2026-01-31','2027-01-01','2026-02-30'])assert.equal(api.prixExact(p,sh,tms,2,date),null);
});
test('station bindings reject changed geometry, distant homonyms and unsupported motorway qualifiers',()=>{
 for(const change of [j=>{j.stations[0].points[0][0]+=.01;},j=>{j.stations[0].road='unknown';},j=>{j.stations[0].name='Alpha A8';}]){
  const {api,p,f}=officialCase();change(f.official);api.attacherTarifsOfficiels(p,f.official);assert.equal(api.prixOfficiel(p,0,1,'2026-11-01'),undefined);
 }
 const {api,p,f}=officialCase();f.official.rows[0][2]='3.25';assert.throws(()=>api.attacherTarifsOfficiels(p,f.official));
});
test('official pricing retains the independent distance and route-completeness guards',()=>{
 const {api,p,sh,tms}=officialCase();p.prix.set(1,[1,2,null]);assert.equal(api.prixExact(p,sh,tms,2,'2026-11-01'),null);
 p.prix.set(1,[1,2,200]);assert.equal(api.prixExact(p,sh,tms,2,'2026-11-01'),null);
});
test('official source loader, actual worker and renderer agree on direction and dated evidence',async()=>{
 const {api,ctx,f,sh,tms}=officialCase();
 ctx.fetch=async url=>({ok:true,json:async()=>plain(String(url).includes('route-prices.json')?f.official:String(url).includes('peages-aprr.json')?f.base:f.overlay)});
 const p=await api.chargerPeages();assert.equal(api.prixExact(p,sh,tms,2,'2026-11-01').c1,3.25);
 let reply;const wk={AbortController,setTimeout,clearTimeout,Date:ctx.Date,fetch:ctx.fetch,postMessage:v=>{reply=v;}};vm.createContext(wk);vm.runInContext(api.CODE_WORKER(),wk);
 await wk.onmessage({data:{id:4,date:'2026-11-01',sh,tms,i0:0,i1:1,base:'https://test.local/'}});
 assert.equal(reply.err,undefined);assert.equal(reply.x.c1,3.25);assert.equal(reply.x.c2,5.5);
 await wk.onmessage({data:{id:5,date:'2027-01-01',sh,tms,i0:0,i1:1,base:'https://test.local/'}});assert.equal(reply.x,null);
 const key=[...sh[0],...sh.at(-1)].map(n=>Number(n).toFixed(3)).join('|');ctx.window.CPValP={[key]:Promise.resolve({trip:{legs:[f.leg]}})};
 let html='';await api.estimerPeage({pts:sh.map(p=>[p[1],p[0]]),dateTarif:'2026-11-01'},{querySelector:()=>({set innerHTML(s){html=s;},closest:()=>null})});
 assert.match(html,/3,25/);assert.match(html,/5,50/);assert.match(html,/synthetic-official/);assert.match(html,/contrôle 2026-11-01/);
});
test('strict source bindings are reproducible and exclude conflicting road identities',()=>{
 const {build}=require('../scripts/build-toll-route-prices.cjs'),f=read('tests/fixtures/tolls-official-directed-prices.json');
 const snapshots=['asf','escota','cofiroute-arcour'].map(id=>read('data/tolls/official/'+id+'.json'));
 assert.deepEqual(build(read('peages-aprr.json'),read('peages-overlay.json'),read('data/gares-peage-officiel.json'),snapshots),read('data/tolls/route-prices.json'));
 const snap={...snapshots[0],headers:['autoroute_entree','nom_entree','autoroute_sortie','nom_sortie','classe1','classe2'],rows:[['A7','Alpha','A8','Beta',1,2]]};
 const m={d:[['Alpha','26A900700CD',48,2.5],['Beta','13A900800CD',48,2.52]]};
 assert.equal(build(f.base,f.overlay,m,[snap]).rows.length,1);
 assert.equal(build({...f.base,g:[...f.base.g,['ALPHA',[[48,2.5]]]]},f.overlay,m,[snap]).rows.length,0);
 assert.equal(build(f.base,f.overlay,{d:m.d.map(r=>[r[0],r[1],r[2]+.1,r[3]])},[snap]).rows.length,0);
 assert.equal(build(f.base,f.overlay,{d:[...m.d,['Alpha','26A900701CD',49,2.5]]},[snap]).rows.length,0);
});
test('an unavailable official index has a bounded wait and cancels its download',async()=>{
 const {api,ctx}=load();let cancelled=false;
 ctx.fetch=async(url,opt)=>{opt.signal.addEventListener('abort',()=>{cancelled=true;});return new Promise(()=>{});};
 ctx.setTimeout=fn=>setTimeout(fn,1);
 await assert.rejects(api.chargerTarifsOfficiels({},'https://test.local/index'),/délai/);
 assert.equal(cancelled,true);
});
test('pickup timestamps select the French tariff day across midnight and both DST boundaries',()=>{
 const {api}=load();
 for(const [stamp,day]of [['2026-06-14T22:30:00Z','2026-06-15'],['2026-09-15T22:30:00Z','2026-09-16'],
  ['2026-11-01T23:30:00Z','2026-11-02'],['2026-03-29T00:30:00Z','2026-03-29'],
  ['2026-03-29T01:30:00Z','2026-03-29'],['2026-10-25T00:30:00Z','2026-10-25'],
  ['2026-10-25T01:30:00Z','2026-10-25'],['2026-06-15T00:30:00.000000+02:00','2026-06-15'],
  ['2026-06-15T00:30','2026-06-15'],['2026-06-15','2026-06-15']])assert.equal(api.dateTarifDepart(stamp),day,stamp);
 for(const bad of ['2026-02-30','2026-02-30T12:00:00Z','2026-06-15T25:00:00Z','next Monday',14])assert.equal(api.dateTarifDepart(bad),null);
 const cached={polyline:'unchanged'},r=api.routeDatee(cached,'2026-06-14T22:30:00Z');
 assert.equal(r.dateTarif,'2026-06-15');assert.equal(cached.dateTarif,undefined);assert.equal(cached.polyline,r.polyline);
});
test('a malformed pickup date refuses a price rather than substituting today',async()=>{
 const {api}=load();let html='';
 await api.estimerPeage({dateTarif:null,pts:[[2.5,48],[2.52,48]]},{querySelector:()=>({set innerHTML(s){html=s;},closest:()=>null})});
 assert.match(html,/Date du trajet invalide/);assert.doesNotMatch(html,/Classe 1|Classe 2|Aucun péage/);
});
test('Tarare Est open-system barrier is priced separately from the closed ticket station',async()=>{
 const {api,ctx}=load(),o=read('peages-overlay.json'),b=o.barrieres.find(b=>b.id==='asf-tarare-est-ouvert'),point=b.points[0];
 const p=await api.chargerPeages(),closed=api.indexGares(p.g)('Tarare Est F');assert.ok(closed>=0);assert.ok(!p.fixes.has(closed));
 const sh=[[point[0]-.0006,point[1]],point,[point[0]+.0006,point[1]]],tms=[{begin_shape_index:0,end_shape_index:2,toll:true,length:.2}];
 const calc=await api.calculPeage(sh,tms,.2,false,'2026-11-01');assert.equal(calc.n,0);assert.equal(calc.x,null);
 const engine=require('../peage-engine.js').creerMoteur({versions:o.tarifs.map(t=>({id:t.id,barrier_station_id:t.b,vehicle_class:t.c,amount_eur:t.a,status:t.s,effective_from:t.f,effective_to:t.t||null}))});
 assert.equal(engine.barriere(b.id,1,'2026-11-01').amount,1.8);assert.equal(engine.barriere(b.id,2,'2026-11-01').amount,2.8);assert.equal(engine.barriere(b.id,1,'2027-01-01').amount,null);
 const proof=o.barrieres_preuves.find(p=>p.barrierId===b.id),source=read('data/tolls/official/asf.json');assert.equal(proof.sourceRawSha256,source.rawSha256);
 assert.deepEqual(proof.publishedClassPrices,[1.8,2.8,5.1,6.8,1]);
 const key=[...sh[0],...sh.at(-1)].map(n=>Number(n).toFixed(3)).join('|');ctx.window.CPValP={[key]:Promise.resolve({trip:{legs:[{shape:encode6(sh),maneuvers:tms}]}})};
 let html='';await api.estimerPeage({pts:sh.map(p=>[p[1],p[0]]),dateTarif:'2026-11-01'},{querySelector:()=>({set innerHTML(s){html=s;},closest:()=>null})});
 assert.match(html,/Tarare Est Ouvert/);assert.match(html,/1,80/);assert.match(html,/2,80/);assert.doesNotMatch(html,/Prix exact non disponible|Aucun péage/);
});
test('nearby station identities with different viable prices never win by catalogue order',()=>{
 const f=read('tests/fixtures/tolls-ambiguous-branches.json'),{api}=load(),g=f.base.g;
 for(const reversed of [false,true])for(const onlyClass2 of [false,true]){
  const prix=new Map([[1,[3,4,2]],[2,[onlyClass2?3:5,6,2]]]),p={g,prix};
  const sh=(reversed?[g[1][1][0],g[0][1][0]]:[g[0][1][0],g[1][1][0]]);
  assert.equal(api.prixExact(p,sh,f.leg.maneuvers,2),null);
  assert.deepEqual(plain(p.ambiguities),['Twin Barrière','Twin Échangeur']);
  assert.deepEqual(plain(prix.get(1)),[3,4,2]);
 }
 const p={g:[g[0],g[2],g[1]],prix:new Map([[1,[5,6,2]],[2,[3,4,2]]])};
 assert.equal(api.prixExact(p,[g[0][1][0],g[1][1][0]],f.leg.maneuvers,2),null);
});
test('equal branch prices remain usable and a later independent calculation clears the warning',()=>{
 const f=read('tests/fixtures/tolls-ambiguous-branches.json'),{api}=load();
 const g=[...f.base.g,['Gamma',[[48.1,2.5]]],['Delta',[[48.1,2.52]]]],p={g,prix:new Map([[1,[3,4,2]],[2,[5,6,2]],[3004,[7,8,2]]])},tms=f.leg.maneuvers;
 assert.equal(api.prixExact(p,[g[0][1][0],g[1][1][0]],tms,2),null);
 assert.equal(api.prixExact(p,[g[3][1][0],g[4][1][0]],tms,2).c1,7);assert.deepEqual(plain(p.ambiguities),[]);
 p.prix.set(2,[3,4,2]);assert.equal(api.prixExact(p,[g[0][1][0],g[1][1][0]],tms,2).c1,3);
 assert.deepEqual(plain(p.ambiguities),[]);
 p.prix.set(2,[9,10,200]);assert.equal(api.prixExact(p,[g[0][1][0],g[1][1][0]],tms,2).c1,3);
});
test('Saint-Michel ministry lane points distinguish barrier and interchange when geometry is clear',async()=>{
 const {api}=load(),p=await api.chargerPeages(),ix=api.indexGares(p.g),a=ix('AITON'),bar=ix('ST MICHEL MAURIENNE BAR'),ech=ix('ST MICHEL MAURIENNE ECH');
 const m=read('data/gares-peage-officiel.json'),o=read('peages-overlay.json');
 assert.ok([a,bar,ech].every(i=>i>=0));assert.notDeepEqual(plain(p.g[bar][1]),plain(p.g[ech][1]));
 for(const i of [bar,ech]){const g=o.gares.find(g=>g.nom===p.g[i][0]);assert.ok(p.verifiedGatePositions.has(i));
  assert.ok(g.points.every(point=>m.d.some(r=>g.provenance.officialNames.includes(r[0])&&g.provenance.routes.includes(r[1])&&r[2]===point[0]&&r[3]===point[1])));}
 const key=b=>Math.min(a,b)*1000+Math.max(a,b),tms=[{begin_shape_index:0,end_shape_index:1}];
 assert.deepEqual(plain(p.prix.get(key(bar)).slice(0,2)),[10.2,15]);assert.deepEqual(plain(p.prix.get(key(ech)).slice(0,2)),[8.2,11.9]);
 // Synthetic endpoint components at source lane points, not public road traces.
 for(const [i,c1,c2]of [[bar,10.2,15],[ech,8.2,11.9]]){
  const result=api.prixExact(p,[p.g[a][1][0],p.g[i][1][0]],tms,60);assert.ok(result,p.g[i][0]);assert.equal(result.c1,c1);assert.equal(result.c2,c2);
 }
 const legacy={g:plain(p.g),prix:p.prix};legacy.g[bar][1]=legacy.g[ech][1]=[[45.219,6.459]];
 assert.equal(api.prixExact(legacy,[legacy.g[a][1][0],legacy.g[bar][1][0]],tms,60),null);
 assert.ok(legacy.ambiguities.includes('ST MICHEL MAURIENNE BAR'));assert.ok(legacy.ambiguities.includes('ST MICHEL MAURIENNE ECH'));
});
test('verified geometry uses line segments and keeps uncertain or unverified near-ties ambiguous',()=>{
 const {api}=load(),g=[['Alpha',[[48,2.5]]],['Mainline',[[48,2.52]]],['Interchange',[[48.00015,2.52]]]],p={g,prix:new Map([[1,[3,4,2]],[2,[5,6,2]]]),verifiedGatePositions:new Set([1,2])};
 const tms=[{begin_shape_index:0,end_shape_index:1}];
 assert.equal(api.prixExact(p,[g[0][1][0],g[1][1][0]],tms,2).c1,3);
 assert.equal(api.prixExact(p,[g[0][1][0],g[2][1][0]],tms,2).c1,5);
 assert.equal(api.prixExact(p,[g[0][1][0],[48.00007,2.52]],tms,2),null);
 const segment=[g[0][1][0],[47.9999,2.52],[48.0001,2.52]];
 assert.equal(api.prixExact(p,segment,[{begin_shape_index:0,end_shape_index:2}],2).c1,3);
 p.verifiedGatePositions.delete(2);assert.equal(api.prixExact(p,[g[0][1][0],g[1][1][0]],tms,2),null);
});
test('coordinate corrections require explicit nearby source positions and clear the spatial cache',()=>{
 const {api}=load(),entry={nom:'Gate',positionOverride:true,points:[[48.0001,2.5]],provenance:{local:'data/gares-peage-officiel.json',officialNames:['Official Gate'],routes:['A0043']}};
 const p={g:[['Gate',[[48,2.5]]]],gi:new Map()};api.appliquerPositionsVerifiees(p,{gares:[entry]});
 assert.deepEqual(plain(p.g[0][1]),entry.points);assert.ok(p.verifiedGatePositions.has(0));assert.equal(p.gi,undefined);
 for(const change of [e=>{e.positionOverride=false;},e=>{e.points=[[49,2.5]];},e=>{e.provenance.local='unknown';}]){
  const e=plain(entry);change(e);const q={g:[['Gate',[[48,2.5]]]]};api.appliquerPositionsVerifiees(q,{gares:[e]});assert.equal(q.verifiedGatePositions.size,0);assert.deepEqual(plain(q.g[0][1]),[[48,2.5]]);
 }
});
test('actual worker and mobile renderer expose branch ambiguity without publishing a total',async()=>{
 const f=read('tests/fixtures/tolls-ambiguous-branches.json'),{api,ctx}=load();
 ctx.fetch=async url=>({ok:!String(url).includes('route-prices.json'),json:async()=>plain(String(url).includes('peages-aprr.json')?f.base:f.overlay)});
 const sh=api.dec6(f.leg.shape),tms=f.leg.maneuvers;
 const direct=await api.calculPeage(sh,tms,2);assert.equal(direct.x,null);assert.deepEqual(plain(direct.ambiguous),['Twin Barrière','Twin Échangeur']);
 let reply;const wk={AbortController,setTimeout,clearTimeout,fetch:ctx.fetch,postMessage:r=>{reply=r;}};vm.createContext(wk);vm.runInContext(api.CODE_WORKER(),wk);
 await wk.onmessage({data:{id:2,sh,tms,i0:0,i1:1,base:'https://test.local/'}});
 assert.equal(reply.err,undefined);assert.equal(reply.x,null);assert.deepEqual(plain(reply.ambiguous),plain(direct.ambiguous));
 const key=[...sh[0],...sh.at(-1)].map(n=>Number(n).toFixed(3)).join('|');ctx.window.CPValP={[key]:Promise.resolve({trip:{legs:[f.leg]}})};
 let html='';await api.estimerPeage({pts:sh.map(p=>[p[1],p[0]])},{querySelector:()=>({set innerHTML(s){html=s;},closest:()=>null})});
 assert.match(html,/Entrée ou branche de péage à confirmer/);assert.match(html,/Twin Barrière/);assert.match(html,/Twin Échangeur/);assert.doesNotMatch(html,/Classe 1|Classe 2|Aucun péage/);
});
