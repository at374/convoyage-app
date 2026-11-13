const {test}=require('node:test');const assert=require('node:assert/strict');
const G=require('../transport-fare-grids.js');
const leg=(from,to,day='2026-11-16',mode='Train')=>({mode,provider:'SNCF',line:'SL L1',from,to,departure:day+'T08:06:00+01:00'});
test('Léman Pass 10+210 : Annemasse ↔ gare genevoise en train = 4,80 €, 90 min',()=>{
 for(const [a,b] of [['Annemasse','Genève'],['Genève-Eaux-Vives','Annemasse'],['Gare d\'Annemasse','Lancy-Pont-Rouge'],['Annemasse','Chêne-Bourg']]){
  const f=G.fareFor(leg(a,b));assert.equal(f.amount,4.80,a+'→'+b);assert.equal(f.currency,'EUR');assert.equal(f.validityMinutes,90);
  assert.match(f.source,/12\/12\/2026/);
 }
});
test('Léman Pass : aucun prix hors du cas prouvé',()=>{
 assert.equal(G.fareFor(leg('Annemasse','Coppet')),null);        // Vaud, hors zone 10
 assert.equal(G.fareFor(leg('Genève','Lancy-Bachet')),null);      // zone 10 seule : autre titre
 assert.equal(G.fareFor(leg('Annecy','Genève')),null);            // hors zone 210
 assert.equal(G.fareFor(leg('Annemasse','Genève','2026-12-13')),null); // après la fin de validité
 assert.equal(G.fareFor(leg('Annemasse','Genève','2026-11-16','Bus')),null); // bus : non couvert par cette règle
});
