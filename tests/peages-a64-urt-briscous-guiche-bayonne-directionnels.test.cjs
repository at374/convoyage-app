'use strict';
// Investigation du corridor A64 Bayonne-ouest / A63 Bayonne-sud (5 nov. 2026),
// aucun GPS fabrique. Quatre noms dangling examines :
//
// 1. "URT-BRISCOUS" <-> "GUICHE" (1,3/1,3, A64) : les deux sorties sont CONFIRMEES
//    REELLES et DISTINCTES via la grille triangulaire officielle ASF
//    (C1/C2-TARIFS-WEB-2026-maille_maj062026.pdf, page lue par rasterisation haute
//    resolution + lecture visuelle -- texte rotatif illisible par pdftotext/
//    pdfplumber.extract_text()) : Briscous (sortie 3), Urt (sortie 4), Guiche
//    (sortie 5), Mouguerre Elizaberry (sortie 2) sur l'A64 a l'ouest de Bayonne.
//    Malgre cette confirmation d'existence physique, AUCUNE source GPS fiable n'a
//    ete trouvee (mcp__widgets__places_search echoue systematiquement pour ces
//    sorties precises malgre plusieurs formulations). La relation est isolee (aucun
//    recoupement avec une gare deja geolocalisee), donc aucune preuve de prix
//    possible non plus. Reste volontairement sans GPS.
//
// 2. "BAYONNE-S JEAN LUZ N" <-> "Biarritz (échangeur)" (1,2/2,0) et
//    "BAYONNE-ST GEOURS M." <-> "CAPBRETON" (2,0/3,1) : ces deux noms composes
//    ("vers Saint-Jean-de-Luz Nord" / "vers St-Geours-Maremne") suivent le meme
//    schema que BRIVE (A20) et ROCADE EST (rocade de Toulouse) deja documentes --
//    des intitules directionnels a une barriere existante plutot que des points
//    physiques distincts. Chaque relation est isolee (une seule destination,
//    elle-meme deja geolocalisee), rendant toute preuve de prix impossible. Reste
//    volontairement sans GPS, meme prudence que BAYONNE (bare) et BIARRITZ
//    BARRIERE, deja laisses non resolus dans tests/peages-bayonne-nord-sud.test.cjs
//    et tests/peages-a63-basque-nouvelles-gares.test.cjs.
//
// Run: node --test tests/peages-a64-urt-briscous-guiche-bayonne-directionnels.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('URT-BRISCOUS, GUICHE, BAYONNE-S JEAN LUZ N and BAYONNE-ST GEOURS M. were deliberately left without GPS', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  for (const n of ['URT-BRISCOUS', 'GUICHE', 'BAYONNE-S JEAN LUZ N', 'BAYONNE-ST GEOURS M.']) {
    assert.equal(gareNames.has(n), false, n + ' must not have a gare entry');
    const stillDangling = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(stillDangling, n + ' should still be present, unmerged');
  }
});

test('each relation is isolated (single destination), making any price-proof impossible', () => {
  function destCount(n) {
    return overlay.paires.filter(p => p[0] === n || p[1] === n).length;
  }
  for (const n of ['URT-BRISCOUS', 'GUICHE', 'BAYONNE-S JEAN LUZ N', 'BAYONNE-ST GEOURS M.']) {
    assert.equal(destCount(n), 1, n + ' should have exactly one relation');
  }
});

test('no price was fabricated or altered (sample)', () => {
  const p1 = overlay.paires.find(x => (x[0] === 'URT-BRISCOUS' && x[1] === 'GUICHE') || (x[1] === 'URT-BRISCOUS' && x[0] === 'GUICHE'));
  assert.ok(p1);
  assert.equal(p1[2], 1.3);
  assert.equal(p1[3], 1.3);
  const p2 = overlay.paires.find(x => (x[0] === 'BAYONNE-ST GEOURS M.' && x[1] === 'CAPBRETON') || (x[1] === 'BAYONNE-ST GEOURS M.' && x[0] === 'CAPBRETON'));
  assert.ok(p2);
  assert.equal(p2[2], 2);
  assert.equal(p2[3], 3.1);
});
