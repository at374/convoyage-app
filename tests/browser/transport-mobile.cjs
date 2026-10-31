/* Real Chromium + actual index.html/app.js/worker; all external traffic is replaced.
 * No user account, mission, credentials or live transport availability is used.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib');
const {chromium,devices}=require('playwright');
const {crc32}=require('../../transport-gtfs-loader');
const {createRelay,PATH:relayPath}=require('../../server/transport-realtime-relay.cjs');
const official=require('../fixtures/mobilites-m-grenoble-crolles-2026-10-30.json');
const railFixture=require('../fixtures/sncf-annecy-grenoble-2026-11-02.json');
const tripgoFixture=require('../fixtures/tripgo-annecy-grenoble-2026-10-31.json');
const siriFixture=require('../fixtures/blablacar-siri-2026-10-31.json');
const tripgoToday=require('../fixtures/tripgo-blablacar-2026-10-31.json');
const root=path.resolve(__dirname,'../..');
const output=path.resolve(process.env.TRANSPORT_BROWSER_OUTPUT||path.join(root,'tmp/transport-browser'));
const missions=[
 {id:'browser-1',external_id:'BROWSER-1',platform:'DriiveMe',kind:'acceptee',status:'acceptee',
  from_city:'Grenoble',to_city:'Grenoble',from_department:'38',to_department:'38',
  origin_address:'12 rue Exemple 38000 Grenoble',destination_address:'14 rue Exemple 38000 Grenoble',
  pickup_start:'2026-11-02T09:00:00+01:00',pickup_end:'2026-11-02T09:00:00+01:00',delivery_end:'2026-11-02T10:00:00+01:00',fee:100},
 {id:'browser-2',external_id:'BROWSER-2',platform:'DriiveMe',kind:'acceptee',status:'acceptee',
  from_city:'Crolles',to_city:'Crolles',from_department:'38',to_department:'38',
  origin_address:'16 rue Exemple 38920 Crolles',destination_address:'18 rue Exemple 38920 Crolles',
  pickup_start:'2026-11-02T13:00:00+01:00',pickup_end:'2026-11-02T13:00:00+01:00',delivery_end:'2026-11-02T14:00:00+01:00',fee:100}
];
const settings={domicile_ville:'Grenoble',domicile_lat:45.193,domicile_lng:5.711,marge_minutes:30,plateformes_choisies:['DriiveMe']};
function archive(){
 const files={
  'agency.txt':'agency_name,agency_timezone\nRéseau de test,Europe/Paris',
  'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nH,Domicile de test,45.193,5.711\nG,Grenoble Gare de test,45.1914,5.7143\nC,Crolles de test,45.28364,5.88224',
  'routes.txt':'route_id,route_short_name,route_type\nR,TEST,3',
  'trips.txt':'route_id,service_id,trip_id\nR,S,Aller\nR,S,Retour\nR,S,Jonction',
  'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nAller,08:00:00,08:00:00,H,1\nAller,08:20:00,08:20:00,G,2\nRetour,10:10:00,10:10:00,G,1\nRetour,10:20:00,10:20:00,H,2\nJonction,10:25:00,10:25:00,G,1\nJonction,11:06:00,11:06:00,C,2',
  'calendar_dates.txt':'service_id,date,exception_type\nS,20261102,1'
 };
 const locals=[],central=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const filename=Buffer.from(name),plain=Buffer.from(text),bytes=zlib.deflateRawSync(plain),head=Buffer.alloc(30),entry=Buffer.alloc(46);
  head.writeUInt32LE(0x04034b50);head.writeUInt16LE(8,8);head.writeUInt32LE(crc32(plain),14);
  head.writeUInt32LE(bytes.length,18);head.writeUInt32LE(plain.length,22);head.writeUInt16LE(filename.length,26);
  entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(8,10);entry.writeUInt32LE(crc32(plain),16);
  entry.writeUInt32LE(bytes.length,20);entry.writeUInt32LE(plain.length,24);entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);
  locals.push(head,filename,bytes);central.push(entry,filename);offset+=head.length+filename.length+bytes.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);
 end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,directory,end]);
}
async function run(){
 await fs.mkdir(output,{recursive:true});
 const zip=archive(),errors=[],requests=[],gates=new Map(),workers=[],blockedWrites=[],regionalGates=[],activeWorkers=new Set(),abortedRequests=[];
 let holdRegional=false,railScenario=false,tripgoScenario=false,busLiveScenario=false;
 const until=async(predicate,message)=>{const end=Date.now()+10000;while(!predicate()){if(Date.now()>end)throw Error(message);await new Promise(resolve=>setTimeout(resolve,20));}};
 const server=http.createServer(async(req,res)=>{
  try{
   const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(name==='/fixture.zip'){res.setHeader('Content-Type','application/zip');res.end(zip);return;}
   const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
   if(!file.startsWith(root+path.sep))throw Error('Invalid path');
   const data=await fs.readFile(file);
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':'application/octet-stream');
   res.end(data);
  }catch(_){res.statusCode=404;res.end('Not found');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let relayUpstreamRequests=0;
 const relayServer=createRelay({allowedOrigins:[origin],now:()=>Date.parse(siriFixture.testNow),fetcher:async(url,init)=>{
  assert.equal(url,siriFixture.source);assert.deepEqual(init.headers,{Accept:'application/json'});relayUpstreamRequests++;
  return new Response(JSON.stringify(siriFixture.response),{headers:{'Content-Type':'application/json'}});
 }});
 await new Promise(resolve=>relayServer.listen(0,'127.0.0.1',resolve));
 const relayOrigin='http://127.0.0.1:'+relayServer.address().port,relayURL=relayOrigin+relayPath;
 let browser,context,page;
 const json=(route,value)=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(value)});
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
  context=await browser.newContext({...devices['Pixel 7'],locale:'fr-FR',timezoneId:'Europe/Paris',serviceWorkers:'block'});
  await context.addInitScript(({missions,settings,origin,relayURL})=>{
   if(new URL(location.href).searchParams.has('buslive'))window.CP_BLABLACAR_REALTIME_URL=relayURL;
   // An invalid optional relay must never block SNCF or the other engines.
   if(new URL(location.href).searchParams.has('rail'))window.CP_BLABLACAR_REALTIME_URL='http://external.invalid/transport-realtime/blablacar';
   if(new URL(location.href).searchParams.has('rail')){
    missions=missions.slice(0,1);missions[0].pickup_start=missions[0].pickup_end='2026-11-02T16:00:00+01:00';
    missions[0].delivery_end='2026-11-02T18:00:00+01:00';
    settings.domicile_ville='Annecy';settings.domicile_lat=45.902047;settings.domicile_lng=6.121826;
    localStorage.removeItem('cp_gps');
   }
   if(new URL(location.href).searchParams.has('tripgo')||new URL(location.href).searchParams.has('buslive')){
    const day=new URL(location.href).searchParams.has('buslive')?'2026-10-31':'2026-11-02';
    missions=missions.slice(0,1);missions[0].pickup_start=missions[0].pickup_end=day+'T08:00:00+01:00';missions[0].delivery_end=day+'T10:00:00+01:00';
    missions[0].to_city='Annecy';missions[0].destination_address='14 rue Exemple 74000 Annecy';
    settings.domicile_ville='Grenoble';settings.domicile_lat=45.1914;settings.domicile_lng=5.7143;
    localStorage.removeItem('cp_gps');localStorage.removeItem('cp_tripgo_key');
   }
   for(const [key,value] of Object.entries({cp_session:{access_token:'browser-test-only',user_id:'browser-fixture',expires_at:Date.now()+86400000},
    cp_cache:{missions,alertes:[],reglages:settings,chargeLe:new Date().toISOString()},cp_preferences:{onglet:'agenda'},cp_plats_choisies:['DriiveMe'],cp_pause:{choix:'non'},cp_notif:{on:false,son:false}}))localStorage.setItem(key,JSON.stringify(value));
   window.CP_GTFS_AGENDA_RESOURCES=[{id:'browser-fixture',network:'Réseau de test',format:'GTFS',url:'https://gtfs-fixture.invalid/feed.zip',bounds:[44,5,46,7],timeZone:'Europe/Paris'}];
  },{missions,settings,origin,relayURL});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin===relayOrigin)return route.continue(); // Real cross-origin HTTP relay, not a mocked response.
   if(url.origin===origin){
    if(railScenario&&url.pathname.startsWith('/data/sncf/'))return json(route,url.pathname.endsWith('/manifest.json')?railFixture.manifest:railFixture.day);
    if(url.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.CP_CONFIG={url:'https://backend.invalid',anonKey:'browser-test-only'};"});
    return route.continue();
   }
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}});
   if(url.hostname==='backend.invalid'){
    // Existing notification setup reads its configuration through a POST function.
    // It is unavailable in this isolated test, and never contacts a real backend.
    if(url.pathname.startsWith('/functions/'))return route.fulfill({status:404,headers:{'access-control-allow-origin':'*'},body:'No notification backend in browser fixtures'});
    const readPost=request.method()==='POST'&&['/rest/v1/rpc/mon_statut','/storage/v1/object/sign/apk/version.json'].includes(url.pathname);
    if(request.method()!=='GET'&&!readPost)blockedWrites.push({method:request.method(),path:url.pathname});
    const tripDay=busLiveScenario?'2026-10-31':'2026-11-02';
    const backendMissions=tripgoScenario?[{...missions[0],pickup_start:tripDay+'T08:00:00+01:00',pickup_end:tripDay+'T08:00:00+01:00',delivery_end:tripDay+'T10:00:00+01:00',to_city:'Annecy',destination_address:'14 rue Exemple 74000 Annecy'}]:railScenario?[{...missions[0],pickup_start:'2026-11-02T16:00:00+01:00',pickup_end:'2026-11-02T16:00:00+01:00',delivery_end:'2026-11-02T18:00:00+01:00'}]:missions;
    const backendSettings=tripgoScenario?{...settings,domicile_lat:45.1914,domicile_lng:5.7143}:railScenario?{...settings,domicile_ville:'Annecy',domicile_lat:45.902047,domicile_lng:6.121826}:settings;
    return json(route,url.pathname.endsWith('/missions')?backendMissions:url.pathname.endsWith('/reglages')?[backendSettings]:[]);
   }
   if(url.hostname==='gtfs-fixture.invalid')return route.fulfill({status:200,contentType:'application/zip',headers:{'access-control-allow-origin':'*'},body:zip});
   if(url.hostname==='api-adresse.data.gouv.fr'&&url.pathname.includes('/search')){
    const q=url.searchParams.get('q')||'',match=q.match(/\b(12|14|16|18)\b/),number=match?.[1];
    if(number){
     await new Promise(resolve=>{const list=gates.get(number)||[];list.push(resolve);gates.set(number,list);});
     const point=tripgoScenario&&number==='14'?[6.1218,45.9019]:['16','18'].includes(number)?[5.88224,45.28364]:[5.7143,45.1914];
     return json(route,{features:[{geometry:{coordinates:point},properties:{score:1,type:'housenumber',city:number==='16'?'Crolles':tripgoScenario&&number==='14'?'Annecy':'Grenoble'}}]}).catch(()=>{});
    }
    return json(route,{features:[]});
   }
   if(url.hostname==='data.mobilites-m.fr'){
    requests.push(Object.fromEntries(url.searchParams));
    if(holdRegional)await new Promise(resolve=>regionalGates.push(resolve));
    const actual=url.searchParams.get('fromPlace')===official.request.fromPlace&&url.searchParams.get('toPlace')===official.request.toPlace&&url.searchParams.get('arriveBy')==='false';
    return json(route,actual?official.response:{plan:{itineraries:[]}}).catch(()=>{});
   }
   if(url.hostname==='open-data.bus.blablacar.com')return route.abort('failed');
   if(url.hostname==='api.tripgo.com'){
    assert.equal(request.headers()['x-tripgo-key'],'a'.repeat(32),'Only a dummy browser-fixture key is used');
    if(busLiveScenario&&url.searchParams.get('from')==='(45.9019,6.1218)'&&url.searchParams.get('to')==='(45.1914,5.7143)'&&url.searchParams.get('departAfter')==='1793437200')return json(route,tripgoToday.response);
    if(url.searchParams.get('from')==='(45.9019,6.1218)'&&url.searchParams.get('to')==='(45.1914,5.7143)'&&url.searchParams.get('departAfter')==='1793610000')return json(route,tripgoFixture.response);
    return route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'Outside recorded test query'});
   }
   if(url.hostname==='transport.opendata.ch')return json(route,{connections:[]});
   if(/valhalla/.test(url.hostname))return route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'Unavailable in deterministic browser test'});
   return json(route,{features:[],results:[]});
  });
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>{if(request.url().includes('data.mobilites-m.fr'))abortedRequests.push(request.failure()?.errorText);});
  page.on('worker',worker=>{workers.push(worker.url());activeWorkers.add(worker);worker.on('close',()=>activeWorkers.delete(worker));});
  // Keep the synthetic November missions visible when this regression runs later.
  await page.clock.setFixedTime(new Date('2026-10-31T08:00:00+01:00'));
  page.setDefaultTimeout(10000);
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  // The real card may omit the external reference; its Agenda index remains explicit.
  await page.locator('.mission').filter({hasText:'Grenoble'}).first().waitFor();
  const cards=await page.locator('.mission').evaluateAll(nodes=>nodes.map(n=>({index:n.dataset.i,text:n.innerText})));
  const current=cards.find(c=>c.text.includes('Grenoble')&&!c.text.includes('Crolles'));
  assert.ok(current,'Synthetic Grenoble mission is visible in Agenda');
  await page.locator('.mission[data-i="'+current.index+'"]').click();
  await page.locator('#btnTransportsMission').waitFor();
  assert.equal(await page.locator('#btnVol').count(),1,'Car and public-transport buttons remain separate');
  const buttonColour=await page.locator('#btnTransportsMission').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(buttonColour,'rgb(205, 234, 255)','The existing light-blue transport button is preserved');
  await page.locator('#btnTransportsMission').click();
  await page.locator('#cpTransportMissionDetails').waitFor();
  const sibraReference=page.locator('#cpSibraFareReference');
  await sibraReference.locator('summary').click();
  assert.match(await sibraReference.innerText(),/2,50 €.*2,00 €/);
  assert.match(await sibraReference.innerText(),/pas le prix total/);
  assert.match(await sibraReference.innerText(),/272.*Grand Annecy/);
  assert.match(await sibraReference.innerText(),/pas encore déduit des prix affichés/);
  assert.equal(await sibraReference.locator('a[href="https://www.sibra.fr/voyages-reguliers/"]').count(),1);
  assert.equal(await sibraReference.locator('a[href="https://www.sibra.fr/app/uploads/2026/07/Reglement_BUS_CARS_CGV_01072026_3.pdf"]').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'mobile-sibra-fares.png')});
  await sibraReference.locator('summary').click();
  await page.locator('#cpTransportPlannedReturn').fill('2026-11-02T10:00');
  await page.getByRole('button',{name:'Calculer avec cette livraison prévue',exact:true}).click();
  await page.locator('#cpTransportMissionDetails').waitFor();
  const release=async number=>{
   await page.waitForFunction(()=>true);
   const start=Date.now();while(!gates.has(number)){if(Date.now()-start>5000)throw Error('No pending geocode '+number);await new Promise(resolve=>setTimeout(resolve,20));}
   for(const resolve of gates.get(number))resolve();gates.delete(number);
  };
  await release('14');
  await page.waitForFunction(()=>document.querySelector('#cpTransportMissionDetails')?.innerText.includes('Retour régional'));
  await release('16');
  await page.getByText(/Jonction régionale : 4 proposition/).waitFor();
  await release('12');
  await page.waitForFunction(()=>document.querySelector('#cpTransportMissionDetails')?.innerText.includes('Aller régional'));
  await page.getByText('Réseau de test — horaires aux arrêts',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-gtfs-agenda]')?.innerText.includes('TEST'));
  const text=await page.locator('#cpTransportMissionDetails').innerText();
  assert.match(text,/C11/);assert.match(text,/Crolles Mairie/);assert.match(text,/minimum : 5 min/);assert.doesNotMatch(text,/\bRéalisable\b/);
  assert.ok(requests.some(r=>r.arriveBy==='true'&&r.time==='08:55'),'Outbound applies mission margin');
  assert.ok(requests.some(r=>r.fromPlace===official.request.fromPlace&&r.toPlace===official.request.toPlace),'Official regional response is rendered after late geocoding');
  assert.ok(workers.length>0,'The actual dedicated browser worker is used');
  await page.locator('[data-gtfs-agenda]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-transports.png')});
  await page.getByText(/Jonction régionale : 4 proposition/).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-regional.png')});
  assert.equal(await page.locator('.feuilleBoite').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow in the mobile mission sheet');
  const before=requests.length;
  await page.getByRole('button',{name:'Actualiser maintenant les transports de cette mission'}).click();
  await page.getByText(/Jonction régionale : 4 proposition/).waitFor();
  assert.ok(requests.length>before,'Explicit refresh issues new regional requests');
  holdRegional=true;const beforeCloseRequests=requests.length,abortedBefore=abortedRequests.length;
  await page.getByRole('button',{name:'Actualiser maintenant les transports de cette mission'}).click();
  await until(()=>requests.length>=beforeCloseRequests+3,'Three regional refresh requests must be in flight');
  await page.locator('#fermer').click();
  assert.equal(await page.locator('#feuille').isHidden(),true);
  await until(()=>abortedRequests.length>=abortedBefore+3&&activeWorkers.size===0,'Closing the mission sheet must abort regional fetches and terminate its GTFS worker');
  const pendingText=await page.locator('#cpTransportMissionDetails').textContent();
  for(const resolve of regionalGates.splice(0))resolve();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#cpTransportMissionDetails').textContent(),pendingText,'Late responses cannot rewrite a closed panel');
  // Second mission scenario replays a recorded subset of the published SNCF files.
  // No external routing response substitutes for its station search.
  holdRegional=false;railScenario=true;
  await page.goto(origin+'?rail=1',{waitUntil:'domcontentloaded'});
  await page.locator('.mission').first().click();
  await page.locator('#btnTransportsMission').click();
  await release('12');
  const rail=page.getByText(/^Aller — secours SNCF, horaires théoriques du flux/);
  await rail.waitFor();
  const railText=await rail.innerText();
  assert.match(railText,/proposition\(s\) de gare à gare/);
  assert.match(railText,/Annecy/);assert.match(railText,/Grenoble/);
  assert.match(railText,/Transport non confirmé/);assert.doesNotMatch(railText,/Réalisable/);
  await rail.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-annecy-grenoble.png')});
  await page.locator('#fermer').click();
  await until(()=>activeWorkers.size===0,'Rail scenario worker must stop on close');
  // Configure the new client through the real UI, using a dummy key and public fixture.
  railScenario=false;tripgoScenario=true;
  await page.goto(origin+'?tripgo=1',{waitUntil:'domcontentloaded'});
  await page.locator('.mission').first().click();await page.locator('#btnTransportsMission').click();
  await page.locator('#cpTransportPlannedReturn').fill('2026-11-02T10:00');
  await page.getByRole('button',{name:'Calculer avec cette livraison prévue',exact:true}).click();
  await page.getByLabel('Clé TripGo privée sur cet appareil').fill('a'.repeat(32));
  await page.getByRole('button',{name:'Activer TripGo sur cet appareil',exact:true}).click();
  await release('14');
  const tripStatus=page.getByText(/^Retour TripGo : 2 proposition/);await tripStatus.waitFor();
  const tripText=await tripStatus.innerText();assert.match(tripText,/FlixBus 1789/);assert.match(tripText,/BlaBlaCar Bus/);
  const steps=tripStatus.locator('[data-tripgo-details]').first();
  await steps.locator('summary').click();
  assert.ok(await steps.locator('li').count()>=3,'Walking and transit legs have separate dated steps');
  const maps=await steps.locator('a').evaluateAll(nodes=>nodes.map(x=>({href:x.href,target:x.target,rel:x.rel})));
  assert.ok(maps.some(x=>new URL(x.href).searchParams.get('travelmode')==='walking'));
  assert.ok(maps.every(x=>new URL(x.href).hostname==='www.google.com'&&x.target==='_blank'&&x.rel.includes('noopener')));
  assert.ok(maps.every(x=>!x.href.includes('TripGo-Key')&&!x.href.includes('aaaaaaaa')));
  assert.match(await steps.innerText(),/nouveau calcul/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByText(/Prévisions BlaBlaCar Bus indisponibles sur cet appareil/).waitFor();
  assert.match(tripText,/Preuves manquantes/);assert.match(tripText,/prix du transport/);assert.doesNotMatch(tripText,/Réalisable/);
  await tripStatus.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'mobile-tripgo.png')});
  await page.getByRole('button',{name:'Retirer la clé TripGo de cet appareil',exact:true}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('cp_tripgo_key')),null);
  assert.equal(await page.getByText(/^Retour TripGo : 2 proposition/).count(),0);
  await page.locator('#fermer').click();await until(()=>activeWorkers.size===0,'TripGo scenario worker must stop on close');
  // Positive operating-day replay, followed by expiry of the operator's validity.
  await page.close();busLiveScenario=true;
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('worker',worker=>{workers.push(worker.url());activeWorkers.add(worker);worker.on('close',()=>activeWorkers.delete(worker));});
  await page.clock.install({time:new Date(siriFixture.testNow)});
  await page.goto(origin+'?buslive=1',{waitUntil:'domcontentloaded'});
  await page.locator('.mission').first().click();await page.locator('#btnTransportsMission').click();
  await page.locator('#cpTransportPlannedReturn').fill('2026-10-31T10:00');
  await page.getByRole('button',{name:'Calculer avec cette livraison prévue',exact:true}).click();
  await page.getByLabel('Clé TripGo privée sur cet appareil').fill('a'.repeat(32));
  await page.getByRole('button',{name:'Activer TripGo sur cet appareil',exact:true}).click();
  await release('14');await page.getByText(/circulation observée par l’opérateur/).waitFor();
  const observed=page.getByText(/^Retour TripGo : 1 proposition/);
  const observedText=await observed.innerText();assert.match(observedText,/arrivée estimée après la marche finale/);
  assert.match(observedText,/11:45/);assert.doesNotMatch(observedText,/Preuves manquantes : circulation/);assert.doesNotMatch(observedText,/Réalisable/);
  await observed.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'mobile-blablacar-observed.png')});
  await page.clock.fastForward(61000);await page.getByText(/Prévisions BlaBlaCar Bus expirées/).waitFor();
  assert.match(await observed.innerText(),/Preuves manquantes : circulation/);
  await page.locator('#fermer').click();await until(()=>activeWorkers.size===0,'Operating-day worker must stop on close');
  assert.equal(relayUpstreamRequests,1,'Operator feed is read through the real relay once');
  assert.deepEqual(errors,[],'No uncaught browser script errors');
  assert.deepEqual(blockedWrites,[],'No account or mission writes');
  const report={browser:browser.version(),viewport:devices['Pixel 7'].viewport,locale:'fr-FR',timezone:'Europe/Paris',
   missionData:'Synthetic fixtures only',network:'All external requests mocked; no user account or live mission sent',
   scenarios:['actual Agenda and mission sheet','two separate buttons','late independent geocoding','Aller / Jonction / Retour',
    '5-minute minimum at exact pickup GPS, final walk required','official SIBRA fare reference opens with product prices, coverage limits and source links','recorded Mobilités M C11 response','real GTFS browser worker','manual refresh','sheet close','in-flight network cancellation','late responses ignored','no horizontal overflow','Annecy–Grenoble with recorded official SNCF subset','private TripGo key entry/removal','TripGo BlaBlaCar Bus and FlixBus with missing evidence','dated TripGo step details and safe coordinate map links','operator feed unavailable without losing alternatives','same-day operator observation and final walk','expired observation loses confirmation','actual cross-origin relay HTTP and CORS','invalid optional relay preserves other engines'],
   relay:{crossOriginHttp:true,upstreamFixture:true,upstreamRequests:relayUpstreamRequests},regionalRequests:requests.length,workerInstances:workers.length,abortedRequests:abortedRequests.length,remainingWorkers:activeWorkers.size,buttonColour,uncaughtErrors:errors,androidDeviceTested:false};
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }catch(error){
  if(page&&!page.isClosed()){
   await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
   await fs.writeFile(path.join(output,'failure.txt'),await page.locator('body').innerText()).catch(()=>{});
  }
  throw error;
 }finally{
  for(const list of gates.values())for(const resolve of list)resolve();
  for(const resolve of regionalGates.splice(0))resolve();
  await context?.close();await browser?.close();relayServer.closeAllConnections();await new Promise(resolve=>relayServer.close(resolve));await new Promise(resolve=>server.close(resolve));
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
