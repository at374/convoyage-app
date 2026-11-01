const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {csv,parseFeed,quote,coverage}=require('../toll-official-catalogue.cjs');
const {refresh,download,MAX_BYTES}=require('../scripts/refresh-toll-sources.cjs');
const config=require('../data/tolls/sources-2026.json');
const header='autoroute_entree;nom_entree;autoroute_sortie;nom_sortie;classe1;classe2;classe3;classe4;classe5';
const od=header+'\nA7;Échangeur Nord;A8;Sortie Sud;1,70;2,70;4;5;0\n';
const checked='2026-11-01',source=config.sources[0];
const req={date:checked,asOf:checked,vehicleClass:1,originRoad:'A7',originName:'Echangeur Nord',destinationRoad:'A8',destinationName:'Sortie Sud'};
const parse=text=>parseFeed(Buffer.from(text),source,checked);
test('official CSV handles BOM, quotes, delimiters and CRLF, rejects malformed input',()=>{
 assert.deepEqual(csv('"A;B";"C""D"\r\n'),[['A;B','C"D']]);
 assert.equal(parse('\uFEFF'+od).rows.length,1);
 for(const x of ['"open','a"b;c','"a"b;c'])assert.throws(()=>csv(x));
 for(const x of [header+'\na;b',od.replace('1,70','1e3'),od.replace('1,70','-1'),od.replace('classe1','missing')])assert.throws(()=>parse(x));
});
test('official price requires directed road-qualified endpoints and source proof, zero remains valid',()=>{
 const s=parse(od),r=quote(s,req);assert.equal(r.amount,1.7);assert.equal(r.routeVerified,false);assert.match(r.rawSha256,/^[a-f0-9]{64}$/);
 assert.equal(quote(s,{...req,vehicleClass:5}).amount,0);
 for(const change of [{originRoad:'A9'},{originName:'Sortie Sud',destinationName:'Echangeur Nord'},
  {originRoad:''},{vehicleClass:6},{originExit:12},{date:'2026-02-30'},{date:'2027-01-01'},{asOf:'2026-11-09'},{asOf:'2026-10-31'}])
  assert.equal(quote(s,{...req,...change}).amount,null,JSON.stringify(change));
});
test('conflicting duplicate prices and missing class prices cannot be quoted',()=>{
 const second=od.split('\n')[1];
 assert.equal(quote(parse(od+second.replace('1,70','1,80')+'\n'),req).amount,null);
 assert.equal(quote(parse(od.replace('1,70','-')),req).amount,null);
 assert.equal(quote(parse(od+second+'\n'),req).amount,1.7);
 const unavailable=parse(od.replace('1,70;2,70;4;5;0','#N/A;#N/A;#N/A;#N/A;#N/A'));
 assert.equal(unavailable.unpricedRows,1);assert.equal(unavailable.missingPriceCells,5);
 assert.equal(quote(unavailable,req).amount,null);
});
test('time-based feeds retain their schedule and never flatten it into a fixed quote',()=>{
 const arcos='Trajet;plage horaire;classe;Tarif_TTC;groupe_euro\nIttenheim;semaine 09h à 15h29;1;4,40;0\n';
 const a86='Type_jour;paiement_badge;Heure_début;heure_fin;Rueil_Vaucresson;Rueil_Vélizy;Vaucresson_Rueil;Vaucresson_Vélizy;Vélizy_Vaucresson;Vélizy_Rueil\nLundi;non;0H;4H30;1;2;3;4;5;6\n';
 const latin=s=>Buffer.from(s,'latin1');
 for(const [i,text] of [[3,arcos],[4,a86]]){
  const s=parseFeed(latin(text),config.sources[i],checked);assert.equal(s.rows.length,1);assert.equal(quote(s,req).amount,null);
 }
});
test('downloads reject HTTP failures, redirects and oversized responses',async()=>{
 await assert.rejects(download(source.url,async()=>new Response('',{status:403})),/HTTP 403/);
 await assert.rejects(download(source.url,async()=>new Response('',{headers:{'content-length':String(MAX_BYTES+1)}})),/size limit/);
 await assert.rejects(download(source.url,async()=>new Response(new Uint8Array(MAX_BYTES+1))),/size limit/);
});
test('failed refresh keeps last valid source bytes but records failure instead of claiming freshness',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'toll-sources-'));
 try{
  const saved=parse(od);await fs.writeFile(path.join(dir,'asf.json'),JSON.stringify(saved));
  const before=await fs.readFile(path.join(dir,'asf.json'),'utf8');
  const m=await refresh({directory:dir,now:new Date(checked),fetcher:async()=>new Response('blocked',{status:403})});
  assert.equal(m.sources[0].status,'stale');assert.equal(m.sources[1].status,'unavailable');
  assert.equal(await fs.readFile(path.join(dir,'asf.json'),'utf8'),before);
  assert.equal(m.coverage.missingNationalTariffs,null);assert.equal(m.coverage.successfulSources,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('refresh publishes complete validated snapshots and reports partial national scope',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'toll-sources-'));
 try{
  const m=await refresh({directory:dir,now:new Date(checked),fetcher:async url=>new Response(url===source.url?od:'bad')});
  assert.equal(m.sources[0].status,'fresh');assert.equal(m.sources[1].status,'unavailable');
  assert.equal(JSON.parse(await fs.readFile(path.join(dir,'asf.json'),'utf8')).rows.length,1);
  assert.equal(coverage(m).universeComplete,false);assert.equal(coverage(m).successfulSources,1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
