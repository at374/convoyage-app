'use strict';
// National overlay structural audit only: never equate numerical consistency with official tariff certification.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const overlay=JSON.parse(fs.readFileSync(path.join(__dirname,'peages-overlay.json'),'utf8'));
const zeroAudit=fs.readFileSync(path.join(__dirname,'peages-france-relations-zero-a-auditer-2026.csv'),'utf8').trimEnd().split(/\r?\n/);
const pairs=overlay.paires;
assert.ok(Array.isArray(pairs)&&pairs.length>0);
const seen=new Set(),zeroPairs=new Set();
let samePrice=0;
for(const [i,p] of pairs.entries()){
 assert.ok(Array.isArray(p)&&p.length>=4,'malformed pair '+i);
 const [origin,destination,c1,c2]=p;
 assert.ok(typeof origin==='string'&&origin.trim()&&typeof destination==='string'&&destination.trim(),'missing station '+i);
 const key=JSON.stringify([origin,destination]);
 assert.ok(!seen.has(key),'duplicate ordered relation '+key);seen.add(key);
 assert.ok(Number.isFinite(c1)&&Number.isFinite(c2)&&c1>=0&&c2>=0,'invalid price '+key);
 if(c1===0||c2===0){
  assert.equal(c1,0,'one-sided zero class 1 '+key);
  assert.equal(c2,0,'one-sided zero class 2 '+key);
  zeroPairs.add(key);
 }
 if(c1===c2)samePrice++;
}
assert.equal(zeroAudit.length-1,zeroPairs.size,'zero-price audit ledger out of sync');
for(const [i,line] of zeroAudit.slice(1).entries()){
 const m=line.match(/^"((?:[^"]|"")*)","((?:[^"]|"")*)",0\.00,0\.00,/);
 assert.ok(m,'malformed zero audit line '+(i+2));
 const origin=m[1].replaceAll('""','"'),destination=m[2].replaceAll('""','"');
 const key=JSON.stringify([origin,destination]);
 assert.ok(zeroPairs.delete(key),'unknown or duplicate zero audit relation '+key);
 assert.ok(line.includes('A_VERIFIER_GRATUITE_OU_ABSENCE_DONNEE'),'zero relation cannot be silently certified '+key);
}
assert.equal(zeroPairs.size,0);
console.log('PASS national overlay structural audit: '+pairs.length+' unique directional entries, '+(zeroAudit.length-1)+' zero-price cases, '+samePrice+' equal-price pairs; none certified by this test');
