'use strict';
// Official source prices. Route access, reverse travel and calendar bands are never inferred.
const {createHash}=require('node:crypto');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const normal=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function csv(text){
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch==='"'){if(cell.trim()||closed)throw Error('Unexpected quote');quoted=true;continue;}
  if(ch===';'||ch==='\n'||ch==='\r'){
   row.push(cell.trim());cell='';closed=false;
   if(ch!==';'){if(row.some(c=>c!==''))rows.push(row);row=[];if(ch==='\r'&&text[i+1]==='\n')i++;}
  }else{if(closed&&!/\s/.test(ch))throw Error('Text after closing quote');cell+=ch;}
 }
 if(quoted)throw Error('Unclosed quote');
 row.push(cell.trim());if(row.some(c=>c!==''))rows.push(row);
 return rows;
}
function amount(s){
 if(s===''||s==='-'||s==='--'||s==='---'||s==='#N/A')return null;
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(s))throw Error('Invalid tariff amount: '+s);
 const n=Number(s.replace(',','.'));if(!Number.isFinite(n)||n>100000)throw Error('Out-of-range tariff');return n;
}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
function parseFeed(bytes,source,checkedOn){
 if(!/^https:\/\//.test(source.url)||!validDate(source.effectiveFrom)||!validDate(checkedOn)||!Number.isInteger(source.verifiedYear))throw Error('Missing source metadata');
 const text=new TextDecoder(source.encoding,{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
 const table=csv(text);if(table.length<2)throw Error('Empty tariff feed');
 const headers=table.shift(),keys=headers.map(normal),at=name=>{const i=keys.indexOf(normal(name));if(i<0)throw Error('Missing column '+name);return i;};
 const required=source.format==='od'?['autoroute_entree','nom_entree','autoroute_sortie','nom_sortie','classe1','classe2','classe3','classe4','classe5']:source.format==='arcos-schedule'?['Trajet','plage horaire','classe','Tarif_TTC','groupe_euro']:source.format==='a86-schedule'?['Type_jour','paiement_badge','Heure_début','heure_fin','Rueil_Vaucresson','Rueil_Vélizy','Vaucresson_Rueil','Vaucresson_Vélizy','Vélizy_Vaucresson','Vélizy_Rueil']:null;
 if(!required)throw Error('Unsupported tariff format');
 required.forEach(at);if(new Set(keys).size!==keys.length)throw Error('Duplicate columns');
 const priceColumns=(source.format==='od'?required.slice(4):source.format==='arcos-schedule'?['Tarif_TTC']:required.slice(4)).map(at);
 const clock=s=>{const m=/^(\d{1,2})H(?:([0-5]\d))?$/.exec(s);return !!m&&Number(m[1])<=24&&(Number(m[1])<24||!Number(m[2]));};
 const rows=table.map((row,index)=>{
  if(row.length!==headers.length)throw Error('Column count at row '+(index+2));
  const parsed=[...row];for(const col of priceColumns)parsed[col]=amount(row[col]);
  if(source.format==='od'&&required.slice(0,4).some(name=>!row[at(name)]))throw Error('Missing route endpoint');
  if(source.format==='arcos-schedule'&&(!row[at('Trajet')]||!row[at('plage horaire')]||!/^[1-5]$/.test(row[at('classe')])))throw Error('Missing scheduled tariff context');
  if(source.format==='a86-schedule'&&(!row[at('Type_jour')]||!['oui','non'].includes(row[at('paiement_badge')])||!clock(row[at('Heure_début')])||!clock(row[at('heure_fin')])))throw Error('Missing A86 time/badge context');
  return parsed;
 });
 return {schemaVersion:1,sourceId:source.id,sourceUrl:source.url,effectiveFrom:source.effectiveFrom,verifiedYear:source.verifiedYear,checkedOn,currency:'EUR',format:source.format,directionality:'as-published-only',rawSha256:sha256(bytes),headers,priceColumns,missingPriceCells:rows.reduce((n,r)=>n+priceColumns.filter(i=>r[i]===null).length,0),unpricedRows:rows.filter(r=>priceColumns.every(i=>r[i]===null)).length,rows};
}
function quote(snapshot,request){
 const unknown=reason=>({status:'unconfirmed',amount:null,reason,sourceUrl:snapshot.sourceUrl});
 const date=String(request.date||'');if(!validDate(date))return unknown('invalid-date');
 const asOf=request.asOf||new Date().toISOString().slice(0,10);
 if(!validDate(asOf)||!validDate(snapshot.checkedOn)||snapshot.checkedOn>asOf||
   Date.parse(asOf)-Date.parse(snapshot.checkedOn)>7*86400000)return unknown('source-not-fresh');
 if(date<snapshot.effectiveFrom||Number(date.slice(0,4))!==snapshot.verifiedYear)return unknown('outside-verified-period');
 if(!Number.isInteger(request.vehicleClass)||request.vehicleClass<1||request.vehicleClass>5)return unknown('invalid-vehicle-class');
 if(snapshot.format!=='od')return unknown('calendar-time-or-payment-context-required');
 if(!request.originRoad||!request.originName||!request.destinationRoad||!request.destinationName)return unknown('road-qualified-endpoints-required');
 const h=snapshot.headers.map(normal),at=name=>h.indexOf(normal(name));
 if((request.originExit!=null&&at('echangeur_entree')<0)||(request.destinationExit!=null&&at('echangeur_sortie')<0))return unknown('exit-identifier-not-published');
 const selected=snapshot.rows.filter(row=>[
  ['autoroute_entree',request.originRoad],['nom_entree',request.originName],['autoroute_sortie',request.destinationRoad],['nom_sortie',request.destinationName]
 ].every(([key,value])=>normal(row[at(key)])===normal(value))&&
 (request.originExit==null||String(row[at('echangeur_entree')])===String(request.originExit))&&
 (request.destinationExit==null||String(row[at('echangeur_sortie')])===String(request.destinationExit)));
 if(!selected.length)return unknown('not-published-for-these-directed-endpoints');
 const amounts=selected.map(row=>row[at('classe'+request.vehicleClass)]);
 if(amounts.some(n=>n===null||!Number.isFinite(n)))return unknown('missing-vehicle-class-price');
 if(new Set(amounts).size!==1)return unknown('contradictory-source-rows');
 return {status:'official-source-price',amount:amounts[0],currency:'EUR',sourceUrl:snapshot.sourceUrl,effectiveFrom:snapshot.effectiveFrom,checkedOn:snapshot.checkedOn,rawSha256:snapshot.rawSha256,routeVerified:false};
}
function coverage(manifest){
 return {universeComplete:false,missingNationalTariffs:null,sourceCount:manifest.sources.length,successfulSources:manifest.sources.filter(s=>s.status==='fresh').length,staleSources:manifest.sources.filter(s=>s.status!=='fresh').map(s=>s.id),rowCount:manifest.sources.reduce((n,s)=>n+(s.rows||0),0),certificate:'partial-source-collection-only'};
}
module.exports={csv,amount,parseFeed,quote,coverage,sha256,validDate};
