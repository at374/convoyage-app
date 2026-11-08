'use strict';
// Référentiel géographique MTE 2025 embarqué ; identification géographique
// seulement : ne prouve ni alias tarifaire ni prix 2026.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const officiel = require('../data/gares-peage-officiel.json');

const cas = [
  ['Thouarce S', '49A908715CD', 47.32952, -0.59645],
  ['Thouarce E', '49A908715CD', 47.32955, -0.59627],
  ['Le Lievinois Sortie', '62A902635CD', 50.43780, 2.70708],
  ['Le Lievinois Entree', '62A902635CD', 50.43783, 2.70725],
];

test('Thouarcé et Le Liévinois : quatre positions officielles exactes et distinctes', () => {
  for (const [nom, code, lat, lon] of cas) {
    const matches = officiel.d.filter(r =>
      r[0] === nom && r[1] === code && r[2] === lat && r[3] === lon
    );
    assert.equal(matches.length, 1, nom + ' doit avoir une correspondance unique');
    assert.equal(matches[0][4], 'Ech');
  }
  assert.equal(new Set(cas.map(x => x.slice(2).join(','))).size, 4);
});

test('ne pas confondre une position officielle avec une preuve de tarif 2026', () => {
  assert.equal(cas.length, 4);
  assert.ok(cas.every(c => c.length === 4));
  assert.ok(officiel.src.includes('data.gouv.fr'));
});
