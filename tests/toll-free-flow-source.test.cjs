const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {parse,attach}=require('../scripts/import-free-flow-gantries.cjs');
const bytes=fs.readFileSync(require.resolve('../data/tolls/reviewed/free-flow-gantries-2025.csv'));
test('free-flow source preserves downloaded bytes, 37 candidate points, directions and third-party attribution',()=>{
 const s=parse(bytes);assert.equal(s.records.length,37);assert.equal(s.records.filter(r=>r.road==='A79').length,7);
 assert.equal(s.source.rawSha256,'6b33271c9441a1170db094ad288a8e55d152f4d35cb772d33ad5978bd74457dc');
 assert.deepEqual(s,require('../data/tolls/reviewed/free-flow-gantries-2025.json'));
 assert.equal(s.source.publisher,'Maxime Lopes');assert.equal(s.source.officialSurvey,false);assert.equal(s.source.laneGeometryVerified,false);
 const a=s.records.find(r=>r.nom==='Portique flux libre Le Montet Ouest');assert.deepEqual(a.point,[46.3891493669593,3.033184796389492]);assert.equal(a.sens,'1+2');assert.equal(a.pk,null);
 assert.equal(s.records.find(r=>r.nom==='Dozulé FL E').sens,null);
 const overlay=require('../peages-overlay.json'),{portiques_source,portiques_candidats,...before}=overlay;
 assert.deepEqual(attach(before,s),overlay);assert.deepEqual(attach(attach(before,s),s),overlay);
 assert.deepEqual(before.gares,overlay.gares);assert.deepEqual(before.paires,overlay.paires);assert.deepEqual(before.tarifs,overlay.tarifs);
});
test('free-flow importer rejects malformed columns, coordinate injection and guessed directions',()=>{
 const text=bytes.toString('latin1');
 for(const [old,next]of [['Nom;','Name;'],['46.3891493669593, 3.033184796389492','0, 0'],['46.3891493669593, 3.033184796389492','46.3, 3.03, 4'],[';1+2;',';both;'],[';Flux libre;',';unknown;'],[';A79;',';A79;extra;']])assert.throws(()=>parse(Buffer.from(text.replace(old,next),'latin1')),old);
});
