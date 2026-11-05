'use strict';
// Investigation de 3 noms isoles (5 nov. 2026), aucun GPS fabrique :
//
// 1. "BEAULIEU" (bare) : confirme via fichier officiel machine-readable
//    Tarifs_Cofiroute_Arcour.txt (reseau A87/A10, "A87;-;BEAULIEU") comme un point de
//    reference de calcul (0 destination commune avec la gare physique DEJA resolue
//    "Beaulieu Sur Layon", 27 relations -- deux "Beaulieu" homonymes mais
//    structurellement distincts). Meme pattern que CHARMONT/EPERNAY (bare), deja
//    documentes non resolus dans tests/peages-metz-freyming-sanef-pdf.test.cjs : nom
//    de ville reelle utilise comme reference de frontiere de reseau, pas une gare
//    physique propre a ce nom. Reste volontairement sans GPS.
//
// 2. "ROCADE EST" : son unique relation ("L'Union" <-> "ROCADE EST", 0,5/0,7, tarif
//    tres court) relie la gare deja geolocalisee "L'Union" (rocade de Toulouse,
//    deja signalee comme zone ambigue -- cf. TOULOUSE EST a 0,306km du meme point
//    dans tests/peages-toulouse-sud-ouest-nouvelle-gare.test.cjs). "ROCADE EST" est
//    tres probablement un intitule directionnel ("vers l'Est de la rocade") a cette
//    meme barriere, pas un point physique distinct -- meme prudence que BRIVE/A9:
//    ESPAGNE. Reste volontairement sans GPS.
//
// 3. "MURS ERIGNE" : sa seule relation (<-> Thouarcé, 0,7/1,2, tarif tres court) le
//    place pres de la gare "Thouarcé" (A87, deja geolocalisee) et de la commune reelle
//    de Murs-Erigné (A87, Maine-et-Loire), mais aucune station Google Places nommee
//    explicitement "Murs-Erigné" n'a ete trouvee. Reste volontairement sans GPS,
//    faute de source fiable (pas une approximation par proximite).
//
// Run: node --test tests/peages-beaulieu-rocade-est-murs-erigne.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('BEAULIEU, ROCADE EST and MURS ERIGNE were deliberately left without GPS', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  for (const n of ['BEAULIEU', 'ROCADE EST', 'MURS ERIGNE']) {
    assert.equal(gareNames.has(n), false, n + ' must not have a gare entry');
    const stillDangling = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(stillDangling, n + ' should still be present, unmerged');
  }
});

test('"BEAULIEU" (bare) shares zero destinations with the already-resolved "Beaulieu Sur Layon" (confirmed distinct, not a casing duplicate)', () => {
  const bareDest = new Set(overlay.paires.filter(p => p[0] === 'BEAULIEU' || p[1] === 'BEAULIEU').map(p => p[0] === 'BEAULIEU' ? p[1] : p[0]));
  const laylonDest = new Set(overlay.paires.filter(p => p[0] === 'Beaulieu Sur Layon' || p[1] === 'Beaulieu Sur Layon').map(p => p[0] === 'Beaulieu Sur Layon' ? p[1] : p[0]));
  let overlap = 0;
  for (const d of bareDest) if (laylonDest.has(d)) overlap++;
  assert.equal(overlap, 0, 'expected zero shared destinations, got ' + overlap);
});

test('no price was fabricated or altered (sample)', () => {
  const p1 = overlay.paires.find(x => (x[0] === 'MURS ERIGNE' && x[1] === 'Thouarcé') || (x[1] === 'MURS ERIGNE' && x[0] === 'Thouarcé'));
  assert.ok(p1);
  assert.equal(p1[2], 0.7);
  assert.equal(p1[3], 1.2);
  const p2 = overlay.paires.find(x => (x[0] === "L'Union" || x[0] === 'L’Union') && x[1] === 'ROCADE EST');
  assert.ok(p2 || overlay.paires.some(x => x[1] === 'ROCADE EST'));
});
