'use strict';
// Audits public timetable discovery only. Does not imply ticket prices or inventory.
const {fetchNationalOperatorGTFS}=require('../transport-catalogue.js');
(async()=>{
 const timeout=AbortSignal.timeout(20000);
 const result=await fetchNationalOperatorGTFS(fetch,{signal:timeout});
 const report={checkedAt:new Date().toISOString(),source:'https://transport.data.gouv.fr/api/datasets',operators:{}};
 for(const [name,feeds] of Object.entries(result)){
  report.operators[name]={resources:feeds.length,feeds:feeds.map(f=>({datasetId:f.datasetId,id:f.id,updatedAt:f.updatedAt,url:f.url,requiresServerSideIndex:f.requiresServerSideIndex}))};
 }
 require('fs').mkdirSync('docs',{recursive:true});
 require('fs').writeFileSync('docs/audit-national-operators.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(Object.values(report.operators).every(x=>x.resources===0))process.exitCode=2;
})().catch(e=>{console.error('Catalogue national indisponible :',e.message);process.exitCode=1;});
