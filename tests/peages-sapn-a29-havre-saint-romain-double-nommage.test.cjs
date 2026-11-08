'use strict';
// Cloture formelle du second jeu de noms (non resolu) de l'echangeur A29/A131 pres
// de Tancarville/Le Havre, deja repere dans tests/sapn-a29-nord-saint-romain.test.cjs
// mais jamais documente nommement pour chacun des noms suivants (5 nov. 2026) :
// "LE HAVRE", "TOTES", "FECAMP YVETOT OUEST", "YVETOT EST", "SAINT ROMAIN SYSTEME
// FERME".
//
// Rappel du probleme (inchange depuis sapn-a29-nord-saint-romain.test.cjs) : la
// grille SAPN comporte DEUX jeux de noms qui se recoupent mais DIFFERENT
// legerement en prix pour le meme secteur geographique (ex. "LE HAVRE"<->BOLBEC =
// 2,5/3,2 contre "LE HAVRE N°5 / A131"<->BOLBEC = 2,5/3,1 ; "LE HAVRE"<->YVETOT EST
// = 5,7/8,3 contre "LE HAVRE N°5 / A131"<->YVETOT = 5,7/8,2). Les deux jeux ne
// peuvent pas etre tous les deux exacts pour le MEME point physique. "LE HAVRE"
// (seul), "TOTES" et "YVETOT EST" restent sans source GPS fiable et NON fusionnes.
//
// CORRECTIF du 8 nov. 2026 : "SAINT ROMAIN SYSTEME FERME" et "FECAMP YVETOT OUEST"
// ont ete FUSIONNES, respectivement vers "ST-ROMAIN-DE-COLBOSC" et "FECAMP" (deja
// resolus en base), apres recoupement du referentiel officiel du ministere
// (gares-peage-2025.csv, data.gouv.fr, 1266 gares, convertit Lambert93->WGS84) :
// - "Saint Romain de Colbosc (ferme)" (officiel, dept 76) tombe a <0,02km de
//   "ST-ROMAIN-DE-COLBOSC" deja en base -- et son libelle "(ferme)" correspond
//   exactement au suffixe "SYSTEME FERME" du nom dangling (systeme a peage ferme,
//   par opposition a "(ouvert)", egalement present dans le referentiel au meme
//   echangeur). Coincidence de nommage explicite, pas une simple proximite.
// - "Fecamp Sortie/Entree" (officiel, dept 76) tombe a <0,01km de "FECAMP" deja en
//   base.
// - PREUVE PAR PRIX, renforcee par rapport a l'examen precedent (price-proof
//   partiel, juge alors insuffisant) : SAINT ROMAIN SYSTEME FERME<->BOLBEC (1,0/1,7)
//   et <->YERVILLE (3,7/5,5) correspondent EXACTEMENT a ST-ROMAIN-DE-COLBOSC<->BOLBEC
//   et <->YERVILLE. FECAMP YVETOT OUEST<->BOLBEC (1,6/2,7), <->YERVILLE (1,9/2,8) et
//   <->ST-SAENS (4,6/6,2) correspondent EXACTEMENT a FECAMP<->BOLBEC/YERVILLE/ST-SAENS
//   (3 destinations, 0 divergence). Ces 5 doublons exacts ont ete dedoublonnes.
// - DEUX relations renommees (ST-ROMAIN-DE-COLBOSC<->FECAMP et <->ST-SAENS) se sont
//   retrouvees en LEGER desaccord (10 centimes : 2,4/3,9 vs 2,4/4,0 ; 6/9,5 vs
//   6/9,6) avec des relations DIRECTES deja existantes sous le nom resolu -- signe
//   probable d'une revision mineure entre deux grilles sources. Conformement a la
//   regle "zero approximation" (et pour respecter le test de regression
//   peages-overlay-conflicts.test.js, qui interdit tout doublon contradictoire),
//   ces 2 relations renommees ont ete RETIREES (pas fusionnees ni arbitrees) : le
//   prix deja en base sous le nom resolu reste inchange, aucun prix n'a ete choisi,
//   invente ou modifie.
// - Le GPS officiel apporte une preuve independante (gouvernementale, pas une
//   simple proximite de nom) qui leve l'ambiguite jugee "trop proche pour
//   trancher" lors de l'examen precedent (price-proof seul, 2 exact/4 partage).
//
// Note : "ST-SAENS" (destination commune aux deux jeux) possede en realite deja un
// GPS verifie dans peages-aprr.json et n'est donc PAS dangling.
//
// Restent volontairement sans GPS, faute de source officielle fiable : "LE HAVRE"
// (seul, sans suffixe), "TOTES", "YVETOT EST" (dont le prix differe legerement de
// "YVETOT" seul -- BOLBEC<->YVETOT = 3,5/4,6 contre BOLBEC<->YVETOT EST = 3,5/4,8 --
// confirmant que ce n'est PAS le meme point, pas seulement une lacune de recherche).
//
// Run: node --test tests/peages-sapn-a29-havre-saint-romain-double-nommage.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');
const aprr = require('../peages-aprr.json');

