'use strict';
// Ajout GPS pour LESTELLE ST MARTORY (A64, Haute-Garonne), 5 nov. 2026.
//
// LESTELLE ST MARTORY : source GPS Google Places "Péage de Lestelle - A64 de bajada"
// (43.1207141, 0.8957131), a 0,47km de la gare canonique "Lestelle" (aprr.g, 23
// relations longue-distance). Aucune destination commune entre les deux noms (0/24
// comparables) donc pas de preuve de prix possible, mais le candidat correspond a un
// tarif local tres court (1,5€/2,4€ vers MARTRES TOLOSANE) coherent avec un acces
// local au meme complexe -- ajoute comme gare distincte, pas fusionne.
//
// TOULOUSE-NORD/EST : un candidat GPS avait d'abord ete ajoute ("Péage de Toulouse
// Nord", 43.658004, 1.4266711, a 0,0665km de la gare existante "Toulouse-Nord/Ouest"),
// mais la distance tombe juste au-dessus du seuil "gares jumelles" (0,06km) --
// resultat ambigu, pas une confirmation nette. Un test pre-existant
// (tests/peages-toulouse-sud-ouest-nouvelle-gare.test.cjs, cree lors d'une session
// anterieure) documente DEJA une decision deliberee de laisser TOULOUSE-NORD/EST non
// resolu, faute de source suffisamment fiable. Cette nouvelle preuve etant trop
// marginale pour renverser une decision deja documentee, l'ajout a ete ANNULE :
// TOULOUSE-NORD/EST reste volontairement sans GPS, comme TOULOUSE EST et
// MARTRES TOLOSANE (aucun candidat GPS distinct trouve pour ce dernier).
//
// Run: node --test tests/peages-toulouse-nord-est-lestelle.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('LESTELLE ST MARTORY now has verified GPS', () => {
  const g = overlay.gares.find(x => x.nom === 'LESTELLE ST MARTORY');
  assert.ok(g);
  assert.equal(typeof g.points[0][0], 'number');
  assert.equal(typeof g.points[0][1], 'number');
});

test('TOULOUSE-NORD/EST, TOULOUSE EST and MARTRES TOLOSANE were deliberately left without GPS', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  assert.equal(gareNames.has('TOULOUSE-NORD/EST'), false);
  assert.equal(gareNames.has('TOULOUSE EST'), false);
  assert.equal(gareNames.has('MARTRES TOLOSANE'), false);
});

test('no price was fabricated or altered (sample)', () => {
  const p2 = overlay.paires.find(x => (x[0] === 'LESTELLE ST MARTORY' && x[1] === 'MARTRES TOLOSANE') || (x[1] === 'LESTELLE ST MARTORY' && x[0] === 'MARTRES TOLOSANE'));
  assert.ok(p2);
  assert.equal(p2[2], 1.5);
  assert.equal(p2[3], 2.4);
});
