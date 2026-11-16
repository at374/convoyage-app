#!/usr/bin/env node
/* Contrôle local de fraîcheur des GTFS avant construction OTP2.
 * Usage: node scripts/otp-gtfs-readiness.cjs <audit.json> <YYYY-MM-DD>
 * audit.json = sortie de scripts/otp-gtfs-audit.cjs ; aucun réseau.
 */
'use strict';
const fs=require('node:fs');
function dateKey(value){
 if(typeof value!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(value))return null;
 const iso=value.replace(/-/g,'');
 const d=new Date(value+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?iso:null;
}
function readiness(input,target){
 const day=dateKey(target);
 if(!day)throw Error('Date cible invalide (YYYY-MM-DD)');
 if(!input||!Array.isArray(input.archives))throw Error('Rapport audit invalide');
 const archives=input.archives.map(a=>{
  const reasons=[];
  if(a.error)reasons.push('audit en erreur');
  if(!a.sha256||!/^[a-f0-9]{64}$/i.test(a.sha256))reasons.push('SHA256 absent');
  if(a.requiredFilesMissing?.length)reasons.push('fichiers GTFS obligatoires manquants');
  if(a.hasCalendar!==true&&a.hasCalendarDates!==true)reasons.push('calendrier absent');
  if(!a.serviceDateMin||!a.serviceDateMax)reasons.push('bornes de calendrier absentes');
  else if(day<a.serviceDateMin||day>a.serviceDateMax)reasons.push('date hors bornes de calendrier');
  if(!Array.isArray(a.agencyTimezones)||!a.agencyTimezones.length)reasons.push('fuseau absent');
  if(!Number.isInteger(a.stops)||a.stops<1)reasons.push('aucun arrêt');
  return {file:a.file||null,readyForDetailedCheck:reasons.length===0,reasons};
 });
 return {targetDate:target,allReadyForDetailedCheck:archives.length>0&&archives.every(x=>x.readyForDetailedCheck),
  archives,warning:'Les bornes du calendrier ne prouvent pas la circulation un jour donné : vérifier service_id, calendar_dates, trips et stop_times.'};
}
if(require.main===module){
 try{if(process.argv.length!==4)throw Error('Usage: node scripts/otp-gtfs-readiness.cjs <audit.json> <YYYY-MM-DD>');
  const report=readiness(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),process.argv[3]);
  console.log(JSON.stringify(report,null,2));
  if(!report.allReadyForDetailedCheck)process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
module.exports={readiness,dateKey};
