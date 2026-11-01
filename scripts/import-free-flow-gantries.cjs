'use strict';
const fs=require('node:fs'),path=require('node:path');
const {csv,sha256}=require('../toll-official-catalogue.cjs');
const source={publisher:'Maxime Lopes',datasetUrl:'https://www.data.gouv.fr/datasets/autoroutes-et-peages-en-flux-libre',
 resourceUrl:'https://static.data.gouv.fr/resources/autoroutes-et-peages-en-flux-libre/20251025-160412/portiques-free-flow-25-10-2025.csv',
 publishedOn:'2025-10-25',retrievedOn:'2026-11-01',encoding:'windows-1252',license:'Other (Attribution)',
 indicativeOnly:true,officialSurvey:false,laneGeometryVerified:false,
 reuseNote:'Credit Maxime Lopes. Free reuse for bundled applications; no paid standalone gantry-alert option. Road signs and legal payment obligations take precedence; the dataset can contain errors.'};
function parse(bytes){
 const table=csv(new TextDecoder(source.encoding,{fatal:true}).decode(bytes));
 const headers=['Nom','Coordonnées GPS','Autoroute','Type','Sens','PK','Concessionnaire','Observations'];
 if(JSON.stringify(table[0])!==JSON.stringify(headers)||table.length<2)throw Error('Unexpected gantry source headers');
 const records=table.slice(1).map((r,i)=>{
  if(r.length!==8||!r[0]||!/^A\d{1,3}$/.test(r[2])||!r[6])throw Error('Invalid source row '+(i+2));
  const p=r[1].split(',').map(s=>s.trim());
  if(p.length!==2||p.some(s=>!/^[-+]?\d+(?:\.\d+)?$/.test(s)))throw Error('Invalid coordinate');
  const point=p.map(Number);if(!point.every(Number.isFinite)||point[0]<41||point[0]>52||point[1]<-6||point[1]>10)throw Error('Outside reviewed metropolitan extent');
  if(!['1','2','1+2',''].includes(r[4]))throw Error('Unsupported direction');
  if(!['Flux libre','BPV','Barrière','Mixte : Flux libre + BPV'].includes(r[3]))throw Error('Unsupported gate type');
  const pk=r[5]==='nc'?null:Number(r[5].replace(',','.'));if(pk!==null&&(!Number.isFinite(pk)||pk<0))throw Error('Invalid kilometre reference');
  return {id:'free-flow-2025-row-'+(i+2),nom:r[0],point,road:r[2],type:r[3],sens:r[4]||null,pk,operator:r[6],observations:r[7],sourceLine:i+2};
 });
 return {schemaVersion:1,source:{...source,rawSha256:sha256(bytes),downloadedBytesVerified:true},records};
}
function attach(overlay,snapshot){return {...overlay,portiques_source:snapshot.source,portiques_candidats:snapshot.records};}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),snapshot=parse(fs.readFileSync(path.join(root,'data/tolls/reviewed/free-flow-gantries-2025.csv')));
 fs.writeFileSync(path.join(root,'data/tolls/reviewed/free-flow-gantries-2025.json'),JSON.stringify(snapshot,null,2)+'\n');
 if(process.argv.includes('--write')){const p=path.join(root,'peages-overlay.json');fs.writeFileSync(p,JSON.stringify(attach(JSON.parse(fs.readFileSync(p,'utf8')),snapshot))+'\n');}
 console.log(JSON.stringify({records:snapshot.records.length,a79:snapshot.records.filter(r=>r.road==='A79').length,rawSha256:snapshot.source.rawSha256,operationalStationBindingsAdded:0,written:process.argv.includes('--write')}));
}
module.exports={parse,attach};
