'use strict';
// Exporte les anomalies pour revue humaine ; aucune certification ni modification des tarifs.
// Usage : node scripts/export-revue-peages-2026.cjs audit-rapprochement-peages.json
const fs = require('node:fs');
const path = require('node:path');
const input = process.argv[2] || 'audit-rapprochement-peages.json';
const report = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!Array.isArray(report.unmatched_details) || !Array.isArray(report.missing_name_counts)) {
  throw Error('Rapport de rapprochement incomplet');
}
const out = path.dirname(path.resolve(input));
const quote = value => {
  const text = String(value ?? '');
  // Les noms proviennent de fichiers externes : neutraliser les formules Excel/LibreOffice.
  const safe = /^[\\s]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
};
const csv = (filename, headers, rows) => {
  const lines = [headers.map(quote).join(',')];
  for (const row of rows) lines.push(row.map(quote).join(','));
  fs.writeFileSync(path.join(out, filename), '\uFEFF' + lines.join('\n') + '\n', 'utf8');
};
const priorities = { both_endpoints_present_pair_missing: 1, one_endpoint_missing: 2, both_endpoints_missing: 3 };
if (report.unmatched_details.some(x => !priorities[x.classification])) throw Error('Categorie de rapprochement inconnue');
const sorted = [...report.unmatched_details].sort((a, b) =>
  priorities[a.classification] - priorities[b.classification] ||
  a.origin.localeCompare(b.origin) || a.destination.localeCompare(b.destination)
);
csv('peages-relations-a-verifier-2026.csv',
  ['priorite', 'classification', 'origine', 'destination', 'overlay_classe_1_eur', 'overlay_classe_2_eur', 'statut', 'source_officielle_url', 'date_validite', 'page_source', 'verification_classe_1', 'verification_classe_2'],
  sorted.map(x => [priorities[x.classification], x.classification, x.origin, x.destination, x.overlay_class1, x.overlay_class2, 'NON_CERTIFIE_OFFICIELLEMENT', '', '', '', 'A_VERIFIER', 'A_VERIFIER'])
);
csv('peages-noms-a-verifier-2026.csv',
  ['gare_overlay', 'occurrences', 'statut'],
  report.missing_name_counts.map(x => [x.gate, x.occurrences, 'A_RAPPROCHER_MANUELLEMENT'])
);
if (sorted.length !== report.not_matched) throw Error('Export des relations incomplet');
console.log(JSON.stringify({ exported_relations: sorted.length, exported_missing_names: report.missing_name_counts.length }));
