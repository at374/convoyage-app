'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('fiche mission : aucune rentabilite issue des couts kilometriques estimes', () => {
  const start = app.indexOf('function blocRenta(');
  const end = app.indexOf('\n  function detail(', start);
  assert.ok(start >= 0 && end > start, 'blocRenta et detail doivent exister');
  const body = app.slice(start, end);
  assert.match(body, /function blocRenta\([^)]*\)\s*\{\s*\/\/[\s\S]*?return '';/);
  const prefix = body.slice(0, body.indexOf("return '';"));
  assert.doesNotMatch(prefix, /\bbk\(|\brow\(|innerHTML|\.net\b/, 'aucun rendu de net avant le garde-fou');
});

test('fiche mission : le bloc rentabilite passe par le garde-fou central', () => {
  assert.match(app, /function blocRenta\(/);
  const detail = app.slice(app.indexOf('\n  function detail('));
  assert.match(detail, /blocRenta\(/);
});
