const test=require('node:test'),assert=require('node:assert');
global.window=global;const G=require('../geo.js')||global.CPGeo;
const g=G&&G.coordonnees?G:(global.CPGeo||global.window.CPGeo);
test('Aéroport de Genève Secteur France et Ferney-Voltaire : point GPS du parking P21',()=>{
  const m={destination:{address:'Aéroport De Genève – Secteur France Route Douanière, 01210 Ferney-Voltaire'},to_city:'Ferney-Voltaire'};
  const c=g.coordonnees(m,'destination');
  assert.deepStrictEqual([c.lat,c.lng,c.precision],[46.232278,6.110413,'gps']);
  assert.strictEqual(g.coordonnees({origin:{address:'Aéroport de Genève Secteur France'}},'origin').lat,46.237722);
  const m2={to_city:'Ferney-Voltaire',destination:{}};assert.strictEqual(g.coordonnees(m2,'destination').lat,46.232278);
  const m3={destination:{address:'Geneve Apt Secteur France'}};assert.strictEqual(g.coordonnees(m3,'destination').lng,6.110413);
  const m4={from_city:'Annecy',origin:{lat:45.9,lng:6.12}};assert.strictEqual(g.coordonnees(m4,'origin').lat,45.9);
});
