const test = require('node:test');
const assert = require('node:assert/strict');
const plaqueW = require('../plaque-w.js');

test('détecte la compétence Hiflow Plaque W garage', () => {
  assert.equal(plaqueW.detect({ vehicle: { competences: ['Plaque W garage obligatoire'] } }), true);
});
test('normalise casse, accents, espaces Unicode et tirets', () => {
  assert.equal(plaqueW.detect({ vehicle: { competences: ['PLAQUES\u00a0W‑GARAGE'] } }), true);
  assert.equal(plaqueW.detect({ vehicle: { competences: ['Plaque professionnelle obligatoire'] } }), false);
  assert.equal(plaqueW.detect({ vehicle: { competences: ['Plaque W professionnelle obligatoire'] } }), true);
});
test('refuse les exigences explicitement non requises et les drapeaux false', () => {
  assert.equal(plaqueW.detect({ vehicle: { competences: ['Plaque W non obligatoire'] } }), false);
  assert.equal(plaqueW.detect({ vehicle: { competences: ['Plaque W obligatoire'], plaque_w_required: false } }), false);
});
test('lit vehicle sérialisé en JSON et rend le SVG original une seule fois', () => {
  const mission = { vehicle: JSON.stringify({ competences: ['W-garage exigé'] }) };
  assert.match(plaqueW.render(mission), /width="150" height="32"/);
  assert.equal((plaqueW.render(mission).match(/class="plaqueW"/g) || []).length, 1);
  assert.equal(plaqueW.render({ vehicle: JSON.stringify({ competences: [] }) }), '');
});
test('n’infère jamais le pictogramme depuis une suite ou une autre propriété non compétence', () => {
  assert.equal(plaqueW.detect({ vehicle: { competences: [], suites: [{ competences: ['Plaque W obligatoire'] }] } }), false);
  assert.equal(plaqueW.detect({ notes: 'Plaque W obligatoire', vehicle: {} }), false);
});
test('accepte les champs explicites de compétence au niveau mission', () => {
  assert.equal(plaqueW.detect({ required_competences: ['Plaque W garage'] }), true);
  assert.equal(plaqueW.detect({ vehicleRequirements: ['Plaque W garage'] }), true);
});
