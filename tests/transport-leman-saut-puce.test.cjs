const {test}=require('node:test');const assert=require('node:assert/strict');const fare=require('../transport-leman-saut-puce.js');
const row={networkId:'65a901970267d05025a905ec',line:'68',tripId:'official-example',departure:'2026-11-07T05:17:00+01:00',from:'1402572:0:B',to:'8587918:0:C',originStop:{stopId:'1402572:0:B',lat:46.24101175,lon:6.02849506},destinationStop:{stopId:'8587918:0:C',lat:46.23346246,lon:6.05541757}};
test('official direct stop pair has an informational reference in both currencies',()=>{const r=fare.reference(row);assert.equal(r.amountEUR,2);assert.equal(r.amountCHF,2.3);assert.equal(r.fareVerified,false);assert.equal(r.totalEUR,null);});
test('unrelated network, line, stops, displaced stops and connections never match',()=>{
 for(const other of [{...row,line:'F'},{...row,networkId:'unknown'},{...row,to:'unknown'},{...row,originStop:{...row.originStop,lat:46}},{...row,legs:[{},{}]}])assert.equal(fare.reference(other),null);
});
test('opposite direction is accepted only at the recorded opposite platforms',()=>{assert.ok(fare.reference({...row,from:'8587918:0:S',to:'1402572:0:A',originStop:{stopId:'8587918:0:S',lat:46.23358052,lon:6.05524699},destinationStop:{stopId:'1402572:0:A',lat:46.24090613,lon:6.02920473}}));});
test('line 64 Prévessin–Meyrin and line 52 Bois-Chatton–Bossy use only their recorded stop pairs',()=>{
 const cases=[{line:'64',from:'1401781:0:P',to:'8594946:0:I',originStop:{stopId:'1401781:0:P',lat:46.24856001,lon:6.08665199},destinationStop:{stopId:'8594946:0:I',lat:46.23988098,lon:6.08658012}},
 {line:'52',from:'1401814:0:F',to:'8587035:0:W',originStop:{stopId:'1401814:0:F',lat:46.29560292,lon:6.10000994},destinationStop:{stopId:'8587035:0:W',lat:46.27964291,lon:6.11408654}}];
 for(const c of cases){const r=fare.reference({...row,...c});assert.ok(r);assert.equal(r.line,c.line);assert.equal(r.totalEUR,null);assert.match(fare.describe(r),new RegExp('ligne '+c.line));assert.equal(fare.reference({...row,...c,line:'68'}),null);}
});
