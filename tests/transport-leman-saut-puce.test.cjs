const {test}=require('node:test');const assert=require('node:assert/strict');const fare=require('../transport-leman-saut-puce.js');
const row={networkId:'65a901970267d05025a905ec',line:'68',tripId:'official-example',departure:'2026-11-07T05:17:00+01:00',from:'1402572:0:B',to:'8587918:0:C',originStop:{stopId:'1402572:0:B',lat:46.24101175,lon:6.02849506},destinationStop:{stopId:'8587918:0:C',lat:46.23346246,lon:6.05541757}};
test('official direct stop pair has an informational reference in both currencies',()=>{const r=fare.reference(row);assert.equal(r.amountEUR,2);assert.equal(r.amountCHF,2.3);assert.equal(r.fareVerified,false);assert.equal(r.totalEUR,null);});
test('unrelated network, line, stops, displaced stops and connections never match',()=>{
 for(const other of [{...row,line:'F'},{...row,networkId:'unknown'},{...row,to:'unknown'},{...row,originStop:{...row.originStop,lat:46}},{...row,legs:[{},{}]}])assert.equal(fare.reference(other),null);
});
test('opposite direction is accepted only at the recorded opposite platforms',()=>{assert.ok(fare.reference({...row,from:'8587918:0:S',to:'1402572:0:A',originStop:{stopId:'8587918:0:S',lat:46.23358052,lon:6.05524699},destinationStop:{stopId:'1402572:0:A',lat:46.24090613,lon:6.02920473}}));});
