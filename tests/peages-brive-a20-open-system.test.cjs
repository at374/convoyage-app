'use strict';
// BRIVE (A20, Lot, 5 nov. 2026) : confirme comme point de reference logique en
// systeme ouvert, SANS GPS propre -- meme prudence que SCIENTRIER/GAILLARD/LE FAYET
// (A40) et MODANE (A43), deja documentes.
//
// Preuve : l'A20 est gratuite sur la quasi-totalite de son parcours entre Vierzon et
// Montauban ; seule une courte section pres de Cahors/Martel est a peage, avec UNE
// SEULE barriere physique nommee "Péage A20 Gignac" (5 voies a droite / 11 voies a
// gauche selon lesvoitures.fr -- aucune barriere "Brive" distincte listee). Cette
// barriere a deja ete fusionnee sous le nom canonique "Martel" dans ce dataset
// (voir tests/peages-gignac-martel-alias.test.cjs, preuve de prix 6/6 destinations).
//
// L'unique relation de BRIVE ("Martel <-> BRIVE" : 0,8 / 1,2, tarif tres court) est
// donc un tarif directionnel ("vers Brive") de cette MEME barriere Martel/Gignac,
// pas une gare physique distincte. Ajouter un GPS pour BRIVE creerait un point
// fictif alors que la perception reelle se fait entierement a la barriere Martel.
//
// Run: node --test tests/peages-brive-a20-open-system.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('BRIVE was deliberately left without GPS (open-system endpoint of the Martel/Gignac barrier)', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  assert.equal(gareNames.has('BRIVE'), false);
  const stillDangling = overlay.paires.some(p => p[0] === 'BRIVE' || p[1] === 'BRIVE');
  assert.ok(stillDangling, 'BRIVE should still be present, unmerged');
});

test('no price was fabricated or altered (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'Martel' && x[1] === 'BRIVE') || (x[1] === 'Martel' && x[0] === 'BRIVE'));
  assert.ok(p);
  assert.equal(p[2], 0.8);
  assert.equal(p[3], 1.2);
});
