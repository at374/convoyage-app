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
      updatedAt:r.updated_at??r.last_updated_at??null,
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
function byNetwork(datasets,term){
  const query=String(term||'').trim().toLocaleLowerCase('fr');
  if(!query)return [];
  return (Array.isArray(datasets)?datasets:[]).filter(d=>
    String(d.name||'').toLocaleLowerCase('fr').includes(query));
}
async function fetchCatalogue(fetcher){
  if(typeof fetcher!=='function')throw new TypeError('fetch required');
  const response=await fetcher(ENDPOINT);
  if(!response?.ok)throw new Error('PAN catalogue unavailable');
  return normalize(await response.json());
}
const api={ENDPOINT,normalize,gtfsResources,byNetwork,fetchCatalogue};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportCatalogue=api;
})(typeof window!=='undefined'?window:globalThis);
