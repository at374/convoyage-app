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
// peuvent pas etre tous les deux exacts pour le MEME point physique. Lequel (si
// l'un des deux) correspond a une barriere officiellement et precisement
// localisable n'a pas pu etre etabli : Google Maps resout de facon ambigue sur la
// zone de l'echangeur A29/A131 pres de Tancarville, et aucune source GPS fiable
// (Google Places, OSM) n'a ete trouvee pour "LE HAVRE" (seul, sans suffixe),
// "TOTES", "FECAMP YVETOT OUEST", "YVETOT EST" ou "SAINT ROMAIN SYSTEME FERME".
//
// "SAINT ROMAIN SYSTEME FERME" a ete examine de pres ce jour (price-proof partiel
// contre ST-ROMAIN-DE-COLBOSC : plusieurs valeurs identiques sur les destinations
// partagees, au moins une non concordante -- trop proche pour trancher sans
// risque) et deliberement PAS fusionne.
//
// Note : "ST-SAENS" (destination commune aux deux jeux) possede en realite deja un
// GPS verifie dans peages-aprr.json et n'est donc PAS dangling.
//
// Reste volontairement sans GPS pour chacun des 5 noms ci-dessus, faute de source
// fiable (aucune approximation).
//
// Run: node --test tests/peages-sapn-a29-havre-saint-romain-double-nommage.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');
const aprr = require('../peages-aprr.json');

const NOMS = ['LE HAVRE', 'TOTES', 'FECAMP YVETOT OUEST', 'YVETOT EST', 'SAINT ROMAIN SYSTEME FERME'];

test('les 5 noms encore dangling du second jeu SAPN restent volontairement sans GPS', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  const aprrNames = new Set(aprr.g.map(g => g[0]));
  for (const n of NOMS) {
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

test('"SAINT ROMAIN SYSTEME FERME" vs "ST-ROMAIN-DE-COLBOSC" : correspondance de prix partielle mais pas concluante (pas fusionne)', () => {
  function dests(n) {
    const m = new Map();
    for (const p of overlay.paires) {
      if (p[0] === n) m.set(p[1], [p[2], p[3]]);
      else if (p[1] === n) m.set(p[0], [p[2], p[3]]);
    }
    return m;
  }
  const srf = dests('SAINT ROMAIN SYSTEME FERME');
  const src = dests('ST-ROMAIN-DE-COLBOSC');
  let shared = 0, exact = 0;
  for (const [dest, [c1, c2]] of srf) {
    if (src.has(dest)) {
      shared++;
      const [oc1, oc2] = src.get(dest);
      if (c1 === oc1 && c2 === oc2) exact++;
    }
  }
  assert.ok(shared >= 3, 'expected at least 3 shared destinations, got ' + shared);
  assert.ok(exact >= 1 && exact < shared, 'expected a partial (not total) match, got ' + exact + '/' + shared);
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
