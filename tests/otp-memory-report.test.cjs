const test=require('node:test');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const path=require('node:path');
const script=path.join(__dirname,'../scripts/otp-memory-report.cjs');
test('mesure OTP2 : commande obligatoire',()=>{
 const run=cp.spawnSync(process.execPath,[script],{encoding:'utf8'});
 assert.equal(run.status,2);
 assert.match(run.stderr,/Usage:/);
});
test('mesure OTP2 : rapport RAM et code de sortie sans Cloud',t=>{
 if(process.platform!=='linux')return t.skip('GNU time requis sous Linux');
 const probe=cp.spawnSync('/usr/bin/time',['-f','%M','true'],{encoding:'utf8'});
 if(probe.error||probe.status!==0)return t.skip('GNU time absent');
 const run=cp.spawnSync(process.execPath,[script,'--',process.execPath,'-e','process.stdout.write("ok")'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/ok/);
 const line=run.stderr.split('\n').find(s=>s.startsWith('OTP2_RESOURCE_REPORT '));
 assert.ok(line,run.stderr);
 const report=JSON.parse(line.slice('OTP2_RESOURCE_REPORT '.length));
 assert.equal(report.exitCode,0);
 assert.ok(report.maxRssMiB>=0);
 assert.ok(report.elapsedWallSeconds>=0);
});
test('mesure OTP2 : conserve un échec de la commande',t=>{
 if(process.platform!=='linux')return t.skip('GNU time requis sous Linux');
 const probe=cp.spawnSync('/usr/bin/time',['-f','%M','true'],{encoding:'utf8'});
 if(probe.error||probe.status!==0)return t.skip('GNU time absent');
 const run=cp.spawnSync(process.execPath,[script,'--',process.execPath,'-e','process.exit(7)'],{encoding:'utf8'});
 assert.equal(run.status,7,run.stderr);
});
