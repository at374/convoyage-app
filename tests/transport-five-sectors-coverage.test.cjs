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

test('ÉVA’D official GTFS is a local candidate without a fare guarantee',()=>{
 const source=DEFAULT_RESOURCES.find(r=>r.id==='pan-evad');
 assert.ok(source);
 assert.equal(selected(source,at(46.40,6.59)),true,'Évian');
 assert.equal(selected(source,at(46.27,6.84)),true,'Abondance');
 assert.equal(selected(source,at(45.96,5.36)),false,'Ambérieu');
 assert.match(source.url,/429c8587-676a-4ed3-8279-e67403bc36f4$/);
 assert.notEqual(source.fareVerified,true);
});

test('STAR’T urban and ÉVA’D urban GTFS are distinct selectable sources',()=>{
 const start=DEFAULT_RESOURCES.find(r=>r.id==='pan-start-thonon');
 const evad=DEFAULT_RESOURCES.find(r=>r.id==='pan-evad');
 assert.ok(start&&evad);
 assert.notEqual(start.url,evad.url);
 assert.equal(selected(start,at(46.37,6.48)),true);
 assert.equal(selected(evad,at(46.37,6.48)),true);
 assert.equal(start.overlapsWith,undefined);
 assert.equal(evad.overlapsWith,undefined);
});

test('seasonal GTFS candidate is excluded outside its publication window',()=>{
 const seasonal={id:'seasonal-test',format:'GTFS',url:'https://example.org/feed.zip',
  bounds:[45.5,5.5,46.5,6.5],validFrom:'2026-06-20',validUntil:'2026-09-05'};
 const trip=at(45.9,6.0);
 assert.equal(selected(seasonal,{...trip,earliestDeparture:'2026-08-15T09:00:00+02:00'}),true);
 assert.equal(selected(seasonal,{...trip,earliestDeparture:'2026-11-09T09:00:00+01:00'}),false);
 assert.equal(selected(seasonal,{...trip,latestArrival:'2026-06-19T09:00:00+02:00'}),false);
});

test('documented network GTFS validity excludes expired archive dates',()=>{
 const cases=[
  ['pan-start-thonon','2026-12-21T10:00:00+01:00'],
  ['pan-evad','2026-12-21T10:00:00+01:00'],
  ['pan-synchro','2026-12-21T10:00:00+01:00'],
  ['pan-tam','2027-01-01T10:00:00+01:00'],
  ['pan-ondea','2027-04-01T10:00:00+02:00']
 ];
 for(const [id,departure] of cases){
  const resource=DEFAULT_RESOURCES.find(r=>r.id===id);
  assert.ok(resource,id);
  const lat=(resource.bounds[0]+resource.bounds[2])/2;
  const lon=(resource.bounds[1]+resource.bounds[3])/2;
  assert.equal(selected(resource,{...at(lat,lon),earliestDeparture:departure}),false,id+' expired');
  assert.ok(resource.validFrom&&resource.validUntil,id+' dates declared');
 }
});
