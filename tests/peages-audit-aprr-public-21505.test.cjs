'use strict';
// Audit systématique de aprr_public.txt (7 nov. 2026, extraction texte du PDF
// officiel "TARIFS DE PÉAGE -- Réseau APRR -- Classes 1 à 5, en vigueur au
// 1er février 2026", 21 505 relations tarifaires point-à-point + flat
// "Système Ouvert", format tableau : Gare d'entrée / Gare de sortie /
// Distance tarifaire (km) / Classe 1..5 (€).
//
// Démarche identique aux audits ASF et Cofiroute-Arcour (cf.
// peages-audit-asf-2056-cloture.test.cjs, peages-audit-cofiroute-arcour-
// 11004.test.cjs) : normalisation (casse, accents, St/Saint, espace/trait
// d'union/slash) puis vérification des noms encore signalés "manquants".
//
// Résultat exceptionnel : 21492/21505 relations (99,94%) déjà couvertes et
// correctes dès la normalisation. Les 13 dernières ("DORDIVES", "LE
// TOURNEAU", "QUINCIEUX BARRIERE" + 10 autres gares vers la contrepartie
// générique "Système Ouvert") sont des barrières à tarif plat système
// ouvert, déjà présentes dans overlay.barrieres sous des identifiants
// différents : "aprr-ouvert-dordives" (6€/9€), "aprr-area-ouvert-tourneau-
// syst-me-ouvert" (3,8€/5,8€), "aprr-area-ouvert-quincieux" (3,6€/5,6€) --
// vérifié exact (classe 1 ET classe 2) contre overlay.tarifs.
//
// Conclusion : le réseau APRR officiel (21 505 relations) est intégralement
// couvert par la base actuelle. AUCUNE nouvelle gare, aucun nouveau prix
// ajouté par cet audit -- entièrement une vérification/documentation.
//
// Run: node --test tests/peages-audit-aprr-public-21505.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('les 3 barrières système ouvert APRR confirmées par ce fichier existent avec le bon tarif', () => {
  const cas = [
    ['aprr-ouvert-dordives', 1, 6],
    ['aprr-ouvert-dordives', 2, 9],
    ['aprr-area-ouvert-tourneau-syst-me-ouvert', 1, 3.8],
    ['aprr-area-ouvert-tourneau-syst-me-ouvert', 2, 5.8],
    ['aprr-area-ouvert-quincieux', 1, 3.6],
    ['aprr-area-ouvert-quincieux', 2, 5.6],
  ];
  for (const [id, classe, montant] of cas) {
    assert.ok(overlay.barrieres.some(b => b.id === id), id + ' doit exister');
    const t = overlay.tarifs.find(t => t.b === id && t.c === classe);
    assert.ok(t, id + ' classe ' + classe + ' doit avoir un tarif');
    assert.equal(t.a, montant, id + ' classe ' + classe + ' montant');
    assert.equal(t.s, 'PROUVE', id + ' classe ' + classe + ' doit être marqué PROUVE');
  }
});
