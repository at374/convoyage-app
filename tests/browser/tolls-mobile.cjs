// Isolated actual toll renderer + Blob worker in mobile Chromium. No account or production requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,devices}=require('playwright');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/tolls-saint-vulbas-la-ciotat-2026-10-31.json');
const fixedClock="const NativeDate=Date;globalThis.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-11-01T12:00:00Z']));}};";
const script=fs.readFileSync(path.join(root,'routes-ui.js'),'utf8').replace('  let rafale = false;','  window.audit={dec6,estimerPeage};let rafale = false;').replace('new Blob([CODE_WORKER()]','new Blob(['+JSON.stringify(fixedClock)+'+CODE_WORKER()]');
function encode6(points){let a=0,b=0,s='';const put=n=>{let v=n<0?~(n<<1):n<<1;while(v>=32){s+=String.fromCharCode((32|(v&31))+63);v>>=5;}s+=String.fromCharCode(v+63);};for(const p of points){const x=Math.round(p[0]*1e6),y=Math.round(p[1]*1e6);put(x-a);put(y-b);a=x;b=y;}return s;}
const overlay=JSON.parse(fs.readFileSync(path.join(root,'peages-overlay.json'),'utf8'));
const conflicting=require('../fixtures/tolls-conflicting-fares.json');
const official=require('../fixtures/tolls-official-directed-prices.json');
const cases=[{name:'La Ciotat unresolved public trace',leg:fixture},{name:'Bonneville / Annemasse public trace',leg:require('../fixtures/tolls-bonneville-annemasse-2026-11-01.json'),prices:['3,50','6,20']}];
const tarare=overlay.barrieres.find(b=>b.id==='asf-tarare-est-ouvert').points[0];
cases.push({name:'Synthetic Tarare Est open gate',prices:['1,80','2,80'],leg:{shape:encode6([[tarare[0]-.0006,tarare[1]],tarare,[tarare[0]+.0006,tarare[1]]]),maneuvers:[{begin_shape_index:0,end_shape_index:2,toll:true,length:.2}]}});
cases.push({name:'Synthetic Swiss road with vignette already in toll inputs',swissNoToll:true,leg:{shape:encode6(Array.from({length:12},(_,i)=>[46.52,6.62+i*.0001])),maneuvers:[{begin_shape_index:0,end_shape_index:11,toll:false,length:.2}]}});
cases.push({name:'Synthetic conflicting tariff',leg:conflicting.leg,conflict:true});
cases.push({name:'Synthetic official forward',leg:official.leg,official:true,prices:['3,25','5,50']});
cases.push({name:'Synthetic official reverse',leg:{...official.leg,shape:encode6([[48,2.52],[48,2.5]])},official:true,prices:['4,25','6,50']});
cases.push({name:'Synthetic official outside reviewed year',leg:official.leg,official:true,unconfirmed:true,date:'2027-01-01'});
for(const [name,c1,c2]of [['BONNEVILLE EST','1,70','3,10'],['BONNEVILLE OUEST','1,30','2,30']]){
 const p=overlay.gares.find(g=>g.nom===name).points[0];
 // Synthetic single-gate component input, not a road route or real mission.
 cases.push({name,prices:[c1,c2],leg:{shape:encode6([[p[0]-.0006,p[1]],p,[p[0]+.0006,p[1]]]),maneuvers:[{begin_shape_index:0,end_shape_index:2,toll:true,length:0.2}]}});
}
(async()=>{
 const server=http.createServer((req,res)=>{
  const custom=req.url.startsWith('/conflict/'),isOfficial=req.url.startsWith('/official/');
  const name=custom?req.url.slice('/conflict/'.length):isOfficial?req.url.slice('/official/'.length):req.url.slice(1);
  const data=isOfficial?official:conflicting;
  if(!name){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div class="bk" style="margin:20px;padding:15px;background:#2262cc;color:white"><b>AVEC PÉAGE</b><div data-peage></div></div>');return;}
  if(!['style.css','peage-engine.js','peages-aprr.json','peages-overlay.json','data/tolls/route-prices.json'].includes(name)){res.writeHead(404);res.end();return;}
  if((custom||isOfficial)&&name==='peages-aprr.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data.base));return;}
  if((custom||isOfficial)&&name==='peages-overlay.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data.overlay));return;}
  if(isOfficial&&name==='data/tolls/route-prices.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(official.official));return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.json')?'application/json':'text/css');res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  for(const worker of [true,false])for(const scenario of cases){
   const context=await browser.newContext({...devices['Pixel 7']});const page=await context.newPage(),errors=[];let workerCount=0;
   page.on('pageerror',e=>errors.push(e.message));page.on('worker',()=>workerCount++);
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
   await page.addInitScript({content:fixedClock});
   await page.goto(`http://127.0.0.1:${server.address().port}/${scenario.conflict?'conflict/':scenario.official?'official/':''}`);
   if(!worker)await page.evaluate(()=>{window.Worker=undefined;});
   await page.addScriptTag({url:'/peage-engine.js'});await page.addScriptTag({content:script});
   await page.evaluate(async ({fixture,date})=>{
    const sh=window.audit.dec6(fixture.shape),a=sh[0],b=sh.at(-1),key=[...a,...b].map(n=>Number(n).toFixed(3)).join('|');
    window.CPValP={[key]:Promise.resolve({trip:{legs:[fixture]}})};
    await window.audit.estimerPeage({pts:[[a[1],a[0]],[b[1],b[0]]],dateTarif:date},document.body);
   },{fixture:scenario.leg,date:scenario.date});
   const text=await page.locator('[data-peage]').innerText();
   if(scenario.swissNoToll){assert.match(text,/Aucun péage/);assert.match(text,/déjà comptabilisée/);assert.match(text,/aucun ajout automatique/);assert.doesNotMatch(text,/40 CHF|80 CHF|Classe 1|Classe 2/);}
   else if(scenario.prices){assert.match(text,/Classe 1/);assert.match(text,/Classe 2/);for(const price of scenario.prices)assert.ok(text.includes(price),text);assert.doesNotMatch(text,/Prix exact non disponible|Aucun péage/);}
   else if(scenario.unconfirmed){assert.match(text,/Prix exact non disponible/);assert.doesNotMatch(text,/Classe 1|Classe 2|Aucun péage/);}
   else if(scenario.conflict){assert.match(text,/Tarifs contradictoires/);assert.match(text,/Alpha → Beta/);assert.doesNotMatch(text,/Classe 1|Classe 2|Aucun péage/);}
   else{assert.match(text,/La Ciotat BPV/);assert.match(text,/Aucun total partiel/);assert.doesNotMatch(text,/Aprr Area Ouvert Boisse|Classe 1/);}
   if(scenario.official&&scenario.prices){assert.match(text,/synthetic-official/);assert.match(text,/contrôle 2026-11-01/);}
   assert.deepEqual(errors,[]);assert.equal(workerCount,scenario.swissNoToll?0:worker?1:0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   console.log(`PASS mobile Chromium: ${scenario.name}, ${worker?'actual Blob worker':'direct fallback'}, correct tariff status, no overflow`);
   await context.close();
  }
 }finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
