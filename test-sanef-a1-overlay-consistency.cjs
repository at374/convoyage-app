'use strict';
/* Compare published SANEF A1 baseline against the existing overlay.
 * Read-only: does not rewrite the pricing database.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8'));
const overlay=load('peages-overlay.json'),data=load('sanef-a1-modulation-2026.json'),aliases=load('sanef-a1-gare-alias-2026.json').aliases;
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const index=new Map();
for(const p of overlay.paires){const key=normalize(p[0])+'|'+normalize(p[1]);if(!index.has(key))index.set(key,[]);index.get(key).push(p);}
const inverse=new Map(Object.entries(aliases).map(([name,canonical])=>[canonical,name]));
assert.equal(data.records.length,122);
let checked=0;
for(const r of data.records){
 const origin=inverse.get(r.origine),destination=inverse.get(r.destination);
 assert.ok(origin&&destination,'unmapped station '+r.origine+' / '+r.destination);
 const matches=index.get(normalize(origin)+'|'+normalize(destination))||[];
 assert.equal(matches.length,1,'missing or ambiguous overlay '+origin+' -> '+destination);
 const p=matches[0];
 assert.equal(Math.round(p[2]*100),r.centimes.classe1_normal,'class 1 baseline mismatch '+origin+' -> '+destination);
 assert.equal(Math.round(p[3]*100),r.centimes.classe2_normal,'class 2 baseline mismatch '+origin+' -> '+destination);
 checked++;
}
console.log('PASS '+checked+' SANEF A1 baseline relations matched in peages-overlay.json');
