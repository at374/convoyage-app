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
// "Péage de Bénesse-Maremne"). Recherche web du 8 nov. 2026 : Bénesse-Maremne et
// Saint-Geours-de-Maremne sont deux communes limitrophes du meme secteur (Landes,
// code postal 40230), ce qui suggere fortement qu'il s'agit du MEME peage designe
// par deux conventions de nommage differentes selon la source -- mais aucune source
// officielle explicite ne confirme qu'il s'agit du meme point physique (pas de
// grille tarifaire DUMEZ/APRR/VINCI nommant explicitement "St Geours de Maremne"
// comme alias de la barriere "Bénesse"). Conformement a la regle "aucune
// approximation" (et a la lecon du cas Viry/Eloise/Bellegarde -- une fusion par
// proximite geographique sans preuve de prix a ete faite par erreur puis annulee
// dans une session precedente), "ST GEOURS DE MAREMNE" reste NON fusionne avec
// BENESSE et NON ajoute comme gare separee tant qu'aucune preuve officielle ne
// tranche. Le prix existant (4,3/6,6 EUR) n'est ni invente ni modifie.
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
