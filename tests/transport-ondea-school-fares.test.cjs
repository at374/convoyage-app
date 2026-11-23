'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fareFor}=require('../transport-fare-grids.js');
const leg=line=>({kind:'transit',mode:'Bus',provider:'Ondéa Aix-les-Bains',line,departure:'2026-11-30T08:00:00+01:00'});
test('Ondea 102 and 419 use the onboard fare, not the QR/M-ticket product',()=>{
 for(const line of ['102','419']){
  const fare=fareFor(leg(line));
  assert.equal(fare?.amount,1.70);
  assert.match(fare.source,/conducteur/i);
 }
});
test('no automatic onboard fare on unverified school lines',()=>{
 assert.equal(fareFor(leg('418')),null);
 assert.equal(fareFor(leg('103')),null);
});
test('no onboard school fare outside validity dates or on unrelated operator',()=>{
 assert.equal(fareFor({...leg('419'),departure:'2026-06-30T08:00:00+02:00'}),null);
 assert.equal(fareFor({...leg('419'),provider:'Autre réseau'}),null);
});

test('fare registry is a single complete module with no appended fragments',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../transport-fare-grids.js'),'utf8');
 assert.equal((source.match(/CPTransportFareGrids=api/g)||[]).length,1);
 assert.match(source,/\}\)\(typeof window!=='undefined'\?window:globalThis\);\s*$/);
 assert.equal((source.match(/network:'TAC'/g)||[]).length,1);
 assert.equal((source.match(/network:'Ondéa \(conducteur, lignes 102\/419\)'/g)||[]).length,1);
});

test('line 274 does not mistake an internal Geneva ride for a cross-border fare',()=>{
 const stop=code=>'FR:'+code+':ZE:1:HAUTExSAVOIE';
 const base={kind:'transit',mode:'Bus',provider:'Cars Région Haute-Savoie',line:'274',departure:'2026-11-30T08:00:00+01:00'};
 const inside={...base,gtfsRaw:{from:stop('6621'),to:stop('6623')}};
 assert.equal(fareFor(inside),null,'Geneva-to-Geneva must not receive the international tariff');
 const international={...base,gtfsRaw:{from:stop('6621'),to:stop('74128')}};
 assert.equal(fareFor(international)?.amount,4.60,'Verified zone 1 international fare');
 assert.equal(fareFor({...international,departure:'2026-12-13T08:00:00+01:00'}),null,'No expired 274 tariff');
});
