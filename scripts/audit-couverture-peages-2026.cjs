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
const distinctPrices = new Map();
let conflictingRelations = 0;
let duplicateRows = 0;
let malformed = 0;
for (const row of rows) {
  const parts = row.split(',');
  if (parts.length < 4) { malformed++; continue; }
  const validCode = x => /^[0-9a-z]+$/i.test(x);
  if (!validCode(parts[0]) || !validCode(parts[1]) || !/^[0-9]+$/.test(parts[2]) || !/^[0-9]+$/.test(parts[3])) { malformed++; continue; }
  const a = parseInt(parts[0], 36), b = parseInt(parts[1], 36);
  if (a >= aprr.g.length || b >= aprr.g.length || a === b) { malformed++; continue; }
  const key = Math.min(a,b) + ':' + Math.max(a,b);
  const fare = Number(parts[2]) + ':' + Number(parts[3]);
  if (keySet.has(key)) {
    duplicateRows++;
    if (distinctPrices.get(key) !== fare) conflictingRelations++;
  } else distinctPrices.set(key, fare);
  keySet.add(key);
}
const status = {};
for (const t of overlay.tarifs || []) status[t.s || 'SANS_STATUT'] = (status[t.s || 'SANS_STATUT'] || 0) + 1;
const paired = Array.isArray(overlay.paires) ? overlay.paires.length : 0;
const knownHistoric = { APRR: [21505, 0], AREA: [955, 0], COFIROUTE_ARCOUR: [11004, 72], ASF: [2056, 48], ESCOTA: [141, 50] };
const historicTotal = Object.values(knownHistoric).reduce((sum, v) => sum + v[0], 0);
const historicUnresolved = Object.values(knownHistoric).reduce((sum, v) => sum + v[1], 0);
const report = {
  audit: 'inventaire local, pas certification nationale',
  date: new Date().toISOString(),
  base: { gares: Array.isArray(aprr.g) ? aprr.g.length : null, lignes_prix: rows.length, relations_uniques_non_orientees: keySet.size, lignes_malformees: malformed, doublons: duplicateRows, doublons_prix_divergents: conflictingRelations, montants_classes_1_2: keySet.size * 2 },
  overlay: { barrieres: (overlay.barrieres || []).length, tarifs_par_statut: status, paires: paired },
  historical_reconciliation: { by_operator: knownHistoric, rows_total: historicTotal, rows_to_clarify: historicUnresolved, remaining_percent: Number((100 * historicUnresolved / historicTotal).toFixed(4)), scope: 'Cinq audits historiques, non dedoublonnes et non certifies nationalement' },
  coverage: { national_total_expected: null, certified_2026_unique_amounts: null, remaining_national_percentage: null, reason: 'Les sources officielles, sens, doublons inter-reseaux et dates de validite ne sont pas tous rapproches.' }
};
console.log(JSON.stringify(report, null, 2));
if (malformed || conflictingRelations) process.exitCode = 1;
