const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../geo.js');

test('a country name in a French street does not bypass address geocoding', async () => {
  const calls = [];
  const mission = { from_city: 'Grenoble', from_department: '38', origin_address: '94 rue de Suisse, 38000 Grenoble' };
  const result = await geo.chercherPoint(mission, 'origin', async url => {
    calls.push(url);
    return { ok: true, json: async () => ({ features: [{ geometry: { coordinates: [5.7, 45.2] }, properties: { score: 1, type: 'housenumber' } }] }) };
  });
  assert.equal(new URL(calls[0]).hostname, 'api-adresse.data.gouv.fr');
  assert.equal(result.point.precision, 'adresse');
});

test('an explicit Swiss country still uses the foreign city lookup', async () => {
  for (const mission of [
    { to_city: 'Genève', to_department: 'CH', destination_address: 'Rue de Lausanne 1' },
    { to_city: 'Genève', destination_address: 'Rue de Lausanne 1, Suisse' }
  ]) {
    const calls = [];
    const result = await geo.chercherPoint(mission, 'destination', async url => {
      calls.push(url);
      return { ok: true, json: async () => ({ results: [{ country_code: 'FR', latitude: 45, longitude: 5 }, { country_code: 'CH', latitude: 46.2, longitude: 6.1 }] }) };
    });
    assert.equal(new URL(calls[0]).hostname, 'geocoding-api.open-meteo.com');
    assert.deepEqual(result.point, { lat: 46.2, lng: 6.1, precision: 'ville' });
  }
});
