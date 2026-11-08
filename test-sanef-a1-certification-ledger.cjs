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
const stationCsv=fs.readFileSync(path.join(root,'sanef-a1-audit-alias-gares-2026.csv'),'utf8').trimEnd().split(/\r?\n/);
const stationRows=stationCsv.slice(1).map(parse);
const stationByCanonical=new Map(stationRows.map(row=>[row[1],row]));
assert.equal(stationByCanonical.size,33,'each station must have a unique canonical identity');
assert.deepEqual(parse(stationCsv[0]),['nom_grille_sanef','nom_canonique_application','statut_identite_gare','numero_echangeur_confirme','coordonnees_confirmees','source_officielle_exacte','page_pdf_verifiee','observation']);
assert.equal(stationRows.length,33);
const isValidGpsCoordinates=value=>{
 const parts=value.split(',').map(x=>x.trim());
 if(parts.length!==2||parts.some(x=>!/^[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)$/.test(x)))return false;
 const [lat,lon]=parts.map(Number);
 return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
};
assert.equal(isValidGpsCoordinates(''),false);
assert.equal(isValidGpsCoordinates('PR 32+359'),false);
assert.equal(isValidGpsCoordinates('91,181'),false);
assert.equal(isValidGpsCoordinates('49.12,2.42'),true);
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
  assert.ok(['A_CERTIFIER_INDEPENDAMMENT','CERTIFIE_INDEPENDAMMENT'].includes(row[5]),'unknown amount certification status');
  if(row[5]==='CERTIFIE_INDEPENDAMMENT'){
   assert.match(row[4],/^https:\/\/www\.autoroutes\.sanef\.com\//,'official SANEF source required');
   for(const [index,label] of [[6,'PDF page'],[7,'PDF row'],[8,'PDF column']]){
    assert.ok(row[index].trim(),label+' required for certified amount');
   }
   assert.equal(row[9],'OUI','direction must be confirmed before certification');
   assert.equal(row[10],'OUI','physical GPS station identity must be confirmed before certification');
   for(const canonical of [record.origine,record.destination]){
    const station=stationByCanonical.get(canonical);
    assert.ok(station,'missing physical station audit for '+canonical);
    assert.equal(station[2],'CERTIFIE','station '+canonical+' must be independently GPS-certified');
    assert.ok(isValidGpsCoordinates(station[4]),'station '+canonical+' must have valid latitude,longitude coordinates');
    assert.ok(station[5].startsWith('https://'),'station '+canonical+' must have a source URL');
   }
  }else{
   assert.deepEqual(row.slice(6),['','','','NON','NON']);
  }
 }
}

console.log('PASS '+verifiedClass1+' SANEF A1 class-1 and class-2 PDF line comparisons recorded; station identities and conditions not certified');
