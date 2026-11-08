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
//
// MISE A JOUR du 8 nov. 2026 : MANSAC, TERRASSON, LA BACHELLERIE EST et LA
// BACHELLERIE SUD sont en realite deja COUVERTS FONCTIONNELLEMENT, pas de simples
// "paires bretelle isolees" en attente -- decouvert en recoupant le referentiel
// officiel du ministere (gares-peage-2025.csv, data.gouv.fr, telecharge en curl) :
// - "La Bachellerie" (overlay.gares, deja resolu) est a <0.02km des points
//   officiels "La Bachellerie Entree/Sortie" (meme echangeur).
// - "Mansac Terrasson" (overlay.gares, deja resolu) est a <0.03km du point
//   officiel "Terrasson E/S".
// - PREUVE PAR PRIX : la relation deja en base "Mansac Terrasson <-> La
//   Bachellerie" = 3,4/5,2 EUR -- IDENTIQUE au prix de la paire dangling
//   "LA BACHELLERIE SUD <-> LA BACHELLERIE EST" = 3,4/5,2 EUR. Meme discipline
//   que l'alias Saint Aignan Sur Cher/ST ROMAIN SUR CHER (preuve par le prix,
//   pas seulement par la proximite GPS).
// Les noms dangling MANSAC/TERRASSON/LA BACHELLERIE EST/SUD restent donc tels
// quels (noms d'une source plus ancienne, jamais nettoyes), mais leur travail de
// tarification est deja fait sous les noms combines "Mansac Terrasson"/
// "La Bachellerie". Aucune action requise ; aucun prix fabrique.
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

test('THENON, MANSAC, TERRASSON, LA BACHELLERIE EST/SUD were deliberately left unresolved (noms nus, non nettoyes)', () => {
  for (const name of ['THENON', 'MANSAC', 'TERRASSON', 'LA BACHELLERIE EST', 'LA BACHELLERIE SUD']) {
    const stillDangling = overlay.paires.some(p => p[0] === name || p[1] === name);
    assert.ok(stillDangling, name + ' should still be present, unmerged');
  }
});

test('MANSAC/TERRASSON et LA BACHELLERIE EST/SUD sont deja couverts fonctionnellement par "Mansac Terrasson"/"La Bachellerie" (preuve par prix)', () => {
  const mansacTerrasson = overlay.gares.find(g => g.nom === 'Mansac Terrasson');
  const laBachellerie = overlay.gares.find(g => g.nom === 'La Bachellerie');
  assert.ok(mansacTerrasson, '"Mansac Terrasson" doit exister');
  assert.ok(laBachellerie, '"La Bachellerie" doit exister');
  const relResolue = overlay.paires.find(p =>
    (p[0] === 'Mansac Terrasson' && p[1] === 'La Bachellerie') ||
    (p[1] === 'Mansac Terrasson' && p[0] === 'La Bachellerie'));
  assert.ok(relResolue, 'la relation "Mansac Terrasson" <-> "La Bachellerie" doit exister');
  const relDangling = overlay.paires.find(p =>
    (p[0] === 'LA BACHELLERIE SUD' && p[1] === 'LA BACHELLERIE EST') ||
    (p[1] === 'LA BACHELLERIE SUD' && p[0] === 'LA BACHELLERIE EST'));
  assert.ok(relDangling, 'la relation dangling LA BACHELLERIE SUD <-> LA BACHELLERIE EST doit exister');
  assert.equal(relResolue[2], relDangling[2], 'classe1 doit correspondre exactement (preuve de prix)');
  assert.equal(relResolue[3], relDangling[3], 'classe2 doit correspondre exactement (preuve de prix)');
});

test('no price was fabricated or altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'Thenon Est' && x[1] === 'Périgueux est') || (x[1] === 'Thenon Est' && x[0] === 'Périgueux est'));
  assert.ok(p);
  assert.equal(p[2], 4.6);
  assert.equal(p[3], 7);
});
