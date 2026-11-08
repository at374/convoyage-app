'use strict';
// Audit documentaire seulement : ne jamais injecter ces liaisons dans les tarifs de gares.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'docs', 'vinci-principales-liaisons-2026.csv');
const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
const header = 'liaison;classe_1_eur;classe_2_eur;date_application;source_url;statut';
if (lines.shift() !== header) throw Error('En-tetes VINCI inattendus');
if (lines.length !== 30) throw Error('Le document VINCI doit contenir 30 liaisons');
const seen = new Set();
for (const [index, line] of lines.entries()) {
  const fields = line.split(';');
  if (fields.length !== 6) throw Error('Colonnes incorrectes ligne ' + (index + 2));
  const [name, c1, c2, date, url, status] = fields;
  if (!name || seen.has(name)) throw Error('Liaison absente ou dupliquee: ' + name);
  seen.add(name);
  for (const price of [c1, c2]) {
    if (!/^\\d+,\\d{2}$/.test(price) || Number(price.replace(',', '.')) <= 0)
      throw Error('Prix invalide: ' + name);
  }
  if (date !== '2026-02-01') throw Error('Date inattendue: ' + name);
  if (url !== 'https://www.vinci-autoroutes.com/static/b9b8279934080436ee3bba255c7835e2/vinci_autoroutes-tarifs-principales-liaisons-2026.pdf') throw Error('Source inattendue');
  if (status !== 'LIAISON_PUBLIEE_NON_RAPPROCHEE_AUX_GARES') throw Error('Statut non securise');
}
console.log(JSON.stringify({liaisons: seen.size, montants: seen.size * 2, status: 'DOCUMENTAIRE_NON_INTEGRE'}));
