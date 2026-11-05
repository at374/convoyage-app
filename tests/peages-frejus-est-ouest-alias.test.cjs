'use strict';
// "FREJUS EST" fusionne vers "Frejus Ouest" (A8, 5 nov. 2026) : double corroboration.
//
// 1. Preuve de prix : l'unique relation de FREJUS EST ("Mandelieu <-> FREJUS EST" :
//    3 / 4,7) est rigoureusement identique a la relation deja existante "Mandelieu
//    <-> Frejus Ouest" (3 / 4,7).
// 2. Source officielle : la page Wikipedia (en) de l'autoroute A8 ne liste qu'une
//    seule barriere de peage pres de Frejus -- le "Péage du Capitou" (entre les
//    sorties 37 Puget-sur-Argens et 38 Frejus) -- et ne mentionne "Fréjus - ouest" que
//    comme destination indiquee sur un panneau de signalisation a la sortie 37, jamais
//    comme nom de peage distinct. Aucune seconde barriere "Fréjus Est" n'existe
//    physiquement.
//
// Run: node --test tests/peages-frejus-est-ouest-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('FREJUS EST was fully renamed to Frejus Ouest', () => {
  const stray = overlay.paires.some(p => p[0] === 'FREJUS EST' || p[1] === 'FREJUS EST');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Frejus Ouest' || p[1] === 'Frejus Ouest');
  assert.ok(has);
});

test('no price was fabricated or altered by this merge (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'Mandelieu' && x[1] === 'Frejus Ouest') || (x[1] === 'Mandelieu' && x[0] === 'Frejus Ouest'));
  assert.ok(p);
  assert.equal(p[2], 3);
  assert.equal(p[3], 4.7);
});
