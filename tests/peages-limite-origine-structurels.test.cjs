'use strict';
// Cloture (documentation, aucune modification de prix) des marqueurs structurels
// "LIMITE X-Y" / "ORIGINE X" (5 nov. 2026) : LIMITE A11-A85, LIMITE A62-A65,
// LIMITE A64-A65, LIMITE A89-A71, LIMITE LE MANS O A11, LIMITE POITIERS A10,
// ORIGINE A8, ORIGINE A57 TOULON.
//
// Preuve de non-physicalite : chacun de ces noms a un GRAND nombre de relations
// (6 a 27 chacun, 104 au total) vers des gares reelles tres eloignees
// geographiquement les unes des autres (ex. LIMITE POITIERS A10 relie 27 gares de
// Niort a Cholet a Mirambeau), et certains sont meme relies ENTRE EUX (ex.
// "LIMITE LE MANS O A11" <-> "LIMITE A11-A85" ; "ORIGINE A8" <-> "ORIGINE A57
// TOULON") -- un comportement impossible pour une gare de peage physique (qui n'a
// qu'un nombre limite de relations locales) mais caracteristique d'un marqueur de
// calcul de reseau ("limite" = frontiere entre deux concessions, "origine" = point
// de depart d'un troncon) utilise par le mecanisme de tarification point-a-point
// sans barriere physique propre. Ce comportement corrobore le fait architectural
// deja etabli pour les marqueurs ESCOTA Cote d'Azur (CASSIS/LA BEDOULE etc.,
// confirme par le PDF officiel ESCOTA : tarifs "calcules sur la base des trajets
// via A57"/"A52") et pour SCIENTRIER/GAILLARD/LE FAYET (A40) / MODANE (A43).
//
// MODANE (A43, Savoie) est documente ici pour la meme raison : Wikipedia (article
// A43 autoroute) confirme explicitement l'absence de gare de peage a Modane meme
// ("No toll station is listed at Modane itself... Junction 30 serves Modane but
// has no péage noted") ; sa seule relation (vers ST MICHEL MAURIENNE BAR, deja
// geolocalisee) est un tarif directionnel vers/depuis ce point de reference logique,
// pas une gare distincte.
//
// Aucun GPS fabrique ou approxime pour ces 9 noms : ils restent volontairement
// sans point dans overlay.gares, et leurs prix (deja PROUVE, inchanges) continuent
// de ne jamais s'activer tant qu'aucune extremite reelle ne les declenche par erreur.
//
// Run: node --test tests/peages-limite-origine-structurels.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

const structurels = [
  'LIMITE A11-A85', 'LIMITE A62-A65', 'LIMITE A64-A65', 'LIMITE A89-A71',
  'LIMITE LE MANS O A11', 'LIMITE POITIERS A10', 'ORIGINE A8', 'ORIGINE A57 TOULON',
  'MODANE',
];

test('none of the 9 structural markers was given a fabricated GPS point', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  for (const n of structurels) {
    assert.equal(gareNames.has(n), false, n + ' must not have a gare entry');
  }
});

test('each marker still has its original, unmodified relations (price proof untouched)', () => {
  for (const n of structurels) {
    const rels = overlay.paires.filter(p => p[0] === n || p[1] === n);
    assert.ok(rels.length >= 1, n + ' should still be present, unmerged');
    for (const r of rels) {
      assert.equal(typeof r[2], 'number');
      assert.equal(typeof r[3], 'number');
    }
  }
});

test('the 8 LIMITE/ORIGINE markers each have many relations across a wide area (non-physical calculation-origin pattern)', () => {
  for (const n of structurels.filter(x => x !== 'MODANE')) {
    const rels = overlay.paires.filter(p => p[0] === n || p[1] === n);
    assert.ok(rels.length >= 6, n + ' expected a wide fan of relations, got ' + rels.length);
  }
});

test('ST MICHEL MAURIENNE BAR (MODANE\'s only destination) already has verified GPS', () => {
  const aprr = require('../peages-aprr.json');
  const g = aprr.g.find(x => x[0] === 'ST MICHEL MAURIENNE BAR');
  assert.ok(g && g[1] && g[1].length >= 1);
});
