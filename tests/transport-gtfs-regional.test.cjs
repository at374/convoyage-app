const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
globalThis.CPGTFSIndex=require('../transport-gtfs-index.js');
const loader=require('../transport-gtfs-loader.js');
const Fares=require('../transport-gtfs-fares.js');
const agenda=require('../transport-gtfs-agenda.js');

// Agrégat Oùra de test, puis extraction réelle par scripts/build_regional_gtfs.py (hors ligne).
function buildExtract(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-gtfs-'));
 const py=`import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1],'w')\n`+Object.entries({
  'agency.txt':"agency_id,agency_name,agency_timezone\\nJY,RUMILLY - J'ybus,Europe/Paris\\nTC,TCL,Europe/Paris\\n",
  'routes.txt':'route_id,agency_id,route_short_name,route_type\\nR1,JY,1,3\\nR6,TC,C1,3\\n',
  'trips.txt':'route_id,service_id,trip_id\\nR1,S,T1\\nR6,S,T6\\n',
  'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\\nT1,08:00:00,08:00:00,A,1\\nT1,08:15:00,08:15:00,B,2\\nT6,08:00:00,08:00:00,C,1\\nT6,08:30:00,08:30:00,D,2\\n',
  'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\\nA,Rumilly gare,45.865,5.944\\nB,Rumilly centre,45.867,5.950\\nC,Lyon 1,45.76,4.85\\nD,Lyon 2,45.75,4.86\\n',
  'calendar_dates.txt':'service_id,date,exception_type\\nS,20261116,1\\n',
  'fare_attributes.txt':'fare_id,price,currency_type,payment_method,transfers,agency_id,transfer_duration\\nFJ,1.50,EUR,0,,JY,3600\\n',
  'fare_rules.txt':'fare_id,route_id\\nFJ,R1\\n'}).map(([k,v])=>`z.writestr(${JSON.stringify(k)},"${v}")\n`).join('')+'z.close()\n';
 const agg=path.join(dir,'oura.zip');execFileSync('python3',['-I','-c',py,agg]);
 execFileSync('python3',['-I',path.join(__dirname,'..','scripts','build_regional_gtfs.py'),'--aggregate',agg,'--out',path.join(dir,'out'),'--offline']);
 return path.join(dir,'out');
}
const response=bytes=>new Response(bytes,{status:200,headers:{'content-type':'application/zip','content-length':String(bytes.length)}});

test('flux J’y bus extrait par le script Python : chargé par le vrai chargeur, indexé, tarif officiel calculé',async()=>{
 const out=buildExtract();
 const bytes=fs.readFileSync(path.join(out,'jybus-rumilly.zip'));
 const feed=await loader.loadResource({format:'GTFS',url:'https://exemple.test/jybus.zip',network:"J'y bus Rumilly"},{fetcher:async()=>response(bytes),retainSourceTables:false});
 assert.equal(feed.index.counts.routes,1,'seule la ligne J’y bus');
 const fare=Fares.legFare(Fares.prepare(feed.files),feed.index,{tripId:'T1',from:'A',to:'B'});
 assert.deepEqual([fare.amount,fare.currency,fare.transferMinutes],[1.5,'EUR',60]);
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 assert.equal(manifest.networks['jybus-rumilly'].sha256.length,64);
});

test('copie du site absente : bascule automatique sur la source officielle (fallbackUrls)',async()=>{
 const out=buildExtract();const bytes=fs.readFileSync(path.join(out,'jybus-rumilly.zip'));const seen=[];
 const fetcher=async url=>{seen.push(url);return url.includes('site.test')?new Response('absent',{status:404}):response(bytes);};
 const feed=await loader.loadResource({format:'GTFS',url:'https://site.test/data/gtfs/x.zip',fallbackUrls:['https://officiel.test/x.zip'],network:'X'},{fetcher});
 assert.deepEqual(seen,['https://site.test/data/gtfs/x.zip','https://officiel.test/x.zip']);
 assert.equal(feed.source.url,'https://officiel.test/x.zip');
});

test('ordre des réseaux : J’y bus seulement pour un trajet interne à Rumilly ; Rumilly → Annecy garde les cars Haute-Savoie',()=>{
 const R=agenda.DEFAULT_RESOURCES;
 const first=t=>R.find(r=>agenda.selected(r,t))?.id;
 assert.equal(first({from:{lat:45.865,lon:5.944},to:{lat:45.867,lon:5.950}}),'jybus-rumilly');
 assert.equal(first({from:{lat:45.865,lon:5.944},to:{lat:45.9017,lon:6.1219}}),'oura-haute-savoie');
 assert.ok(R.filter(r=>r.broad).every(r=>R.indexOf(r)>R.findIndex(x=>x.id==='82178')),'cars régionaux larges en dernier');
});
