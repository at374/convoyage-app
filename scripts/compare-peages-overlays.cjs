'use strict';
// Compare two toll overlays without silently replacing official class 1/2 fares.
// Usage: node scripts/compare-peages-overlays.cjs main.json branch.json
const fs = require('node:fs');
function normalize(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+N°\d+/g, '')
    .replace(/\s*\(PEAGE[^)]*\)/g, '')
    .replace(/\s*\(A\d+\)/g, '')
    .replace(/[^A-Z0-9]/g, '');
}
function index(overlay) {
  if (!overlay || !Array.isArray(overlay.paires)) throw new TypeError('Missing paires');
  const pairs = new Map();
  for (const row of overlay.paires) {
    if (!Array.isArray(row) || row.length < 4 ||
      !Number.isFinite(row[2]) || !Number.isFinite(row[3])) throw new TypeError('Invalid toll row');
    const key = normalize(row[0]) + '|' + normalize(row[1]);
    const fare = JSON.stringify(row.slice(2, 4));
    if (!pairs.has(key)) pairs.set(key, new Set());
    pairs.get(key).add(fare);
  }
  return pairs;
}
function compare(main, branch) {
  const a = index(main), b = index(branch);
  const onlyMain = [], onlyBranch = [], different = [], internalConflicts = [];
  for (const [key, fares] of a) {
    if (fares.size > 1) internalConflicts.push({ side: 'main', key, fares: [...fares] });
    if (!b.has(key)) onlyMain.push(key);
    else if (JSON.stringify([...fares].sort()) !== JSON.stringify([...b.get(key)].sort()))
      different.push({ key, main: [...fares], branch: [...b.get(key)] });
  }
  for (const [key, fares] of b) {
    if (fares.size > 1) internalConflicts.push({ side: 'branch', key, fares: [...fares] });
    if (!a.has(key)) onlyBranch.push(key);
  }
  return { counts: { main: a.size, branch: b.size, onlyMain: onlyMain.length,
    onlyBranch: onlyBranch.length, different: different.length,
    internalConflicts: internalConflicts.length }, onlyMain, onlyBranch, different, internalConflicts };
}
if (require.main === module) {
  if (process.argv.length !== 4) {
    console.error('Usage: node scripts/compare-peages-overlays.cjs main.json branch.json');
    process.exitCode = 2;
  } else {
    const result = compare(...process.argv.slice(2).map(p => JSON.parse(fs.readFileSync(p, 'utf8'))));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.counts.different || result.counts.internalConflicts) process.exitCode = 1;
  }
}
module.exports = { compare, normalize };
