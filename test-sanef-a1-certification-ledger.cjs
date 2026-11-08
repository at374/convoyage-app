'use strict';
/* Verify the certification ledger remains synchronized with experimental data.
 * All entries remain unverified until separately checked against official PDFs.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const dataset=JSON.parse(fs.readFileSync(path.join(root,'sanef-a1-modulation-2026.json'),'utf8'));
const aliases=JSON.parse(fs.readFileSync(path.join(root,'sanef-a1-gare-alias-2026.json'),'utf8')).aliases;
const csv=fs.readFileSync(path.join(root,'sanef-a1-certification-relations-2026.csv'),'utf8').trimEnd().split(/\r?\n/);
const parse=line=>{const result=[];let item='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){item+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){result.push(item);item='';}else item+=c;}result.push(item);assert.equal(quoted,false);return result;};
const header=parse(csv[0]);
const names=['origine_canonique','destination_canonique','origine_grille_a_verifier','destination_grille_a_verifier','classe1_normal_eur','classe1_vert_eur','classe1_rouge_eur','classe2_normal_eur','source_officielle','statut_correspondance','page_pdf_verifiee','colonne_pdf_verifiee','commentaire'];
assert.deepEqual(header,names);
assert.equal(csv.length-1,dataset.records.length);
const inverse=Object.fromEntries(Object.entries(aliases).map(([label,canonical])=>[canonical,label]));
for(let i=0;i<dataset.records.length;i++){
 const record=dataset.records[i],row=parse(csv[i+1]);
 assert.equal(row.length,header.length,'CSV columns row '+(i+2));
 assert.deepEqual(row.slice(0,4),[record.origine,record.destination,inverse[record.origine],inverse[record.destination]]);
 assert.deepEqual(row.slice(4,8),['classe1_normal','classe1_vert','classe1_rouge','classe2_normal'].map(field=>(record.centimes[field]/100).toFixed(2)));
 assert.equal(row[8],dataset.source);
 if(record.destination==='ARSY'){
  assert.equal(row[9],'CLASSE1_VERIFIEE_PDF_2026');
  assert.equal(row[10],'1');
  assert.equal(row[11],String(i+1));
 }else{
  assert.equal(row[9],'A_VERIFIER');
  assert.equal(row[10],'');
  assert.equal(row[11],'');
 }
}
console.log('PASS '+dataset.records.length+' SANEF A1 certification ledger relations synchronized (all still unverified)');