const NOMS_TOUJOURS_DANGLING = ['LE HAVRE', 'TOTES', 'YVETOT EST'];

test('"LE HAVRE", "TOTES" et "YVETOT EST" restent volontairement sans GPS', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  const aprrNames = new Set(aprr.g.map(g => g[0]));
  for (const n of NOMS_TOUJOURS_DANGLING) {
    assert.equal(gareNames.has(n), false, n + ' must not have a gare entry');
    assert.equal(aprrNames.has(n), false, n + ' must not have an aprr entry');
    const stillDangling = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(stillDangling, n + ' should still be present, unmerged');
  }
});

test('"ST-SAENS" is not dangling (already geolocated in peages-aprr.json)', () => {
  const aprrNames = new Set(aprr.g.map(g => g[0]));
  assert.ok(aprrNames.has('ST-SAENS'));
});

test('"SAINT ROMAIN SYSTEME FERME" et "FECAMP YVETOT OUEST" ont bien ete fusionnes (correctif du 8 nov. 2026)', () => {
  const names = new Set([
    ...aprr.g.map(g => g[0]),
    ...overlay.gares.map(g => g.nom),
    ...overlay.paires.flatMap(p => [p[0], p[1]]),
  ]);
  assert.equal(names.has('SAINT ROMAIN SYSTEME FERME'), false, 'ancien nom ne doit plus trainer');
  assert.equal(names.has('FECAMP YVETOT OUEST'), false, 'ancien nom ne doit plus trainer');
});

test('ST-ROMAIN-DE-COLBOSC/FECAMP correspond au point officiel "Saint Romain de Colbosc (ferme)"/"Fecamp" du ministere', () => {
  function dist(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const src = aprr.g.find(g => g[0] === 'ST-ROMAIN-DE-COLBOSC');
  const fecamp = aprr.g.find(g => g[0] === 'FECAMP');
  assert.ok(src && fecamp);
  // Coordonnees officielles (gares-peage-2025.csv, data.gouv.fr, Lambert93 -> WGS84)
  const officiels = { src: [49.55160, 0.33579], fecamp: [49.63257, 0.63996] };
  assert.ok(Math.min(...src[1].map(p => dist(p, officiels.src))) < 0.02);
  assert.ok(Math.min(...fecamp[1].map(p => dist(p, officiels.fecamp))) < 0.02);
});

test('les doublons exacts issus de la fusion ont ete dedoublonnes, sans conflit restant', () => {
  function keyed(n) {
    const m = new Map();
    for (const p of overlay.paires) {
      if (p[0] === n) m.set(p[1], [p[2], p[3]]);
      else if (p[1] === n) m.set(p[0], [p[2], p[3]]);
    }
    return m;
  }
  const src = keyed('ST-ROMAIN-DE-COLBOSC');
  assert.deepEqual(src.get('BOLBEC'), [1, 1.7]);
  assert.deepEqual(src.get('YERVILLE'), [3.7, 5.5]);
  const fecamp = keyed('FECAMP');
  assert.deepEqual(fecamp.get('YERVILLE'), [1.9, 2.8]);
  assert.deepEqual(fecamp.get('ST-SAENS'), [4.6, 6.2]);
  assert.deepEqual(fecamp.get('BOLBEC'), [1.6, 2.7]);
});

test('YVETOT EST reste distinct de YVETOT (preuve par desaccord de prix)', () => {
  const p1 = overlay.paires.find(x => (x[0] === 'BOLBEC' && x[1] === 'YVETOT') || (x[1] === 'BOLBEC' && x[0] === 'YVETOT'));
  const p2 = overlay.paires.find(x => (x[0] === 'BOLBEC' && x[1] === 'YVETOT EST') || (x[1] === 'BOLBEC' && x[0] === 'YVETOT EST'));
  assert.ok(p1 && p2);
  assert.notDeepEqual([p1[2], p1[3]], [p2[2], p2[3]], 'YVETOT EST doit rester un point distinct de YVETOT (prix different)');
});

test('no price was fabricated or altered (sample)', () => {
  const p1 = overlay.paires.find(x => (x[0] === 'LE HAVRE' && x[1] === 'BOLBEC') || (x[1] === 'LE HAVRE' && x[0] === 'BOLBEC'));
  assert.ok(p1);
  assert.equal(p1[2], 2.5);
  assert.equal(p1[3], 3.2);
  const p2 = overlay.paires.find(x => (x[0] === 'LE HAVRE N°5 / A131' && x[1] === 'BOLBEC') || (x[1] === 'LE HAVRE N°5 / A131' && x[0] === 'BOLBEC'));
  assert.ok(p2);
  assert.equal(p2[2], 2.5);
  assert.equal(p2[3], 3.1);
  assert.notDeepEqual([p1[2], p1[3]], [p2[2], p2[3]], 'the two naming sets should genuinely disagree, confirming neither can be assumed identical');
});
