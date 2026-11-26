'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../server/hiflow-sync-deploy/hiflow-sync.cjs'), 'utf8');
const start = source.indexOf('async function choisirRegion(');
const end = source.indexOf('async function lireMesTrajets(');
const listUrl = 'https://example.invalid/journey/list#journeys';
const scrape = vm.runInNewContext(source.slice(start, end) + '\nscrapeRegion', {
  LIST_URL: listUrl,
  sleep: async () => {},
  jitter: () => 0,
  CPNet: { trajetsHiflow: json => json.response.journeys }
});

function simulate(mode) {
  let index = 0;
  let onRequest, resolveResponse, matchesResponse;
  function emitPage() {
    const request = { url: () => 'https://example.invalid/getJourneysOpenToConveyorBooking' };
    onRequest(request);
    const response = {
      request: () => request,
      ok: () => mode !== 'unauthorized',
      status: () => 401,
      json: async () => ({ response: { journeys: mode === 'empty' ? [] : [
        { external_id: String(10000 + index), from: 'Dijon', to: 'Lyon' }
      ] } })
    };
    if (matchesResponse(response)) resolveResponse(response);
  }
  return {
    goto: async () => {},
    url: () => listUrl,
    waitForSelector: async () => {},
    on: (_, handler) => { onRequest = handler; },
    off: () => { onRequest = undefined; },
    selectOption: async selector => {
      if (selector === '#start_region' && mode !== 'timeout') emitPage();
    },
    waitForResponse: predicate => {
      matchesResponse = predicate;
      if (mode === 'timeout') return Promise.reject(Error('délai dépassé'));
      return new Promise(resolve => { resolveResponse = resolve; });
    },
    $: async selector => {
      if (selector !== '.pagination-tableJourneyList' || mode === 'missing') return null;
      return {
        $: async () => ({
          evaluate: async () => mode !== 'limit' && index === 1,
          click: async () => { index++; emitPage(); }
        })
      };
    }
  };
}

test('Deux pages valides avec une fin explicite couvrent la région', async () => {
  const missions = {};
  await scrape(simulate('complete'), 'Auvergne-Rhône-Alpes', missions);
  assert.deepEqual(Object.keys(missions), ['10000', '10001']);
});

for (const [label, mode, reason] of [
  ['Pagination absente', 'missing', /fin de pagination.*non confirmée/],
  ['Pagination toujours active après 60 clics', 'limit', /au-delà de la limite/],
  ['Réponse vide', 'empty', /vide ou incomplète/],
  ['Réponse absente', 'timeout', /délai dépassé/],
  ['Session refusée', 'unauthorized', /HTTP 401/]
]) {
  test(label + ' ne valide pas la région', async () => {
    await assert.rejects(scrape(simulate(mode), 'Auvergne-Rhône-Alpes', {}), reason);
  });
}
