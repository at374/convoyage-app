'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const filters = fs.readFileSync(path.join(root, 'filtres.js'), 'utf8');
const sync = require('../server/hiflow-sync-deploy/hiflow-vendor/sync-core.js');
const platformState = require('../etat.js');

test('Delivery Car partial scans never hide offers', () => {
  const i = filters.indexOf('function deliveryCarNonRevue');
  assert.notEqual(i, -1);
  const fn = filters.slice(i, filters.indexOf('\n  }', i) + 4);
  assert.match(fn, /complet/);
  assert.match(fn, /Dernier balayage Delivery Car/);
});

test('Delivery Car partial marker overrides a stale ok=true source status', () => {
  const row = { platform: 'DeliveryCar', lu_le: new Date(0).toISOString(), ok: true, message: 'Dernier balayage Delivery Car · partiel · 39 offres annoncées' };
  const partial = platformState.ligne(row, 60_000);
  assert.equal(partial.couleur, 'orange');
  assert.match(partial.texte, /partiel/);
  const complete = platformState.ligne({ ...row, message: 'Dernier balayage Delivery Car · complet · 39 offres annoncées' }, 60_000);
  assert.equal(complete.couleur, 'vert');
});

test('Delivery Car PWA asset is versioned and precached after the partial-scan fix', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(index, /filtres\.js\?v=deliverycar-complet-20261126/);
  assert.match(sw, /cp-app-transport-refresh-20261126-v280/);
  assert.match(sw, /filtres\.js\?v=deliverycar-complet-20261126/);
});

test('A mission can be sent again after its previous local scan entry was removed', () => {
  const row = { user_id: 'user', platform: 'Otoqi', external_id: 'mission_1234567', kind: 'disponible', status: 'disponible' };
  assert.deepEqual(sync.changedRows([row], {}), [row]);
  const key = sync.keyOf(row);
  const sent = { [key]: sync.hash(row) };
  assert.deepEqual(sync.changedRows([row], sent), []);
  // When the row is absent from the current scan, the Android synchronizer forgets its sent hash.
  const currentRows = [];
  const live = new Set(currentRows.map(x => sync.keyOf(x)));
  for (const k of Object.keys(sent)) if (!live.has(k)) delete sent[k];
  assert.deepEqual(sync.changedRows([row], sent), [row]);
});
