const {test}=require('node:test');const assert=require('node:assert/strict');
const G=require('../transport-fare-grids.js');
const leg=(from,to,day='2026-11-16',mode='Train',provider='SNCF',line='SL L1')=>({mode,provider,line,from,to,departure:day+'T08:06:00+01:00'});
test('Léman Pass 210+10 : sources officielles contradictoires (4,80 € / 4,90 €) → aucun prix',()=>{
 assert.equal(G.lemanPassFare(leg('Annemasse','Genève')),null);
 assert.equal(G.fareFor(leg('Annemasse','Genève')),null);
});
test('TAC : 1,70 € / 60 min dans la période prouvée, rien hors période ni hors TAC',()=>{
 const f=G.fareFor(leg('Annemasse Gare','Saint-Julien','2026-11-16','Bus','TAC Annemasse','T2'));
 assert.equal(f.amount,1.70);assert.equal(f.currency,'EUR');assert.equal(f.validityMinutes,60);assert.match(f.source,/14\/12\/2025|tac-mobilites/);
 assert.equal(G.fareFor(leg('Annemasse Gare','Saint-Julien','2026-12-13','Bus','TAC Annemasse','T2')),null);
 assert.equal(G.fareFor(leg('Annemasse','Genève','2026-11-16','Tram','TPG','17')),null);
});
