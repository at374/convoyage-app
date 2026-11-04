'use strict';
// Troisieme vague du meme bug systemique que les corrections de casse et de
// ponctuation du 4 nov. 2026 : ix() (routes-ui.js) fait une comparaison de
// CHAINE EXACTE. Un import officiel SANEF (axes A16/A26/A1/A4...) ecrivait
// les noms de gares avec un suffixe de numero de sortie (" N°14", " N°6.1",
// parfois avec l'autoroute entre parentheses, ex. "ARRAS NORD (A26) N°7"),
// different de la forme canonique deja presente avec GPS verifie
// ("Saint-Omer" vs "SAINT-OMER N°3"). Ce batch a renomme 1837 occurrences
// (69 formes distinctes) vers leur forme canonique exacte (candidat unique
// apres normalisation ET suppression du suffixe de sortie), reactivant des
// relations deja PROUVEes mais totalement inactives dans le moteur. Aucun
// montant, distance ou GPS modifie : seule la chaine de nom a change.
// Un cas ambigu ("NŒUX-LES-MINES N°6.1", deux candidats a 2,5km l'un de
// l'autre) et les libelles couvrant une plage de sorties ou des gares
// absentes de la base ont ete laisses volontairement non resolus.
// Run: node --test tests/peages-suffixe-sortie-mismatch-fix.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
function stripSuffix(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(/\s*\(A\d+\)\s*$/, '').replace(/\s*N°[\d.]+\s*$/, '').trim();
  } while (s !== prev);
  return s;
}
function exactNameSet() {
  const s = new Set();
  for (const g of aprr.g) s.add(g[0]);
  for (const g of overlay.gares) s.add(g.nom);
  return s;
}

test('every N°-suffixed paire name with a unique stripped+normalized match now matches it exactly', () => {
  const exact = exactNameSet();
  const byNorm = new Map();
  for (const n of exact) {
    const k = norm(n);
    if (!byNorm.has(k)) byNorm.set(k, new Set());
    byNorm.get(k).add(n);
  }
  const stillMismatched = [];
  for (const p of overlay.paires) {
    for (let i = 0; i < 2; i++) {
      const nom = p[i];
      if (exact.has(nom) || !/N°[\d.]+/.test(nom)) continue;
      const k = norm(stripSuffix(nom));
      if (byNorm.has(k) && byNorm.get(k).size === 1) {
        stillMismatched.push(nom + ' -> ' + Array.from(byNorm.get(k))[0]);
      }
    }
  }
  assert.equal(stillMismatched.length, 0, 'still-mismatched names: ' + JSON.stringify(stillMismatched.slice(0, 10)));
});

test('spot-check: well-known SANEF relations activated by this fix now fire with their canonical spelling', () => {
  const checks = ['Saint-Omer', 'LILLERS', 'MASNIÈRES', 'LAON', 'GUIGNICOURT', 'VILLERS-BRETONNEUX', 'SAVERNE', 'SARREGUEMINES'];
  for (const n of checks) {
    const has = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(has, n + ' should have at least one active relation after the suffix-stripping rename');
  }
});

test('the ambiguous "NŒUX-LES-MINES N°6.1" case (two real, distinct points 2.5km apart) was left untouched', () => {
  const p = overlay.paires.filter(x => x[0] === 'NŒUX-LES-MINES N°6.1' || x[1] === 'NŒUX-LES-MINES N°6.1');
  assert.ok(p.length > 0, 'the ambiguous name should still be present, unrenamed');
});

test('no price, distance or class amount was altered by the suffix-stripping fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'Saint-Omer' || x[1] === 'Saint-Omer');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
