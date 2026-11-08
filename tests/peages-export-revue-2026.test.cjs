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
    assert.deepEqual(JSON.parse(run.stdout), { exported_relations: 7251, southeast_candidates: 123, southeast_gates: 8, southeast_double_counted_pairs: 19, exported_missing_names: 378, exported_divergences: 5, verified_sapn_divergences: 5 });
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
    const southeast = fs.readFileSync(path.join(dir, 'peages-priorite-sud-est-2026.csv'), 'utf8').trim().split('\n');
    assert.equal(southeast.length, 124);
    const southeastGates = fs.readFileSync(path.join(dir, 'peages-priorite-sud-est-par-gare-2026.csv'), 'utf8').trim().split('\n');
    assert.equal(southeastGates.length, 9);
    const gateTotal = southeastGates.slice(1).reduce((n, line) => n + Number(line.split(',')[1].replace(/"/g, '')), 0);
    assert.equal(gateTotal, 142); // 123 relations uniques + 19 presentes sous deux gares
    assert.ok(southeastGates[1].includes('Saint-Laurent-du-Var'));
    assert.ok(southeastGates[1].includes('"21"'));
    assert.ok(southeast[1].includes('A_DETERMINER'));
    assert.ok(southeast[1].includes('A_VERIFIER_MANUELLEMENT'));
    const sapn = fs.readFileSync(path.join(dir, 'peages-divergences-a-verifier-2026.csv'), 'utf8').trim().split('\n');
    assert.equal(sapn.length, 6);
    assert.equal(sapn.filter(line => line.includes('OVERLAY_CONFORME_SAPN_2026')).length, 5);
    assert.ok(sapn.some(line => line.includes('POISSY / ORGEVAL')));
    assert.ok(sapn.some(line => line.includes('BOURG-ACHARD')));
    assert.ok(sapn.every((line, index) => index === 0 || line.includes('2026-02-01')));
    assert.ok(sapn[1].includes('2026_02-Grille-SAPN.pdf'));
    assert.ok(relations[1].startsWith('"1","both_endpoints_present_pair_missing"'));
    assert.ok(relations[1].includes('"NON_CERTIFIE_OFFICIELLEMENT"'));
    // Simulation d'une gare externe malveillante : aucune formule ne doit etre executee.
    const hostile = JSON.parse(audit.stdout);
    hostile.unmatched_details[0].origin = '=1+1';
    hostile.missing_name_counts[0].gate = '  +SUM(1,2)';
    fs.writeFileSync(file, JSON.stringify(hostile));
    const guarded = spawnSync(process.execPath, [path.join(root, 'scripts/export-revue-peages-2026.cjs'), file], { encoding: 'utf8' });
    assert.equal(guarded.status, 0, guarded.stderr);
    const safeRelations = fs.readFileSync(path.join(dir, 'peages-relations-a-verifier-2026.csv'), 'utf8');
    const safeNames = fs.readFileSync(path.join(dir, 'peages-noms-a-verifier-2026.csv'), 'utf8');
    assert.ok(safeRelations.includes('"\'=1+1"'));
    assert.ok(safeNames.includes('"\'  +SUM(1,2)"'));
    // Une alteration du prix overlay ne doit jamais conserver le statut certifie.
    const altered = JSON.parse(audit.stdout);
    altered.divergences[0].overlay_class1 += 0.1;
    fs.writeFileSync(file, JSON.stringify(altered));
    const check = spawnSync(process.execPath, [path.join(root, 'scripts/export-revue-peages-2026.cjs'), file], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr);
    assert.equal(JSON.parse(check.stdout).verified_sapn_divergences, 4);
    const rechecked = fs.readFileSync(path.join(dir, 'peages-divergences-a-verifier-2026.csv'), 'utf8').trim().split('\n');
    assert.equal(rechecked.filter(line => line.includes('OVERLAY_CONFORME_SAPN_2026')).length, 4);
    assert.equal(rechecked.filter(line => line.includes('"A_VERIFIER"')).length, 1);


  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
