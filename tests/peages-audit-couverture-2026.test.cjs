'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('audit peages : JSON coherent et taux historique explicitement distinct du national', () => {
  const script = path.resolve(__dirname, '../scripts/audit-couverture-peages-2026.cjs');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr + '\n' + run.stdout.slice(0, 1500));
  const report = JSON.parse(run.stdout);
  assert.ok(report.base.gares > 0);
  assert.ok(report.base.relations_uniques_non_orientees > 0);
  assert.equal(report.base.lignes_malformees, 0);
  assert.equal(report.base.doublons_prix_divergents, 0);
  assert.equal(report.base.montants_classes_1_2, report.base.relations_uniques_non_orientees * 2);
  assert.equal(report.historical_reconciliation.rows_total, 35661);
  assert.equal(report.historical_reconciliation.rows_to_clarify, 170);
  assert.equal(report.historical_reconciliation.remaining_percent, 0.4767);
  assert.equal(report.coverage.remaining_national_percentage, null);
});
