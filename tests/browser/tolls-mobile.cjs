// Isolated actual toll renderer + Blob worker in mobile Chromium. No account or production requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,devices}=require('playwright');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/tolls-saint-vulbas-la-ciotat-2026-10-31.json');
const script=fs.readFileSync(path.join(root,'routes-ui.js'),'utf8').replace('  let rafale = false;','  window.audit={dec6,estimerPeage};let rafale = false;');
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=req.url.slice(1);
  if(!name){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div class="bk" style="margin:20px;padding:15px;background:#2262cc;color:white"><b>AVEC PÉAGE</b><div data-peage></div></div>');return;}
  if(!['style.css','peage-engine.js','peages-aprr.json','peages-overlay.json'].includes(name)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.json')?'application/json':'text/css');res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  for(const worker of [true,false]){
   const context=await browser.newContext({...devices['Pixel 7']});const page=await context.newPage(),errors=[];let workerCount=0;
   page.on('pageerror',e=>errors.push(e.message));page.on('worker',()=>workerCount++);
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   if(!worker)await page.evaluate(()=>{window.Worker=undefined;});
   await page.addScriptTag({url:'/peage-engine.js'});await page.addScriptTag({content:script});
   await page.evaluate(async fixture=>{
    const sh=window.audit.dec6(fixture.shape),a=sh[0],b=sh.at(-1),key=[...a,...b].map(n=>Number(n).toFixed(3)).join('|');
    window.CPValP={[key]:Promise.resolve({trip:{legs:[fixture]}})};
    await window.audit.estimerPeage({pts:[[a[1],a[0]],[b[1],b[0]]]},document.body);
   },fixture);
   const text=await page.locator('[data-peage]').innerText();
   assert.match(text,/La Ciotat BPV/);assert.match(text,/Aucun total partiel/);assert.doesNotMatch(text,/Aprr Area Ouvert Boisse|Classe 1/);
   assert.deepEqual(errors,[]);assert.equal(workerCount,worker?1:0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   console.log(`PASS mobile Chromium: ${worker?'actual Blob worker':'direct fallback'}, missing sections visible, no partial total, no overflow`);
   await context.close();
  }
 }finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
