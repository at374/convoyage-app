'use strict';
// Audit reproductible des volumes, sans transformer les rapprochements en certifications.
// Usage: node scripts/audit-couverture-peages-2026.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const aprr = read('peages-aprr.json');
const overlay = read('peages-overlay.json');
const rows = String(aprr.p || '').split(';').filter(Boolean);
const keySet = new Set();
let malformed = 0;
for (const row of rows) {
  const parts = row.split(',');
  if (parts.length < 4) { malformed++; continue; }
  const a = parseInt(parts[0], 36), b = parseInt(parts[1], 36);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(Number(parts[2])) || !Number.isFinite(Number(parts[3]))) { malformed++; continue; }
  keySet.add(Math.min(a,b) + ':' + Math.max(a,b));
}
const status = {};
for (const t of overlay.tarifs || []) status[t.s || 'SANS_STATUT'] = (status[t.s || 'SANS_STATUT'] || 0) + 1;
const paired = Array.isArray(overlay.paires) ? overlay.paires.length : 0;
const report = {
  audit: 'inventaire local, pas certification nationale',
  date: new Date().toISOString(),
  base: { gares: Array.isArray(aprr.g) ? aprr.g.length : null, lignes_prix: rows.length, relations_uniques_non_orientees: keySet.size, lignes_malformees: malformed, montants_classes_1_2: keySet.size * 2 },
  overlay: { barrieres: (overlay.barrieres || []).length, tarifs_par_statut: status, paires: paired },
  coverage: { national_total_expected: null, certified_2026_unique_amounts: null, remaining_national_percentage: null, reason: 'Les sources officielles, sens, doublons inter-reseaux et dates de validite ne sont pas tous rapproches.' }
};
console.log(JSON.stringify(report, null, 2));
if (malformed) process.exitCode = 1;
