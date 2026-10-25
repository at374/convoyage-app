// node tests/transport-serveur.test.js
'use strict';
const assert = require('node:assert/strict');
const { creer } = require('../transport-serveur.js');
(async () => {
  assert.throws(() => creer({ chemin: 'https://external.example/journeys' }), /local/);
  assert.throws(() => creer({ chemin: '//external.example/journeys' }), /local/);
  const precedent = global.fetch;
  const appels = [];
  try {
    global.fetch = async (url, options) => {
      appels.push({ url, options });
      return { ok: true, json: async () => ({ trajets: [{ departAt: '2026-11-02T09:00:00+01:00', arriveeAt: '2026-11-02T10:00:00+01:00', prixEUR: null }] }) };
    };
    const lignes = await creer().rechercher({ depart: 'Annecy', arrivee: 'Lyon' });
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].prixEUR, null);
    assert.equal(appels[0].url, '/api/transports/rechercher');
    assert.equal(appels[0].options.method, 'POST');
    assert.equal(appels[0].options.credentials, 'same-origin');
    global.fetch = async () => ({ ok: true, json: async () => ({ erreurs: [] }) });
    await assert.rejects(() => creer().rechercher({}), /invalide/);
    global.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(() => creer().rechercher({}), /503/);
    console.log('Transport serveur: 9 assertions passed');
  } finally {
    global.fetch = precedent;
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
