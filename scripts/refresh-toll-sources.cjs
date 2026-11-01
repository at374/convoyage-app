'use strict';
// Download official tables without replacing the operational route catalogue.
const fs=require('node:fs/promises');
const path=require('node:path');
const {parseFeed,coverage}=require('../toll-official-catalogue.cjs');
const config=require('../data/tolls/sources-2026.json');
const MAX_BYTES=4*1024*1024;
async function download(url,fetcher){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 let reader;
 try{
  const r=await fetcher(url,{signal:controller.signal,redirect:'error'});
  if(!r.ok)throw Error('HTTP '+r.status);
  if(Number(r.headers.get('content-length'))>MAX_BYTES)throw Error('Source exceeds size limit');
  reader=r.body.getReader();const chunks=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;if(total>MAX_BYTES)throw Error('Source exceeds size limit');chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks);
 }finally{clearTimeout(timer);if(reader)await reader.cancel().catch(()=>{});}
}
async function atomic(file,data){
 await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';
 await fs.writeFile(tmp,JSON.stringify(data)+'\n');await fs.rename(tmp,file);
}
async function refresh({directory,fetcher=fetch,now=new Date()}={}){
 const dir=directory||path.join(__dirname,'../data/tolls/official'),checkedOn=now.toISOString().slice(0,10);
 const sources=await Promise.all(config.sources.map(async source=>{
  const file=path.join(dir,source.id+'.json');
  try{
   const bytes=await download(source.url,fetcher),snapshot=parseFeed(bytes,source,checkedOn);
   await atomic(file,snapshot);
   return {id:source.id,url:source.url,status:'fresh',checkedOn,rows:snapshot.rows.length,unpricedRows:snapshot.unpricedRows,missingPriceCells:snapshot.missingPriceCells,rawSha256:snapshot.rawSha256};
  }catch(error){
   let previous=null;try{previous=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
   return {id:source.id,url:source.url,status:previous?'stale':'unavailable',checkedOn:previous?.checkedOn||null,
    rows:previous?.rows?.length||0,error:String(error.message),attemptedOn:checkedOn};
  }
 }));
 const manifest={schemaVersion:1,checkedOn,sources};manifest.coverage=coverage(manifest);
 await atomic(path.join(dir,'manifest.json'),manifest);return manifest;
}
if(require.main===module)refresh().then(m=>{console.log(JSON.stringify(m,null,2));if(m.sources.some(s=>s.status!=='fresh'))process.exitCode=1;})
 .catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={download,refresh,MAX_BYTES};
