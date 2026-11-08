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
let verifiedClass1=0;
const position={ARSY:0,CHEVRIERES:0,SENLIS:0,CHAMANT:0};
for(let i=0;i<dataset.records.length;i++){
 const record=dataset.records[i],row=parse(csv[i+1]);
 assert.equal(row.length,header.length,'CSV columns row '+(i+2));
 assert.deepEqual(row.slice(0,4),[record.origine,record.destination,inverse[record.origine],inverse[record.destination]]);
 assert.deepEqual(row.slice(4,8),['classe1_normal','classe1_vert','classe1_rouge','classe2_normal'].map(field=>(record.centimes[field]/100).toFixed(2)));
 assert.equal(row[8],dataset.source);
 assert.ok(Object.hasOwn(position,record.destination));
 position[record.destination]++;
 assert.equal(row[9],'CLASSES1_2_COMPAREES_PDF_2026');
 assert.equal(row[10],'1');
 assert.equal(row[11],String(position[record.destination]));
 assert.match(row[12],/classe 2 normal comparées/);
 assert.match(row[12],/identité des gares, sens et exceptions à confirmer/);
 verifiedClass1++;
}
assert.deepEqual(position,{ARSY:29,CHEVRIERES:30,SENLIS:31,CHAMANT:32});
assert.equal(verifiedClass1,122);

// Every amount has its own independent verification record, initially uncertified.
const amountCsv=fs.readFileSync(path.join(root,'sanef-a1-certification-montants-2026.csv'),'utf8').trimEnd().split(/\r?\n/);
assert.deepEqual(parse(amountCsv[0]),['origine','destination','tarif','montant_eur','source_tarif','statut_certification','page_pdf_confirmee','ligne_pdf_confirmee','colonne_pdf_confirmee','sens_confirme','identite_gps_confirmee']);
assert.equal(amountCsv.length-1,488);
let amountIndex=1;
for(const record of dataset.records){
 for(const field of ['classe1_normal','classe1_vert','classe1_rouge','classe2_normal']){
  const row=parse(amountCsv[amountIndex++]);
  assert.equal(row.length,11);
  assert.deepEqual(row.slice(0,4),[record.origine,record.destination,field,(record.centimes[field]/100).toFixed(2)]);
  assert.equal(row[4],field==='classe2_normal'?'https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf':dataset.source);
  assert.equal(row[5],'A_CERTIFIER_INDEPENDAMMENT');
  assert.deepEqual(row.slice(6),['','','','NON','NON']);
 }
}

console.log('PASS '+verifiedClass1+' SANEF A1 class-1 and class-2 PDF line comparisons recorded; station identities and conditions not certified');
