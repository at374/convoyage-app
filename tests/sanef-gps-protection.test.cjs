'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {GPS_CODES,isBlocked,protectEngine}=require('../sanef-gps-protection.js');
const {creerMoteur}=require('../peage-engine.js');
const versions=[{id:'known',barrier_station_id:'VALIDEE',vehicle_class:1,amount_eur:5.4,status:'PROUVE',effective_from:'2026-02-01',source_url:'test'}];
const real=creerMoteur({versions});
const safe=protectEngine(real);
for(const code of GPS_CODES){
 test('GPS blocked '+code,()=>{assert.equal(isBlocked(code),true);assert.equal(safe.barriere(code,1,'2026-11-03').amount,null);});
}
test('validated unchanged',()=>assert.deepEqual(safe.barriere('VALIDEE',1,'2026-11-03'),real.barriere('VALIDEE',1,'2026-11-03')));
test('validated-only trip unchanged',()=>{const p=[{type:'barriere',station:'VALIDEE'}];assert.deepEqual(safe.trajet(p,1,'2026-11-03'),real.trajet(p,1,'2026-11-03'));});
test('mixed trip has no misleading partial total',()=>{const r=safe.trajet([{type:'barriere',station:'VALIDEE'},{type:'barriere',station:GPS_CODES[0]}],1,'2026-11-03');assert.equal(r.total,null);assert.equal(r.complet,false);assert.equal(r.lignes.length,2);});
test('group alias cannot bypass guard',()=>{const r=safe.trajet([{type:'barriere',station:GPS_CODES[0],group:'VALIDEE'}],1,'2026-11-03');assert.equal(r.total,null);});
test('duplicate GPS crossing counted once',()=>{const r=safe.trajet([{type:'barriere',station:GPS_CODES[0]},{type:'barriere',station:GPS_CODES[0]}],1,'2026-11-03');assert.equal(r.lignes.length,1);});
test('invalid engine rejected',()=>assert.throws(()=>protectEngine({}),TypeError));
