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

test('urban Ain GTFS must take precedence over broad Cars Région Ain',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const resource=urbanResources[0]||preferredAin||'));
 assert.equal(source.includes('const resource=preferredAin||urbanResources[0]||'),false);
 for(const [lat,lon,id] of [[45.959,5.36,'pan-tam'],[46.205,5.225,'oura-rubis']]){
  const task={...at(lat,lon),earliestDeparture:'2026-11-10T09:00:00+01:00'};
  assert.ok(DEFAULT_RESOURCES.some(r=>r.id===id&&selected(r,task)),id);
 }
});

test('Agenda GTFS inventory has 16 distinct configured source identities',()=>{
 const ids=DEFAULT_RESOURCES.map(resource=>resource.id);
 assert.equal(ids.length,16);
 assert.equal(new Set(ids).size,ids.length,'Duplicate GTFS source id');
 for(const resource of DEFAULT_RESOURCES){
  assert.equal(resource.format,'GTFS',resource.id);
  assert.ok(resource.url.startsWith('https://'),resource.id);
  assert.equal(resource.bounds.length,4,resource.id);
  assert.ok(resource.bounds.every(Number.isFinite),resource.id);
  assert.ok(resource.bounds[0]<resource.bounds[2]&&resource.bounds[1]<resource.bounds[3],resource.id);
 }
 assert.equal(ids.includes('tcl-lyon'),false,'TCL must not be counted as connected until its GTFS is usable');
});

test('GTFS panel must disclose partners omitted by the two-feed limit',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const partnerCandidates='));
 assert.ok(source.includes('const partners=uniqueCandidates.filter(r=>r.federate)'));
 assert.ok(source.includes('.sort((a,b)=>partnerCoverage(b)-partnerCoverage(a)).slice(0,2);'));
 assert.ok(source.includes('const nonFederatedPartners=uniqueCandidates.filter(r=>!r.federate).length;'));
 assert.ok(source.includes('sans fédération GTFS activée'));
 assert.ok(source.includes('const omittedPartners=partnerCandidates.length-partners.length;'));
 assert.ok(source.includes('if(omittedPartners>0)warning.textContent+='));
 assert.ok(source.includes('réseau(x) candidat(s) supplémentaire(s) non interrogé(s)'));
});

test('omitted GTFS networks are named rather than only counted',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('uniqueCandidates.filter(r=>!partners.includes(r))'));
 assert.ok(source.includes("omitted.map(r=>r.network).join(' ; ')"));
 assert.ok(source.includes('Réseaux non interrogés : '));
});

test('GTFS partner selection prioritizes mission coverage without claiming service',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const partnerCoverage=r=>taskList.reduce('));
 assert.ok(source.includes('selected(r,task)||crossEnvelopePair(resource,r,task)'));
 assert.ok(source.includes('partnerCoverage(b)-partnerCoverage(a)'));
});

test('GTFS worker rejects duplicate network identities before downloading',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8');
 assert.ok(source.includes("const identities=list.map(item=>item?.datasetId||item?.id||item?.url);"));
 assert.ok(source.includes('new Set(identities).size!==identities.length'));
 assert.ok(source.includes('Duplicate, unidentified or invalid GTFS network'));
 assert.ok(source.includes('new Set(urls).size!==urls.length'));
});

test('GTFS candidate list removes duplicate network identities and URLs',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const candidateIds=new Set([resource.datasetId||resource.id]);'));
 assert.ok(source.includes('const candidateUrls=new Set([resource.url]);'));
 assert.ok(source.includes('candidateIds.has(identity)||candidateUrls.has(candidate.url)'));
 assert.ok(source.includes('const omittedPartners=uniqueCandidates.length-partners.length;'));
});

test('partially loaded GTFS feeds name the selected networks that failed',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const loadedIds=new Set(loaded.map(n=>n.source.datasetId||n.source.resourceId));'));
 assert.ok(source.includes('const missingSelected=[resource,...partners].filter('));
 assert.ok(source.includes('Flux sélectionnés indisponibles : '));
 assert.ok(source.includes('Résultats incomplets, même si un autre réseau répond.'));
});

test('GTFS summaries must belong to the requested feed identifiers',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const expectedIds=new Set([resource,...partners].map(r=>r.datasetId||r.id));'));
 assert.ok(source.includes('expectedIds.has(n.source.datasetId||n.source.resourceId)'));
});

test('missing expected GTFS feed marks results partial even if loader says success',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const missingSelected=[resource,...partners].filter('));
 assert.ok(source.includes('missingSelected.length>0;'));
 assert.ok(source.indexOf('const missingSelected=')<source.indexOf('const partialNetworks='));
});

