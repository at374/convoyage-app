'use strict';
// Suppression d'un doublon : "CALAIS" <-> "SAINT OMER B" (2,8/4,4), A26, 5 nov. 2026.
//
// Preuve (fichier officiel fourni par l'utilisateur, sanef_a26_axis132.json,
// extrait de la grille SANEF 2026 par positions de cellules) : dans la matrice
// source, "SAINT OMER B" n'a QU'UNE SEULE cellule renseignee (vers "CALAIS (peage
// de Setques)", 2,8/4,4) -- toutes ses 27 autres cellules sont null. Le noeud
// "SAINT OMER" (sans B) de la MEME matrice porte lui TOUTES les relations reelles
// (vers AIRE SUR LA LYS 0,8/0,9, LILLERS 2,5/4, BETHUNE 3,8/5,1, etc.), qui
// correspondent EXACTEMENT a la gare canonique deja presente "Saint-Omer" (92
// relations). "SAINT OMER B" est donc un artefact de l'extraction en triangle de
// la matrice (meme noeud physique duplique sous un second nom par la grille
// triangulaire, cf. note src_paires "93 cellules ambigues exclues (proprietaire
// de colonne indetermine)"), pas une gare distincte -- la seule valeur qu'il
// portait (CALAIS<->SAINT OMER B = 2,8/4,4) est RIGOUREUSEMENT IDENTIQUE a celle
// deja presente pour CALAIS<->Saint-Omer (2,8/4,4). Supprime comme doublon pur,
// aucun prix perdu ni modifie.
//
// "VALLEE DE LA HEM" reste volontairement non resolu : ses prix vers les memes
// destinations que Saint-Omer (AIRE SUR LA LYS, LILLERS, BETHUNE...) different de
// Saint-Omer avec un ECART NON CONSTANT (ex. +1,2/+4,0 vers Aire-sur-la-Lys mais
// +1,7/+5,0 vers Lillers) -- preuve que c'est un point physique REEL et DISTINCT
// (pas un doublon de Saint-Omer), mais aucune source GPS fiable trouvee (ni
// Google Places, ni recherche web) pour le localiser avec certitude.
//
// Run: node --test tests/peages-saint-omer-b-doublon-fix.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('"SAINT OMER B" no longer appears (pure duplicate of the canonical "Saint-Omer" removed)', () => {
  const present = overlay.paires.some(p => p[0] === 'SAINT OMER B' || p[1] === 'SAINT OMER B');
  assert.equal(present, false);
});

test('the canonical "Saint-Omer" <-> CALAIS relation (the one real value SAINT OMER B carried) is untouched', () => {
  const p = overlay.paires.find(x => (x[0] === 'CALAIS' && x[1] === 'Saint-Omer') || (x[1] === 'CALAIS' && x[0] === 'Saint-Omer'));
  assert.ok(p);
  assert.equal(p[2], 2.8);
  assert.equal(p[3], 4.4);
});

test('"VALLEE DE LA HEM" was deliberately left without GPS (confirmed distinct real point, no reliable source found)', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  assert.equal(gareNames.has('VALLEE DE LA HEM'), false);
  const stillDangling = overlay.paires.some(p => p[0] === 'VALLEE DE LA HEM' || p[1] === 'VALLEE DE LA HEM');
  assert.ok(stillDangling, 'VALLEE DE LA HEM should still be present, unmerged');
});
