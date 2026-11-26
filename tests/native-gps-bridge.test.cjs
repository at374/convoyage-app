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

test('pré-calcul transport : lance retour et jonction à quinze minutes de la livraison puis masque le panneau', () => {
  const src = fs.readFileSync(require.resolve('../app.js'), 'utf8');
  assert.match(src, /const transportPrefetchTimers = new Map\(\)/);
  assert.match(src, /const remaining = finish\.t - Date\.now\(\)/);
  assert.match(src, /remaining > 15 \* 60000 \|\| remaining < 0/);
  assert.match(src, /const timer = setInterval\(tickPrefetch, 30000\)/);
  assert.match(src, /transportDetailButton\.click\(\)/);
  assert.match(src, /prefetchPanel\.dataset\.cpPrefetched = 'true'/);
  assert.match(src, /prefetchPanel\.style\.display = 'none'/);
  assert.match(src, /existing\.dataset\.cpPrefetched === 'true'/);
});

test('pré-calcul transport : une arrivée GPS déjà confirmée déclenche immédiatement le cache', () => {
  const src = fs.readFileSync(require.resolve('../app.js'), 'utf8');
  assert.match(src, /const arrivalKnown = arriveeGps\(missionTiming\(m\)\.key\)/);
  assert.match(src, /if \(!arrivalKnown\) \{/);
});

test('pré-calcul transport : le minuteur reste actif jusqu’au tick qui détecte l’arrivée GPS', () => {
  const src = fs.readFileSync(require.resolve('../app.js'), 'utf8');
  const start = src.indexOf('function suiviArrivee(m, t, ts)');
  const end = src.indexOf('function suiviMaj()', start);
  const arrival = src.slice(start, end);
  assert.match(arrival, /Ne pas arrêter le minuteur ici/);
  assert.doesNotMatch(arrival, /transportPrefetchTimers\.delete/);
  assert.match(src, /const arrivalKnown = arriveeGps\(missionTiming\(m\)\.key\)/);
});
