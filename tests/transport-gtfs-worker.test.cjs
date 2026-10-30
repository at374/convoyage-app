const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const path=require('node:path');
const {createClient}=require('../transport-gtfs-worker-client.js');
const {crc32}=require('../transport-gtfs-loader.js');
function archive(transfers=false,tripCount=1,overnightSide=null){
 const files={
  'agency.txt':'agency_name,agency_timezone\nFixture,Europe/Paris',
  'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nA,Start,45.9,6.1\nB,End,45.8,6.2',
  'routes.txt':'route_id,route_type\nR,3',
  'trips.txt':'route_id,service_id,trip_id\nR,S,T',
  'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,11:00:00,11:00:00,A,1\nT,11:48:00,11:48:00,B,2',
  'calendar_dates.txt':'service_id,date,exception_type\nS,20261102,1'
 };
 if(transfers){
  files['stops.txt']='stop_id,stop_name,stop_lat,stop_lon\nA,Start,45.9,6.1\nX,Change,45.8,6.2\nB,End,45.7,6.3';
  files['routes.txt']='route_id,route_short_name,route_type\nR,One,3\nR2,Two,3';
  files['trips.txt']='route_id,service_id,trip_id\nR,S,T\nR2,S,T2';
  files['stop_times.txt']='trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,11:00:00,11:00:00,A,1\nT,11:20:00,11:20:00,X,2\nT2,11:28:00,11:28:00,X,1\nT2,11:48:00,11:48:00,B,2';
 }
 if(overnightSide){
  const first=overnightSide==='first';
  files['trips.txt']='route_id,service_id,trip_id\nR,S,T';
  files['stop_times.txt']='trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'+(first?
   'T,23:40:00,23:40:00,A,1\nT,24:00:00,24:00:00,X,2':
   'T,00:10:00,00:10:00,X,1\nT,00:40:00,00:40:00,B,2');
  files['calendar_dates.txt']='service_id,date,exception_type\nS,'+(first?'20261102':'20261103')+',1';
 }
 if(tripCount>1){
  const clock=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')+':00';
  files['trips.txt']='route_id,service_id,trip_id\n'+Array.from({length:tripCount},(_,i)=>'R,S,T'+i).join('\n');
  files['stop_times.txt']='trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'+Array.from({length:tripCount},(_,i)=>
   `T${i},${clock(480+i)},${clock(480+i)},A,1\nT${i},${clock(490+i)},${clock(490+i)},B,2`).join('\n');
 }
 const local=[],directory=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const filename=Buffer.from(name),body=Buffer.from(text),header=Buffer.alloc(30),entry=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50);header.writeUInt32LE(crc32(body),14);
  header.writeUInt32LE(body.length,18);header.writeUInt32LE(body.length,22);header.writeUInt16LE(filename.length,26);
  entry.writeUInt32LE(0x02014b50);entry.writeUInt32LE(crc32(body),16);
  entry.writeUInt32LE(body.length,20);entry.writeUInt32LE(body.length,24);entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);
  local.push(header,filename,body);directory.push(entry,filename);offset+=30+filename.length+body.length;
 }
 const central=Buffer.concat(directory),end=Buffer.alloc(22),count=Object.keys(files).length;
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);
 end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,central,end]);
}
// Execute the actual classic browser worker and importScripts dependencies on a
// separate thread. Only the network response is replaced with a synthetic ZIP.
const bootstrap=`
const {parentPort,workerData}=require('node:worker_threads');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const context=vm.createContext({TextDecoder,TextEncoder,Uint8Array,Uint32Array,DataView,
 Blob,Response,DecompressionStream,AbortController,DOMException,Intl,setTimeout,clearTimeout,
 fetch:async url=>url.includes('missing')?new Response('missing',{status:404}):new Response(url.includes('overnight-second')?workerData.secondBytes:workerData.bytes),postMessage:data=>parentPort.postMessage(data)});
context.self=context;
context.importScripts=(...names)=>{for(const name of names)vm.runInContext(fs.readFileSync(path.join(workerData.root,name),'utf8'),context);};
vm.runInContext(fs.readFileSync(path.join(workerData.root,'transport-gtfs-worker.js'),'utf8'),context);
parentPort.on('message',data=>context.onmessage({data}));`;
function factory(mode){
 const thread=new Worker(bootstrap,{eval:true,workerData:{root:path.resolve(__dirname,'..'),bytes:archive(mode===true||mode==='overnight',mode==='dense'?120:1,mode==='overnight'?'first':null),secondBytes:mode==='overnight'?archive(true,1,'second'):null}});
 const adapter={postMessage:data=>thread.postMessage(data),terminate:()=>thread.terminate()};
 thread.on('message',data=>adapter.onmessage?.({data}));thread.on('error',error=>adapter.onerror?.(error));
 return adapter;
}
const resource={id:'fixture',url:'https://example.org/fixture.zip',format:'GTFS'};
test('real worker loads, returns only metadata, and queries dated trips and nearby stops',async t=>{
 const client=createClient({workerFactory:factory});t.after(()=>client.dispose());
 const loaded=await client.load(resource);
 assert.equal(loaded.counts.stops,2);assert.equal(loaded.indexedStopTimes,2);
 assert.equal(loaded.index,undefined);assert.equal(loaded.files,undefined);
 assert.equal(loaded.serviceConfirmed,false);assert.equal(loaded.faresVerified,false);
 const queries=await Promise.all([
  client.query({method:'directTrips',date:'2026-11-02',from:'A',to:'B'}),
  client.query({method:'nearbyStops',lat:45.9,lon:6.1,radiusMeters:50000,limit:1})
 ]);
 assert.equal(queries[0].rows[0].arrival,'11:48:00');assert.equal(queries[0].rows[0].priceEUR,null);
 assert.equal(queries[0].rows[0].serviceConfirmed,false);
 assert.equal(queries[1].rows[0].stopId,'A');assert.equal(queries[1].truncated,true);
 assert.equal((await client.query({method:'directTrips',date:'2026-11-03',from:'A',to:'B'})).rows.length,0);
 await assert.rejects(client.query({method:'directTrips',date:'2026-02-30',from:'A',to:'B'}),/Invalid service date/);
 await assert.rejects(client.query({method:'scheduledTrips'}),/Unsupported/);
 await assert.rejects(client.query({method:'nearbyStops',limit:501}),/limit/);
 const nearby=await client.query({method:'nearbyDirectTrips',date:'2026-11-02',
  origin:{lat:45.9,lon:6.1},destination:{lat:45.8,lon:6.2}});
 assert.equal(nearby.rows[0].originStop.stopId,'A');
 assert.equal(nearby.rows[0].destinationStop.stopId,'B');
 assert.equal(nearby.rows[0].accessVerified,false);
 assert.equal(nearby.rows[0].arrival,'11:48:00');
 await assert.rejects(client.query({method:'nearbyDirectTrips',radiusMeters:5001}),/radius/);
 assert.equal(client.stats().pending,0);
});
test('replacing or clearing a worker rejects pending work and permits a fresh load',async t=>{
 const client=createClient({workerFactory:factory});t.after(()=>client.dispose());
 const old=client.load(resource);const rejected=assert.rejects(old,{name:'AbortError'});
 await client.load(resource);await rejected;
 const query=client.query({method:'nearbyStops',lat:45.9,lon:6.1});
 const cancelled=assert.rejects(query,{name:'AbortError'});client.clear();await cancelled;
 assert.equal(client.stats().running,false);
 await assert.rejects(client.query({}),/Load a network/);
 await client.load(resource);
});
test('abort terminates the worker, while an already aborted request preserves current network',async t=>{
 const client=createClient({workerFactory:factory});t.after(()=>client.dispose());
 const controller=new AbortController();const load=client.load(resource,{signal:controller.signal});
 const rejected=assert.rejects(load,{name:'AbortError'});controller.abort();await rejected;
 assert.deepEqual(client.stats(),{running:false,pending:0,disposed:false});
 await client.load(resource);
 await assert.rejects(client.load(resource,{signal:controller.signal}),{name:'AbortError'});
 assert.equal(client.stats().running,true);
});
test('deadline terminates even a worker stuck in synchronous work and releases all requests',async()=>{
 let terminated=0;
 const client=createClient({timeoutMs:20,workerFactory:()=>({postMessage(){},terminate(){terminated++;}})});
 const load=client.load(resource),query=client.query({});
 await Promise.all([assert.rejects(load,/timed out/),assert.rejects(query,/timed out/)]);
 assert.equal(terminated,1);assert.equal(client.stats().pending,0);client.dispose();
 await assert.rejects(client.load(resource),/disposed/);
});
test('queue limits, worker errors and structured clone failures reject cleanly',async()=>{
 let fake;
 const client=createClient({maxPending:1,workerFactory:()=>fake={postMessage(){},terminate(){}}});
 const load=client.load(resource),failure=assert.rejects(load,/worker failed/);
 await assert.rejects(client.query({}),/Too many/);fake.onerror();await failure;
 client.dispose();
 const broken=createClient({workerFactory:()=>({postMessage(){throw new Error('clone failed');},terminate(){}})});
 await assert.rejects(broken.load(resource),/clone failed/);assert.equal(broken.stats().pending,0);broken.dispose();
});
test('mission worker applies time windows before limiting and keeps timetable-only status',async t=>{
 const client=createClient({workerFactory:factory});t.after(()=>client.dispose());
 await client.load(resource);
 const query={method:'missionDirectTrips',date:'2026-11-02',origin:{lat:45.9,lon:6.1},
  destination:{lat:45.8,lon:6.2},limit:1};
 const [valid,late]=await Promise.all([
  client.query({...query,window:{earliestDeparture:'2026-11-02T11:00:00+01:00',latestArrival:'2026-11-02T12:18:00+01:00'}}),
  client.query({...query,window:{earliestDeparture:'2026-11-02T11:00:01+01:00'}})
 ]);
 assert.equal(valid.rows.length,1);assert.equal(valid.rows[0].departure,'2026-11-02T10:00:00.000Z');
 assert.equal(valid.rows[0].arrival,'2026-11-02T10:48:00.000Z');
 assert.equal(valid.rows[0].timetableOnly,true);assert.equal(valid.rows[0].accessVerified,false);
 assert.equal(valid.rows[0].priceEUR,null);assert.equal(valid.truncated,false);
 assert.equal(late.rows.length,0);
 await assert.rejects(client.query(query),/window/);
 await assert.rejects(client.query({...query,window:{latestArrival:'2026-11-02T12:00:00'}}),/timezone/);
});

