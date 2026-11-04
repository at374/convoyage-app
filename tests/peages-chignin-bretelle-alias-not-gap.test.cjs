'use strict';
// Investigation (4 nov. 2026): CHIGNIN BRETELLE (peages-aprr.json) portait les
// memes coordonnees GPS que CHIGNIN BARRIERE (doublon manifeste) et n'avait
// aucune relation dans overlay.paires : signale precedemment comme "a
// corriger (GPS distinct a trouver)". Verification par recherche de lieu :
// le vrai point physique de la bretelle de sortie n°21 "Chignin les Marches"
// (A43) se trouve en realite a ~0,03km de la gare DEJA active "CHIGNIN LES
// MARCHES" (14 relations PROUVEes dans peages-aprr.json), pas a un
// emplacement distinct restant a creer. CHIGNIN BRETELLE est donc un alias
// mort et inoffensif (comme GAUCHY/COURBES) : aucune paire ne le reference
// litteralement, ix() ne l'active jamais, aucun risque de prix errone.
// Aucune donnee modifiee suite a cette investigation.
// Run: node --test tests/peages-chignin-bretelle-alias-not-gap.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

const dist = (a, b, c, d) => {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

test('CHIGNIN LES MARCHES already carries the real tariffs for the A43 exit n°21 bretelle', () => {
  const clm = aprr.g.find(g => g[0] === 'CHIGNIN LES MARCHES');
  assert.ok(clm, 'CHIGNIN LES MARCHES should exist in peages-aprr.json');
  const paires = overlay.paires.filter(p => p[0] === 'CHIGNIN LES MARCHES' || p[1] === 'CHIGNIN LES MARCHES');
  assert.ok(paires.length > 0, 'CHIGNIN LES MARCHES should already have priced relations');
});

test('CHIGNIN BRETELLE currently duplicates CHIGNIN BARRIERE\'s GPS (known placeholder, not its true location)', () => {
  const bretelle = aprr.g.find(g => g[0] === 'CHIGNIN BRETELLE');
  const barriere = aprr.g.find(g => g[0] === 'CHIGNIN BARRIERE');
  assert.ok(bretelle && barriere);
  const d = dist(bretelle[1][0][0], bretelle[1][0][1], barriere[1][0][0], barriere[1][0][1]);
  assert.ok(d < 0.01, 'expected the known placeholder duplication, got ' + d.toFixed(4) + 'km');
});

test('no paire anywhere references the literal name "CHIGNIN BRETELLE" (dead alias, zero price/double-charge risk)', () => {
  const paires = overlay.paires.filter(p => p[0] === 'CHIGNIN BRETELLE' || p[1] === 'CHIGNIN BRETELLE');
  assert.equal(paires.length, 0);
});
