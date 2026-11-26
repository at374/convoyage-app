/* Real Chromium + actual index.html/app.js/worker; all external traffic is replaced.
 * No user account, mission, credentials or live transport availability is used.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib');
const {chromium,devices}=require('playwright');
const {crc32}=require('../../transport-gtfs-loader');
const official=require('../fixtures/mobilites-m-grenoble-crolles-2026-10-30.json');
const railFixture=require('../fixtures/sncf-annecy-grenoble-2026-11-02.json');
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
function archive(line='TEST',regional=false){
 const files={
  'agency.txt':'agency_name,agency_timezone\nRéseau de test,Europe/Paris',
  'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nH,Domicile de test,45.193,5.711\nG,Grenoble Gare de test,45.1914,5.7143\nC,Crolles de test,45.28364,5.88224',
  'routes.txt':'route_id,route_short_name,route_type\nR,'+line+',3',
  'trips.txt':'route_id,service_id,trip_id\nR,S,Aller\nR,S,Retour\nR,S,Jonction',
  'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nAller,08:00:00,08:00:00,H,1\nAller,08:20:00,08:20:00,G,2\nRetour,10:10:00,10:10:00,G,1\nRetour,10:20:00,10:20:00,H,2\nJonction,10:25:00,10:25:00,G,1\nJonction,11:06:00,11:06:00,C,2',
  'calendar_dates.txt':'service_id,date,exception_type\nS,20261102,1'
 };
 if(regional){
  const scope=require('../fixtures/y51-sibra-scope-2026-10-31.json');
  const fares=require('../fixtures/y51-tariff-reference-2026-10-31.json');
  const recorded=fares.stops.find(s=>s[0].includes(':58900:'));
  const outside={stopId:recorded[0],lat:recorded[1],lon:recorded[2],name:recorded[4]};
  const stops=[scope.eligibleStops.find(s=>s.stopId.includes(':57539:')),regional==='full'?outside:scope.eligibleStops.find(s=>s.stopId.includes(':58436:')),scope.outsideStops[0]];
  files['stops.txt']='stop_id,stop_name,stop_lat,stop_lon\n'+stops.map(s=>[s.stopId,s.name,s.lat,s.lon].join(',')).join('\n');
  for(const [i,id] of ['H','G','C'].entries())files['stop_times.txt']=files['stop_times.txt'].replaceAll(','+id+',',','+stops[i].stopId+',');
 }
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
 const zip=archive(),sibraZip=archive('4'),regionalZip=archive('Y51',true),regionalFareZip=archive('Y51','full'),errors=[],requests=[],gates=new Map(),workers=[],blockedWrites=[],regionalGates=[],activeWorkers=new Set(),abortedRequests=[];
 const agendaWorkersStopped=()=>[...activeWorkers].every(worker=>!new URL(worker.url()).pathname.endsWith('/transport-gtfs-worker.js'));
 const sibraGates=[];let holdSibra=false;
 let holdRegional=false,railScenario=false,regionalPassScenario=false,regionalFareScenario=false;
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
 let browser,context,page;
 const json=(route,value)=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(value)});
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
  context=await browser.newContext({...devices['Pixel 7'],locale:'fr-FR',timezoneId:'Europe/Paris',serviceWorkers:'block'});
  // Les anciens blocs par moteur sont désormais repliés sous « Détail par moteur » : ce test vérifie leur contenu, il les ouvre.
  await context.addInitScript(()=>{new MutationObserver(()=>document.querySelectorAll('details.cp-transport-sources:not([open])').forEach(d=>{d.open=true;}))
   .observe(document,{childList:true,subtree:true});});
  await context.addInitScript(({missions,settings})=>{
   const project='https://backend.invalid',user_id='browser-fixture';
   const access_token='fixture.'+btoa(JSON.stringify({sub:user_id,iss:project+'/auth/v1'})).replace(/=+$/,'')+'.fixture';
   localStorage.setItem('cp_session',JSON.stringify({access_token,user_id,project,stamp:'browser-fixture',expires_at:Date.now()+86400000}));
   const prefix='cp_account:'+encodeURIComponent(project+'/'+user_id)+':';
   const setLocal=(key,value)=>localStorage.setItem(prefix+key,JSON.stringify(value));
   const removeLocal=key=>localStorage.removeItem(prefix+key);
   // An invalid optional relay must never block SNCF or the other engines.
   if(new URL(location.href).searchParams.has('rail'))window.CP_BLABLACAR_REALTIME_URL='http://external.invalid/transport-realtime/blablacar';
   if(new URL(location.href).searchParams.has('rail')){
    missions=missions.slice(0,1);missions[0].pickup_start=missions[0].pickup_end='2026-11-02T16:00:00+01:00';
    missions[0].delivery_end='2026-11-02T18:00:00+01:00';
    settings.domicile_ville='Annecy';settings.domicile_lat=45.902047;settings.domicile_lng=6.121826;
    removeLocal('cp_gps');
   }
   for(const [key,value] of Object.entries({cp_cache:{missions,alertes:[],reglages:settings,chargeLe:new Date().toISOString()},cp_preferences:{onglet:'agenda'},cp_plats_choisies:['DriiveMe'],cp_pause:{choix:'non'},cp_notif:{on:false,son:false}}))setLocal(key,value);
   window.CP_GTFS_AGENDA_RESOURCES=[{id:'browser-fixture',network:'Réseau de test',format:'GTFS',url:'https://gtfs-fixture.invalid/feed.zip',bounds:[44,5,46,7],timeZone:'Europe/Paris'}];
   if(new URL(location.href).searchParams.has('regionalpass')){
    missions=missions.slice(0,1);missions[0].from_city='Annecy';missions[0].to_city='Duingt';
    missions[0].origin_address='12 rue Exemple 74000 Annecy';missions[0].destination_address='14 rue Exemple 74410 Duingt';
    if(new URL(location.href).searchParams.has('fare')){missions[0].to_city='Albertville';missions[0].destination_address='14 rue Exemple 73200 Albertville';}
    settings.domicile_ville='Annecy';settings.domicile_lat=45.9016985;settings.domicile_lng=6.1201612;
    window.CP_GTFS_AGENDA_RESOURCES[0].datasetId='oura-haute-savoie';window.CP_GTFS_AGENDA_RESOURCES[0].url+=new URL(location.href).searchParams.has('fare')?'?regionalfare=1':'?regional=1';
    setLocal('cp_cache',{missions,alertes:[],reglages:settings,chargeLe:new Date().toISOString()});
    removeLocal('cp_gps');
   }
   if(new URL(location.href).searchParams.has('sibrapass')){
    window.CP_GTFS_AGENDA_RESOURCES[0].datasetId='5bd9843e634f413220f7f04a';
    window.CP_GTFS_AGENDA_RESOURCES[0].url+='?sibra=1';
    removeLocal('cp_gps');removeLocal('cp_tripgo_key');
   }
  },{missions,settings});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin===origin){
    if(holdSibra&&url.pathname.startsWith('/data/sibra/'))await new Promise(resolve=>sibraGates.push(resolve));
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
    const backendMissions=regionalPassScenario?[{...missions[0],from_city:'Annecy',to_city:regionalFareScenario?'Albertville':'Duingt',origin_address:'12 rue Exemple 74000 Annecy',destination_address:regionalFareScenario?'14 rue Exemple 73200 Albertville':'14 rue Exemple 74410 Duingt'}]:railScenario?[{...missions[0],pickup_start:'2026-11-02T16:00:00+01:00',pickup_end:'2026-11-02T16:00:00+01:00',delivery_end:'2026-11-02T18:00:00+01:00'}]:missions;
    const backendSettings=regionalPassScenario?{...settings,domicile_ville:'Annecy',domicile_lat:45.9016985,domicile_lng:6.1201612}:railScenario?{...settings,domicile_ville:'Annecy',domicile_lat:45.902047,domicile_lng:6.121826}:settings;
    return json(route,url.pathname.endsWith('/missions')?backendMissions:url.pathname.endsWith('/reglages')?[backendSettings]:[]);
   }
   if(url.hostname==='gtfs-fixture.invalid')return route.fulfill({status:200,contentType:'application/zip',headers:{'access-control-allow-origin':'*'},body:url.searchParams.has('regionalfare')?regionalFareZip:url.searchParams.has('regional')?regionalZip:url.searchParams.has('sibra')?sibraZip:zip});
   if(url.hostname==='data.geopf.fr'&&url.pathname.includes('/search')){
    const q=url.searchParams.get('q')||'',match=q.match(/\b(12|14|16|18)\b/),number=match?.[1];
    if(number){
     await new Promise(resolve=>{const list=gates.get(number)||[];list.push(resolve);gates.set(number,list);});
     const point=regionalFareScenario&&number==='14'?[6.3897282,45.6693897]:regionalPassScenario&&number==='14'?[6.2018053,45.827708]:['16','18'].includes(number)?[5.88224,45.28364]:[5.7143,45.1914];
     return json(route,{features:[{geometry:{coordinates:point},properties:{score:1,type:'housenumber',city:number==='16'?'Crolles':'Grenoble'}}]}).catch(()=>{});
    }
    return json(route,{features:[]});
   }
   if(url.hostname==='data.mobilites-m.fr'){
    requests.push(Object.fromEntries(url.searchParams));
    if(holdRegional)await new Promise(resolve=>regionalGates.push(resolve));
    const actual=url.searchParams.get('fromPlace')===official.request.fromPlace&&url.searchParams.get('toPlace')===official.request.toPlace&&url.searchParams.get('arriveBy')==='false';
    // Synthetic direct service for UI coverage; keep the recorded C11 query intact.
    const boundary=Date.parse(url.searchParams.get('date')+'T'+url.searchParams.get('time')+':00+01:00');
    const end=url.searchParams.get('arriveBy')==='true'?boundary:boundary+42*60000;
    const start=end-42*60000;
    const synthetic={plan:{itineraries:[{startTime:start,endTime:end,duration:42*60,transfers:0,walkDistance:0,
     legs:[{mode:'BUS',routeShortName:'TEST UI',startTime:start,endTime:end,distance:1000,
      from:{name:'Arrêt fictif A'},to:{name:'Arrêt fictif B'}}]}]}};
    return json(route,actual?official.response:synthetic).catch(()=>{});
   }
   if(url.hostname==='open-data.bus.blablacar.com')return route.abort('failed');
   if(url.hostname==='api.tripgo.com'){errors.push('Unexpected request to retired TripGo');return route.abort();}
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
  let cards=[],current;
  // Agenda can re-render between the initial locator wait and reading the cards.
  // Retry the actual mission selection, never silently accept a missing mission.
  for(let attempt=0;attempt<25;attempt++){
   cards=await page.locator('.mission').evaluateAll(nodes=>nodes.map(n=>({index:n.dataset.i,text:n.innerText})));
   current=cards.find(c=>c.text.includes('Grenoble')&&c.text.includes('09:00'))||cards.find(c=>c.text.includes('Grenoble'));
   if(current)break;
   await page.waitForTimeout(100);
  }
   // The Agenda card may mention the next mission in Crolles; that must not
   // exclude the Grenoble card itself from the browser regression.
  assert.ok(current,'Synthetic Grenoble mission is visible in Agenda; cards='+JSON.stringify(cards)+'; pageErrors='+JSON.stringify(errors));
  await page.locator('.mission[data-i="'+current.index+'"]').click();
  await page.locator('#btnTransportsMission').waitFor();
  assert.equal(await page.locator('#btnVol').count(),1,'Car and public-transport buttons remain separate');
  const buttonColour=await page.locator('#btnTransportsMission').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(buttonColour,'rgb(205, 234, 255)','The existing light-blue transport button is preserved');
  assert.equal(await page.locator('#cpTransportMissionDetails').count(),0,'Mission does not open transport results before the button is pressed');
  await page.locator('#btnTransportsMission').click();
  await page.locator('#cpTransportMissionDetails').waitFor();
  assert.equal(await page.locator('#cpTransportSettings').evaluate(node=>node.open),false,'Settings stay collapsed after opening Transports');
  await page.locator('#cpTransportSettings > summary').click();
  const sibraReference=page.locator('#cpSibraFareReference');
  await sibraReference.locator('summary').click();
  assert.match(await sibraReference.innerText(),/2,50 €.*2,00 €/);
  assert.match(await sibraReference.innerText(),/pas le prix total/);
  assert.match(await sibraReference.innerText(),/272.*Grand Annecy/);
  assert.match(await sibraReference.innerText(),/Renseignez les dates de votre abonnement/);
  assert.equal(await sibraReference.locator('a[href="https://www.sibra.fr/voyages-reguliers/"]').count(),1);
  assert.equal(await sibraReference.locator('a[href="https://www.sibra.fr/app/uploads/2026/07/Reglement_BUS_CARS_CGV_01072026_3.pdf"]').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'mobile-sibra-fares.png')});
  await sibraReference.locator('summary').click();
  await page.locator('#cpTransportPlannedReturn').fill('2026-11-02T10:00');
  await page.getByRole('button',{name:'Calculer avec cette livraison prévue',exact:true}).click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await page.locator('#cpTransportMissionDetails').waitFor();
  const release=async number=>{
   await page.waitForFunction(()=>true);
   const start=Date.now();while(!gates.has(number)){if(Date.now()-start>5000)throw Error('No pending geocode '+number);await new Promise(resolve=>setTimeout(resolve,20));}
   for(const resolve of gates.get(number))resolve();gates.delete(number);
  };
  await release('14');
  await page.waitForFunction(()=>document.querySelector('#cpTransportMissionDetails')?.textContent.includes('Retour régional'));
  await release('16');
  await page.locator('.cp-transport-evidence').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
  await page.getByText(/Jonction régionale : 4 proposition/).waitFor();
  await release('12');
  await page.waitForFunction(()=>document.querySelector('#cpTransportMissionDetails')?.textContent.includes('Aller régional'));
  const openGtfsAgenda=()=>page.locator('[data-gtfs-agenda] > summary').click();
  await page.getByText('Réseau de test — horaires aux arrêts',{exact:true}).waitFor();
  await openGtfsAgenda();
  await page.waitForFunction(()=>document.querySelector('[data-gtfs-agenda]')?.innerText.includes('TEST'));
  await page.locator('.cp-transport-evidence').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
  // Le hub unifié peut déclarer « Réalisable » quand horaires, marches et marge sont prouvés ;
  // les blocs historiques par moteur restent soumis à l'ancienne règle (jamais « Réalisable »).
  const text=await page.locator('#cpTransportMissionDetails').evaluate(node=>{const c=node.cloneNode(true);c.querySelectorAll('[data-transport-hub]').forEach(h=>h.remove());document.body.appendChild(c);const t=c.innerText;c.remove();return t;});
  await page.waitForFunction(()=>document.querySelectorAll('#cpTransportMissionDetails [data-transport-hub]').length>=2,null,{timeout:45000});
  const hubText=await page.locator('#cpTransportMissionDetails [data-transport-hub]').allInnerTexts();
  assert.ok(hubText.length>=2,'hub affiché dans les directions');
  for(const block of hubText)for(const m of block.matchAll(/Réalisable · avance (\d+) min \(marge (\d+) min\)/g))assert.ok(Number(m[1])>=Number(m[2]),'Réalisable avec marge respectée');
  assert.match(text,/C11/);assert.match(text,/Crolles Mairie/);assert.match(text,/(?:minimum\s*:\s*15\s*min|Arrivée\s*:\s*15\s*min\s+minimum)/);assert.doesNotMatch(text,/\bRéalisable\b/);
  assert.ok(requests.some(r=>r.arriveBy==='true'&&r.time==='08:45'),'Outbound applies mission margin');
  assert.ok(requests.some(r=>r.fromPlace===official.request.fromPlace&&r.toPlace===official.request.toPlace),'Official regional response is rendered after late geocoding');
  // Verify the actual mobile DOM and interaction, not only the source code.
  const comparison=page.locator('#cpTransportMissionDetails');
  // Let the real transient notification disappear before visual evidence is captured.
  await page.locator('#toast').waitFor({state:'hidden'});
  const launcher=page.locator('#cpApkBtn');
  await launcher.waitFor({state:'visible'});
  const launcherCoveredBySheet=()=>launcher.evaluate(node=>{
   const r=node.getBoundingClientRect();
   return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#feuille');
  });
  assert.equal(await launcherCoveredBySheet(),true,'Mission sheet covers the background install launcher');
  await page.locator('#cpTransportSettings').evaluate(node=>{node.open=false;});
  await page.locator('.cp-transport-evidence').evaluateAll(nodes=>nodes.forEach(node=>{node.open=false;}));
  await page.locator('.cp-transport-hero').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-transport-workspace.png')});
  const originalStyle=await page.evaluate(()=>document.documentElement.dataset.style);
  for(const style of ['ultra','braise','crepuscule','jour','classique']){
   await page.evaluate(style=>{document.documentElement.dataset.style=style;},style);
   const palette=await page.locator('#cpTransportMissionDetails').evaluate(panel=>{
    const probe=document.createElement('span');probe.style.cssText='background:var(--fond);color:var(--accent)';panel.appendChild(probe);
    const expected=getComputedStyle(probe),actual=getComputedStyle(panel),title=getComputedStyle(panel.querySelector('h2'));
    const result={background:actual.backgroundColor,expectedBackground:expected.backgroundColor,title:title.color,expectedTitle:expected.color,weight:Number(title.fontWeight)};probe.remove();return result;
   });
   assert.equal(palette.background,palette.expectedBackground,style+' uses the page background');
   assert.equal(palette.title,palette.expectedTitle,style+' uses its vivid heading accent');
   assert.ok(palette.weight>=800,style+' headings are bold');
   await page.locator('.cp-transport-hero').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(output,'mobile-transport-style-'+style+'.png')});
  }
  await page.evaluate(style=>{if(style)document.documentElement.dataset.style=style;else delete document.documentElement.dataset.style;},originalStyle);

  await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await page.locator('.cp-transport-evidence').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
  const comparisonChecks=[];
  for(const [direction,heading] of [['aller','Aller · comparer'],['jonction','Jonction mission · comparer'],['retour','Retour · comparer']]){
   const title=comparison.getByRole('heading',{name:heading,exact:true});
   await title.waitFor();
   const cards=title.locator('..').locator('details').filter({hasText:'Étapes théoriques'});
   const count=await cards.count();
   assert.ok(count>=1&&count<=3,heading+' renders one to three comparison cards');
   for(let i=0;i<count;i++){
    const card=cards.nth(i),summary=card.locator('summary');
    assert.equal(await card.evaluate(node=>node.open),false,heading+' initially collapsed');
    await summary.click();
    assert.equal(await card.evaluate(node=>node.open),true,heading+' tap expands itinerary');
    assert.match(await card.innerText(),/Transport non confirmé/);
    assert.match(await card.innerText(),/Étapes théoriques/);
    assert.doesNotMatch(await card.innerText(),/\bRéalisable\b/);
    assert.ok(await card.locator('ol li').count()>0,heading+' shows actual leg details');
    assert.equal(await page.locator('.feuilleBoite').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,heading+' expanded cards fit mobile width');
    assert.equal(await launcherCoveredBySheet(),true,heading+' stays above the install launcher');
    if(i===0){
     await card.screenshot({path:path.join(output,'mobile-comparaison-'+direction+'.png')});
    }
    await summary.click();
    assert.equal(await card.evaluate(node=>node.open),false,heading+' second tap collapses itinerary');
   }
   comparisonChecks.push({direction,cards:count,expandedAndCollapsed:true,noHorizontalOverflow:true});
  }
  assert.ok(workers.length>0,'The actual dedicated browser worker is used');
  await page.locator('[data-gtfs-agenda]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-transports.png')});
  await page.locator('.cp-transport-evidence').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
  await page.getByText(/Jonction régionale : 4 proposition/).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-regional.png')});
  assert.equal(await page.locator('.feuilleBoite').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow in the mobile mission sheet');
  const before=requests.length;
  await page.getByRole('button',{name:'Actualiser maintenant les transports de cette mission'}).click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});await page.locator('.cp-transport-evidence').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
  await page.locator('.cp-transport-evidence').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
  await page.getByText(/Jonction régionale : 4 proposition/).waitFor();
  assert.ok(requests.length>before,'Explicit refresh issues new regional requests');
  holdSibra=true;  holdRegional=true;const beforeCloseRequests=requests.length,abortedBefore=abortedRequests.length;
  await page.getByRole('button',{name:'Actualiser maintenant les transports de cette mission'}).click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});await page.locator('.cp-transport-evidence').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));
  await page.locator('#cpTransportMissionDetails .cp-hub-recherche progress').first().waitFor();
  await until(()=>requests.length>=beforeCloseRequests+3,'Three regional refresh requests must be in flight');
  await until(()=>sibraGates.length>0,'A daily SIBRA response must be in flight before closing');
  await page.locator('#fermer').click();
  assert.equal(await page.locator('#feuille').isHidden(),true);
  assert.equal(await launcher.evaluate(node=>{
   const r=node.getBoundingClientRect();
   return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===node;
  }),true,'Install launcher is accessible again after closing the sheet');
  await until(()=>abortedRequests.length>=abortedBefore+3,'Closing the mission sheet must abort regional fetches');
  await until(agendaWorkersStopped,'Closing the mission sheet must terminate its Agenda GTFS workers');
  // The detached hub can finish and save, while the closed sheet stays untouched.
  const pendingText=await page.locator('#cpTransportMissionDetails').textContent();
  for(const resolve of regionalGates.splice(0))resolve();
  const lateSibra=page.waitForResponse(response=>new URL(response.url()).pathname==='/data/sibra/sibra-2026-11-02.json');
  holdSibra=false;for(const resolve of sibraGates.splice(0))resolve();
  await (await lateSibra).finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#cpTransportMissionDetails').textContent(),pendingText,'Late responses cannot rewrite a closed panel');
  // Second mission scenario replays a recorded subset of the published SNCF files.
  // No external routing response substitutes for its station search.
  holdRegional=false;railScenario=true;
  await page.goto(origin+'?rail=1',{waitUntil:'domcontentloaded'});
  await page.locator('.mission').first().click();
  await page.locator('#btnTransportsMission').click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await release('12');
  await release('14');
  const railCard=page.locator('#cpTransportMissionDetails [data-transport-hub] details.cp-hub-card')
   .filter({has:page.locator('summary').filter({hasText:/\bK21\b/})}).first();
  await railCard.waitFor({timeout:45000});
  const railSummary=railCard.locator(':scope > summary');
  await railSummary.click();
  assert.equal(await railCard.evaluate(node=>node.open),true,'SNCF card opens');
  const railLegs=await railCard.locator('.cp-hub-legs').innerText();
  assert.match(railLegs,/K21/);assert.match(railLegs,/Annecy/i);assert.match(railLegs,/Grenoble/i);
  assert.match(await railCard.innerText(),/Source tarifaire manquante/);
  assert.doesNotMatch(await railSummary.innerText(),/Réalisable/);
  assert.equal(await page.locator('.feuilleBoite').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'SNCF card fits mobile width');
  await railCard.screenshot({path:path.join(output,'mobile-annecy-grenoble.png')});
  await railSummary.click();
  assert.equal(await railCard.evaluate(node=>node.open),false,'SNCF card closes');
  // Exercise the current mission renderer with an unbooked GTFS-Flex window.
  await page.locator('#cpTransportMissionDetails').evaluate(panel=>{
   const host=panel.ownerDocument.createElement('div');
   host.id='browser-flex-check';
   panel.appendChild(host);
   window.CPTransportHub.render(host,{done:true,total:0,picks:[],others:[],errors:{},flexCandidates:[
    {kind:'gtfs-flex-candidate',network:'Réseau de test',line:'TAD 31',tripId:'flex-31',
     pickupWindow:{startSeconds:28800,endSeconds:32400},
     pickupRule:{bookingType:'1',noticeMinutes:60,phoneNumber:'04 00 00 00 00',bookingUrl:'https://reservation.example/'}
    },
    {kind:'gtfs-flex-candidate',network:'Réseau de test',line:'TAD 32',tripId:'flex-32',
     pickupWindow:{startSeconds:32400,endSeconds:36000}}
   ]});
  });
  const flexPanel=page.locator('#browser-flex-check');
  await flexPanel.getByRole('heading',{name:'Résultats de transport à la demande'}).waitFor();
  const bookedRequired=flexPanel.locator('details').filter({hasText:'TAD 31'});
  await bookedRequired.locator('summary').click();
  assert.match(await bookedRequired.innerText(),/Préavis minimum : 60 min/);
  assert.match(await bookedRequired.innerText(),/04 00 00 00 00/);
  assert.equal(await bookedRequired.getByRole('link',{name:/Réserver/}).getAttribute('href'),'https://reservation.example/');
  const unknownNotice=flexPanel.locator('details').filter({hasText:'TAD 32'});
  await unknownNotice.locator('summary').click();
  assert.match(await unknownNotice.innerText(),/Conditions de réservation à vérifier/);
  assert.doesNotMatch(await flexPanel.innerText(),/Réalisable/);
  assert.equal(await flexPanel.locator('.cp-hub-card').count(),0,'Unbooked windows stay outside ranked journeys');
  await page.locator('#fermer').click();
  await until(agendaWorkersStopped,'TAD scenario workers must stop on close');
  // Synthetic SIBRA feed identity exercises the real worker and pass controls.
  await page.close();railScenario=false;
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('worker',worker=>{workers.push(worker.url());activeWorkers.add(worker);worker.on('close',()=>activeWorkers.delete(worker));});
  await page.clock.install({time:new Date('2026-11-02T07:00:00Z')});
  await page.goto(origin+'?sibrapass=1',{waitUntil:'domcontentloaded'});
  await page.locator('.mission').filter({hasText:'Grenoble'}).first().click();await page.locator('#btnTransportsMission').click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await page.locator('#cpTransportPlannedReturn').fill('2026-11-02T10:00');
  await page.getByRole('button',{name:'Calculer avec cette livraison prévue',exact:true}).click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await release('14');
  await openGtfsAgenda();
  await page.waitForFunction(()=>document.querySelector('[data-gtfs-agenda]')?.innerText.includes('4'));
  await page.locator('#cpSibraFareReference summary').click();
  await page.locator('#cpSibraPassFrom').fill('2026-01-01');await page.locator('#cpSibraPassThrough').fill('2026-12-31');
  await page.getByRole('button',{name:'Utiliser mon abonnement SIBRA',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-sibra-pass-cost]')?.innerText.includes('0,00 €'));
  assert.match(await page.locator('[data-gtfs-agenda]').innerText(),/sous réserve d’abonnement valide/);
  assert.doesNotMatch(await page.locator('[data-gtfs-agenda]').innerText(),/Réalisable/);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(CPAccount.storage.getItem('cp_sibra_pass_v1'))),{active:true,from:'2026-01-01',through:'2026-12-31'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('[data-sibra-pass-cost]').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-sibra-pass-applied.png')});
  await page.getByRole('button',{name:'Retirer mon abonnement SIBRA',exact:true}).click();
  assert.equal(await page.evaluate(()=>CPAccount.storage.getItem('cp_sibra_pass_v1')),null);
  // Without a pass, the UI intentionally displays an explicit unverified-coverage notice, not an empty field.
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-sibra-pass-cost]')).every(x=>!x.textContent.includes('0,00 € sous réserve d’abonnement valide') && x.textContent.includes('Couverture SIBRA')),null,{timeout:10000});
  await page.locator('#fermer').click();await until(agendaWorkersStopped,'SIBRA pass worker must stop on close');
  await page.close();regionalPassScenario=true;
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('worker',worker=>{workers.push(worker.url());activeWorkers.add(worker);worker.on('close',()=>activeWorkers.delete(worker));});
  await page.clock.setFixedTime(new Date('2026-10-31T08:00:00+01:00'));
  await page.goto(origin+'?regionalpass=1',{waitUntil:'domcontentloaded'});
  await page.locator('.mission').filter({hasText:'Duingt'}).first().click();await page.locator('#btnTransportsMission').click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await page.locator('#cpTransportPlannedReturn').fill('2026-11-02T10:00');
  await page.getByRole('button',{name:'Calculer avec cette livraison prévue',exact:true}).click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await release('14');
  await openGtfsAgenda();
  await page.waitForFunction(()=>document.querySelector('[data-gtfs-agenda]')?.innerText.includes('Y51'));
  await page.locator('#cpSibraFareReference summary').click();
  await page.locator('#cpSibraPassFrom').fill('2026-01-01');await page.locator('#cpSibraPassThrough').fill('2026-12-31');
  await page.getByRole('button',{name:'Utiliser mon abonnement SIBRA',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-sibra-pass-cost]')?.innerText.includes('Y51'));
  assert.match(await page.locator('[data-gtfs-agenda]').innerText(),/Coût supplémentaire transport : 0,00 €/);
  assert.match(await page.locator('[data-gtfs-agenda]').innerText(),/sous réserve d’abonnement valide/);
  await page.locator('[data-sibra-pass-cost]').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'mobile-y51-pass-applied.png')});
  assert.match(await page.locator('[data-y51-fare-reference]').first().innerText(),/2,50 €.*2,00 €/);
  await page.locator('#fermer').click();await until(agendaWorkersStopped,'Y51 scope worker must stop on close');
  await page.close();regionalFareScenario=true;
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('worker',worker=>{workers.push(worker.url());activeWorkers.add(worker);worker.on('close',()=>activeWorkers.delete(worker));});
  await page.clock.setFixedTime(new Date('2026-10-31T08:00:00+01:00'));
  await page.goto(origin+'?regionalpass=1&fare=1',{waitUntil:'domcontentloaded'});
  await page.locator('.mission').filter({hasText:'Albertville'}).first().click();await page.locator('#btnTransportsMission').click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await page.locator('#cpTransportPlannedReturn').fill('2026-11-02T10:00');
  await page.getByRole('button',{name:'Calculer avec cette livraison prévue',exact:true}).click();await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await release('14');
  await openGtfsAgenda();
  await page.waitForFunction(()=>document.querySelector('[data-y51-fare-reference]')?.innerText.includes('8,90 €'));
  const fareRef=page.locator('[data-y51-fare-reference]').first();
  assert.match(await fareRef.innerText(),/Albertville → Annecy.*zone 4.*hors abonnement/);
  assert.match(await fareRef.innerText(),/à revérifier avant achat/);
  assert.equal(await page.locator('[data-sibra-pass-cost]').evaluateAll(nodes=>nodes.some(x=>x.textContent.includes('0,00 €'))),false,'Active SIBRA pass must not make Albertville–Annecy free');
  assert.doesNotMatch(await page.locator('[data-gtfs-agenda]').innerText(),/Réalisable/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await fareRef.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'mobile-y51-full-fare.png')});
  await page.locator('#fermer').click();await until(agendaWorkersStopped,'Y51 fare worker must stop on close');
  assert.deepEqual(errors,[],'No uncaught browser script errors');
  assert.deepEqual(blockedWrites,[],'No account or mission writes');
  const report={browser:browser.version(),viewport:devices['Pixel 7'].viewport,locale:'fr-FR',timezone:'Europe/Paris',
   comparisonChecks,missionData:'Synthetic fixtures only',network:'All external requests mocked; no user account or live mission sent',
   scenarios:['actual Agenda and mission sheet','install launcher stays behind mission sheet and becomes accessible after closing','two separate buttons','late independent geocoding','Aller / Jonction / Retour',
    '15-minute pickup margin by default; five minutes only with reliable exact GPS and final walk','official SIBRA fare reference opens with product prices, coverage limits and source links','recorded Mobilités M C11 response','real GTFS browser worker','manual refresh','sheet close','in-flight network cancellation','late responses ignored','no horizontal overflow','Annecy–Grenoble with recorded SNCF schedules in unified mission cards','GTFS-Flex notice, operator contact and unconfirmed status','SIBRA pass dates saved and removed locally; real worker fixture shows conditional portion cost','Y51 portion with recorded stop identifiers and coordinates traverses worker scope proof and conditional Agenda display','Y51 Albertville–Annecy shows dated full-fare reference; SIBRA pass does not make the journey free'],
   regionalRequests:requests.length,workerInstances:workers.length,abortedRequests:abortedRequests.length,remainingWorkers:activeWorkers.size,buttonColour,uncaughtErrors:errors,androidDeviceTested:false};
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
  holdSibra=false;for(const resolve of sibraGates.splice(0))resolve();
  await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
