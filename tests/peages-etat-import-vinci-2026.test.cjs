'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const registry = require('../data/sources-officielles/etat-import-vinci-2026.json');

test('registre VINCI : cinq reseaux distincts et statuts verifiables', () => {
  assert.equal(registry.schema_version, 1);
  const expected = ['ASF', 'ESCOTA', 'COFIROUTE_ARCOUR', 'A86', 'ARCOS'];
  assert.deepEqual(registry.sources.map(s => s.operator).sort(), expected.sort());
  for (const source of registry.sources) {
    assert.match(source.effective_date, /^2026-\d{2}-\d{2}$/);
    assert.ok(['not_imported', 'imported'].includes(source.status));
    if (source.status === 'not_imported') {
      assert.equal(source.local_path, null, source.operator + ' : fichier absent mais chemin renseigne');
      assert.equal(source.sha256, null, source.operator + ' : fichier absent mais empreinte renseignee');
      continue;
    }
    assert.equal(typeof source.local_path, 'string');
    assert.ok(source.local_path.startsWith('data/sources-officielles/'));
    const full = path.resolve(root, source.local_path);
    assert.ok(full.startsWith(path.resolve(root, 'data/sources-officielles') + path.sep));
    assert.ok(fs.existsSync(full), source.operator + ' : source officielle declaree importee mais absente');
    const digest = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    assert.equal(source.sha256, digest, source.operator + ' : empreinte SHA-256 non conforme');
  }
});
