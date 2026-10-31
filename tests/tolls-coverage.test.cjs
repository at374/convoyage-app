const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'routes-ui.js'), 'utf8');
const fixture = require('./fixtures/tolls-saint-vulbas-la-ciotat-2026-10-31.json');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const exposed = source.replace('  let rafale = false;', '  window.audit={indexGares,chargerPeages,prixExact,garesManquantes,barrieresTraversees,dec6,CODE_WORKER,estimerPeage};let rafale = false;');
function load() {
  const ctx = {window:{CPPeage:require('../peage-engine.js')},document:{documentElement:{},body:{offsetHeight:0}},MutationObserver:class{observe(){}},performance:{now:()=>0},setInterval:()=>0,
    setTimeout:(fn,ms)=>ms<10?setTimeout(fn,ms):0,clearTimeout,URL,
    fetch:async url=>({ok:true,json:async()=>read(new URL(String(url),'https://test.local/').pathname.slice(1))})};
  vm.createContext(ctx); vm.runInContext(exposed,ctx);
  assert.ok(ctx.window.audit,'test seam must match actual closure');
  return {api:ctx.window.audit,ctx};
}
const plain = value => JSON.parse(JSON.stringify(value));
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
  const worker={fetch:ctx.fetch,postMessage:v=>{reply=v;}};
  vm.createContext(worker); vm.runInContext(api.CODE_WORKER(),worker);
  await worker.onmessage({data:{id:7,base:'https://test.local/',sh,tms,i0,i1}});
  assert.equal(reply.err,undefined);
  assert.equal(reply.x,null);
  assert.deepEqual(plain(reply.missing),plain(api.garesManquantes(sh,i0,i1)));
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
