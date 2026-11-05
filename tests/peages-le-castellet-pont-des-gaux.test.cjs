'use strict';
// "LE CASTELLET" et "PONT DES GAUX" (A50 Marseille-Toulon, secteur Bandol/Ollioules,
// 5 nov. 2026), aucun GPS fabrique.
//
// "LE CASTELLET" est CONFIRME REEL : c'est la sortie officielle n°11 de l'A50,
// entre Saint-Cyr-sur-Mer (sortie 10) et Bandol (sortie 12), desservant La
// Cadière-d'Azur, Le Beausset, le Circuit du Castellet et la Z.I. Signes (source :
// article Wikipedia "A50 autoroute", liste des sorties). Coherent avec ses relations
// dans overlay.paires (Aubagne Est, BANDOL, PONT DES GAUX -- tous situes sur le meme
// corridor). Absent du PDF tarifaire ESCOTA-Guide-tarifaire-2026 ainsi que de
// l'ancien tarif Escota 2021 (verifie par recherche plein texte) et de
// mcp__widgets__places_search (aucune gare de peage nommee "Le Castellet" trouvee).
//
// "PONT DES GAUX" reste de statut incertain : un lieu nomme "Pont des Gaux" existe
// bien via Google Places, mais UNIQUEMENT comme arret de bus a Toulon-centre
// (83200), hors du corridor A50 Bandol/Ollioules/Le Castellet attendu (sorties
// 10-13, communes 83330/83430/83190) -- type et localisation incompatibles avec une
// barriere de peage sur ce tronçon. Rejete comme correspondance (pas de fusion par
// proximite). Aucune autre source trouvee.
//
// Les deux noms restent donc volontairement sans GPS, faute de source officielle
// precise (aucune approximation par proximite ou par homonymie).
//
// Run: node --test tests/peages-le-castellet-pont-des-gaux.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('"LE CASTELLET" and "PONT DES GAUX" were deliberately left without GPS', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  for (const n of ['LE CASTELLET', 'PONT DES GAUX']) {
    assert.equal(gareNames.has(n), false, n + ' must not have a gare entry');
    const stillDangling = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(stillDangling, n + ' should still be present, unmerged');
  }
});

test('no price was fabricated or altered (sample)', () => {
  const p1 = overlay.paires.find(x => (x[0] === 'LE CASTELLET' && x[1] === 'BANDOL') || (x[1] === 'LE CASTELLET' && x[0] === 'BANDOL'));
  assert.ok(p1);
  assert.equal(p1[2], 1.4);
  assert.equal(p1[3], 2);
  const p2 = overlay.paires.find(x => (x[0] === 'PONT DES GAUX' && x[1] === 'OLLIOULES') || (x[1] === 'PONT DES GAUX' && x[0] === 'OLLIOULES'));
  assert.ok(p2);
  assert.equal(p2[2], 0.9);
  assert.equal(p2[3], 1.4);
});
