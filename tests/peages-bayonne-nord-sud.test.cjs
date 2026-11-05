'use strict';
// Ajout GPS pour BAYONNE NORD et BAYONNE SUD (A63, Pyrénées-Atlantiques, 5 nov. 2026).
// Ces deux noms n'ont qu'UNE relation chacun, l'un vers l'autre (0,8€/1,3€, tarif
// tres court), coherent avec deux sens/voies d'une meme barriere locale.
//
// Source GPS (aucune approximation) : Google Places, "Péage de Bayonne Anglet - A63 -
// Sortie N°5" (43.4622342, -1.4984937) -- seul péage nommé "Bayonne" trouvé sur l'A63
// a hauteur d'Anglet. Verifie a plus de 4,8km de toute autre gare "Bayonne" existante
// (Bayonne-Mousserolles, sur l'A64, axe different) -- aucun risque de confusion avec
// un point deja resolu.
//
// Le nom "BAYONNE" (sans suffixe), qui relie uniquement vers "BIARRITZ BARRIERE"
// (encore non resolu), est volontairement LAISSE EN ATTENTE : il n'y a pas assez
// d'elements pour determiner avec certitude s'il s'agit du meme complexe ou d'un
// point distinct.
//
// Run: node --test tests/peages-bayonne-nord-sud.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

for (const nom of ['BAYONNE NORD', 'BAYONNE SUD']) {
  test(`${nom} now has verified GPS`, () => {
    const g = overlay.gares.find(x => x.nom === nom);
    assert.ok(g);
    assert.equal(typeof g.points[0][0], 'number');
    assert.equal(typeof g.points[0][1], 'number');
  });
}

test('bare "BAYONNE" was deliberately left without GPS (insufficient certainty)', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  assert.equal(gareNames.has('BAYONNE'), false);
});

test('no price was fabricated or altered (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'BAYONNE NORD' && x[1] === 'BAYONNE SUD') || (x[1] === 'BAYONNE NORD' && x[0] === 'BAYONNE SUD'));
  assert.ok(p);
  assert.equal(p[2], 0.8);
  assert.equal(p[3], 1.3);
});