test('worker rejects duplicate URLs and insecure URLs before fetching archives',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[],sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 const serviceDates=['2026-11-10'];
 await sandbox.self.onmessage({data:{id:101,type:'loadNetworks',options:{indexServiceDates:serviceDates},
  resources:[{id:'one',url:'https://example.org/feed.zip'},{id:'two',url:'https://example.org/feed.zip'}]}});
 await sandbox.self.onmessage({data:{id:102,type:'loadNetworks',options:{indexServiceDates:serviceDates},
  resources:[{id:'insecure',url:'http://example.org/feed.zip'}]}});
 assert.equal(posted.length,2);
 for(const reply of posted)assert.match(reply.error?.message||'',/Duplicate, unidentified or invalid GTFS network/);
});

test('worker returns a partial result when one of two GTFS archives fails',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[],loaded=[];
 const sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}},
  CPGTFSLoader:{async loadResource(item){
   loaded.push(item.id);
   if(item.id==='failed')throw new Error('Archive unavailable');
   return {source:{datasetId:item.id,network:item.network,loadedAt:'2026-11-10T08:00:00Z'},
    index:{counts:{stops:12}},archiveBytes:1,expandedBytes:2,indexedStopTimes:3,
    skippedStopTimes:0,rejectedStopTimes:0,indexServiceDates:['2026-11-10']};
  }}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 await sandbox.self.onmessage({data:{id:201,type:'loadNetworks',options:{indexServiceDates:['2026-11-10']},
  resources:[{id:'working',network:'Working',url:'https://example.org/a.zip'},
   {id:'failed',network:'Failed',url:'https://example.org/b.zip'}]}});
 assert.deepEqual(loaded,['working','failed']);
 assert.equal(posted.length,1);
 assert.equal(posted[0].result?.partial,true);
 assert.equal(posted[0].result?.networks?.length,2);
 assert.equal(posted[0].result.networks[0].counts.stops,12);
 assert.equal(posted[0].result.networks[1].error.network,'Failed');
});

test('worker can retry loading after all GTFS feeds failed',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[];let attempts=0;
 const sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}},
  CPGTFSLoader:{async loadResource(item){
   attempts++;
   if(attempts===1)throw new Error('Temporary archive failure');
   return {source:{datasetId:item.id,network:item.network,loadedAt:'2026-11-10T08:00:00Z'},
    index:{counts:{stops:12}},archiveBytes:1,expandedBytes:2,indexedStopTimes:3,
    skippedStopTimes:0,rejectedStopTimes:0,indexServiceDates:['2026-11-10']};
  }}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 const request=id=>({data:{id,type:'load',resource:{id:'retry',network:'Retry',url:'https://example.org/feed.zip'}}});
 await sandbox.self.onmessage(request(301));
 await sandbox.self.onmessage(request(302));
 assert.equal(attempts,2);
 assert.match(posted[0].error?.message||'',/Temporary archive failure/);
 assert.equal(posted[1].result?.counts?.stops,12);
});

test('worker names both networks when both GTFS loads fail',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[];
 const sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}},
  CPGTFSLoader:{async loadResource(item){throw new Error('Archive unavailable '+item.id);}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 await sandbox.self.onmessage({data:{id:401,type:'loadNetworks',options:{indexServiceDates:['2026-11-10']},
  resources:[{id:'one',network:'Premier réseau',url:'https://example.org/a.zip'},
   {id:'two',network:'Second réseau',url:'https://example.org/b.zip'}]}});
 assert.equal(posted.length,1);
 assert.match(posted[0].error?.message||'',/Premier réseau: Archive unavailable one/);
 assert.match(posted[0].error?.message||'',/Second réseau: Archive unavailable two/);
});

test('Agenda surfaces bounded GTFS load errors as plain text',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes("typeof error?.message==='string'?error.message.trim().slice(0,300):''"));
 assert.ok(source.includes("(detail?' Détail : '+detail:'')"));
 assert.ok(source.includes("sourceStatus.textContent='Flux officiel indisponible"));
});

test('skipped GTFS candidate networks force partial mission results',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const incomplete=truncated||partialNetworks||omittedPartners>0||invalidJourneys>0;'));
 assert.ok(source.includes('onResults({task,itineraries:distinct,partial:incomplete})'));
});

test('GTFS worker caps federation at three feeds and enumerates all three pairs',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8');
 assert.ok(source.includes("list.length>3)throw new Error('One to three GTFS networks required')"));
 assert.ok(source.includes('for(let i=0;i<feeds.length;i++)for(let j=i+1;j<feeds.length;j++)'));
 assert.ok(source.includes('crossNetworkTrips([feeds[i],feeds[j]]'));
});

