/* One retained network per worker. Cancellation terminates synchronous indexing too. */
(function(root){
'use strict';
function createClient({workerURL='transport-gtfs-worker.js',workerFactory=url=>new root.Worker(url),
 timeoutMs=45000,maxPending=16}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0||!Number.isSafeInteger(maxPending)||maxPending<=0)
  throw new Error('Invalid GTFS worker limits');
 let worker=null,sequence=0,disposed=false;
 const pending=new Map();
 const abortError=()=>new DOMException('GTFS worker operation cancelled','AbortError');
 function stop(error){
  const previous=worker;worker=null;
  if(previous){previous.onmessage=null;previous.onerror=null;previous.onmessageerror=null;previous.terminate();}
  for(const item of pending.values()){item.cleanup();item.reject(error);}
  pending.clear();
 }
 function start(){
  const current=workerFactory(workerURL);worker=current;
  current.onmessage=({data})=>{
   if(worker!==current)return;
   const item=pending.get(data?.id);if(!item)return;
   pending.delete(data.id);item.cleanup();
   if(data.error){const error=new Error(data.error.message);error.name=data.error.name;item.reject(error);}
   else item.resolve(data.result);
  };
  current.onerror=()=>{if(worker===current)stop(new Error('GTFS worker failed'));};
  current.onmessageerror=()=>{if(worker===current)stop(new Error('GTFS worker response could not be read'));};
 }
 function request(type,payload,{signal}={}){
  if(disposed)return Promise.reject(new Error('GTFS worker client disposed'));
  if(signal?.aborted)return Promise.reject(abortError());
  if(type==='load'){
   stop(abortError());
   try{start();}catch(error){return Promise.reject(error);}
  }
  if(!worker)return Promise.reject(new Error('Load a network before querying'));
  if(pending.size>=maxPending)return Promise.reject(new Error('Too many GTFS worker requests'));
  return new Promise((resolve,reject)=>{
   const id=++sequence;
   const cancel=()=>stop(abortError());
   const timer=setTimeout(()=>stop(new Error('GTFS worker operation timed out')),timeoutMs);
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
   pending.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',cancel,{once:true});
   try{worker.postMessage({id,type,...payload});}
   catch(error){stop(error);}
  });
 }
 return {
  load:(resource,{signal,...options}={})=>request('load',{resource,options},{signal}),
  query:(query,options)=>request('query',{query},options),
  clear:()=>stop(abortError()),
  dispose:()=>{disposed=true;stop(abortError());},
  stats:()=>({running:!!worker,pending:pending.size,disposed})
 };
}
const api={createClient};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPGTFSWorker=api;
})(typeof window!=='undefined'?window:globalThis);
