// Regression guard for SANEF Meaux/Crecy and nationwide toll-overlay data quality.
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
  // No contradictory class 1 or class 2 tariffs may enter the overlay.
  assert.equal(bad.size, 0, 'Unresolved contradictory toll tariffs: ' + [...bad].join(', '));
});
test('same-price aliases do not conflict', () => {
  assert.equal(conflicts([['MÉAUX (A140) / CRECY N°16','DORMANS N°21',7.2,11.1],
    ['MEAUX / CRECY','DORMANS',7.2,11.1]]).size, 0);
});
test('different-price aliases are detected', () => {
  assert.equal(conflicts([['MÉAUX (A140) / CRECY N°16','DORMANS N°21',7.2,11.1],
    ['MEAUX / CRECY','DORMANS',9.6,14.9]]).size, 1);
});

test('Meaux/Crecy aliases match the detailed 2026 SANEF tariffs in both classes', () => {
  const detailed = new Map(overlay.paires
    .filter(row => row[0].startsWith('MEAUX (A140)'))
    .map(row => [normalize(row[1]), row]));
  const simplified = overlay.paires.filter(row => row[0] === 'MEAUX / CRECY');
  assert.equal(simplified.length, 34);
  assert.equal(detailed.size, 34);
  for (const row of simplified) {
    const official = detailed.get(normalize(row[1]));
    assert.ok(official, 'Missing detailed destination: ' + row[1]);
    assert.equal(row[2], official[2], 'Class 1 mismatch: ' + row[1]);
    assert.equal(row[3], official[3], 'Class 2 mismatch: ' + row[1]);
  }
});

test('all national overlay rows have valid class 1 and 2 fares', () => {
  for (const [index, row] of overlay.paires.entries()) {
    assert.ok(Array.isArray(row) && row.length >= 4, 'Invalid row ' + index);
    assert.ok(typeof row[0] === 'string' && row[0].trim(), 'Missing origin ' + index);
    assert.ok(typeof row[1] === 'string' && row[1].trim(), 'Missing destination ' + index);
    assert.ok(Number.isFinite(row[2]) && row[2] >= 0, 'Invalid class 1 ' + index);
    assert.ok(Number.isFinite(row[3]) && row[3] >= 0, 'Invalid class 2 ' + index);
  }
});
test('duplicate tariff keys may differ in distance metadata but not in price', () => {
  const seen = new Map();
  for (const row of overlay.paires) {
    const key = normalize(row[0]) + '|' + normalize(row[1]);
    const previous = seen.get(key);
    if (previous) {
      assert.deepEqual(row.slice(2, 4), previous.slice(2, 4), key);
    } else seen.set(key, row);
  }
});
