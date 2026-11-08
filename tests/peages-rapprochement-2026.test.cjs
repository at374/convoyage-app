'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const script = path.resolve(__dirname, '../scripts/audit-rapprochement-peages.cjs');
test('rapprochement : bilan complet et ecarts Beuzeville visibles', () => {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr);
  const r = JSON.parse(run.stdout);
  assert.equal(r.compared_overlay_pairs, r.identical + r.divergent + r.ambiguous + r.not_matched);
  assert.equal(r.divergent, r.divergences.length);
  assert.ok(r.identical > 0);
  assert.ok(r.not_matched > 0);
  assert.ok(r.divergences.every(d => Number.isFinite(d.base_class1) && Number.isFinite(d.overlay_class2)));
  assert.equal(r.audit, 'rapprochement des noms normalises, pas certification officielle');
});
