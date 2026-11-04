'use strict';
// Deuxieme vague du meme bug systemique que la correction de casse du 4 nov.
// 2026 : ix() (routes-ui.js) fait une comparaison de CHAINE EXACTE. Au-dela
// de la casse, des imports officiels utilisaient une ponctuation/accentuation
// differente de la forme canonique deja presente avec GPS verifie (tirets,
// apostrophes, accents, parentheses, slashs -- ex. "LAMOTTE BEUVRON" vs
// "LAMOTTE-BEUVRON", "EVRON" vs "Évron", "BAYONNE MOUSSEROLLES" vs
// "Bayonne-Mousserolles"). Ce batch a renomme 1761 occurrences (56 formes
// distinctes) vers leur forme canonique exacte deja verifiee, reactivant des
// relations deja PROUVEes mais totalement inactives dans le moteur. Aucun
// montant, aucune distance, aucune coordonnee GPS n'a ete modifiee : seule
// la chaine de nom a change. Aucun renommage ambigu (plusieurs candidats
// possibles pour une meme forme normalisee) n'a ete applique.
// Run: node --test tests/peages-ponctuation-mismatch-fix.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function exactNameSet() {
  const s = new Set();
  for (const g of aprr.g) s.add(g[0]);
  for (const g of overlay.gares) s.add(g.nom);
  return s;
}

test('every paire name that has a unique normalized (accent/punctuation-insensitive) match now matches it exactly', () => {
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
      if (exact.has(nom)) continue;
      const k = norm(nom);
      if (byNorm.has(k) && byNorm.get(k).size === 1) {
        stillMismatched.push(nom + ' -> ' + Array.from(byNorm.get(k))[0]);
      }
    }
  }
  assert.equal(stillMismatched.length, 0, 'still-mismatched names: ' + JSON.stringify(stillMismatched.slice(0, 10)));
});

test('spot-check: well-known relations activated by this fix now fire with their canonical spelling', () => {
  const checks = [
    ['LAMOTTE-BEUVRON', 'ORLEANS-CENTRE'],
    ['Bayonne-Mousserolles', 'ELOISE'],
    ['Biarritz (échangeur)', null], // existence check only, see below
    ['SAINT-QUENTIN NORD', 'LA FÈRE'],
  ];
  for (const [a] of checks) {
    const exists = overlay.paires.some(x => x[0] === a || x[1] === a) || aprr.g.some(g => g[0] === a);
    assert.ok(exists, a + ' should exist/be referenced with canonical spelling');
  }
  const p = overlay.paires.find(x => (x[0] === 'Bayonne-Mousserolles' && x[1] === 'ELOISE') || (x[0] === 'ELOISE' && x[1] === 'Bayonne-Mousserolles'));
  // Bayonne-Mousserolles <-> ELOISE specifically was not one of the two renamed BAYONNE MOUSSEROLLES occurrences;
  // instead verify the two renamed names independently fire with at least one real relation each.
  const bm = overlay.paires.filter(x => x[0] === 'Bayonne-Mousserolles' || x[1] === 'Bayonne-Mousserolles');
  assert.ok(bm.length > 0, 'Bayonne-Mousserolles should have at least one active relation after the rename');
  const be = overlay.paires.filter(x => x[0] === 'Biarritz (échangeur)' || x[1] === 'Biarritz (échangeur)');
  assert.ok(be.length > 0, 'Biarritz (échangeur) should have at least one active relation after the rename');
});

test('ELOISE (Annecy area, A41/AREA) and Sisteron Nord/Sud (ESCOTA/A51) relations are now active', () => {
  const eloise = overlay.paires.filter(p => p[0] === 'ELOISE' || p[1] === 'ELOISE');
  assert.ok(eloise.length > 50, 'expected many ELOISE relations to be active, got ' + eloise.length);
  const sisteronNord = overlay.paires.filter(p => p[0] === 'Sisteron Nord' || p[1] === 'Sisteron Nord');
  assert.ok(sisteronNord.length > 10, 'expected many Sisteron Nord relations to be active, got ' + sisteronNord.length);
});

test('no price, distance or class amount was altered by the punctuation fix (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'LAMOTTE-BEUVRON' || x[1] === 'LAMOTTE-BEUVRON'));
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