test('worker combines direct search with dated single-transfer journeys',async t=>{
 const client=createClient({workerFactory:()=>factory(true)});t.after(()=>client.dispose());
 await client.load(resource);
 const answer=await client.query({method:'missionJourneys',date:'2026-11-02',
  origin:{lat:45.9,lon:6.1},destination:{lat:45.7,lon:6.3},
  window:{earliestDeparture:'2026-11-02T11:00:00+01:00',latestArrival:'2026-11-02T12:18:00+01:00'}});
 assert.equal(answer.rows.length,1);assert.equal(answer.searchTruncated,false);
 const row=answer.rows[0];assert.equal(row.legs.length,2);
 assert.equal(row.transferStop.name,'Change');assert.equal(row.transferMinutes,8);
 assert.equal(row.departure,'2026-11-02T10:00:00.000Z');assert.equal(row.arrival,'2026-11-02T10:48:00.000Z');
 assert.equal(row.transferVerified,false);assert.equal(row.serviceConfirmed,false);assert.equal(row.priceEUR,null);
});

test('two scoped networks retain namespaces and expose unverified inter-network candidates',async t=>{
 const client=createClient({workerFactory:()=>factory(true)});t.after(()=>client.dispose());
 const resources=[{...resource,datasetId:'A',network:'A'},{...resource,datasetId:'B',network:'B'}];
 const loaded=await client.loadNetworks(resources,{indexServiceDates:['2026-11-02']});
 assert.equal(loaded.networks.length,2);assert.equal(loaded.partial,false);
 const answer=await client.query({method:'missionJourneys',date:'2026-11-02',origin:{lat:45.9,lon:6.1},destination:{lat:45.7,lon:6.3},window:{earliestDeparture:'2026-11-02T10:00:00Z',latestArrival:'2026-11-02T11:18:00Z'}});
 const cross=answer.rows.filter(row=>row.interNetwork);
 assert.equal(cross.length,2);assert.equal(cross[0].walkingDurationSeconds,null);
 assert.notEqual(cross[0].legs[0].networkId,cross[0].legs[1].networkId);
 assert.equal(cross[0].transferVerified,false);assert.equal(cross[0].priceEUR,null);
 await assert.rejects(client.query({method:'directTrips',date:'2026-11-03',from:'A',to:'B'}),/scope/);
});
test('secondary network failure preserves the primary results and flags partial coverage',async t=>{
 const client=createClient({workerFactory:()=>factory(true)});t.after(()=>client.dispose());
 await assert.rejects(client.loadNetworks([resource]),/Service dates required/);
 const loaded=await client.loadNetworks([{...resource,datasetId:'A'},{...resource,datasetId:'B',url:'https://example.org/missing.zip'}],{indexServiceDates:['2026-11-02']});
 assert.equal(loaded.partial,true);assert.ok(loaded.networks[1].error);
 const result=await client.query({method:'missionJourneys',date:'2026-11-02',origin:{lat:45.9,lon:6.1},destination:{lat:45.7,lon:6.3},window:{earliestDeparture:'2026-11-02T10:00:00Z',latestArrival:'2026-11-02T11:18:00Z'}});
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].interNetwork,undefined);
});

