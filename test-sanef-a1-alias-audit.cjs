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
 }else{
  assert.equal(row[2],'NOM_NUMERO_PR_OFFICIELS_RELEVES_ALIAS_A_CONFIRMER');
  assert.ok(row[3]);
  assert.equal(row[4],'','coordinates must remain unconfirmed');
  assert.match(row[5],/^https:\/\/www\.autoroutes\.sanef\.com\/sites\/default\/files\/2025-12\//);
  assert.equal(row[6],'','PDF page not yet independently recorded');
  assert.match(row[7],/PR \d+\+\d+/);
 }

 assert.ok(!canon.has(row[1]),'duplicate canonical alias '+row[1]);
 canon.add(row[1]);
}
for(const relation of dataset.records){
 assert.ok(canon.has(relation.origine),'missing origin '+relation.origine);
 assert.ok(canon.has(relation.destination),'missing destination '+relation.destination);
}
assert.equal(csv.slice(1).map(parse).filter(row=>row[2]==='NOM_NUMERO_PR_OFFICIELS_RELEVES_ALIAS_A_CONFIRMER').length,4);
console.log('PASS 33 SANEF A1 aliases inventoried, 4 station references documented, all physical aliases unverified, all 122 relations mapped');
