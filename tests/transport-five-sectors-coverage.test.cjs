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

test('GTFS validity keeps searches overlapping the first or last service day',()=>{
 const feed={format:'GTFS',url:'https://example.org/season.zip',
  bounds:[45.5,5.5,46.5,6.5],validFrom:'2026-07-04',validUntil:'2026-08-31'};
 const trip=at(45.9,6.0);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-07-03T22:00:00+02:00',
  latestArrival:'2026-07-04T08:00:00+02:00'}),true);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-08-31T20:00:00+02:00',
  latestArrival:'2026-09-01T08:00:00+02:00'}),true);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-09-01T08:00:00+02:00',
  latestArrival:'2026-09-01T10:00:00+02:00'}),false);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-07-02T08:00:00+02:00',
  latestArrival:'2026-07-03T10:00:00+02:00'}),false);
});

test('dated seasonal GTFS candidates reject malformed and reversed mission windows',()=>{
 const feed={format:'GTFS',url:'https://example.org/season.zip',
  bounds:[45.5,5.5,46.5,6.5],validFrom:'2026-07-04',validUntil:'2026-08-31'};
 const trip=at(45.9,6.0);
 assert.equal(selected(feed,{...trip,earliestDeparture:'not-a-date'}),false);
 assert.equal(selected(feed,{...trip,latestArrival:'2026/08/01'}),false);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-08-20T10:00:00+02:00',
  latestArrival:'2026-08-19T10:00:00+02:00'}),false);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-08-20T12:00:00+02:00',
  latestArrival:'2026-08-20T09:00:00+02:00'}),false);
});

test('seasonal selection compares real instants across offset changes',()=>{
 const feed={format:'GTFS',url:'https://example.org/season.zip',
  bounds:[45.5,5.5,46.5,6.5],validFrom:'2026-01-01',validUntil:'2026-12-31'};
 const trip=at(45.9,6.0);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-11-09T10:00:00+01:00',
  latestArrival:'2026-11-09T09:30:00+00:00'}),true);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-11-09T10:00:00+01:00',
  latestArrival:'2026-11-09T08:30:00+00:00'}),false);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-11-09T25:00:00+01:00'}),false);
 assert.equal(selected(feed,{...trip,earliestDeparture:'2026-11-09T10:00:00'}),false);
});

test('urban networks in Haute-Savoie remain selectable beside departmental GTFS',()=>{
 const thonon=at(46.37,6.48);
 const candidates=DEFAULT_RESOURCES.filter(r=>selected(r,{...thonon,earliestDeparture:'2026-11-09T09:00:00+01:00'}));
 assert.ok(candidates.some(r=>r.id==='pan-start-thonon'));
 assert.ok(candidates.some(r=>r.id==='pan-evad'));
 assert.ok(candidates.some(r=>r.id==='oura-haute-savoie'));
 // In mount(), urbanResources[0] must be preferred to localResources.find().
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.match(source,/const resource=preferredAin\|\|urbanResources\[0\]\|\|/);
});

test('Thonon ranks the narrower STAR’T urban envelope before ÉVA’D',()=>{
 const task={...at(46.37,6.48),earliestDeparture:'2026-11-09T09:00:00+01:00'};
 const urban=DEFAULT_RESOURCES.filter(r=>r.urban&&selected(r,task))
  .sort((a,b)=>(a.bounds[2]-a.bounds[0])*(a.bounds[3]-a.bounds[1])-
    (b.bounds[2]-b.bounds[0])*(b.bounds[3]-b.bounds[1]));
 assert.equal(urban[0].id,'pan-start-thonon');
 assert.ok(urban.some(r=>r.id==='pan-evad'));
});

test('Thonon and Evian have distinct nearest urban hubs',()=>{
 const hubs={'pan-start-thonon':[46.37,6.48],'pan-evad':[46.40,6.59]};
 const distance=(r,lat,lon)=>{
  const [a,b]=hubs[r.id];
  return (lat-a)**2+((lon-b)*Math.cos(a*Math.PI/180))**2;
 };
 for(const [lat,lon,expected] of [[46.37,6.48,'pan-start-thonon'],[46.40,6.59,'pan-evad']]){
  const candidates=DEFAULT_RESOURCES.filter(r=>hubs[r.id]&&selected(r,{
   ...at(lat,lon),earliestDeparture:'2026-11-09T09:00:00+01:00'
  })).sort((a,b)=>distance(a,lat,lon)-distance(b,lat,lon));
  assert.equal(candidates[0]?.id,expected);
  assert.equal(candidates.length,2);
 }
});

test('undated GTFS feeds also reject invalid or inverted mission windows',()=>{
 const feed={format:'GTFS',url:'https://example.org/no-validity.zip',bounds:[45,5,47,7]};
 const task=at(46,6);
 assert.equal(selected(feed,{...task,earliestDeparture:'2026-11-09T09:00:00+01:00',
  latestArrival:'2026-11-09T08:59:00+01:00'}),false);
 assert.equal(selected(feed,{...task,earliestDeparture:'2026-11-09T25:00:00+01:00'}),false);
 assert.equal(selected(feed,{...task,earliestDeparture:'2026-11-09T09:00:00'}),false);
 assert.equal(selected(feed,{...task,earliestDeparture:'2026-11-09T09:00:00+01:00',
  latestArrival:'2026-11-09T09:30:00+01:00'}),true);
});

test('empty GTFS feeds are not marked loaded by Agenda',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.match(source,/Number\.isInteger\(n\.counts\.stops\)&&n\.counts\.stops>0/);
 assert.doesNotMatch(source,/Number\.isInteger\(n\.counts\.stops\)&&n\.counts\.stops>=0/);
});

test('GTFS producer validity dates must be real and ordered',()=>{
 const task={...at(46,6),earliestDeparture:'2026-11-09T09:00:00+01:00'};
 const feed={format:'GTFS',url:'https://example.org/feed.zip',bounds:[45,5,47,7]};
 assert.equal(selected({...feed,validFrom:'2026-02-30',validUntil:'2026-12-31'},task),false);
 assert.equal(selected({...feed,validFrom:'2026-12-31',validUntil:'2026-01-01'},task),false);
 assert.equal(selected({...feed,validFrom:'2026-01-01',validUntil:'2026-12-31'},task),true);
});

test('federated partner cannot be silently skipped without loadNetworks',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.match(source,/if\(partners\.length&&typeof client\.loadNetworks!=='function'\)/);
 assert.doesNotMatch(source,/if\(needsFederation&&typeof client\.loadNetworks!=='function'\)/);
});
