'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const filters = fs.readFileSync(path.join(root, 'filtres.js'), 'utf8');
const sync = require('../server/hiflow-sync-deploy/hiflow-vendor/sync-core.js');

test('Delivery Car partial scans never hide offers', () => {
  const i = filters.indexOf('function deliveryCarNonRevue');
  assert.notEqual(i, -1);
  const fn = filters.slice(i, filters.indexOf('\n  }', i) + 4);
  assert.match(fn, /·\) complet/);
  assert.match(fn, /startsWith\('Dernier balayage Delivery Car'\)/);
});

test('Delivery Car PWA asset is versioned and precached after the partial-scan fix', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(index, /filtres\.js\?v=deliverycar-complet-20261126/);
  assert.match(sw, /cp-app-availability-reconcile-20261126-v280/);
  assert.match(sw, /filtres\.js\?v=deliverycar-complet-20261126/);
});

test('A platform mission removed from the local scan can be sent again when it returns', () => {
  const row = { user_id: 'user', platform: 'Otoqi', external_id: 'mission_1234567', kind: 'disponible', status: 'disponible' };
  assert.deepEqual(sync.changedRows([row], {}), [row]);
  const key = sync.keyOf(row);
  const sent = { [key]: sync.hash(row) };
  assert.deepEqual(sync.changedRows([row], sent), []);
  // The Android synchronizer deletes envoyes entries for keys absent from the current local rows.
  assert.match(brain, /const vivantes = new Set\(rows\.map\(x => S\.keyOf\(x\)\)\); let oubli = 0; for \(const k of Object\.keys\(envoyes\)\) if \(!vivantes\.has\(k\)\) \{ delete envoyes\[k\];/);
  assert.deepEqual(sync.changedRows([row], {}), [row]);
});

test('Only completed Delivery Car scans can mark missing offers as plus_vue', () => {
  assert.match(brain, /if \(pf === 'DeliveryCar' && \(!lu\.completeAt/);
  assert.match(brain, /const complete = \(annonce > 0 && vuesUniques >= annonce\) \|\| emptyScans >= 2/);
});
