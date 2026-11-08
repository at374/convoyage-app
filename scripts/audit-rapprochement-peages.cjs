'use strict';
// Rapprochement interne de deux inventaires : ni certification officielle ni calcul national.
// Usage : node scripts/audit-rapprochement-peages.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'peages-aprr.json'), 'utf8'));
const overlay = JSON.parse(fs.readFileSync(path.join(root, 'peages-overlay.json'), 'utf8'));
const normalize = name => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const key = (a, b) => [normalize(a), normalize(b)].sort().join('|');
const map = new Map();
for (const line of base.p.split(';').filter(Boolean)) {
  const [a, b, c1, c2] = line.split(',');
  const left = base.g[parseInt(a, 36)];
  const right = base.g[parseInt(b, 36)];
  if (!left || !right) throw Error('Indice de gare invalide : ' + line);
  const k = key(left[0], right[0]);
  const prices = [Number(c1) / 10, Number(c2) / 10];
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(prices);
}
const report = {
  audit: 'rapprochement des noms normalises, pas certification officielle',
  compared_overlay_pairs: overlay.paires.length,
  identical: 0, divergent: 0, ambiguous: 0, not_matched: 0,
  divergences: [],
};
for (const p of overlay.paires) {
  const candidates = map.get(key(p[0], p[1]));
  if (!candidates) { report.not_matched++; continue; }
  const signatures = new Set(candidates.map(x => x.join('/')));
  if (signatures.size !== 1) { report.ambiguous++; continue; }
  const actual = candidates[0];
  if (Math.abs(actual[0] - p[2]) < 0.00001 && Math.abs(actual[1] - p[3]) < 0.00001) report.identical++;
  else {
    report.divergent++;
    report.divergences.push({ origin: p[0], destination: p[1], base_class1: actual[0], base_class2: actual[1], overlay_class1: p[2], overlay_class2: p[3] });
  }
}
if (report.identical + report.divergent + report.ambiguous + report.not_matched !== report.compared_overlay_pairs) throw Error('Comptage incoherent');
console.log(JSON.stringify(report, null, 2));
