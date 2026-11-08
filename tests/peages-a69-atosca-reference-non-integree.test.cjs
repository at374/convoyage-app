'use strict';
// A69 (Toulouse-Castres, ATOSCA) : autoroute toute nouvelle (premiere section
// ouverte le 4 nov. 2026, reseau en flux libre), totalement absente de la
// base. Grille tarifaire officielle recuperee le 8 nov. 2026 depuis
// https://www.atosca.fr/wp-content/uploads/2026/11/grilles_tarifaires_A69.pdf
// ("en vigueur au 05 Novembre 2026") : 10 relations entre 5 points
// (Verfeil, Villeneuve-les-Lavaur/Maurens-Scopont, Puylaurens, Soual Est,
// Saint-Palais), classes 1 et 2.
//
// NON INTEGREE dans peages-aprr.json / peages-overlay.json : aucune source
// GPS fiable trouvee pour les 5 points (Google Places et OpenStreetMap n'ont
// pas encore indexe les diffuseurs/portiques, l'autoroute ayant ouvert
// quelques jours avant cette verification). Integrer sans GPS verifie
// risquerait une mauvaise detection de trajet -- contraire a la regle "zero
// approximation". Les donnees sont conservees comme reference verifiee
// (data/peages-a69-verifie-non-integre-2026.json) pour une integration
// future une fois une source GPS fiable disponible.
//
// Run: node --test tests/peages-a69-atosca-reference-non-integree.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');
const ref = require('../data/peages-a69-verifie-non-integre-2026.json');

test('reference A69 : 5 points, 10 relations, statut verified_not_integrated', () => {
  assert.equal(ref.status, 'verified_not_integrated');
  assert.equal(ref.points_officiels.length, 5);
  assert.equal(ref.relations.length, 10);
  for (const r of ref.relations) {
    assert.equal(typeof r.classe1, 'number');
    assert.equal(typeof r.classe2, 'number');
    assert.ok(r.classe2 >= r.classe1, r.a + ' <-> ' + r.b + ' : classe2 doit etre >= classe1');
  }
});

test('les points A69 ne sont pas presents dans la base de production (pas d\'integration premature)', () => {
  const noms = ref.points_officiels.map(p => p.nom.toLowerCase());
  const allNames = [...aprr.g.map(g => g[0].toLowerCase()), ...overlay.gares.map(g => g.nom.toLowerCase())];
  for (const n of noms) {
    assert.equal(allNames.includes(n), false, n + ' ne doit pas avoir ete ajoute sans GPS verifie');
  }
});
