'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const f = require('../data/peages-vinci-principales-liaisons-2026.json');
test('tarifs principaux VINCI 2026: valeurs et provenance explicites', () => {
  assert.equal(f.effective_date, '2026-02-01');
  assert.match(f.source, /^https:\/\/public-content\.vinci-autoroutes\.com\//);
  assert.equal(f.relations.length, 4);
  for (const r of f.relations) {
    assert.ok(r.route && r.label);
    for (const k of ['class1_eur','class2_eur']) {
      assert.ok(Number.isInteger(r[k]*10), k + ' doit etre au dixieme d euro');
      assert.ok(r[k] > 0);
    }
  }
  assert.deepEqual(f.relations.find(r => r.route === 'A8'), {route:'A8',label:'Aix / Nice',class1_eur:21.2,class2_eur:31.5});
  assert.deepEqual(f.relations.find(r => r.route === 'A51'), {route:'A51',label:'Aix / Gap (La Saulce)',class1_eur:14.9,class2_eur:20.6});
});
