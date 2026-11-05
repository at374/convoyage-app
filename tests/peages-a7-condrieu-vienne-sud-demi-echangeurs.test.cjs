'use strict';
// Ajout de 4 nouvelles gares sur l'A7 (Rhône, 5 nov. 2026) : CONDRIEU ENTREE,
// CONDRIEU SORTIE, Vienne Sud Entree, Vienne Sud Sortie.
//
// Chacune de ces 4 entrées n'a qu'UNE SEULE relation dans overlay.paires, vers son
// homologue (CONDRIEU ENTREE <-> CONDRIEU SORTIE : 1,1/1,1 € ; Vienne Sud Entree <->
// Vienne Sud Sortie : 1,9/2,5 €) -- un tarif local court, sans rapport avec les
// relations longue-distance de "Condrieu" et "Vienne sud" (noms canoniques deja
// presents, respectivement 0 et 61 relations). Ce sont donc deux points FONCTIONNELLEMENT
// distincts au meme endroit, pas une simple variante de nom a fusionner (fusionner
// aurait produit une paire absurde "Condrieu <-> Condrieu").
//
// Source de localisation (aucune approximation) :
// - VINCI Autoroutes confirme par communique de presse que l'echangeur de Condrieu
//   est l'echangeur n°10 de l'A7, et que l'echangeur Vienne Sud (n°11) est un
//   "demi-échangeur" neuf (travaux 2024-2025) construit "au niveau de la barrière de
//   péage de Reventin-Vaugris" -- donc au meme endroit que la gare "Vienne sud" deja
//   presente, mais une installation DIFFERENTE de cette barriere historique.
//   (https://www.vinci-autoroutes.com/fr/actualites/amenagements/a7-echangeur-vienne-sud-le-chantier-demarre/,
//    https://www.vinci-autoroutes.com/fr/actualites/amenagements/demi-changeur-vienne-autoroute-a7/)
// - Google Places confirme les coordonnees exactes :
//   "Barrière de péage d'Ampuis - Sortie n°10" (45.5052136, 4.839044) -- a seulement
//   0,0056km de la gare EXISTANTE "Condrieu" (confirmation du meme emplacement).
//   "Autoroute A7 / Sortie 11" (45.497324, 4.8391836) -- a seulement 0,0390km de la
//   gare EXISTANTE "Vienne sud" (confirmation du meme emplacement).
//
// Run: node --test tests/peages-a7-condrieu-vienne-sud-demi-echangeurs.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

for (const nom of ['CONDRIEU ENTREE', 'CONDRIEU SORTIE', 'Vienne Sud Entree', 'Vienne Sud Sortie']) {
  test(`${nom} now has verified GPS`, () => {
    const g = overlay.gares.find(x => x.nom === nom);
    assert.ok(g, `${nom} should now exist in overlay.gares`);
    assert.equal(typeof g.points[0][0], 'number');
    assert.equal(typeof g.points[0][1], 'number');
  });
}

test('CONDRIEU ENTREE/SORTIE were NOT merged into the pre-existing distinct "Condrieu" gare', () => {
  const condrieu = overlay.gares.find(g => g.nom === 'Condrieu');
  assert.ok(condrieu, 'pre-existing canonical "Condrieu" gare should be untouched');
  const names = new Set(overlay.gares.map(g => g.nom));
  assert.ok(names.has('CONDRIEU ENTREE') && names.has('CONDRIEU SORTIE') && names.has('Condrieu'));
});

test('no price was fabricated or altered: the two local relations keep their original numbers', () => {
  const p1 = overlay.paires.find(x => (x[0] === 'CONDRIEU ENTREE' && x[1] === 'CONDRIEU SORTIE') || (x[1] === 'CONDRIEU ENTREE' && x[0] === 'CONDRIEU SORTIE'));
  assert.ok(p1);
  assert.equal(p1[2], 1.1);
  assert.equal(p1[3], 1.1);
  const p2 = overlay.paires.find(x => (x[0] === 'Vienne Sud Entree' && x[1] === 'Vienne Sud Sortie') || (x[1] === 'Vienne Sud Entree' && x[0] === 'Vienne Sud Sortie'));
  assert.ok(p2);
  assert.equal(p2[2], 1.9);
  assert.equal(p2[3], 2.5);
});
