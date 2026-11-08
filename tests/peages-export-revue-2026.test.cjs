'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('exports CSV pour revue sans modifier les prix sources', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-peages-'));
  try {
    const audit = spawnSync(process.execPath, [path.join(root, 'scripts/audit-rapprochement-peages.cjs')], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    assert.equal(audit.status, 0, audit.stderr);
    const file = path.join(dir, 'audit-rapprochement-peages.json');
    fs.writeFileSync(file, audit.stdout);
    const run = spawnSync(process.execPath, [path.join(root, 'scripts/export-revue-peages-2026.cjs'), file], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), { exported_relations: 7251, exported_missing_names: 378 });
    const relations = fs.readFileSync(path.join(dir, 'peages-relations-a-verifier-2026.csv'), 'utf8').trim().split('\n');
    const names = fs.readFileSync(path.join(dir, 'peages-noms-a-verifier-2026.csv'), 'utf8').trim().split('\n');
    assert.equal(relations.length, 7252);
    assert.ok(relations[0].includes('source_officielle_url'));
    assert.ok(relations[0].includes('date_validite'));
    assert.ok(relations[0].includes('page_source'));
    assert.ok(relations[0].includes('verification_classe_1'));
    assert.ok(relations[0].includes('verification_classe_2'));
    assert.ok(relations[1].includes('"A_VERIFIER","A_VERIFIER"'));
    assert.equal(names.length, 379);
    assert.ok(relations[1].startsWith('"1","both_endpoints_present_pair_missing"'));
    assert.ok(relations[1].includes('"NON_CERTIFIE_OFFICIELLEMENT"'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
