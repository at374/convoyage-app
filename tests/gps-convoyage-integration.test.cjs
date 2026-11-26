const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');

test('GPS convoyage : position enregistrée pendant le déplacement, à cadence de 10 minutes', () => {
  assert.match(app, /SUIVI_CONVOYAGE_INTERVALLE_MS = 10 \* 60000/);
  assert.match(app, /function suiviConvoyageEnregistrer\(m, t, pos, ts\)/);
  assert.match(app, /suiviConvoyageEnregistrer\(m,t,pos,ts\)/);
  assert.match(app, /state\.status = 'en_route'/);
  assert.match(app, /state\.samples = .*slice\(-36\)/);
});

test('GPS convoyage : ETA routière toutes les 5 minutes et déclenchement à 15 minutes', () => {
  assert.match(app, /SUIVI_CONVOYAGE_ETA_INTERVALLE_MS = 5 \* 60000/);
  assert.match(app, /routes\.estimate\(/);
  assert.match(app, /minutes <= 15/);
  assert.match(app, /cp-livraison-approche/);
  assert.match(app, /etaDepartureAt/);
});

test('Pont Android : service natif démarré, points et arrivées récupérés, arrêt explicite', () => {
  assert.match(app, /window\.CPNatif\.demarrerSuiviGps\(/);
  assert.match(app, /window\.CPNatif\.prendrePointsSuiviGps\(\)/);
  assert.match(app, /window\.CPNatif\.prendreArriveesSuiviGps\(\)/);
  assert.match(app, /window\.CPNatif\.arreterSuiviGps\(\)/);
});

test('Pré-calcul des transports : seuil T-15, panneau conservé masqué et minuteur nettoyé', () => {
  assert.match(app, /const transportPrefetchTimers = new Map\(\)/);
  assert.match(app, /remaining > 15 \* 60000 \|\| remaining < 0/);
  assert.match(app, /setInterval\(tickPrefetch, 30000\)/);
  assert.match(app, /prefetchPanel\.dataset\.cpPrefetched = 'true'/);
  assert.match(app, /prefetchPanel\.style\.display = 'none'/);
});

test('Actualisation indépendante : chaque section dispose de son bouton et ne relance que sa tâche', () => {
  assert.match(app, /Actualiser '\+key/);
  assert.match(app, /transportRefreshLabel=key/);
  assert.match(app, /startTransportHub\(false,key\)/);
  assert.match(app, /if\(onlyLabel\)tasks\.splice/);
  assert.match(app, /const cachedViews=!onlyJonction&&stored\?\.views&&\(!refresh\|\|!!refreshLabel\)/);
  assert.match(app, /const resetLabels=onlyJonction\?\['Jonction'\]:\(onlyLabel\?\[onlyLabel\]/);
  assert.ok(app.includes('if(!refresh&&(onlyJonction?junctionHub:transportHub)?.signatureKey===signature)return;'));
});

test('Cache indépendant : les signatures Aller, Jonction et Retour sont persistées séparément', () => {
  assert.match(app, /const taskSignatures=Object\.fromEntries\(allTasks/);
  assert.match(app, /stored\.partSignatures\?\.\[label\]===taskSignatures\[label\]/);
  assert.match(app, /partSignatures:taskSignatures/);
});
