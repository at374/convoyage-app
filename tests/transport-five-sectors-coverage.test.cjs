const test=require('node:test');
const assert=require('node:assert/strict');
const {DEFAULT_RESOURCES,selected}=require('../transport-gtfs-agenda.js');
const at=(lat,lon)=>({from:{lat,lon},to:{lat,lon}});
const cases=[
 ['Aix-les-Bains',45.688,5.915],
 ['Ambérieu-en-Bugey',45.959,5.357],
 ['Archamps',46.136,6.133],
 ['Saint-Julien-en-Genevois',46.144,6.084],
 ['Chambéry',45.566,5.920]
];
test('five priority towns have candidate GTFS source envelopes, not verified service',()=>{
 for(const [name,lat,lon] of cases){
  const candidates=DEFAULT_RESOURCES.filter(r=>selected(r,at(lat,lon)));
  assert.ok(candidates.length>0,name+' must have a candidate source');
  assert.ok(candidates.every(r=>r.url.startsWith('https://')),name+' sources use HTTPS');
 }
});
test('Ondea, TAM and Synchro official GTFS archives are registered',()=>{
 for(const name of ['Ondéa','TAM','Synchro'])assert.equal(DEFAULT_RESOURCES.some(r=>r.network.includes(name)),true);
});
test('invalid GPS cannot produce GTFS coverage',()=>{
 for(const r of DEFAULT_RESOURCES)assert.equal(selected(r,at(91,6)),false);
});

test('Rumilly J’ybus official source is a candidate for local trips',()=>{
 const source=DEFAULT_RESOURCES.find(r=>r.id==='pan-jybus');
 assert.ok(source);
 assert.equal(selected(source,at(45.862,5.945)),true);
 assert.equal(selected(source,at(46.20,6.40)),false);
 assert.match(source.url,/80092\.20260807\.141107\.062760\.zip$/);
});

test('Thonon STAR’T source is selected locally, never assumed to contain fares',()=>{
 const source=DEFAULT_RESOURCES.find(r=>r.id==='pan-start-thonon');
 assert.ok(source);
 assert.equal(selected(source,at(46.37,6.48)),true);
 assert.equal(selected(source,at(45.96,5.36)),false);
 assert.match(source.url,/84108\.20260901\.002618\.536834\.zip$/);
 assert.notEqual(source.fareVerified,true,'GTFS does not supply a verified ticket price');
});
