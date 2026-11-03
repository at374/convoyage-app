// Regression guard for the known SANEF Meaux/Crecy overlay conflict.
// Run: node --test tests/peages-overlay-conflicts.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const overlay = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'peages-overlay.json'), 'utf8'));
function normalize(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+N°\d+/g, '')
    .replace(/\s*\(PEAGE[^)]*\)/g, '')
    .replace(/\s*\(A\d+\)/g, '')
    .replace(/[^A-Z0-9]/g, '');
}
function conflicts(rows) {
  const seen = new Map(), bad = new Set();
  for (const row of rows) {
    assert.ok(Array.isArray(row) && row.length >= 4);
    const key = normalize(row[0]) + '|' + normalize(row[1]);
    const price = row[2] + '|' + row[3];
    if (seen.has(key) && seen.get(key) !== price) bad.add(key);
    else if (!seen.has(key)) seen.set(key, price);
  }
  return bad;
}
test('national overlay conflicts are confined to the 33 known Meaux/Crecy pairs', () => {
  const bad = conflicts(overlay.paires);
  assert.equal(bad.size, 33, 'Conflict count changed: inspect tariff sources before accepting changes');
  for (const key of bad) assert.ok(key.startsWith('MEAUXCRECY|'), key);
});
test('same-price aliases do not conflict', () => {
  assert.equal(conflicts([['MÉAUX (A140) / CRECY N°16','DORMANS N°21',7.2,11.1],
    ['MEAUX / CRECY','DORMANS',7.2,11.1]]).size, 0);
});
test('different-price aliases are detected', () => {
  assert.equal(conflicts([['MÉAUX (A140) / CRECY N°16','DORMANS N°21',7.2,11.1],
    ['MEAUX / CRECY','DORMANS',9.6,14.9]]).size, 1);
});
