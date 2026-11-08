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
  const safe = /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
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
// Preselection geographique, non attribution certaine a un concessionnaire.
const escotaGate = name => /PASDETRETS|LASAULCE|NICE|MENTON|MONACO|TURBIE|MANDELIEU|SAINTLAURENTDUVAR/.test(
  String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
);
const escotaCandidates = sorted.filter(x => x.classification === 'both_endpoints_present_pair_missing' &&
  (escotaGate(x.origin) || escotaGate(x.destination)));
csv('peages-priorite-sud-est-2026.csv',
  ['origine', 'destination', 'overlay_classe_1_eur', 'overlay_classe_2_eur', 'statut', 'concessionnaire', 'source_officielle_url'],
  escotaCandidates.map(x => [x.origin, x.destination, x.overlay_class1, x.overlay_class2,
    'A_VERIFIER_MANUELLEMENT', 'A_DETERMINER', ''])
);
csv('peages-noms-a-verifier-2026.csv',
  ['gare_overlay', 'occurrences', 'statut'],
  report.missing_name_counts.map(x => [x.gate, x.occurrences, 'A_RAPPROCHER_MANUELLEMENT'])
);
// Les cinq divergences SAPN ont ete confrontees aux pages 2 (C1) et 3 (C2).
// L'export ne modifie aucune valeur dans la base de production.
const sapnSource = 'https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf';
const verifiedBeuzeville = new Map([
  ['POISSY / ORGEVAL N°7 à MANTES-SUD N°12', [11.6, 18.5]],
  ['CHAUFOUR N°15 à GAILLON N°17', [8.6, 13.6]],
  ['BOURNEVILLE N°26', [4.1, 6.5]],
  ['HEUDEBOUVILLE N°18', [6.6, 10.4]],
  ['BOURG-ACHARD N°25', [4.1, 6.5]],
]);
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const official = new Map([...verifiedBeuzeville].map(([name, prices]) => [normalize(name), prices]));
const divergences = Array.isArray(report.divergences) ? report.divergences : [];
const verified = divergences.map(d => {
  const other = normalize(d.origin).includes('BEUZEVILLE') ? d.destination : normalize(d.destination).includes('BEUZEVILLE') ? d.origin : '';
  const expected = official.get(normalize(other));
  const matches = expected && Math.abs(d.overlay_class1 - expected[0]) < 0.00001 && Math.abs(d.overlay_class2 - expected[1]) < 0.00001;
  return [d.origin, d.destination, d.base_class1, d.base_class2, d.overlay_class1, d.overlay_class2,
    matches ? 'OVERLAY_CONFORME_SAPN_2026' : 'A_VERIFIER', matches ? sapnSource : '',
    matches ? '2026-02-01' : '', matches ? '2 (classe 1), 3 (classe 2)' : ''];
});
csv('peages-divergences-a-verifier-2026.csv',
  ['origine', 'destination', 'base_classe_1_eur', 'base_classe_2_eur', 'overlay_classe_1_eur', 'overlay_classe_2_eur', 'statut', 'source_officielle_url', 'date_validite', 'pages_pdf'], verified);
if (sorted.length !== report.not_matched) throw Error('Export des relations incomplet');
console.log(JSON.stringify({ exported_relations: sorted.length, southeast_candidates: escotaCandidates.length, exported_missing_names: report.missing_name_counts.length, exported_divergences: divergences.length, verified_sapn_divergences: verified.filter(x => x[6] === 'OVERLAY_CONFORME_SAPN_2026').length }));
