#!/usr/bin/env node
/* Inventaire GTFS hors réseau. Usage: node scripts/otp-gtfs-audit.cjs <gtfs.zip> [...]
 * Lecture seule, pas d'API ni de déploiement. Node 20+ ; utilise unzip si installé.
 */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),path=require('node:path');
const REQUIRED=['agency.txt','stops.txt','routes.txt','trips.txt','stop_times.txt'];
function csvRows(src){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<src.length;i++){const c=src[i];
  if(quoted){if(c==='"'&&src[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
  else if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}
  else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
 return rows;
}
function audit(file){
 const bytes=fs.readFileSync(file),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 const listing=cp.spawnSync('unzip',['-Z','-1',file],{encoding:'utf8',maxBuffer:16*1024*1024});
 if(listing.status!==0)throw Error('archive ZIP illisible ou unzip absent');
 const names=listing.stdout.split(/\r?\n/).filter(Boolean);
 const matches=(name)=>names.filter(x=>x===name||x.endsWith('/'+name));
 const missing=REQUIRED.filter(x=>matches(x).length!==1);
 const read=(name)=>{const files=matches(name);if(files.length!==1)return null;
  const p=cp.spawnSync('unzip',['-p',file,files[0]],{encoding:'utf8',maxBuffer:64*1024*1024});
  if(p.status!==0)throw Error('lecture impossible : '+name);return csvRows(p.stdout.replace(/^\uFEFF/,''));
 };
 const agencies=read('agency.txt'),stops=read('stops.txt'),calendar=read('calendar.txt'),dates=read('calendar_dates.txt');
 const index=(rows,name)=>rows?.[0]?.indexOf(name)??-1;
 const values=(rows,col)=>{const i=index(rows,col);return i<0?[]:rows.slice(1).map(r=>r[i]).filter(Boolean);};
 const tz=[...new Set(values(agencies,'agency_timezone'))];
 const serviceDates=[...values(calendar,'start_date'),...values(calendar,'end_date'),...values(dates,'date')].filter(x=>/^\d{8}$/.test(x)).sort();
 return {file:path.basename(file),sizeBytes:bytes.length,sha256,requiredFilesMissing:missing,
  stops:stops?Math.max(0,stops.length-1):null,agencyTimezones:tz,
  serviceDateMin:serviceDates[0]||null,serviceDateMax:serviceDates.at(-1)||null,
  hasCalendar:!!calendar,hasCalendarDates:!!dates,
  warnings:[...missing.map(x=>'Fichier absent ou ambigu : '+x),...(!calendar&&!dates?['Aucun calendrier GTFS']:[]),
   ...(tz.length!==1?['Fuseau agence absent ou multiple : vérifier']:[])]};
}
if(require.main===module){
 const files=process.argv.slice(2);
 if(!files.length){console.error('Usage: node scripts/otp-gtfs-audit.cjs <gtfs.zip> [...]');process.exit(2);}
 const out=[];let errors=0;
 for(const f of files){try{out.push(audit(f));}catch(e){errors++;out.push({file:path.basename(f),error:e.message});}}
 process.stdout.write(JSON.stringify({generatedAt:new Date().toISOString(),archives:out},null,2)+'\n');
 if(errors||out.some(x=>x.warnings?.length))process.exitCode=1;
}
module.exports={csvRows,audit};
