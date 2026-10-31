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
const api={ENDPOINT,normalize,gtfsResources,downloadGTFS,byNetwork,fetchCatalogue};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportCatalogue=api;
})(typeof window!=='undefined'?window:globalThis);
