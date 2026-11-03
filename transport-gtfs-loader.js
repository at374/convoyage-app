/* ZIP -> static GTFS index. No realtime, fare or walking-access confirmation. */
(function(root){
'use strict';
const node=typeof module==='object'&&module.exports;
const catalogue=node?require('./transport-catalogue.js'):root.CPTransportCatalogue;
const gtfs=node?require('./transport-gtfs-index.js'):root.CPGTFSIndex;
const DEFAULT_LIMITS=Object.freeze({maxArchiveBytes:20*1024*1024,maxFileBytes:64*1024*1024,
 maxExpandedBytes:128*1024*1024,maxEntries:128});
const TABLES=new Set(['agency.txt','stops.txt','routes.txt','trips.txt','stop_times.txt',
 'calendar.txt','calendar_dates.txt','transfers.txt','feed_info.txt','fare_attributes.txt','fare_rules.txt']);
const REQUIRED={
 'agency.txt':['agency_name','agency_timezone'],
 'stops.txt':['stop_id','stop_name','stop_lat','stop_lon'],
 'routes.txt':['route_id','route_type'],
 'trips.txt':['route_id','service_id','trip_id'],
 'stop_times.txt':['trip_id','arrival_time','departure_time','stop_id','stop_sequence']
};
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function limits(options={}){
 const result={...DEFAULT_LIMITS,...options};
 for(const key of Object.keys(DEFAULT_LIMITS))if(!Number.isSafeInteger(result[key])||result[key]<=0)throw new Error('Invalid ZIP limit: '+key);
 return result;
}
function aborted(signal){if(signal?.aborted)throw new DOMException('GTFS loading cancelled','AbortError');}
function inspectZip(bytes,options={}){
 const cap=limits(options);
 if(!(bytes instanceof Uint8Array)||bytes.length<22)throw new Error('Invalid ZIP archive');
 if(bytes.length>cap.maxArchiveBytes)throw new Error('ZIP archive exceeds size limit');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
  if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){end=p;break;}
 }
 if(end<0)throw new Error('ZIP central directory not found');
 const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
 if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count)throw new Error('Multi-volume ZIP unsupported');
 if(count===65535||size===0xffffffff||offset===0xffffffff)throw new Error('ZIP64 unsupported');
 if(count>cap.maxEntries||offset+size!==end)throw new Error('Invalid ZIP directory or entry limit');
 let position=offset,expandedBytes=0;
 const entries=[],names=new Set(),tables=new Set(),prefixes=new Set(),intervals=[];
 for(let i=0;i<count;i++){
  if(position+46>end||view.getUint32(position,true)!==0x02014b50)throw new Error('Invalid ZIP directory entry');
  const flags=view.getUint16(position+8,true),method=view.getUint16(position+10,true);
  const checksum=view.getUint32(position+16,true),compressedSize=view.getUint32(position+20,true),uncompressedSize=view.getUint32(position+24,true);
  const nameLength=view.getUint16(position+28,true),extraLength=view.getUint16(position+30,true),commentLength=view.getUint16(position+32,true);
  const localOffset=view.getUint32(position+42,true),mode=view.getUint32(position+38,true)>>>16;
  const next=position+46+nameLength+extraLength+commentLength;
  if(next>end||!nameLength||view.getUint16(position+34,true)!==0)throw new Error('Invalid ZIP filename or disk');
  if(flags&0x41)throw new Error('Encrypted ZIP unsupported');
  if([compressedSize,uncompressedSize,localOffset].includes(0xffffffff))throw new Error('ZIP64 entry unsupported');
  if((mode&0xf000)===0xa000)throw new Error('ZIP symbolic links unsupported');
  const nameBytes=bytes.subarray(position+46,position+46+nameLength);
  if(!(flags&0x800)&&nameBytes.some(b=>b>127))throw new Error('Non-UTF8 ZIP filename unsupported');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(nameBytes);
  const directory=name.endsWith('/'),parts=(directory?name.slice(0,-1):name).split('/');
  if(/[\\\0:]/.test(name)||parts.some(p=>!p||p==='.'||p==='..'))throw new Error('Unsafe ZIP path');
  if(names.has(name))throw new Error('Duplicate ZIP path');
  names.add(name);
  if(localOffset+30>offset||view.getUint32(localOffset,true)!==0x04034b50)throw new Error('Invalid ZIP local header');
  const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true);
  const start=localOffset+30+localNameLength+localExtraLength,stop=start+compressedSize;
  if(stop>offset||view.getUint16(localOffset+6,true)!==flags||view.getUint16(localOffset+8,true)!==method||
     localNameLength!==nameLength||!nameBytes.every((b,j)=>bytes[localOffset+30+j]===b))throw new Error('ZIP local header mismatch');
  let physicalEnd=stop;
  if(flags&8){
   let descriptor=stop;
   if(descriptor+4<=offset&&view.getUint32(descriptor,true)===0x08074b50)descriptor+=4;
   if(descriptor+12>offset||view.getUint32(descriptor,true)!==checksum||
      view.getUint32(descriptor+4,true)!==compressedSize||view.getUint32(descriptor+8,true)!==uncompressedSize)throw new Error('Invalid ZIP data descriptor');
   physicalEnd=descriptor+12;
  }else if(view.getUint32(localOffset+14,true)!==checksum||view.getUint32(localOffset+18,true)!==compressedSize||
           view.getUint32(localOffset+22,true)!==uncompressedSize)throw new Error('ZIP local size or checksum mismatch');
  intervals.push([localOffset,physicalEnd]);
  const table=parts[parts.length-1].toLowerCase();
  if(!directory&&TABLES.has(table)){
   if(method!==0&&method!==8)throw new Error('Unsupported GTFS ZIP compression');
   if(tables.has(table))throw new Error('Duplicate GTFS table');
   if(uncompressedSize>cap.maxFileBytes||(expandedBytes+=uncompressedSize)>cap.maxExpandedBytes)throw new Error('Expanded GTFS exceeds size limit');
   tables.add(table);prefixes.add(parts.slice(0,-1).join('/'));
   entries.push({name,table,method,checksum,compressedSize,uncompressedSize,start,stop});
  }
  position=next;
 }
 if(position!==end)throw new Error('ZIP directory size mismatch');
 intervals.sort((a,b)=>a[0]-b[0]);
 if(intervals.some((range,i)=>i&&range[0]<intervals[i-1][1]))throw new Error('Overlapping ZIP entries');
 if(prefixes.size>1)throw new Error('GTFS tables split across directories');
 for(const name of Object.keys(REQUIRED))if(!tables.has(name))throw new Error('Missing GTFS table: '+name);
 if(!tables.has('calendar.txt')&&!tables.has('calendar_dates.txt'))throw new Error('Missing GTFS service calendar');
 return {entries,expandedBytes,archiveBytes:bytes.length};
}
async function inflate(bytes,entry,signal){
 aborted(signal);
 if(entry.method===0){
  if(entry.compressedSize!==entry.uncompressedSize)throw new Error('Stored ZIP size mismatch');
  return bytes.subarray(entry.start,entry.stop);
 }
 let stream;
 try{stream=new Blob([bytes.subarray(entry.start,entry.stop)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch(_){
  if(!node)throw new Error('Raw DEFLATE unavailable in this browser');
  const inflater=require('node:zlib').createInflateRaw();
  stream=require('node:stream').Readable.toWeb(inflater);inflater.end(bytes.subarray(entry.start,entry.stop));
 }
 const reader=stream.getReader(),chunks=[];let size=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  while(true){
   aborted(signal);const {done,value}=await reader.read();aborted(signal);if(done)break;
   size+=value.byteLength;
   if(size>entry.uncompressedSize)throw new Error('Inflated GTFS exceeds declared size');
   chunks.push(value);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
 if(size!==entry.uncompressedSize)throw new Error('Inflated GTFS size mismatch');
 const output=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength;}
 return output;
}
async function extractGTFS(bytes,{signal,...options}={}){
 const manifest=inspectZip(bytes,options),files=Object.create(null);
 for(const entry of manifest.entries){
  aborted(signal);const output=await inflate(bytes,entry,signal);
  if(crc32(output)!==entry.checksum)throw new Error('GTFS ZIP checksum mismatch: '+entry.table);
  files[entry.table]=new TextDecoder('utf-8',{fatal:true}).decode(output);
 }
 return {files,archiveBytes:manifest.archiveBytes,expandedBytes:manifest.expandedBytes};
}
function validateTables(files){
 const columnsByTable={...REQUIRED};
 if(files['calendar.txt']!==undefined)columnsByTable['calendar.txt']=['service_id','monday','tuesday','wednesday','thursday','friday','saturday','sunday','start_date','end_date'];
 if(files['calendar_dates.txt']!==undefined)columnsByTable['calendar_dates.txt']=['service_id','date','exception_type'];
 for(const [name,columns] of Object.entries(columnsByTable)){
  // Inspect headers without parsing large tables twice.
  const names=files[name].split('\n',1)[0].replace(/^\uFEFF/,'').trim().split(',').map(s=>s.replace(/^"|"$/g,''));
  if(columns.some(column=>!names.includes(column)))throw new Error('Missing GTFS column in '+name);
 }
 const agencies=gtfs.parseCSV(files['agency.txt']);
 if(!agencies.length)throw new Error('Missing GTFS agency');
 for(const agency of agencies){
  if(!agency.agency_name||!agency.agency_timezone)throw new Error('Missing GTFS agency timezone or name');
  new Intl.DateTimeFormat('en',{timeZone:agency.agency_timezone});
 }
}
async function loadResource(resource,{fetcher=root.fetch,signal,timeoutMs=30000,indexServiceDates=null,retainSourceTables=true,...options}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0)throw new Error('Invalid GTFS timeout');
 const cap=limits(options),controller=new AbortController();let timer,rejectCancellation;
 const cancellation=new Promise((_,reject)=>{rejectCancellation=reject;});
 const cancel=()=>{controller.abort();rejectCancellation(new DOMException('GTFS loading cancelled','AbortError'));};
 signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted)controller.abort();
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('GTFS loading timed out'));},timeoutMs);});
 const job=(async()=>{
  aborted(controller.signal);
  let resolved=resource;
  if(resource?.resolveFromCatalogue){
   const datasets=await catalogue.fetchCatalogue(fetcher,{signal:controller.signal});
   const candidates=catalogue.gtfsResources(datasets.filter(d=>d.id===resource.datasetId));
   if(!candidates.length)throw new Error('GTFS network not found in current catalogue');
   resolved=[...candidates].sort((a,b)=>(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)||
    (a.id===resource.id?-1:b.id===resource.id?1:0))[0];
  }
  const bytes=await catalogue.downloadGTFS(resolved,fetcher,cap.maxArchiveBytes,{signal:controller.signal});
  const extracted=await extractGTFS(bytes,{...cap,signal:controller.signal});
  validateTables(extracted.files);aborted(controller.signal);
  let serviceIds=null,dates=null;
  if(indexServiceDates!==null){
   if(!Array.isArray(indexServiceDates)||!indexServiceDates.length||indexServiceDates.length>7)throw new Error('Invalid GTFS index service dates');
   dates=[...new Set(indexServiceDates)];serviceIds=new Set();
   for(const date of dates)for(const id of gtfs.activeServices(extracted.files,date))serviceIds.add(id);
  }
  const index=gtfs.buildIndex(extracted.files,{serviceIds});
  const indexedStopTimes=[...index.timesByTrip.values()].reduce((total,rows)=>total+rows.length,0);
  if(!index.counts.stops||!index.counts.routes||!index.sourceTrips||!index.counts.stopTimes||(!indexedStopTimes&&!index.skippedStopTimes))throw new Error('Empty or disconnected GTFS index');
  const files=retainSourceTables?extracted.files:Object.fromEntries(Object.entries(extracted.files).filter(([name])=>['agency.txt','calendar.txt','calendar_dates.txt','transfers.txt','feed_info.txt'].includes(name)));
  return {...extracted,files,index,indexServiceDates:dates,source:{datasetId:resolved.datasetId||null,resourceId:resolved.id||null,
   network:resolved.network||resource.network||null,url:resolved.url,updatedAt:resolved.updatedAt||null,loadedAt:new Date().toISOString()},
   indexedStopTimes,skippedStopTimes:index.skippedStopTimes,rejectedStopTimes:index.counts.stopTimes-indexedStopTimes-index.skippedStopTimes,
   serviceConfirmed:false,faresVerified:false,accessVerified:false};
 })();
 try{return await Promise.race([job,deadline,cancellation]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
function createLoader({ttlMs=300000,maxCachedFeeds=2,maxCachedBytes=128*1024*1024,...options}={}){
 for(const value of [ttlMs,maxCachedFeeds,maxCachedBytes])if(!Number.isSafeInteger(value)||value<=0)throw new Error('Invalid GTFS cache limit');
 const cache=new Map(),pending=new Map();let cachedBytes=0,generation=0;
 const key=r=>JSON.stringify([r?.datasetId,r?.id,r?.url,r?.updatedAt]);
 function remove(id){const entry=cache.get(id);if(entry){cachedBytes-=entry.feed.expandedBytes;cache.delete(id);}}
 async function load(resource,{refresh=false}={}){
  const id=key(resource),known=cache.get(id);
  if(!refresh&&known&&Date.now()-known.at<ttlMs){cache.delete(id);cache.set(id,known);return {feed:known.feed,cached:true};}
  if(pending.has(id))return pending.get(id);
  remove(id);const current=generation;
  const task=loadResource(resource,options).then(feed=>{
   if(current===generation&&feed.expandedBytes<=maxCachedBytes){
    while(cache.size>=maxCachedFeeds||cachedBytes+feed.expandedBytes>maxCachedBytes)remove(cache.keys().next().value);
    cache.set(id,{feed,at:Date.now()});cachedBytes+=feed.expandedBytes;
   }
   return {feed,cached:false};
  }).finally(()=>{if(pending.get(id)===task)pending.delete(id);});
  pending.set(id,task);return task;
 }
 return {load,clear:()=>{generation++;cache.clear();pending.clear();cachedBytes=0;},
  stats:()=>({cachedFeeds:cache.size,cachedSourceBytes:cachedBytes,pending:pending.size})};
}
const api={DEFAULT_LIMITS,crc32,inspectZip,extractGTFS,loadResource,createLoader};
if(node)module.exports=api;
root.CPGTFSLoader=api;
})(typeof window!=='undefined'?window:globalThis);
