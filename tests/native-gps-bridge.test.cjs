const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('pont GPS Android : démarre avec les coordonnées de prise en charge et de livraison', () => {
  const src = fs.readFileSync(require.resolve('../app.js'), 'utf8');
  assert.match(src, /window\.CPNatif\.demarrerSuiviGps\(plat, plng, Number\(dest\.lat\), Number\(dest\.lng\), cible\.t\.key, rayon\)/);
  assert.match(src, /window\.CPNatif\.arreterSuiviGps\(\)/);
  assert.match(src, /window\.CPNatif\.prendrePointsSuiviGps\(\)/);
  assert.match(src, /window\.CPNatif\.prendreArriveesSuiviGps\(\)/);
  assert.match(src, /arriveeGps\(cible\.t\.key\)/);
  assert.match(src, /timestamp, coords: \{ latitude: lat, longitude: lng, accuracy:/);
  assert.match(src, /if \(natif\) \{[\s\S]*?return;[\s\S]*?navigator\.geolocation\.getCurrentPosition/);
});

test('pont GPS Android : le suivi natif est séparé du suivi navigateur', () => {
  const src = fs.readFileSync(require.resolve('../app.js'), 'utf8');
  assert.match(src, /const natif = window\.CPNatif && typeof window\.CPNatif\.demarrerSuiviGps === 'function'/);
  assert.match(src, /window\.CPNatif\.demarrerSuiviGps\(plat, plng/);
  assert.match(src, /else window\.CPNatif\.arreterSuiviGps\(\)/);
});
