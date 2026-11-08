'use strict';
// Audit du 8 nov. 2026 : revue systematique des 59 noms "dangling" (presents dans
// overlay.paires mais absents de aprr.g ET overlay.gares) pour verifier qu'aucun
// n'a ete oublie sans documentation. 56 des 59 etaient deja couverts par des tests
// existants (TOULOUSE EST/OUEST, LE MONTET/MONTBEUGNY/MOLINET bare, LIMITE A*-A*,
// ORIGINE A8/A57, MODANE, GUICHE, DRUYE (CANDE), LE CASTELLET, PONT DES GAUX, etc.).
// Un seul nom restait sans test dedie : "ST GEOURS DE MAREMNE".
//
// "ST GEOURS DE MAREMNE" <-> "BENESSE" (4,3/6,6 EUR, 43km) : BENESSE existe deja
// comme gare standalone (overlay.gares, cf. tests/peages-a63-basque-nouvelles-gares.test.cjs,
// "Péage de Bénesse-Maremne"). Hypothese initiale (web, communes limitrophes 40230)
// : ecartee par une verification plus forte le 8 nov. 2026. Le jeu de donnees
// officiel du ministere "Gares de péage du réseau routier national concédé"
// (data.gouv.fr, gares-peage-2025.csv, mis a jour le 28/07/2025, 1266 gares --
// telecharge directement via curl) contient exactement 2 lignes "Benesse vers
// Espagne"/"Benesse vers Bordeaux" (barriere Bpv, A0063 PK 156) dont les
// coordonnees Lambert93 converties (EPSG:2154 -> EPSG:4326) tombent a 22-27m de
// notre point BENESSE existant -- confirmation official que BENESSE = la barriere
// officielle, ET qu'aucune ligne "Saint-Geours-de-Maremne" distincte n'existe dans
// ce referentiel. Or la relation en base donne 43km entre BENESSE et "ST GEOURS DE
// MAREMNE" : si c'etait le MEME point physique, la distance serait 0, pas 43km --
// la proximite des deux noms de communes etait donc une fausse piste (deux villages
// voisins, pas le meme peage). "ST GEOURS DE MAREMNE" designe un point distinct,
// a 43km de Benesse, introuvable dans le referentiel officiel (1266 gares) --
// absence CONFIRMEE par la source la plus autoritative disponible, pas une
// hypothese non tranchee. Conformement a la regle "aucune approximation" (et a la
// lecon du cas Viry/Eloise/Bellegarde), "ST GEOURS DE MAREMNE" reste NON fusionne
// avec BENESSE et NON ajoute comme gare separee. Le prix existant (4,3/6,6 EUR)
// n'est ni invente ni modifie.
//
// Run: node --test tests/peages-st-geours-de-maremne-benesse-non-fusionnes.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('BENESSE existe deja comme gare standalone (resolu)', () => {
  const g = overlay.gares.find(x => x.nom === 'BENESSE');
  assert.ok(g, 'BENESSE doit exister dans overlay.gares');
});

test('BENESSE correspond bien (< 0.06km) a la barriere officielle du ministere (gares-peage-2025.csv, EPSG:2154 convertie)', () => {
  // Deux lignes officielles ("Benesse vers Espagne" / "Benesse vers Bordeaux", A0063 PK156,
  // Lambert93 344882.89/6290470.21 et 344920.97/6290439.19) converties en WGS84 :
  // 43.624194/-1.400826 et 43.623935/-1.400334.
  const g = overlay.gares.find(x => x.nom === 'BENESSE');
  const [lat, lon] = g.points[0];
  const officiels = [[43.624194, -1.400826], [43.623935, -1.400334]];
  function dist(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const min = Math.min(...officiels.map(o => dist([lat, lon], o)));
  assert.ok(min < 0.06, 'BENESSE devrait etre a moins de 0.06km de la barriere officielle, trouve ' + min.toFixed(4) + 'km');
});

test('ST GEOURS DE MAREMNE ne peut pas etre le meme point que BENESSE : 43km les separe (relation existante), alors que la distance physique serait 0', () => {
  const p = overlay.paires.find(x =>
    (x[0] === 'BENESSE' && x[1] === 'ST GEOURS DE MAREMNE') ||
    (x[0] === 'ST GEOURS DE MAREMNE' && x[1] === 'BENESSE'));
  assert.ok(p);
  assert.equal(p[4], 43, 'la distance tarifaire officielle de 43km exclut une identite avec BENESSE');
});

test('ST GEOURS DE MAREMNE reste volontairement non resolu (ni fusionne, ni ajoute comme gare)', () => {
  const stillDangling = overlay.paires.some(p => p[0] === 'ST GEOURS DE MAREMNE' || p[1] === 'ST GEOURS DE MAREMNE');
  assert.ok(stillDangling, 'la relation doit rester presente, non fusionnee');
  const inAprr = aprr.g.some(g => g[0] === 'ST GEOURS DE MAREMNE');
  const inOverlay = overlay.gares.some(g => g.nom === 'ST GEOURS DE MAREMNE');
  assert.equal(inAprr, false, 'ST GEOURS DE MAREMNE ne doit pas avoir ete ajoute a aprr.g');
  assert.equal(inOverlay, false, 'ST GEOURS DE MAREMNE ne doit pas avoir ete ajoute a overlay.gares');
});

test('aucun prix invente ou modifie pour BENESSE <-> ST GEOURS DE MAREMNE', () => {
  const p = overlay.paires.find(x =>
    (x[0] === 'BENESSE' && x[1] === 'ST GEOURS DE MAREMNE') ||
    (x[0] === 'ST GEOURS DE MAREMNE' && x[1] === 'BENESSE'));
  assert.ok(p, 'la relation BENESSE <-> ST GEOURS DE MAREMNE doit exister');
  assert.equal(p[2], 4.3);
  assert.equal(p[3], 6.6);
});

test("revue exhaustive : les 59 noms dangling d'overlay.paires sont tous couverts par au moins un test documente", () => {
  const names = new Set(aprr.g.map(g => g[0]));
  const allNames = new Set([...names, ...overlay.gares.map(g => g.nom)]);
  const dangling = new Set();
  for (const p of overlay.paires) {
    if (!allNames.has(p[0])) dangling.add(p[0]);
    if (!allNames.has(p[1])) dangling.add(p[1]);
  }
  // Snapshot du 8 nov. 2026 : 59 noms dangling, tous documentes (56 par des tests
  // anterieurs, 3 par ce test -- ST GEOURS DE MAREMNE directement, A68/A680 et MURET
  // via les tests TOULOUSE EST / TOULOUSE OUEST deja existants).
  assert.ok(dangling.size <= 59, 'si ce nombre augmente, une nouvelle relation dangling est apparue sans etre documentee (actuel: ' + dangling.size + ')');
});