test('worker loads three distinct GTFS feeds and reports all three',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[],loaded=[];
 const sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}},
  CPGTFSLoader:{async loadResource(item){
   loaded.push(item.id);
   return {source:{datasetId:item.id,network:item.network,loadedAt:'2026-11-10T08:00:00Z'},
    index:{counts:{stops:10}},archiveBytes:1,expandedBytes:2,indexedStopTimes:3,
    skippedStopTimes:0,rejectedStopTimes:0,indexServiceDates:['2026-11-10']};
  }}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 await sandbox.self.onmessage({data:{id:501,type:'loadNetworks',options:{indexServiceDates:['2026-11-10']},
  resources:[1,2,3].map(i=>({id:'feed'+i,network:'Network '+i,url:'https://example.org/'+i+'.zip'}))}});
 assert.deepEqual(loaded,['feed1','feed2','feed3']);
 assert.equal(posted.length,1);
 assert.equal(posted[0].result?.partial,false);
 assert.equal(posted[0].result?.networks?.length,3);
 assert.ok(posted[0].result.networks.every(n=>n.counts.stops===10));
});

test('three-feed worker marks one unavailable network as partial',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[];
 const sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}},
  CPGTFSLoader:{async loadResource(item){
   if(item.id==='feed2')throw new Error('Feed temporarily unavailable');
   return {source:{datasetId:item.id,network:item.network,loadedAt:'2026-11-10T08:00:00Z'},
    index:{counts:{stops:10}},archiveBytes:1,expandedBytes:2,indexedStopTimes:3,
    skippedStopTimes:0,rejectedStopTimes:0,indexServiceDates:['2026-11-10']};
  }}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 await sandbox.self.onmessage({data:{id:502,type:'loadNetworks',options:{indexServiceDates:['2026-11-10']},
  resources:[1,2,3].map(i=>({id:'feed'+i,network:'Network '+i,url:'https://example.org/'+i+'.zip'}))}});
 assert.equal(posted[0].result?.partial,true);
 assert.equal(posted[0].result?.networks?.length,3);
 assert.equal(posted[0].result.networks[1].error.network,'Network 2');
 assert.equal(posted[0].result.networks[2].counts.stops,10);
});

test('three GTFS networks federate all three distinct pairs during mission query',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[],pairs=[];
 const sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}},
  CPGTFSLoader:{async loadResource(item){return {
   source:{datasetId:item.id,network:item.network,loadedAt:'2026-11-10T08:00:00Z'},
   index:{counts:{stops:10}},files:{},indexServiceDates:['2026-11-10']};}},
  CPGTFSIndex:{nearbyDirectTrips(){return [];},nearbyTransferTrips(){return {journeys:[],searchTruncated:false};}},
  CPGTFSTime:{datedTrips(_files,_index,found){return found;},datedTransferTrips(){return [];},
   serviceWindow(){return {};}},CPGTFSFederation:{
   crossNetworkTrips(feeds){pairs.push(feeds.map(f=>f.source.datasetId).join('+'));return {journeys:[],searchTruncated:false};}
  }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 await sandbox.self.onmessage({data:{id:601,type:'loadNetworks',options:{indexServiceDates:['2026-11-10']},
  resources:[1,2,3].map(i=>({id:'feed'+i,network:'Network '+i,url:'https://example.org/'+i+'.zip'}))}});
 await sandbox.self.onmessage({data:{id:602,type:'query',query:{method:'missionJourneys',date:'2026-11-10',
  origin:{lat:46,lon:6},destination:{lat:46.1,lon:6.1},window:{}}}});
 assert.deepEqual(pairs,['feed1+feed2','feed1+feed3','feed2+feed3']);
 assert.equal(posted[1].result?.rows?.length,0);
 assert.equal(posted[1].result?.serviceConfirmed,false);
});

