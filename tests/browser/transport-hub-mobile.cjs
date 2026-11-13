/* Hub transports — vraie application (index.html + app.js) dans Chromium, format Pixel 7.
 * Réponses fournisseurs : enregistrements réels du dépôt (TripGo 31/10/2026, SNCF GTFS 02/11/2026).
 * Valhalla est simulé par une réponse piétonne géométriquement valide (pas d'accès réseau dans le test).
 * Aucun compte, aucune mission réelle, aucune écriture serveur.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,devices}=require('playwright');
const zlib=require('node:zlib');const {crc32}=require('../../transport-gtfs-loader');
// Flux GTFS de test (Annecy → Grenoble) avec un tarif publié (fare_attributes) : vérifie la chaîne worker → hub → carte.
function gtfsZip(){
 const files={'agency.txt':'agency_name,agency_timezone\nRéseau tarif test,Europe/Paris',
  'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nA,Annecy test,45.9019,6.1218\nG,Grenoble test,45.1914,5.7143',
  'routes.txt':'route_id,route_short_name,route_type\nR,T42,3','trips.txt':'route_id,service_id,trip_id\nR,S,Ret',
  'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nRet,10:30:00,10:30:00,A,1\nRet,12:00:00,12:00:00,G,2',
  'calendar_dates.txt':'service_id,date,exception_type\nS,20261102,1',
  'fare_attributes.txt':'fare_id,price,currency_type,payment_method,transfers,transfer_duration\nU,1.60,EUR,0,,3600'};
 const locals=[],central=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const fn=Buffer.from(name),plain=Buffer.from(text),bytes=zlib.deflateRawSync(plain),head=Buffer.alloc(30),entry=Buffer.alloc(46);
  head.writeUInt32LE(0x04034b50);head.writeUInt16LE(8,8);head.writeUInt32LE(crc32(plain),14);head.writeUInt32LE(bytes.length,18);head.writeUInt32LE(plain.length,22);head.writeUInt16LE(fn.length,26);
  entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(8,10);entry.writeUInt32LE(crc32(plain),16);entry.writeUInt32LE(bytes.length,20);entry.writeUInt32LE(plain.length,24);entry.writeUInt16LE(fn.length,28);entry.writeUInt32LE(offset,42);
  locals.push(head,fn,bytes);central.push(entry,fn);offset+=head.length+fn.length+bytes.length;
 }
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,dir,end]);
}
const root=path.resolve(__dirname,'../..');
const output=path.resolve(process.env.TRANSPORT_BROWSER_OUTPUT||path.join(root,'tmp/transport-hub-browser'));
const tripgoFixture=require('../fixtures/tripgo-annecy-grenoble-2026-10-31.json');
const railFixture=require('../fixtures/sncf-annecy-grenoble-2026-11-02.json');
const missions=[{id:'hub-1',external_id:'HUB-1',platform:'DriiveMe',kind:'acceptee',status:'acceptee',
 from_city:'Grenoble',to_city:'Annecy',from_department:'38',to_department:'74',
 origin_address:'12 rue Exemple 38000 Grenoble',destination_address:'14 rue Exemple 74000 Annecy',
 pickup_start:'2026-11-02T08:00:00+01:00',pickup_end:'2026-11-02T08:00:00+01:00',delivery_end:'2026-11-02T10:00:00+01:00',fee:100}];
const settings={domicile_ville:'Grenoble',domicile_lat:45.1914,domicile_lng:5.7143,marge_minutes:30,plateformes_choisies:['DriiveMe']};
function encode(points){let prev=[0,0],out='';for(const p of points){const next=[Math.round(p.lat*1e6),Math.round(p.lon*1e6)];
 for(let i=0;i<2;i++){const d=next[i]-prev[i];let v=d<0?-d*2-1:d*2;while(v>=32){out+=String.fromCharCode((v%32|32)+63);v=Math.floor(v/32);}out+=String.fromCharCode(v+63);}prev=next;}return out;}
function hav(a,b){const r=Math.PI/180,x=(b.lat-a.lat)*r,y=(b.lon-a.lon)*r;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(x/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(y/2)**2)));}
function valhalla(q){const [a,b]=q.locations;const mid={lat:(a.lat+b.lat)/2+0.00005,lon:(a.lon+b.lon)/2};
 const m=Math.max(hav(a,mid)+hav(mid,b),1),km=Math.round(m)/1000,t=Math.max(1,Math.round(m/1.25));
 return {trip:{status:0,units:'kilometers',summary:{time:t,length:km,has_ferry:false},legs:[{summary:{time:t,length:km,has_ferry:false},shape:encode([a,mid,b]),maneuvers:[{travel_mode:'pedestrian',travel_type:'foot'}]}]}};}
async function run(){
 await fs.mkdir(output,{recursive:true});
 const errors=[],hits={tripgo:0,swiss:0,valhalla:0,sncf:0,mobilites:0},writes=[];
 const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw 0;
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json');
  res.end(await fs.readFile(file));}catch(_){res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const json=(route,v,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(v)});
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
 try{
  const context=await browser.newContext({...devices['Pixel 7'],locale:'fr-FR',timezoneId:'Europe/Paris',serviceWorkers:'block'});
  await context.addInitScript(({missions,settings})=>{
   for(const [k,v] of Object.entries({cp_session:{access_token:'browser-test-only',user_id:'hub-fixture',expires_at:Date.now()+86400000},
    cp_cache:{missions,alertes:[],reglages:settings,chargeLe:new Date().toISOString()},cp_preferences:{onglet:'agenda'},cp_plats_choisies:['DriiveMe'],
    cp_pause:{choix:'non'},cp_notif:{on:false,son:false},cp_marche_max_km:3}))localStorage.setItem(k,JSON.stringify(v));
   localStorage.setItem('cp_tripgo_key','a'.repeat(32));localStorage.removeItem('cp_gps');
   window.CP_GTFS_AGENDA_RESOURCES=[{id:'tarif-test',network:'Réseau tarif test',format:'GTFS',url:'https://gtfs-fixture.invalid/feed.zip',bounds:[45,5.5,46.2,6.5],timeZone:'Europe/Paris'}];
  },{missions,settings});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin){
    if(url.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.CP_CONFIG={url:'https://backend.invalid',anonKey:'browser-test-only'};"});
    if(url.pathname.startsWith('/data/sncf/')){hits.sncf++;return json(route,url.pathname.endsWith('/manifest.json')?railFixture.manifest:railFixture.day);}
    return route.continue();
   }
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}});
   if(url.hostname==='backend.invalid'){
    if(url.pathname.startsWith('/functions/'))return route.fulfill({status:404,headers:{'access-control-allow-origin':'*'}});
    const readPost=req.method()==='POST'&&['/rest/v1/rpc/mon_statut','/storage/v1/object/sign/apk/version.json'].includes(url.pathname);
    if(req.method()!=='GET'&&!readPost)writes.push(req.method()+' '+url.pathname);
    return json(route,url.pathname.endsWith('/missions')?missions:url.pathname.endsWith('/reglages')?[settings]:[]);
   }
   if(url.hostname==='api-adresse.data.gouv.fr'){
    const q=url.searchParams.get('q')||'';
    if(/\b12\b/.test(q))return json(route,{features:[{geometry:{coordinates:[5.7143,45.1914]},properties:{score:1,type:'housenumber',city:'Grenoble'}}]});
    if(/\b14\b/.test(q))return json(route,{features:[{geometry:{coordinates:[6.1218,45.9019]},properties:{score:1,type:'housenumber',city:'Annecy'}}]});
    return json(route,{features:[]});
   }
   if(url.hostname==='api.tripgo.com'){hits.tripgo++;
    assert.equal(req.headers()['x-tripgo-key'],'a'.repeat(32));
    if(url.searchParams.get('from')==='(45.9019,6.1218)'&&url.searchParams.get('to')==='(45.1914,5.7143)'&&url.searchParams.get('departAfter')==='1793610000')return json(route,tripgoFixture.response);
    return route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'hors requête enregistrée'});
   }
   if(url.hostname==='gtfs-fixture.invalid'){hits.gtfs=(hits.gtfs||0)+1;return route.fulfill({status:200,contentType:'application/zip',headers:{'access-control-allow-origin':'*'},body:gtfsZip()});}
   if(url.hostname==='transport.opendata.ch'){hits.swiss++;return json(route,{connections:[]});}
   if(url.hostname==='data.mobilites-m.fr'){hits.mobilites++;return json(route,{plan:{itineraries:[]}});}
   if(/valhalla/.test(url.hostname)){hits.valhalla++;return json(route,valhalla(JSON.parse(url.searchParams.get('json'))));}
   if(url.hostname==='open-data.bus.blablacar.com')return route.abort('failed');
   return json(route,{features:[],results:[]});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/index.html');
  await page.locator('.mission').first().click();
  await page.locator('#btnTransportsMission').click();
  await page.locator('#cpTransportMissionDetails').waitFor();
  // Heure de livraison prévue (saisie existante de la fiche) : déclenche aussi le retour.
  await page.locator('#cpTransportSettings').evaluate(node=>{node.open=true;});
  await page.locator('#cpTransportPlannedReturn').fill('2026-11-02T10:00');
  await page.getByRole('button',{name:'Calculer avec cette livraison prévue',exact:true}).click();
  await page.locator('#cpTransportMissionDetails').waitFor();
  // Aucun bouton de recherche manuelle à presser : les résultats arrivent seuls.
  const t0=Date.now();
  const retour=page.locator('[data-transport-direction="Retour"] [data-transport-hub]');
  await retour.waitFor({timeout:20000});
  await page.waitForFunction(()=>{const h=document.querySelector('[data-transport-direction="Retour"] [data-transport-hub]');return h&&/propositions? comparée/.test(h.textContent);},null,{timeout:60000});
  var elapsed=Date.now()-t0;
  const text=await retour.evaluate(n=>n.textContent);
  assert.ok(elapsed<30000,'résultats du retour en moins de 30 s : '+elapsed+' ms');
  assert.match(text,/FlixBus 1789/,'TripGo réel intégré');
  assert.match(text,/Moins cher|Meilleur compromis|Plus rapide/);
  assert.match(text,/Prix à confirmer/,'aucun tarif inventé pour FlixBus/BlaBlaCar/SNCF');
  // Tarif publié dans le GTFS : la course T42 doit afficher 1,60 € et sa source.
  await page.waitForFunction(()=>/T42/.test(document.querySelector('[data-transport-direction="Retour"] [data-transport-hub]')?.textContent||''),null,{timeout:60000});
  const withFare=await retour.evaluate(n=>n.textContent);
  assert.match(withFare,/1,60 €/,'prix GTFS affiché');assert.match(withFare,/tarif publié dans le GTFS officiel/);
  assert.match(await retour.innerText(),/Moins cher/,'le trajet au prix connu est classé « Moins cher »');
  assert.match(text,/🚶/,'marches affichées');
  assert.ok(hits.tripgo>=1,'TripGo appelé automatiquement');assert.ok(hits.sncf>=1,'SNCF consulté automatiquement');
  assert.ok(hits.valhalla>=1,'marches réelles demandées');
  assert.equal(hits.swiss,0,'aucune requête suisse pour Grenoble–Annecy (hors zone)');
  // Ouvrir la carte « Plus rapide » ou la première : étapes, tracé, sources.
  const first=retour.locator('.cp-hub-card').first();await first.locator('summary').click();
  assert.ok(await first.locator('svg.cp-hub-map').count()>=1,'tracé sur carte');
  assert.match(await first.innerText(),/Sources :/);
  const aller=await page.locator('[data-transport-direction="Aller"] [data-transport-hub]').innerText();
  assert.match(aller,/Gratuit \(à pied\)/,'domicile = prise en charge : trajet à pied gratuit proposé');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'pas de débordement horizontal Android');
  assert.deepEqual(writes,[],'aucune écriture serveur');
  assert.deepEqual(errors,[],'aucune erreur JavaScript');
  await retour.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'hub-retour-pixel7.png'),fullPage:false});
  await page.locator('[data-transport-direction="Aller"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'hub-aller-pixel7.png')});
  // Réglages : inventaire de couverture visible, sans débordement, et aucun « Validé en réel » sans diagnostic.
  await page.locator('#fermer').click().catch(()=>{});
  await page.locator('button[data-onglet="reglages"]').click();
  await page.locator('#rCouverture > summary').click();
  const cov=await page.locator('#rCouvInv').innerText();
  assert.match(cov,/AURA/);assert.match(cov,/Suisse/);assert.match(cov,/Transfrontalier/);assert.doesNotMatch(cov,/Validé en réel —/);
  assert.match(cov,/TCL \(Lyon\) — Non raccordé/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Réglages sans débordement');
  assert.equal(await page.locator('table.cp-cov').evaluate(t=>t.getBoundingClientRect().right<=t.parentElement.getBoundingClientRect().right+1),true,'tableau de couverture entièrement visible');
  await page.locator('#rCouverture').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'couverture-pixel7.png')});
  assert.deepEqual(errors,[],'aucune erreur JavaScript (Réglages)');
  console.log('OK hub mobile',JSON.stringify(hits),'retour complet en',elapsed,'ms');
 }finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);process.exit(1);});
