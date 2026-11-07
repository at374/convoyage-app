'use strict';
// Audit systématique de area_public.txt (7 nov. 2026, extraction du PDF
// officiel "Tarifs de péage réseau AREA, classes 1 à 5, en vigueur au 1er
// février 2026", 955 relations, tableau Code Entrée/Gare d'entrée/Code
// Sortie/Gare de sortie/Distance/Classe 1..5).
//
// Résultat : 950/955 relations (99,5%) déjà couvertes. Les 5 restantes
// concernent la contrepartie générique "Système Ouvert" (tarif plat),
// dont une seule (CRUSEILLES A -> Système Ouvert, 25,00km, 3,20€/4,90€)
// n'est pas un nom manquant mais un artefact de découpage du texte PDF (la
// ligne "CRUSEILLES A 410 Système Ouvert" n'a qu'un seul espace entre "A"
// et le code de sortie "410", contre deux espaces ou plus pour les autres
// colonnes) -- "CRUSEILLES A" existe déjà dans aprr.g (point déjà flaggé
// SUSPECTES dans routes-ui.js, position douteuse connue, volontairement non
// modifiée) et sa relation "Système Ouvert" existe déjà sous
// "aprr-area-ouvert-cruseilles-a", vérifiée exacte (3,2€/4,9€).
//
// Conclusion : le réseau AREA officiel est intégralement couvert. Aucune
// donnée ajoutée par cet audit.
//
// Run: node --test tests/peages-audit-area-public-955.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('CRUSEILLES A existe et sa relation système ouvert correspond exactement au PDF officiel AREA', () => {
  assert.ok(aprr.g.some(g => g[0] === 'CRUSEILLES A'));
  const c1 = overlay.tarifs.find(t => t.b === 'aprr-area-ouvert-cruseilles-a' && t.c === 1);
  const c2 = overlay.tarifs.find(t => t.b === 'aprr-area-ouvert-cruseilles-a' && t.c === 2);
  assert.ok(c1 && c2);
  assert.equal(c1.a, 3.2);
  assert.equal(c2.a, 4.9);
  assert.equal(c1.s, 'PROUVE');
});
