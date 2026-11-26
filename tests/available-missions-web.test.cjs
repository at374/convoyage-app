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

test('Agenda restores the dated Hiflow estimate when a later sync records completion', () => {
  const vm = require('node:vm');
  const RT = require('../retours.js');
  const extract = app.slice(app.indexOf('  const dMail ='), app.indexOf('  function mailBloc('));
  const gps = new Map();
  const fmtDate = value => new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short'
  }).format(new Date(value));
  const blocks = vm.runInNewContext(extract + '\nagendaDateBlocks', {
    globalThis: { CPAccount: { storage: { getItem: () => JSON.stringify(Object.fromEntries(gps)) } } },
    transportCacheKey: () => null,
    transportReturnPlans: new Map(),
    RT, fmtDate, heureP: fmtDate, esc: value => value,
    bk: (_, label, value) => label + ' ' + value + '\n'
  });
  const mission = {
    platform: 'Hiflow', kind: 'acceptee', status: 'terminee', external_id: '123456',
    pickup_start: '2026-11-23T08:00:00Z', delivery_end: '2026-11-23T12:00:00Z', duree_h: 3,
    modifications: [{ champ: 'statut', a: 'terminee', le: '2026-11-26T18:04:00Z' }]
  };
  assert.match(blocks(mission), /LIVRAISON PRÉVUE 23\/11\/2026 12:00/);
  assert.match(blocks(mission), /DATE LIMITE DE LIVRAISON 23\/11\/2026 13:00/);
  assert.doesNotMatch(blocks(mission), /26\/11/);
  gps.set(JSON.stringify(['Hiflow', '123456']), { arrivee: '2026-11-23T10:30:00Z' });
  assert.match(blocks(mission), /LIVRAISON PRÉVUE 23\/11\/2026 11:45.*arrivée détectée par GPS/);
});
