const {test}=require('node:test');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const loader=require('../transport-gtfs-loader.js');
const gtfs=require('../transport-gtfs-index.js');
const files={
 'agency.txt':'agency_name,agency_timezone\nExample,Europe/Paris\n',
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nA,Annecy,45.901,6.122\nB,Albertville,45.675,6.390\n',
 'routes.txt':'route_id,route_short_name,route_type\nR,Y51,3\n',
 'trips.txt':'route_id,service_id,trip_id\nR,WK,T\n',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,10:30:00,10:30:00,A,1\nT,11:48:00,11:48:00,B,2\n',
 'calendar.txt':'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,1,1,20261101,20261130\n',
 'calendar_dates.txt':'service_id,date,exception_type\nWK,20261103,2\n'
};
const resource={id:'test',datasetId:'network',network:'Example',format:'GTFS',url:'https://example.org/feed.zip',updatedAt:'2026-10-30'};
// Independent ZIP fixture writer: compression and CRC are supplied by Node zlib.
function zip(input=files,{method=8,descriptor=false,prefix='',comment='',flags=0,mode=0}={}){
 const locals=[],central=[];let offset=0;
 for(const [filename,text] of Object.entries(input)){
  const name=Buffer.from(prefix+filename),plain=Buffer.from(text),body=method===8?zlib.deflateRawSync(plain):plain;
  const crc=zlib.crc32(plain),bits=flags|(descriptor?8:0),local=Buffer.alloc(30),entry=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(bits,6);local.writeUInt16LE(method,8);
  local.writeUInt16LE(name.length,26);
  if(!descriptor){local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(plain.length,22);}
  const tail=descriptor?Buffer.alloc(16):Buffer.alloc(0);
  if(descriptor){tail.writeUInt32LE(0x08074b50);tail.writeUInt32LE(crc,4);tail.writeUInt32LE(body.length,8);tail.writeUInt32LE(plain.length,12);}
  entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);
  entry.writeUInt16LE(bits,8);entry.writeUInt16LE(method,10);entry.writeUInt32LE(crc,16);
  entry.writeUInt32LE(body.length,20);entry.writeUInt32LE(plain.length,24);entry.writeUInt16LE(name.length,28);
  entry.writeUInt32LE((mode<<16)>>>0,38);entry.writeUInt32LE(offset,42);
  locals.push(local,name,body,tail);central.push(entry,name);offset+=local.length+name.length+body.length+tail.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22),note=Buffer.from(comment);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);
 end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(note.length,20);
 return Buffer.concat([...locals,directory,end,note]);
}
function fetcher(bytes,counter={calls:0}){return async(url,options)=>{
 counter.calls++;assert.equal(url,resource.url);assert.equal(options.credentials,'omit');
 return new Response(bytes,{headers:{'content-type':'application/zip'}});
};}
test('extracts stored/deflated feeds, folder prefixes and streaming ZIP descriptors',async()=>{
 assert.equal(loader.crc32(Buffer.from('123456789')),0xcbf43926);
 for(const options of [{method:0},{method:8,prefix:'feed/',comment:'GTFS feed'},{descriptor:true}]){
  const result=await loader.extractGTFS(zip({...files,'shapes.txt':'ignored geometry'},options));
  assert.equal(result.files['stops.txt'],files['stops.txt']);
  assert.equal(result.files['shapes.txt'],undefined);
  assert.equal(result.expandedBytes,Object.values(files).reduce((n,s)=>n+Buffer.byteLength(s),0));
 }
});
test('native Node fallback works when browser raw DEFLATE streams are unavailable',async()=>{
 const native=globalThis.DecompressionStream;
 try{globalThis.DecompressionStream=undefined;assert.equal((await loader.extractGTFS(zip())).files['trips.txt'],files['trips.txt']);}
 finally{globalThis.DecompressionStream=native;}
});
test('rejects traversal, aliases, encryption and symbolic links',async()=>{
 for(const name of ['../stops.txt','/stops.txt','a\\stops.txt','a/../stops.txt'])
  assert.throws(()=>loader.inspectZip(zip({...files,[name]:'x'})),/Unsafe/);
 assert.throws(()=>loader.inspectZip(zip({...files,'other/stops.txt':files['stops.txt']})),/Duplicate GTFS/);
 assert.throws(()=>loader.inspectZip(zip(files,{flags:1})),/Encrypted/);
 assert.throws(()=>loader.inspectZip(zip(files,{mode:0o120777})),/symbolic/);
 assert.throws(()=>loader.inspectZip(zip(files,{method:12})),/Unsupported GTFS ZIP compression/);
});
test('rejects truncation, CRC corruption, missing tables and oversized expansion',async()=>{
 const valid=zip();assert.throws(()=>loader.inspectZip(valid.subarray(0,valid.length-1)),/directory/);
 const crc=Buffer.from(valid),central=crc.indexOf(Buffer.from([0x50,0x4b,1,2]));
 crc.writeUInt32LE(1,14);crc.writeUInt32LE(1,central+16);
 await assert.rejects(loader.extractGTFS(crc),/checksum mismatch/);
 const incomplete={...files};delete incomplete['trips.txt'];
 assert.throws(()=>loader.inspectZip(zip(incomplete)),/Missing GTFS table/);
 assert.throws(()=>loader.inspectZip(valid,{maxArchiveBytes:10}),/archive exceeds/);
 assert.throws(()=>loader.inspectZip(valid,{maxFileBytes:10}),/Expanded GTFS/);
 assert.throws(()=>loader.inspectZip(valid,{maxExpandedBytes:100}),/Expanded GTFS/);
 assert.throws(()=>loader.inspectZip(valid,{maxEntries:1}),/entry limit/);
 const lie=Buffer.from(valid);lie.writeUInt32LE(1,22);lie.writeUInt32LE(1,central+24);
 await assert.rejects(loader.extractGTFS(lie),/exceeds declared/);
 const localName=Buffer.from(valid);localName[30]=0x58;
 assert.throws(()=>loader.inspectZip(localName),/local header mismatch/);
 const zip64=Buffer.from(valid);zip64.writeUInt16LE(65535,zip64.length-14);zip64.writeUInt16LE(65535,zip64.length-12);
 assert.throws(()=>loader.inspectZip(zip64),/ZIP64/);
 const noCalendar={...files};delete noCalendar['calendar.txt'];delete noCalendar['calendar_dates.txt'];
 assert.throws(()=>loader.inspectZip(zip(noCalendar)),/Missing GTFS service calendar/);
});
test('downloads, extracts and indexes a complete network without confirming availability or access',async()=>{
 const feed=await loader.loadResource(resource,{fetcher:fetcher(zip())});
 assert.deepEqual(feed.index.counts,{stops:2,routes:1,trips:1,stopTimes:2});
 assert.equal(feed.indexedStopTimes,2);assert.equal(feed.rejectedStopTimes,0);
 const trips=gtfs.directTrips(feed.files,feed.index,'2026-11-02','A','B');
 assert.equal(trips.length,1);assert.equal(trips[0].arrival,'11:48:00');
 assert.equal(gtfs.directTrips(feed.files,feed.index,'2026-11-03','A','B').length,0);
 assert.equal(feed.serviceConfirmed,false);assert.equal(feed.faresVerified,false);assert.equal(feed.accessVerified,false);
 assert.equal(feed.source.updatedAt,'2026-10-30');assert.equal(trips[0].priceEUR,null);
});
test('streamed CSV indexing preserves quoted newlines, BOM, empty rows and arbitrary GTFS columns',()=>{
 const text='\uFEFFid,label,extra\r\n1,"Annecy, Gare\nPôle A","Stop ""A"""\r\n\r\n2,Final,kept';
 const rows=[...gtfs.csvRows(text)];
 assert.deepEqual(rows,[{id:'1',label:'Annecy, Gare\nPôle A',extra:'Stop "A"'},
  {id:'2',label:'Final',extra:'kept'}]);
 assert.deepEqual(gtfs.parseCSV(text),rows);
 assert.throws(()=>[...gtfs.csvRows('id\n"unfinished')],/Unclosed/);
 const feed=gtfs.buildIndex({...files,'stop_times.txt':files['stop_times.txt'].replace('stop_sequence\n','stop_sequence,pickup_type\n').replace(',A,1\n',',A,1,1\n').replace(',B,2\n',',B,2,0\n')});
 assert.equal(feed.timesByTrip.get('T')[0].pickup_type,'1');
});
test('invalid headers and disconnected stop times never become a cached network',async()=>{
 for(const changed of [{...files,'routes.txt':'route_id\nR\n'},
   {...files,'stop_times.txt':files['stop_times.txt'].replaceAll(',A,',',UNKNOWN,').replaceAll(',B,',',UNKNOWN,')}]){
  const engine=loader.createLoader({fetcher:fetcher(zip(changed))});
  await assert.rejects(engine.load(resource),/Missing GTFS column|disconnected/);
  assert.equal(engine.stats().cachedFeeds,0);assert.equal(engine.stats().pending,0);
 }
});
test('shares concurrent loads, invalidates by resource version and supports explicit fresh checks',async()=>{
 const counter={calls:0},engine=loader.createLoader({fetcher:fetcher(zip(),counter)});
 const [a,b]=await Promise.all([engine.load(resource),engine.load(resource)]);
 assert.equal(counter.calls,1);assert.equal(a.feed,b.feed);
 assert.equal((await engine.load(resource)).cached,true);
 await engine.load({...resource,updatedAt:'2026-10-31'});assert.equal(counter.calls,2);
 await engine.load(resource,{refresh:true});assert.equal(counter.calls,3);
 engine.clear();assert.equal(engine.stats().cachedFeeds,0);
});
test('cache expires and enforces feed/source-byte budgets',async()=>{
 const counter={calls:0},engine=loader.createLoader({fetcher:fetcher(zip(),counter),ttlMs:1,maxCachedFeeds:1});
 await engine.load(resource);await new Promise(resolve=>setTimeout(resolve,10));
 await engine.load(resource);assert.equal(counter.calls,2);
 await engine.load({...resource,id:'other'});assert.equal(engine.stats().cachedFeeds,1);
 const small=loader.createLoader({fetcher:fetcher(zip()),maxCachedBytes:1});
 await small.load(resource);assert.equal(small.stats().cachedFeeds,0);
});
test('timeout and explicit cancellation terminate loading even if fetch ignores abort',async()=>{
 await assert.rejects(loader.loadResource(resource,{fetcher:()=>new Promise(()=>{}),timeoutMs:5}),/timed out/);
 const controller=new AbortController();
 const request=loader.loadResource(resource,{fetcher:()=>new Promise(()=>{}),signal:controller.signal});
 controller.abort();await assert.rejects(request,{name:'AbortError'});
});