test('mission departure order is applied before truncation and preserves the latest outbound trips',async t=>{
 const client=createClient({workerFactory:()=>factory('dense')});t.after(()=>client.dispose());
 await client.load(resource);
 const query={method:'missionJourneys',date:'2026-11-02',origin:{lat:45.9,lon:6.1},destination:{lat:45.8,lon:6.2},
  window:{latestArrival:'2026-11-02T12:00:00+01:00'},limit:100};
 const early=await client.query(query),late=await client.query({...query,order:'latestDeparture'});
 assert.equal(early.rows.length,100);assert.equal(late.rows.length,100);
 assert.equal(early.rows[0].tripId,'T0');assert.equal(early.rows.at(-1).tripId,'T99');
 assert.equal(late.rows[0].tripId,'T119');assert.equal(late.rows.at(-1).tripId,'T20');
 assert.equal(early.truncated,true);assert.equal(late.truncated,true);
 assert.equal(late.rows[0].serviceConfirmed,false);assert.equal(late.rows[0].priceEUR,null);
 const filtered=await client.query({...query,order:'latestDeparture',limit:1,window:{latestArrival:'2026-11-02T10:00:00+01:00'}});
 assert.equal(filtered.rows[0].tripId,'T80');assert.equal(filtered.rows[0].arrival,'2026-11-02T08:30:00.000Z');
 await assert.rejects(client.query({...query,connectionDates:[]}),/service dates/);
 await assert.rejects(client.query({...query,connectionDates:['2026-11-02','2026-02-30']}),/date/);
 await assert.rejects(client.query({...query,method:'missionDirectTrips',connectionDates:['2026-11-02']}),/mission journey/);
 await assert.rejects(client.query({...query,order:'cheapest'}),/order/);
 await assert.rejects(client.query({...query,method:'nearbyDirectTrips',order:'latestDeparture'}),/order/);
});

