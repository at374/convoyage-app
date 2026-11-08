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
const knownNames = new Set(base.g.map(g => normalize(g[0])));
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
  unmatched_origins: [],
  unmatched_classification: { both_endpoints_missing: 0, one_endpoint_missing: 0, both_endpoints_present_pair_missing: 0 },
  missing_pair_origins: [],
  missing_pair_examples: [],
  missing_pair_details: [],
  missing_pair_unique_gates: 0,
  missing_name_counts: [],
};
const unmatchedByOrigin = new Map();
const missingPairByOrigin = new Map();
const missingNameCounts = new Map();
const missingPairGates = new Set();
for (const p of overlay.paires) {
  const candidates = map.get(key(p[0], p[1]));
  if (!candidates) {
    report.not_matched++;
    const missingEndpoints = Number(!knownNames.has(normalize(p[0]))) + Number(!knownNames.has(normalize(p[1])));
    const group = missingEndpoints === 2 ? 'both_endpoints_missing' : missingEndpoints === 1 ? 'one_endpoint_missing' : 'both_endpoints_present_pair_missing';
    report.unmatched_classification[group]++;
    if (missingEndpoints > 0) {
      for (const name of [p[0], p[1]]) {
        if (!knownNames.has(normalize(name))) missingNameCounts.set(name, (missingNameCounts.get(name) || 0) + 1);
      }
    }
    if (missingEndpoints === 0) {
      missingPairGates.add(normalize(p[0]));
      missingPairGates.add(normalize(p[1]));
      missingPairByOrigin.set(p[0], (missingPairByOrigin.get(p[0]) || 0) + 1);
      const detail = { origin: p[0], destination: p[1], overlay_class1: p[2], overlay_class2: p[3] };
      report.missing_pair_details.push(detail);
      if (report.missing_pair_examples.length < 30) report.missing_pair_examples.push(detail);
    }
    unmatchedByOrigin.set(p[0], (unmatchedByOrigin.get(p[0]) || 0) + 1);
    continue;
  }
  const signatures = new Set(candidates.map(x => x.join('/')));
  if (signatures.size !== 1) { report.ambiguous++; continue; }
  const actual = candidates[0];
  if (Math.abs(actual[0] - p[2]) < 0.00001 && Math.abs(actual[1] - p[3]) < 0.00001) report.identical++;
  else {
    report.divergent++;
    report.divergences.push({ origin: p[0], destination: p[1], base_class1: actual[0], base_class2: actual[1], overlay_class1: p[2], overlay_class2: p[3] });
  }
}
report.missing_pair_unique_gates = missingPairGates.size;
report.missing_name_counts = [...missingNameCounts].map(([gate, occurrences]) => ({ gate, occurrences })).sort((a, b) => b.occurrences - a.occurrences || a.gate.localeCompare(b.gate));
report.missing_pair_origins = [...missingPairByOrigin].map(([origin, count]) => ({ origin, count })).sort((a, b) => b.count - a.count || a.origin.localeCompare(b.origin));
report.unmatched_origins = [...unmatchedByOrigin].map(([origin, count]) => ({ origin, count })).sort((a, b) => b.count - a.count || a.origin.localeCompare(b.origin));
report.unmatched_origin_count = report.unmatched_origins.length;
if (report.missing_name_counts.some(x => x.occurrences <= 0)) throw Error('Compteur de noms absent invalide');
if (report.missing_pair_details.length !== report.unmatched_classification.both_endpoints_present_pair_missing) throw Error('Paires absentes : details incomplets');
if (report.missing_pair_origins.reduce((a, b) => a + b.count, 0) !== report.unmatched_classification.both_endpoints_present_pair_missing) throw Error('Paires absentes : regroupement incoherent');
if (Object.values(report.unmatched_classification).reduce((a, b) => a + b, 0) !== report.not_matched) throw Error('Classification des relations non rapprochees incoherente');
if (report.unmatched_origins.reduce((sum, item) => sum + item.count, 0) !== report.not_matched) throw Error('Decompte des origines non rapprochees incoherent');
if (report.identical + report.divergent + report.ambiguous + report.not_matched !== report.compared_overlay_pairs) throw Error('Comptage incoherent');
console.log(JSON.stringify(report, null, 2));
