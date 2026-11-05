'use strict';
// "PERIGUEUX" fusionne vers "Périgueux est" (A89, 5 nov. 2026) : preuve de prix
// directe -- l'unique relation de PERIGUEUX ("Thenon Est <-> PERIGUEUX" : 4,6 / 7)
// est rigoureusement identique a la relation deja existante "Thenon Est <-> Périgueux
// est" (4,6 / 7) depuis la MEME origine (Thenon Est). Simple variante de casse/accent
// du meme nom physique, pas une coincidence de grille tarifaire locale. Le doublon de
// relation cree par la fusion (Thenon Est <-> Périgueux est, apparue deux fois a
// l'identique) a ete dedoublonne.
//
// NB : "THENON" (nom nu, nd), dont l'unique relation connue ("THENON <-> Périgueux
// est" : 8,6 / 13,1) correspond EXACTEMENT au prix de "Périgueux est <-> Mansac
// Terrasson", a ete delibermment LAISSE NON RESOLU : cette zone (Périgueux
// est/sud/ouest, Mansac Terrasson) presente plusieurs tarifs identiques entre
// origines differentes (ex. Périgueux est <-> Périgueux sud/ouest = 0/0), donc une
// preuve sur une seule destination partagee est jugee trop faible pour exclure un
// faux positif -- pas de fusion sans recoupement supplementaire.
// MANSAC et TERRASSON restent egalement non resolus (paire bretelle isolee,
// meme discipline que Vienne Sud Entree/Sortie), de meme que LA BACHELLERIE EST /
// LA BACHELLERIE SUD (autre paire bretelle isolee).
//
// Run: node --test tests/peages-perigueux-thenon-est-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('PERIGUEUX was fully renamed to Périgueux est, no duplicate relation left', () => {
  const stray = overlay.paires.some(p => p[0] === 'PERIGUEUX' || p[1] === 'PERIGUEUX');
  assert.equal(stray, false);
  const matches = overlay.paires.filter(p =>
    (p[0] === 'Thenon Est' && p[1] === 'Périgueux est') ||
    (p[1] === 'Thenon Est' && p[0] === 'Périgueux est'));
  assert.equal(matches.length, 1, 'should be exactly one Thenon Est <-> Périgueux est relation, got ' + matches.length);
});

test('THENON, MANSAC, TERRASSON, LA BACHELLERIE EST/SUD were deliberately left unresolved', () => {
  for (const name of ['THENON', 'MANSAC', 'TERRASSON', 'LA BACHELLERIE EST', 'LA BACHELLERIE SUD']) {
    const stillDangling = overlay.paires.some(p => p[0] === name || p[1] === name);
    assert.ok(stillDangling, name + ' should still be present, unmerged');
  }
});

test('no price was fabricated or altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'Thenon Est' && x[1] === 'Périgueux est') || (x[1] === 'Thenon Est' && x[0] === 'Périgueux est'));
  assert.ok(p);
  assert.equal(p[2], 4.6);
  assert.equal(p[3], 7);
});
