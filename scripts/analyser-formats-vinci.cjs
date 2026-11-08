'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = path.resolve('artifacts/vinci-sources/browser');
const operators = ['ASF','ESCOTA','A86','COFIROUTE_ARCOUR','ARCOS'];
const output = { analyzed_at: new Date().toISOString(), files: [] };
for (const operator of operators) {
  const filename = path.join(dir, 'Tarifs_' + operator + '.txt');
  const item = { operator, filename: path.basename(filename), exists: fs.existsSync(filename) };
  output.files.push(item);
  if (!item.exists) continue;
  const bytes = fs.readFileSync(filename);
  const decoded = bytes.toString('utf8');
  const lines = decoded.split(/\r?\n/);
  const nonempty = lines.filter(x => x.trim().length);
  const delimiters = [';', '\t', '|', ','];
  item.bytes = bytes.length;
  item.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  item.lines_total = lines.length;
  item.lines_nonempty = nonempty.length;
  item.utf8_replacement_characters = (decoded.match(/\uFFFD/g) || []).length;
  item.first_lines = nonempty.slice(0, 3).map(x => x.slice(0, 350));
  item.delimiter_counts_first_100 = Object.fromEntries(delimiters.map(d => [d === '\t' ? 'tab' : d, nonempty.slice(0, 100).reduce((n, line) => n + line.split(d).length - 1, 0)]));
  item.date_mentions_first_50 = [...new Set(nonempty.slice(0, 50).flatMap(x => x.match(/\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/g) || []))].slice(0, 15);
  item.semicolon_field_histogram = {};
  for (const line of nonempty.slice(1)) {
    const count = line.split(';').length;
    item.semicolon_field_histogram[count] = (item.semicolon_field_histogram[count] || 0) + 1;
  }
}
fs.writeFileSync(path.join(dir, 'analyse-formats.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));
