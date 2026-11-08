'use strict';
// Tarifs SAPN TTC au 01/02/2026, classes 1 et 2.
// Grille officielle : https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf
// La base principale contient actuellement des prix divergents : ce test
// ne les corrige pas et n'affirme pas leur date d'application.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');
const aprr = require('../peages-aprr.json');
const cases = [
  ['POISSY / ORGEVAL N°7 à MANTES-SUD N°12', 11.6, 18.5],
  ['CHAUFOUR N°15 à GAILLON N°17', 8.6, 13.6],
  ['BOURNEVILLE N°26', 4.1, 6.5],
  ['HEUDEBOUVILLE N°18', 6.6, 10.4],
  ['BOURG-ACHARD N°25', 4.1, 6.5],
];
const origin = 'BEUZEVILLE N°28';

test('SAPN 2026 Beuzeville : 10 montants officiels classes 1 et 2 dans overlay', () => {
  for (const [destination, class1, class2] of cases) {
    const found = overlay.paires.filter(p => p[0] === origin && p[1] === destination);
    assert.equal(found.length, 1, destination + ' : paire absente ou multiple');
    assert.deepEqual(found[0].slice(2, 4), [class1, class2], destination);
  }
});

test('SAPN 2026 Beuzeville : signaler les ecarts historiques de la base sans bloquer une future correction', t => {
  const idx = new Map(aprr.g.map((g, i) => [g[0], i]));
  const a = idx.get(origin);
  assert.notEqual(a, undefined, 'Gare Beuzeville introuvable');
  const prices = new Map();
  for (const line of aprr.p.split(';').filter(Boolean)) {
    const [x, y, c1, c2] = line.split(',');
    const key = [parseInt(x, 36), parseInt(y, 36)].sort((u, v) => u - v).join(':');
    prices.set(key, [Number(c1) / 10, Number(c2) / 10]);
  }
  const differences = [];
  for (const [destination, c1, c2] of cases) {
    const b = idx.get(destination);
    assert.notEqual(b, undefined, destination + ' absent du referentiel');
    const key = [a, b].sort((u, v) => u - v).join(':');
    const actual = prices.get(key);
    assert.ok(actual, destination + ' : relation absente');
    if (actual[0] !== c1 || actual[1] !== c2) {
      differences.push({ destination, expected_2026: [c1, c2], principal: actual });
    }
  }
  t.diagnostic(JSON.stringify({ divergent_relations: differences.length, differences }));
});
