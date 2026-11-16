#!/usr/bin/env node
/* Mesure locale OTP2 Java. Aucun accès Cloud ni déploiement.
 * Usage: node scripts/otp-memory-report.cjs -- <commande> [arguments...]
 * Ex: node scripts/otp-memory-report.cjs -- java -Xmx6g -jar otp.jar --load ./graph
 * Nécessite /usr/bin/time sur Linux (GNU time recommandé).
 */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const args=process.argv.slice(2);
if(args[0]!=='--'||args.length<2){console.error('Usage: node scripts/otp-memory-report.cjs -- <commande> [arguments...]');process.exit(2);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'otp-mem-'));
const metrics=path.join(tmp,'metrics.txt');
const start=process.hrtime.bigint();
try{
 const result=cp.spawnSync('/usr/bin/time',['-f','MAX_RSS_KB=%M\nELAPSED_SEC=%e\nUSER_CPU_SEC=%U\nSYSTEM_CPU_SEC=%S','-o',metrics,...args.slice(1)],{stdio:'inherit'});
 const seconds=Number(process.hrtime.bigint()-start)/1e9;
 const raw=fs.existsSync(metrics)?fs.readFileSync(metrics,'utf8'):'';
 const fields=Object.fromEntries(raw.split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
 const rss=Number(fields.MAX_RSS_KB);
 const report={command:args[1],exitCode:result.status,elapsedWallSeconds:Number(seconds.toFixed(2)),
  maxRssMiB:Number.isFinite(rss)?Number((rss/1024).toFixed(1)):null,
  userCpuSeconds:Number(fields.USER_CPU_SEC)||null,systemCpuSeconds:Number(fields.SYSTEM_CPU_SEC)||null,
  host:process.platform,measuredAt:new Date().toISOString(),notes:[
   'Mesure locale : ne représente pas directement la consommation facturée Cloud Run.',
   'Mesurer séparément construction du graphe, chargement du graphe et trafic de requêtes.',
   'Ne pas déployer sur Google Cloud sans accord explicite.'
  ]};
 process.stderr.write('\nOTP2_RESOURCE_REPORT '+JSON.stringify(report)+'\n');
 process.exitCode=result.status??2;
 if(result.error)process.stderr.write(result.error.message+'\n');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
