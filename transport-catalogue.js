/* National transport data catalogue discovery; metadata only, not journey availability. */
(function(root){
'use strict';
const ENDPOINT='https://transport.data.gouv.fr/api/datasets';
function list(payload){
  if(Array.isArray(payload))return payload;
  if(Array.isArray(payload?.data))return payload.data;
  if(Array.isArray(payload?.datasets))return payload.datasets;
  return [];
}
function resources(dataset){
  return Array.isArray(dataset?.resources)?dataset.resources:[];
}
function normalize(payload){
  return list(payload).map(dataset=>({
    id:String(dataset.id??dataset.slug??''),
    name:String(dataset.title??dataset.name??''),
    resources:resources(dataset).filter(r=>r&&typeof r==='object').map(r=>({
      id:String(r.id??''),
      name:String(r.title??r.name??''),
      format:String(r.format??r.type??'').toUpperCase(),
      url:typeof r.original_url==='string'?r.original_url:(typeof r.url==='string'?r.url:null),
      updatedAt:r.updated_at??r.last_updated_at??r.updated??null,
      sourcePage:typeof dataset.page_url==='string'?dataset.page_url:null
    })).filter(r=>r.url&&/^https:\/\//i.test(r.url))
  })).filter(d=>d.id&&d.resources.length);
}
function gtfsResources(datasets){
  return (Array.isArray(datasets)?datasets:[]).flatMap(dataset=>
    (Array.isArray(dataset.resources)?dataset.resources:[])
      .filter(resource=>resource.format==='GTFS'&&
        typeof resource.url==='string'&&resource.url.startsWith('https://'))
      .map(resource=>({...resource,datasetId:dataset.id,network:dataset.name})));
}
async function downloadGTFS(resource,fetcher,limitBytes=20*1024*1024,{signal}={}){
  if(typeof fetcher!=='function')throw new TypeError('fetch required');
  if(!resource||resource.format!=='GTFS'||typeof resource.url!=='string'||
      !/^https:\/\//i.test(resource.url))throw new Error('Invalid GTFS resource');
  if(!Number.isSafeInteger(limitBytes)||limitBytes<=0)throw new Error('Invalid size limit');
  if(signal?.aborted)throw new DOMException('GTFS download cancelled','AbortError');
  const response=await fetcher(resource.url,{redirect:'follow',credentials:'omit',cache:'no-cache',signal});
  if(!response?.ok)throw new Error('GTFS download failed');
  if(response.url && !/^https:\/\//i.test(response.url))throw new Error('Insecure GTFS redirect');
  const contentType=response.headers?.get?.('content-type')||'';
  if(/text\/html/i.test(contentType))throw new Error('GTFS resource returned HTML');
  const declared=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(declared)&&declared>limitBytes)throw new Error('GTFS exceeds size limit');
  if(!response.body?.getReader)throw new Error('Streaming response required');
  const reader=response.body.getReader(),chunks=[];
  const cancel=()=>{reader.cancel().catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  let size=0;
  try{
    while(true){
      if(signal?.aborted)throw new DOMException('GTFS download cancelled','AbortError');
      const {done,value}=await reader.read();
      if(signal?.aborted)throw new DOMException('GTFS download cancelled','AbortError');
      if(done)break;
      size+=value.byteLength;
      if(size>limitBytes)throw new Error('GTFS exceeds size limit');
      chunks.push(value);
    }
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{signal?.removeEventListener('abort',cancel);reader.releaseLock?.();}
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(size<4||bytes[0]!==0x50||bytes[1]!==0x4b||
    !((bytes[2]===3&&bytes[3]===4)||(bytes[2]===5&&bytes[3]===6)))
    throw new Error('GTFS is not a ZIP archive');
  return bytes;
}
function byNetwork(datasets,term){
  const query=String(term||'').trim().toLocaleLowerCase('fr');
  if(!query)return [];
  return (Array.isArray(datasets)?datasets:[]).filter(d=>
    String(d.name||'').toLocaleLowerCase('fr').includes(query));
}
async function fetchCatalogue(fetcher,{signal}={}){
  if(typeof fetcher!=='function')throw new TypeError('fetch required');
  const response=await fetcher(ENDPOINT,{credentials:'omit',cache:'no-cache',signal});
  if(!response?.ok)throw new Error('PAN catalogue unavailable');
  return normalize(await response.json());
}
// Swiss national GTFS includes operators serving Geneva; coverage in Ain must be
// verified from stop coordinates and trips, never inferred from this catalogue.
const SWISS_DATASET='https://data.opentransportdata.swiss/api/3/action/package_show?id=timetable-2026-gtfs2020';
function swissGTFSResources(payload){
  if(payload?.success!==true||!Array.isArray(payload?.result?.resources))return [];
  return payload.result.resources.filter(r=>r&&typeof r==='object'&&
    /\.zip(?:$|[?#])/i.test(r.url||'')&&/^https:\/\//i.test(r.url||'')&&
    /GTFS/i.test(String(r.name||r.description||''))).map(r=>({
      id:String(r.id||''),name:String(r.name||''),datasetId:'timetable-2026-gtfs2020',
      network:'Transports publics suisses (GTFS national)',format:'GTFS',
      url:r.url,updatedAt:r.last_modified||r.created||null,
      sourcePage:'https://data.opentransportdata.swiss/fr/dataset/timetable-2026-gtfs2020',
      // National archives may exceed the mobile loader's 20 MB safety limit.
      requiresServerSideIndex:true
    })).filter(r=>r.id);
}
// Select the latest published snapshot for the requested timetable year.
// Do not mix 2026 and 2027 schedules around the December changeover.
function latestSwissGTFSResource(resources,year){
  if(!Number.isInteger(year)||year<2020||year>2100)return null;
  const matches=(Array.isArray(resources)?resources:[]).filter(r=>r&&
    r.requiresServerSideIndex===true&&r.format==='GTFS'&&
    typeof r.url==='string'&&r.url.startsWith('https://')&&
    r.datasetId==='timetable-'+year+'-gtfs2020'&&
    new RegExp('(?:^|[^0-9])FP'+year+'[_-]([0-9]{8})(?:[^0-9]|$)','i').test(r.name||''));
  return matches.sort((a,b)=>String(b.name).localeCompare(String(a.name)))[0]||null;
}
async function fetchSwissGTFSResources(fetcher,{signal}={}){
  if(typeof fetcher!=='function')throw new TypeError('fetch required');
  const response=await fetcher(SWISS_DATASET,{credentials:'omit',cache:'no-cache',signal});
  if(!response?.ok)throw new Error('Swiss GTFS catalogue unavailable');
  return swissGTFSResources(await response.json());
}
// Source discovery only: timetable coverage does not imply live ticket prices or seat inventory.
const NATIONAL_OPERATORS=Object.freeze({
 sncf:/\b(?:sncf|tgv|intercit[eé]s|ter)\b/i,
 blablacarBus:/blablacar[\s-]*bus/i,
 flixbus:/\bflix(?:bus|train)\b/i
});
function nationalOperatorGTFS(datasets){
 const rows=Array.isArray(datasets)?datasets:[];
 const result={};
 for(const [operator,pattern] of Object.entries(NATIONAL_OPERATORS)){
  result[operator]=gtfsResources(rows.map(d=>({ ...d,resources:(Array.isArray(d.resources)?d.resources:[])
   .filter(r=>pattern.test(String(d.name||''))||pattern.test(String(r?.name||''))) })))
   .filter(r=>/^https:\/\//i.test(r.url))
   .map(r=>({...r,operator,providesLiveFares:false,providesSeatAvailability:false,
     timetableOnly:true,requiresServerSideIndex:true}));
 }
 return result;
}
async function fetchNationalOperatorGTFS(fetcher,{signal}={}){
 const datasets=await fetchCatalogue(fetcher,{signal});
 const found=nationalOperatorGTFS(datasets);
 for(const operator of Object.keys(found)){
  const seen=new Set();
  found[operator]=found[operator].filter(resource=>{
   const key=resource.datasetId+'|'+resource.id+'|'+resource.url;
   if(seen.has(key))return false;
   seen.add(key);return true;
  });
 }
 return found;
}
const api={ENDPOINT,normalize,gtfsResources,nationalOperatorGTFS,fetchNationalOperatorGTFS,downloadGTFS,byNetwork,fetchCatalogue,SWISS_DATASET,swissGTFSResources,fetchSwissGTFSResources,latestSwissGTFSResource};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportCatalogue=api;
})(typeof window!=='undefined'?window:globalThis);
