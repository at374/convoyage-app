const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
test('Available list requires available status', () => {
  assert.match(app, /const estDisponible = m => m\?\.status === 'disponible' && estSuiviDisponible\(m\)/);
  assert.match(app, /etat\.missions\.filter\(estDisponible\)/);
});
test('Return proposals exclude withdrawn missions', () => {
  assert.match(app, /RT\.retours\(m, etat\.missions\.filter\(estDisponible\)/);
});
test('Older loads cannot overwrite newer mission lists', () => {
  const load = app.slice(app.indexOf('async function charger(silencieux)'));
  assert.match(load, /generation !== generationChargementMissions\) return;[\s\S]*?Object\.assign\(etat, \{ missions:/);
});
test('Reconnect triggers refresh', () => {
  assert.match(app, /window\.addEventListener\('online', \(\) => \{ if \(document\.visibilityState === 'visible'\) charger\(true\); \}\)/);
});
