'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const sources = require('../data/peages-sources-vinci-2026.json');

test('provenance VINCI 2026 : dates distinctes par concession', () => {
  assert.equal(sources.publisher, 'VINCI Autoroutes');
  assert.match(sources.official_page, /^https:\/\/www\.vinci-autoroutes\.com\//);
  const byOperator = Object.fromEntries(sources.networks.map(x => [x.operator, x]));
  assert.equal(byOperator.ASF.effective_date, '2026-06-01');
  assert.equal(byOperator.ESCOTA.effective_date, '2026-02-01');
  assert.equal(byOperator.COFIROUTE.effective_date, '2026-02-01');
  for (const network of sources.networks) {
    assert.deepEqual(network.classes, [1, 2]);
    if (!network.source_file_committed) {
      assert.equal(network.comparison_ci_complete, false,
        network.operator + ': impossible de certifier la comparaison sans source');
    }
  }
});
