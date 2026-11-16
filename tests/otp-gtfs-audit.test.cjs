const test=require('node:test');
const assert=require('node:assert/strict');
const {csvRows}=require('../scripts/otp-gtfs-audit.cjs');
test('CSV GTFS : en-têtes et CRLF',()=>{
 assert.deepEqual(csvRows('stop_id,stop_name\r\n1,Annecy\r\n'),[['stop_id','stop_name'],['1','Annecy']]);
});
test('CSV GTFS : champs entre guillemets et virgules',()=>{
 assert.deepEqual(csvRows('id,name\n1,"Annecy, gare"\n2,"Station ""Centre"""\n'),[
 ['id','name'],['1','Annecy, gare'],['2','Station "Centre"']]);
});
test('CSV GTFS : dernière ligne sans saut de ligne',()=>{
 assert.deepEqual(csvRows('a,b\n1,2'),[['a','b'],['1','2']]);
});

test('GTFS : archive réelle minimale, contrôle des dates et fuseaux',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'otp-gtfs-'));
 try{
  const zipProbe=cp.spawnSync('zip',['-v'],{encoding:'utf8'});
  if(zipProbe.error){t.skip('zip non disponible');return;}
  const files={
   'agency.txt':'agency_id,agency_name,agency_url,agency_timezone\n1,Test,https://example.org,Europe/Paris\n',
   'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\n1,Annecy,45.9,6.12\n2,Geneve,46.2,6.14\n',
   'routes.txt':'route_id,agency_id,route_type\n1,1,2\n',
   'trips.txt':'route_id,service_id,trip_id\n1,1,1\n',
   'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n1,08:00:00,08:00:00,1,1\n',
   'calendar.txt':'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n1,1,1,1,1,1,0,0,20261101,20261231\n'
  };
  for(const [name,body] of Object.entries(files))fs.writeFileSync(path.join(dir,name),body);
  const zip=path.join(dir,'feed.zip');
  const result=cp.spawnSync('zip',['-q',zip,...Object.keys(files)],{cwd:dir,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const {audit}=require('../scripts/otp-gtfs-audit.cjs');
  const report=audit(zip);
  assert.deepEqual(report.requiredFilesMissing,[]);
  assert.equal(report.stops,2);
  assert.deepEqual(report.agencyTimezones,['Europe/Paris']);
  assert.equal(report.serviceDateMin,'20261101');
  assert.equal(report.serviceDateMax,'20261231');
  assert.deepEqual(report.warnings,[]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
