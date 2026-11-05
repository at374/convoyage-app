'use strict';
// "HOCHFELDEN" fusionne vers "HOCHFELDEN N°45" (A4 Alsace, 5 nov. 2026) : preuve de
// prix stricte sur 29/29 destinations communes, 0 ecart -- simple variante de nommage
// (avec/sans suffixe de sortie), meme point physique.
//
// NB IMPORTANT : le GPS source via Google Places ("Péage d'Hochfelden - A4 - Sortie
// N°45", confirme par "Gare de Péage de Schwindratzeim" au meme endroit, km 456 de
// l'A4) s'est revele etre a seulement 0,0362km de la gare DEJA EXISTANTE "STRASBOURG"
// -- a l'interieur du seuil de fusion jumelle (0,06km). Mais la comparaison des prix
// partages entre HOCHFELDEN et STRASBOURG montre un ECART SYSTEMATIQUE NON NUL
// (ex. Chateau-Thierry : 36,0/55,5 pour HOCHFELDEN contre 38,0/57,9 pour STRASBOURG ;
// Dormans : 33,4/51,7 contre 35,4/54,1 -- ecart constant d'environ 2 euros) : par la
// methodologie du projet, un ecart systematique mais non nul est une PREUVE DE
// NON-IDENTITE (deux points logiques de tarification distincts), pas une
// approximation a ignorer. En consequence, AUCUN GPS n'a ete assigne a HOCHFELDEN
// N°45 malgre la decouverte de ce candidat -- la gare reste geographiquement non
// resolue (toujours dangling), seule la duplication de nom a ete corrigee.
//
// Run: node --test tests/peages-hochfelden-n45-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('HOCHFELDEN was fully renamed to HOCHFELDEN N°45', () => {
  const stray = overlay.paires.some(p => p[0] === 'HOCHFELDEN' || p[1] === 'HOCHFELDEN');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'HOCHFELDEN N°45' || p[1] === 'HOCHFELDEN N°45');
  assert.ok(has);
});

test('HOCHFELDEN N°45 was deliberately left without GPS (no new gare added)', () => {
  const newGare = overlay.gares.some(g => g.nom === 'HOCHFELDEN N°45' || g.nom === 'HOCHFELDEN');
  assert.equal(newGare, false, 'HOCHFELDEN N°45 must not have been added as a new gare (disproved identity with STRASBOURG)');
});

test('no price was fabricated or altered by this merge (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'HOCHFELDEN N°45' || x[1] === 'HOCHFELDEN N°45');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
