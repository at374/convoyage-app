const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../sncf-fallback');
const day='2026-11-02',tick=()=>new Promise(resolve=>setImmediate(resolve));
const fixture=sha=>({schemaVersion:1,date:day,timeZone:'Europe/Paris',sourceSha256:sha,transportConfirmed:false,realtime:false,
 stations:[['A','Alpha',45,5],['B','Bravo',45.1,5.1]],trips:[['valid','TER','',[[0,30600,30600,0,0],[1,32400,32400,0,0]]]]});
const query={from:'Alpha',to:'Bravo',when:'2026-11-02T08:00:00+01:00'};
function deferredSource(letter){
 const sha=letter.repeat(64),manifest={schemaVersion:1,sourceSha256:sha,dates:{[day]:{file:'sncf-'+day+'.json',sha256:sha}}},requests=[];
 const fetcher=async(url,options)=>{
  if(url.includes('manifest'))return {ok:true,json:async()=>manifest};
  return new Promise(resolve=>requests.push({signal:options.signal,finish:()=>resolve({ok:true,json:async()=>fixture(sha)})}));
 };
 return {fetcher,requests};
}
test('SNCF applies the mission arrival boundary before limiting candidate results',()=>{
 const data=fixture('c'.repeat(64));
 data.trips.unshift(...Array.from({length:12},(_,i)=>['slow-'+i,'TER','',[[0,28800+i*60,28800+i*60,0,0],[1,43200+i*60,43200+i*60,0,0]]]));
 assert.equal(api.search([data],{...query,limit:1}).itineraries[0].legs[0].tripId,'slow-0');
 const r=api.search([data],{...query,limit:1,latestArrival:'2026-11-02T09:00:00+01:00'});
 assert.equal(r.itineraries[0].legs[0].tripId,'valid');assert.equal(r.itineraries[0].transportConfirmed,false);
 assert.equal(api.search([data],{...query,latestArrival:'2026-11-02T08:59:00+01:00'}).itineraries.length,0);
 for(const latestArrival of [null,'bad','2026-11-02T09:00:00'])assert.throws(()=>api.search([data],{...query,latestArrival}),/limite/);
});
test('SNCF day downloads remain shared while another consumer is active',async()=>{
 const {fetcher,requests}=deferredSource('d'),a=new AbortController(),b=new AbortController();
 const first=api.plan({...query,fetcher,signal:a.signal}),second=api.plan({...query,fetcher,signal:b.signal});
 await tick();assert.equal(requests.length,1);
 a.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(requests[0].signal.aborted,false);
 requests[0].finish();assert.equal((await second).itineraries.length,1);
});
test('last SNCF consumer cancellation aborts the download and a late response never fills the day cache',async()=>{
 const {fetcher,requests}=deferredSource('e'),controller=new AbortController();
 const first=api.plan({...query,fetcher,signal:controller.signal});await tick();controller.abort();
 await assert.rejects(first,{name:'AbortError'});assert.equal(requests[0].signal.aborted,true);
 requests[0].finish();await tick();
 const fresh=api.plan({...query,fetcher});await tick();assert.equal(requests.length,2);requests[1].finish();
 assert.equal((await fresh).itineraries.length,1);
});
test('already cancelled SNCF searches perform no manifest or schedule fetch',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(api.plan({...query,signal:controller.signal,fetcher:async()=>{calls++;}}),{name:'AbortError'});
 assert.equal(calls,0);
});
