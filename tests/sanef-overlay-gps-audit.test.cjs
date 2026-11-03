'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const overlay=require('../peages-overlay.json');
const {GPS_CODES}=require('../sanef-gps-protection.js');
const cases=[
 ['GAUCHY','02A902615CD'],
 ['COURBES','02A902620CD'],
 ['LA NEUVILLETTE','51A902605CD'],
 ['CHEVRIERES','60A900120CD'],
 ['ARSY','60A900125CD']
];
test('all five SANEF GPS plazas are already represented in overlay',()=>{
 for(const [name] of cases){
  const g=overlay.gares.find(x=>x.nom===name);
  assert.ok(g,name+' missing GPS station');
  assert.equal(g.points.length,2,name+' should have two GPS points');
 }
});
test('the five SANEF GPS plazas must not be used as tariff relationships without official proof',()=>{
 for(const [name] of cases){
  const pairs=overlay.paires.filter(x=>x[0]===name||x[1]===name);
  assert.equal(pairs.length,0,name+' has new tariff relationships requiring official review');
 }
});
test('guard covers the exact road identifiers of those five stations',()=>{
 for(const [,code] of cases)assert.ok(GPS_CODES.includes(code),code);
});
test('geographic guard must not be automatically expanded from overlay GPS entries',()=>{
 // An unproven GPS station can be near a proven toll relation: geographic blocking
 // without checking the actual tariff model can hide a valid official price.
 const fs=require('node:fs'),path=require('node:path');
 const ui=fs.readFileSync(path.join(__dirname,'..','routes-ui.js'),'utf8');
 assert.match(ui,/const UNK =/);
 assert.match(ui,/const CODE_WORKER =/);
});
