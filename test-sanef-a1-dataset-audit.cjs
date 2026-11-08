'use strict';
/* Fail-closed audit of the experimental SANEF A1 dataset.
 * Checks structure, uniqueness and internally consistent toll amounts.
 * Does NOT certify the PDF column-to-station mapping.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8'));
const dataset=read('sanef-a1-modulation-2026.json');
const mapping=read('sanef-a1-gare-alias-2026.json');
const fields=['classe1_normal','classe1_vert','classe1_rouge','classe2_normal'];
assert.equal(dataset.status,'experimental_not_activated');
assert.equal(mapping.statut,'correspondances_documentaires_non_certifiees');
assert.equal(dataset.application,'2026-02-01');
assert.equal(dataset.records.length,122);
const aliasEntries=Object.entries(mapping.aliases);
assert.equal(aliasEntries.length,33);
const canonical=new Set();
for(const [label,station] of aliasEntries){
 assert.equal(typeof label,'string');assert.ok(label.trim());
 assert.equal(typeof station,'string');assert.ok(station.trim());
 assert.ok(!canonical.has(station),'duplicate canonical station '+station);
 canonical.add(station);
}
const seen=new Set(),groups=new Map();
let checked=0;
for(const record of dataset.records){
 assert.ok(canonical.has(record.origine),'unknown origin '+record.origine);
 assert.ok(canonical.has(record.destination),'unknown destination '+record.destination);
 assert.notEqual(record.origine,record.destination);
 const key=record.origine+'|'+record.destination;
 assert.ok(!seen.has(key),'duplicate relation '+key);seen.add(key);
 assert.deepEqual(Object.keys(record.centimes).sort(),[...fields].sort());
 for(const field of fields)assert.ok(Number.isSafeInteger(record.centimes[field])&&record.centimes[field]>=0,key+' '+field);
 assert.ok(record.centimes.classe1_vert<=record.centimes.classe1_normal,key+' green higher than normal');
 assert.ok(record.centimes.classe1_normal<=record.centimes.classe1_rouge,key+' red lower than normal');
 groups.set(record.destination,(groups.get(record.destination)||0)+1);
 checked++;
}
assert.deepEqual(Object.fromEntries([...groups].sort()),{ARSY:29,CHAMANT:32,CHEVRIERES:30,SENLIS:31});
console.log('PASS SANEF A1 dataset structural audit: '+checked+' relations, '+(checked*4)+' prices, '+aliasEntries.length+' aliases (not PDF-certified)');