test('failed GTFS federation pair preserves other pairs and marks search truncated',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[],pairs=[];
 const sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}},
  CPGTFSLoader:{async loadResource(item){return {source:{datasetId:item.id,network:item.network},
   index:{counts:{stops:10}},files:{},indexServiceDates:['2026-11-10']};}},
  CPGTFSIndex:{nearbyDirectTrips(){return [];},nearbyTransferTrips(){return {journeys:[],searchTruncated:false};}},
  CPGTFSTime:{datedTrips(_f,_i,found){return found;},datedTransferTrips(){return [];},serviceWindow(){return {};}},
  CPGTFSFederation:{crossNetworkTrips(feeds){
   const pair=feeds.map(f=>f.source.datasetId).join('+');pairs.push(pair);
   if(pair==='feed1+feed2')throw new Error('Federation failed');
   return {journeys:[],searchTruncated:false};
  }}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 await sandbox.self.onmessage({data:{id:701,type:'loadNetworks',options:{indexServiceDates:['2026-11-10']},
  resources:[1,2,3].map(i=>({id:'feed'+i,url:'https://example.org/'+i+'.zip'}))}});
 await sandbox.self.onmessage({data:{id:702,type:'query',query:{method:'missionJourneys',date:'2026-11-10',
  origin:{lat:46,lon:6},destination:{lat:46.1,lon:6.1},window:{}}}});
 assert.deepEqual(pairs,['feed1+feed2','feed1+feed3','feed2+feed3']);
 assert.equal(posted[1].result?.truncated,true);
 assert.equal(posted[1].result?.searchTruncated,true);
 assert.equal(posted[1].result?.failedFederations?.length,1);
 assert.equal(posted[1].result.failedFederations[0].reason,'Federation failed');
 assert.deepEqual(Array.from(posted[1].result.failedFederations[0].networks),['feed1','feed2']);
 assert.equal(posted[1].error,undefined);
});

test('Agenda displays federation failures after resetting mission status text',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const federationFailures=new Map()'));
 assert.ok(source.includes('Array.isArray(result.failedFederations)'));
 assert.ok(source.includes('federationFailures.size>0'));
 const statusAt=source.indexOf("status.textContent=task.label+' : '");
 const detailsAt=source.indexOf("detail.textContent='Correspondances non vérifiées : '");
 assert.ok(statusAt>=0&&detailsAt>statusAt,'diagnostics must be appended after status text reset');
 assert.ok(source.includes('status.appendChild(detail)'));
});

test('GTFS source links follow the actual loaded network after partial failures',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const selectedSourceFor=n=>[resource,...partners].find('));
 assert.ok(source.includes('source.href=selectedSourceFor(loaded[0])?.url||resource.url;'));
 assert.ok(source.includes('link.href=selectedSourceFor(other)?.url||resource.url;'));
 assert.ok(!source.includes('link.href=other.source.url||partners[0].url;'));
});

test('malformed federation response is isolated and marked partial',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const posted=[],pairs=[];
 const sandbox={importScripts(){},self:{postMessage(message){posted.push(message);}},
  CPGTFSLoader:{async loadResource(item){return {source:{datasetId:item.id},
   index:{counts:{stops:1}},files:{},indexServiceDates:['2026-11-10']};}},
  CPGTFSIndex:{nearbyDirectTrips(){return [];},nearbyTransferTrips(){return {journeys:[],searchTruncated:false};}},
  CPGTFSTime:{datedTrips(_f,_i,found){return found;},datedTransferTrips(){return [];},serviceWindow(){return {};}},
  CPGTFSFederation:{crossNetworkTrips(feeds){
   const pair=feeds.map(f=>f.source.datasetId).join('+');pairs.push(pair);
   return pair==='a+b'?{journeys:null}:{journeys:[],searchTruncated:false};
  }}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../transport-gtfs-worker.js'),'utf8'),sandbox);
 await sandbox.self.onmessage({data:{id:801,type:'loadNetworks',options:{indexServiceDates:['2026-11-10']},
  resources:['a','b','c'].map(id=>({id,url:'https://example.org/'+id}))}});
 await sandbox.self.onmessage({data:{id:802,type:'query',query:{method:'missionJourneys',date:'2026-11-10',
  origin:{lat:46,lon:6},destination:{lat:46.1,lon:6.1},window:{}}}});
 assert.deepEqual(pairs,['a+b','a+c','b+c']);
 assert.equal(posted[1].result?.truncated,true);
 assert.equal(posted[1].result?.failedFederations?.length,1);
 assert.equal(posted[1].result.failedFederations[0].reason,'Invalid federation result');
});

test('three-network Agenda eligibility includes partner-to-partner transfers',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('partners.some((first,i)=>partners.slice(i+1).some(second=>crossEnvelopePair(first,second,task)))'));
});

test('GTFS partner selection scores two-network mission coverage together',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../transport-gtfs-agenda.js'),'utf8');
 assert.ok(source.includes('const federatedCandidates=uniqueCandidates.filter(r=>r.federate)'));
 assert.ok(source.includes('combinations.push([federatedCandidates[i],federatedCandidates[j]])'));
 assert.ok(source.includes('pair.length===2&&crossEnvelopePair(pair[0],pair[1],task)'));
 assert.ok(source.includes('combinations.sort((a,b)=>coveredTasks(b)-coveredTasks(a)'));
 assert.ok(source.includes('const partners=combinations[0]||[]'));
});