test('real worker finds a two-network interchange between explicit service dates',async t=>{
 const client=createClient({workerFactory:()=>factory('overnight')});t.after(()=>client.dispose());
 await client.loadNetworks([{...resource,datasetId:'A'},
  {...resource,datasetId:'B',url:'https://example.org/overnight-second.zip'}],{indexServiceDates:['2026-11-02','2026-11-03']});
 const query={method:'missionJourneys',date:'2026-11-02',origin:{lat:45.9,lon:6.1},destination:{lat:45.7,lon:6.3},
  window:{earliestDeparture:'2026-11-02T23:00:00+01:00',latestArrival:'2026-11-03T01:10:00+01:00'}};
 assert.equal((await client.query(query)).rows.length,0);
 const answer=await client.query({...query,connectionDates:['2026-11-02','2026-11-03']});
 assert.equal(answer.rows.length,1);assert.equal(answer.truncated,false);
 assert.deepEqual(answer.rows[0].serviceDates,['2026-11-02','2026-11-03']);
 assert.equal(answer.rows[0].transferMinutes,10);assert.equal(answer.rows[0].serviceConfirmed,false);
 assert.equal((await client.query({...query,date:'2026-11-03',connectionDates:['2026-11-02','2026-11-03']})).rows.length,0);
 await assert.rejects(client.query({...query,connectionDates:['2026-11-02','2026-11-04']}),/scope/);
});
