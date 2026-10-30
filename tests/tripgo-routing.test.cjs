const {test,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const routing=require('../tripgo-routing.js');
const start=Date.parse('2026-11-02T08:00:00+01:00')/1000;
const options={from:{lat:45.9,lon:6.1},to:{lat:45.6,lon:6.3},departure:new Date(start*1000).toISOString()};
const fixture=(mode='pt_pub_bus')=>({segmentTemplates:[{hashCode:1,modeInfo:{identifier:mode},serviceNumber:'Y51',from:{name:'Annecy'},to:{name:'Albertville'}}],groups:[{trips:[{depart:start,arrive:start+3600,segments:[{segmentTemplateHashCode:1,startTime:start,endTime:start+3600}]}]}]});
const response=raw=>({ok:true,text:async()=>JSON.stringify(raw)});
beforeEach(()=>routing.configure('test-key-device-only'));

test('arrival search uses a deadline with no fixed date window or credential in URL',()=>{
  const url=routing.buildUrl({...options,departure:null,arrivalDeadline:'2027-06-03T14:00:00+02:00'});
  assert.equal(url.searchParams.get('arriveBefore'),String(Date.parse('2027-06-03T12:00:00Z')/1000));
  assert.equal(url.searchParams.has('departAfter'),false);
  assert.equal(url.href.includes('test-key'),false);
  assert.throws(()=>routing.buildUrl({...options,departure:'2026-11-02T08:00:00'}));
});
test('rejects early departures, missed deadlines, boats and broken chronology',()=>{
  assert.equal(routing.normalize(fixture(),options).length,1);
  assert.equal(routing.normalize(fixture(),{departure:new Date((start+1)*1000).toISOString()}).length,0);
  assert.equal(routing.normalize(fixture(),{arrivalDeadline:new Date((start+3599)*1000).toISOString()}).length,0);
  assert.equal(routing.normalize(fixture('pt_pub_ferry'),options).length,0);
  const broken=fixture();broken.groups[0].trips[0].segments[0].startTime=start-1;
  assert.equal(routing.normalize(broken,options).length,0);
  assert.deepEqual(routing.normalize({groups:[]}),[]);
});
test('prices and exact addresses remain unverified, duplicate options collapse',()=>{
  const raw=fixture();raw.groups[0].trips.push(raw.groups[0].trips[0]);
  const [item,...rest]=routing.normalize(raw,options);
  assert.equal(rest.length,0);assert.equal(item.price,null);
  assert.equal(item.transportConfirmed,false);assert.equal(item.exactAddressVerified,false);
});
test('parallel identical calls share a request; cached data is isolated; refresh calls network',async()=>{
  let calls=0;
  const fetcher=async(url,request)=>{
    calls++;assert.equal(request.headers['X-TripGo-Key'],'test-key-device-only');
    assert.equal(request.credentials,'omit');assert.equal(request.cache,'no-store');
    return response(fixture());
  };
  const [a,b]=await Promise.all([routing.plan({...options,fetcher}),routing.plan({...options,fetcher})]);
  assert.equal(calls,1);assert.equal(a.status,'candidates');assert.equal(b.itineraries.length,1);
  a.itineraries.length=0;
  const cached=await routing.plan({...options,fetcher});
  assert.equal(cached.cached,true);assert.equal(cached.itineraries.length,1);
  await routing.plan({...options,fetcher,refresh:true});assert.equal(calls,2);
});
test('rotating credentials clears cache and removal disables requests',async()=>{
  let calls=0;const fetcher=async()=>{calls++;return response(fixture());};
  await routing.plan({...options,fetcher});routing.configure('another-test-key');
  await routing.plan({...options,fetcher});assert.equal(calls,2);
  routing.configure('');assert.equal((await routing.plan({...options,fetcher})).status,'not_configured');
  assert.equal(calls,2);
});
test('network failures, quotas and timeouts produce no confirmed transport',async()=>{
  for (const [status,want] of [[403,'access_denied'],[429,'quota_reached'],[503,'unavailable']]) {
    const answer=await routing.plan({...options,refresh:true,fetcher:async()=>({ok:false,status})});
    assert.equal(answer.status,want);assert.deepEqual(answer.itineraries,[]);
  }
  const answer=await routing.plan({...options,timeoutMs:5,fetcher:(_,request)=>new Promise((resolve,reject)=>{
    request.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
  })});
  assert.equal(answer.status,'timeout');assert.deepEqual(answer.itineraries,[]);
});

test('panel launches three jobs concurrently and renders each independently as plain text',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const stored=new Map();
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.ownerDocument=document;this.isConnected=true;this.textContent='';this.style={};}
    append(...children){this.children.push(...children);}
    setAttribute(){}
  }
  const document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
  const sandbox={URL,AbortController,structuredClone,setTimeout,clearTimeout,Intl,document,
    localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)}};
  sandbox.window=sandbox;
  vm.runInNewContext(fs.readFileSync(require.resolve('../tripgo-routing.js'),'utf8'),sandbox);
  const api=sandbox.CPTripGo,settings=new Element('div');api.mountSettings(settings);
  const card=settings.children[0],input=card.children.find(x=>x.type==='password');
  const choice=card.children.find(x=>x.children?.some(y=>y.type==='checkbox'));
  input.value='test-key-device-only';choice.children[0].checked=true;
  const buttons=card.children.find(x=>x.className==='boutons');buttons.children[0].onclick();
  assert.equal(stored.get('cp_tripgo_device_key'),'test-key-device-only');assert.equal(input.value,'');
  const panel=new Element('div'),calls=[],responses=[];
  const fetcher=url=>new Promise(resolve=>{
    calls.push(new URL(url));responses.push(()=>{
      const params=new URL(url).searchParams,a=Number(params.get('departAfter')||params.get('arriveBefore'));
      const depart=params.has('departAfter')?a:a-3600,raw=fixture();
      raw.segmentTemplates[0].serviceNumber='<img src=x onerror="bad()">';
      raw.groups[0].trips[0]={depart,arrive:depart+1800,segments:[{segmentTemplateHashCode:1,startTime:depart,endTime:depart+1800}]};
      resolve(response(raw));
    });
  });
  api.mountPanel(panel,{home:{lat:45.9,lon:6.1},origin:{lat:45.8,lon:6.2},destination:{lat:45.7,lon:6.3},nextOrigin:{lat:45.6,lon:6.4},pickup:'2026-11-02T09:00:00+01:00',delivery:'2026-11-02T11:00:00+01:00',nextPickup:'2026-11-02T14:00:00+01:00',marginMinutes:30,fetcher});
  assert.equal(calls.length,3);
  assert.equal(calls[0].searchParams.get('arriveBefore'),String(Date.parse('2026-11-02T08:30:00+01:00')/1000));
  const blocks=panel.children[0].children.filter(x=>x.tagName==='div');
  responses[1]();await new Promise(resolve=>setImmediate(resolve));
  assert.match(blocks[1].children[0].textContent,/1 proposition/);
  assert.match(blocks[0].children[0].textContent,/recherche TripGo/);
  const flatten=e=>[e,...(e.children||[]).flatMap(flatten)];
  assert.equal(flatten(panel).some(e=>e.tagName==='img'),false);
  assert.equal(flatten(panel).some(e=>e.textContent.includes('test-key-device-only')),false);
  assert.equal(flatten(panel).some(e=>e.textContent.includes('<img src=x')),true);
  responses[0]();responses[2]();await new Promise(resolve=>setImmediate(resolve));
  assert.match(blocks[2].children[0].textContent,/1 proposition/);
  buttons.children[1].onclick();assert.equal(stored.has('cp_tripgo_device_key'),false);
  assert.equal(api.status().active,false);
});
