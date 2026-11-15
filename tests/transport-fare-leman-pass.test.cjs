const {test}=require('node:test');const assert=require('node:assert/strict');
const G=require('../transport-fare-grids.js');
const leg=(from,to,day='2026-11-16',mode='Train',provider='SNCF',line='SL L1')=>({mode,provider,line,from,to,departure:day+'T08:06:00+01:00'});
test('Léman Pass 210+10 : 4,90 € / 90 min en train Annemasse <> Genève (TAC + tpg concordants)',()=>{
 const f=G.fareFor(leg('Annemasse','Genève'));
 assert.equal(f.amount,4.90);assert.equal(f.currency,'EUR');assert.equal(f.validityMinutes,90);assert.match(f.source,/tac-mobilites/);
 assert.equal(G.fareFor(leg('Genève Cornavin','Annemasse')).amount,4.90);
 assert.equal(G.fareFor(leg('Annemasse','Genève','2026-12-13')),null);
 assert.equal(G.fareFor(leg('Annemasse','La Roche-sur-Foron')),null);
});
test('TAC : 1,70 € / 60 min dans la période prouvée, rien hors période ni hors TAC',()=>{
 const f=G.fareFor(leg('Annemasse Gare','Saint-Julien','2026-11-16','Bus','TAC Annemasse','T2'));
 assert.equal(f.amount,1.70);assert.equal(f.currency,'EUR');assert.equal(f.validityMinutes,60);assert.match(f.source,/14\/12\/2025|tac-mobilites/);
 assert.equal(G.fareFor(leg('Annemasse Gare','Saint-Julien','2026-12-13','Bus','TAC Annemasse','T2')),null);
 assert.equal(G.fareFor(leg('Annemasse','Genève','2026-11-16','Tram','TPG','17')),null);
});

test('Synchro : 1,40 € / 60 min dans la période prouvée (délib. 080-25 C, 7/07/2025)',()=>{
 const legS=(day='2026-11-16')=>({mode:'Bus',provider:'Synchro Bus',line:'4',from:'Chambéry gare',to:'Technolac',departure:day+'T08:06:00+01:00'});
 const f=G.fareFor(legS());assert.equal(f.amount,1.40);assert.equal(f.currency,'EUR');assert.equal(f.validityMinutes,60);
 assert.match(f.source,/Acte16655|grandchambery/);
 assert.equal(G.fareFor(legS('2027-01-01')),null); // hors période prouvée (recherche à refaire)
});
