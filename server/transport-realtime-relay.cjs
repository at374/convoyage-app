/* Read-only relay for one public operator feed. No arbitrary URL or credentials. */
'use strict';
const http=require('node:http');
const {ENDPOINT,parse}=require('../transport-blablacar-realtime.js');
const PATH='/transport-realtime/blablacar';
function origins(values){
 return new Set(values.map(value=>{
  const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.origin!==value||url.username||url.password)throw Error('Invalid allowed origin');return value;
 }));
}
function createRelay({allowedOrigins=[],fetcher=globalThis.fetch,now=()=>Date.now(),timeoutMs=8000,maxRequestsPerMinute=120}={}){
 const allowed=origins(allowedOrigins);
 if(typeof fetcher!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>30000||!Number.isSafeInteger(maxRequestsPerMinute)||maxRequestsPerMinute<1)throw Error('Invalid relay configuration');
 let cache=null,pending=null,blockedUntil=0,windowStart=now(),requests=0;
 async function download(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetcher(ENDPOINT,{signal:controller.signal,redirect:'error',cache:'no-cache',credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});
   if(response.status!==200||!response.body?.getReader)throw Error('upstream_unavailable');
   if(!/^application\/json\b/i.test(response.headers?.get?.('content-type')||''))throw Error('upstream_invalid');
   if(Number(response.headers.get('content-length'))>2500000)throw Error('upstream_too_large');
   const reader=response.body.getReader(),chunks=[];let size=0;const cancel=()=>{reader.cancel().catch(()=>{});};controller.signal.addEventListener('abort',cancel,{once:true});
   try{while(true){if(controller.signal.aborted)throw Error('upstream_timeout');const r=await reader.read();if(controller.signal.aborted)throw Error('upstream_timeout');if(r.done)break;
     size+=r.value.byteLength;if(size>2500000)throw Error('upstream_too_large');chunks.push(Buffer.from(r.value));}
   }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock();}
   const body=Buffer.concat(chunks,size),data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body)),feed=parse(data,{now:now()});
   if(feed.stale||controller.signal.aborted)throw Error('upstream_stale');
   const value={body,until:feed.until,timestamp:feed.timestamp,refreshAt:Math.min(now()+15000,feed.until)};cache=value;return value;
  }finally{clearTimeout(timer);}
 }
 async function load(){
  if(cache&&now()<cache.refreshAt&&now()<cache.until)return cache;
  if(now()<blockedUntil)throw Error('upstream_temporarily_unavailable');
  if(!pending){
   const current=download().catch(error=>{cache=null;blockedUntil=now()+30000;throw error;}).finally(()=>{if(pending===current)pending=null;});pending=current;
  }
  return pending;
 }
 const server=http.createServer({maxHeaderSize:8192},async(req,res)=>{
  const origin=req.headers.origin;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
  const fail=(status,error,extra={})=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify({error}));};
  if(origin&&!allowed.has(origin)){fail(403,'origin_not_allowed');return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Accept');}
  let url;try{url=new URL(req.url,'http://relay.invalid');}catch(_){fail(400,'invalid_request');return;}
  if(url.search){fail(400,'query_not_allowed');return;}
  if(url.pathname!==PATH&&url.pathname!=='/health'){fail(404,'not_found');return;}
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(!['GET','HEAD'].includes(req.method)){fail(405,'method_not_allowed',{Allow:'GET, HEAD, OPTIONS'});return;}
  if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(req.method==='HEAD'?undefined:JSON.stringify({status:'ok',feedChecked:false}));return;}
  if(now()-windowStart>=60000||now()<windowStart){windowStart=now();requests=0;}
  if(++requests>maxRequestsPerMinute){fail(429,'rate_limited',{'Retry-After':String(Math.max(1,Math.ceil((windowStart+60000-now())/1000)))});return;}
  try{
   const value=await load();if(res.destroyed)return;
   if(now()>=value.until){cache=null;fail(503,'upstream_stale',{'Retry-After':'30'});return;}
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':value.body.length});res.end(req.method==='HEAD'?undefined:value.body);
  }catch(_){fail(503,'operator_feed_unavailable',{'Retry-After':'30'});}
 });
 server.headersTimeout=5000;server.requestTimeout=5000;server.keepAliveTimeout=5000;
 return server;
}
if(require.main===module){
 const allowedOrigins=(process.env.TRANSPORT_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const server=createRelay({allowedOrigins});const port=Number(process.env.PORT||8080);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
 server.listen(port,'0.0.0.0');
 const stop=()=>server.close(()=>process.exit(0));process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
module.exports={createRelay,PATH};
