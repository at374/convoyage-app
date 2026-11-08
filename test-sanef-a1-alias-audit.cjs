'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const aliases=JSON.parse(read('sanef-a1-gare-alias-2026.json')).aliases;
const dataset=JSON.parse(read('sanef-a1-modulation-2026.json'));
const csv=read('sanef-a1-audit-alias-gares-2026.csv').trimEnd().split(/\r?\n/);
const parse=line=>{const items=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){items.push(value);value='';}else value+=c;}assert.equal(quoted,false);items.push(value);return items;};
assert.deepEqual(parse(csv[0]),['nom_grille_sanef','nom_canonique_application','statut_identite_gare','numero_echangeur_confirme','coordonnees_confirmees','source_officielle_exacte','page_pdf_verifiee','observation']);
const entries=Object.entries(aliases);
assert.equal(entries.length,33);
assert.equal(csv.length,34);
const canon=new Set();
for(let i=0;i<entries.length;i++){
 const row=parse(csv[i+1]);
 assert.equal(row.length,8);
 assert.deepEqual(row.slice(0,2),entries[i]);
 if(row[2]==='A_VERIFIER'){
  assert.deepEqual(row.slice(3,7),['','','','']);
  assert.match(row[7],/ne pas activer pour facturation/);
 }else if(row[2]==='NOM_KM_OFFICIELS_RELEVES_ALIAS_A_CONFIRMER'){
  assert.equal(row[0],'CALAIS (péage de Setques)');
  assert.deepEqual(row.slice(3,5),['','']);
  assert.equal(row[5],'https://www.autoroutes.sanef.com/fr/mon-voyage/peage-de-setques');
  assert.equal(row[6],'');
  assert.match(row[7],/km 32/);
  assert.match(row[7],/non certifiées/);
 }else{
  assert.equal(row[2],'NOM_NUMERO_PR_OFFICIELS_RELEVES_ALIAS_A_CONFIRMER');
  assert.ok(row[3]);
  assert.equal(row[4],'','coordinates must remain unconfirmed');
  assert.match(row[5],/^https:\/\/www\.autoroutes\.sanef\.com\/sites\/default\/files\/2025-12\//);
  assert.ok(['33','34'].includes(row[6]),'SANEF annex 2 printed page 33 or 34');
  assert.match(row[7],/PR \d+\+\d+/);
 }

 assert.ok(!canon.has(row[1]),'duplicate canonical alias '+row[1]);
 canon.add(row[1]);
}
for(const relation of dataset.records){
 assert.ok(canon.has(relation.origine),'missing origin '+relation.origine);
 assert.ok(canon.has(relation.destination),'missing destination '+relation.destination);
}
assert.equal(csv.slice(1).map(parse).filter(row=>row[2]==='NOM_NUMERO_PR_OFFICIELS_RELEVES_ALIAS_A_CONFIRMER').length,8);
assert.equal(csv.slice(1).map(parse).filter(row=>row[2]==='NOM_KM_OFFICIELS_RELEVES_ALIAS_A_CONFIRMER').length,1);
const rows=csv.slice(1).map(parse);
assert.equal(rows.filter(row=>row[2]==='A_VERIFIER').length,24);
assert.equal(rows.filter(row=>row[5].startsWith('https://www.autoroutes.sanef.com/')).length,9);
assert.ok(rows.every(row=>row[4]===''),'no physical alias may be marked GPS-confirmed without independent coordinates');
assert.ok(rows.every(row=>row[2]!=='CERTIFIE'),'no physical alias is certified');
console.log('PASS 33 SANEF aliases: 9 documentary references, 24 pending, 0 GPS-certified; 122 relations mapped');
