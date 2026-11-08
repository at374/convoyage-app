'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'sanef-a1-regles-officielles-2026.js'),'utf8'),sandbox);
const determine=sandbox.window.SanefA1ReglesOfficielles2026.determiner;
let count=0;
function check(time,expected,overrides={}){
 const actual=determine({classe:1,direction:'VERS_PARIS',passageLocal:time,...overrides});
 assert.equal(actual.couleur,expected,`${time}: expected ${expected}, got ${actual.couleur}`);
 count++;
}
for(const [time,color] of [
 ['2026-11-08T14:29:59','normal'],['2026-11-08T14:30:00','vert'],
 ['2026-11-08T16:29:59','vert'],['2026-11-08T16:30:00','rouge'],
 ['2026-11-08T20:29:59','rouge'],['2026-11-08T20:30:00','vert'],
 ['2026-11-08T23:29:59','vert'],['2026-11-08T23:30:00','normal'],
 ['2026-02-01T17:00:00','rouge'],['2027-01-31T17:00:00','rouge'],
 ['2027-02-07T17:00:00',null],['2026-01-25T17:00:00',null],
 ['2026-11-09T17:00:00',null],['2026-11-09T17:00:00','normal'],
 ['2026-04-06T17:00:00',null],['2026-11-08T24:00:00',null],
 ['2026-02-30T17:00:00',null],['2026-11-08T17:00',null]
])check(time,color,time==='2026-11-09T17:00:00'&&color==='normal'?{calendrierFeriesVerifie:true}:{});
check('2026-11-08T17:00:00','normal',{classe:2});
check('2026-11-08T17:00:00','normal',{direction:'AUTRE'});
console.log(`OK: ${count} SANEF A1 regression checks`);
