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
