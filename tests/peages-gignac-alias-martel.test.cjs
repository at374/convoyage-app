'use strict';
// Audit Tarifs_ASF.txt (7 nov. 2026, suite de l'audit du réseau ASF) — "GIGNAC" (A20, Lot).
//
// GIGNAC apparaissait dans Tarifs_ASF.txt avec 6 relations tarifaires :
//   CAHORS NORD<->GIGNAC (8,1/12,1), CAHORS SUD<->GIGNAC (10,6/16,3),
//   CAUSSADE<->GIGNAC (13,6/20,2), LABASTIDE MURAT<->GIGNAC (5,8/9,6),
//   MONTAUBAN NORD<->GIGNAC (15,9/24,6), SOUILLAC<->GIGNAC (2,2/3,6).
// Absent de la base sous ce nom -> candidat a priori pour un nouvel ajout.
//
// Géocodage (Google Places) : "Gare de Péage de Gignac", A20, 46600 Gignac,
// GPS [44.9907081, 1.5269206] -- à seulement 0,346km du point déjà existant
// "Martel" ([44.9933, 1.5316]), juste au-dessus du seuil de détection barrière
// (0,3km), donc ambigu par le seul critère GPS.
//
// Preuve de prix (méthode utilisée pour METZ=BEAUMONT, ST LAURENT=Saint-
// Laurent-du-Var, EPERNAY=REIMS SUD) : comparaison des 6 relations ASF de
// "GIGNAC" contre les 6 relations déjà existantes de "Martel" vers EXACTEMENT
// les mêmes 6 destinations -- correspondance EXACTE (au centime, classes 1 ET
// 2) sur la totalité des 6 relations, 0 écart. Conclusion : "GIGNAC" (nom
// Tarifs_ASF.txt / Google Places) et "Martel" (base) désignent le MÊME point
// de péage physique. Aucune nouvelle gare, aucune nouvelle relation : les 6
// prix recherchés sont déjà présents et déjà exacts sous le nom "Martel".
//
// Run: node --test tests/peages-gignac-alias-martel.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');

function idx(n) { return aprr.g.findIndex(g => g[0] === n); }

function prix(a, b) {
  const ai = idx(a), bi = idx(b);
  for (const s of aprr.p.split(';')) {
    const [x, y, c1, c2] = s.split(',');
    const xi = parseInt(x, 36), yi = parseInt(y, 36);
    if ((xi === ai && yi === bi) || (xi === bi && yi === ai)) return [Number(c1) / 10, Number(c2) / 10];
  }
  return undefined;
}

test('GIGNAC n\'existe pas comme gare distincte dans la base (alias confirmé de Martel)', () => {
  assert.equal(idx('GIGNAC'), -1);
  assert.equal(idx('Gignac'), -1);
});

test('les 6 relations ASF "GIGNAC" correspondent exactement aux relations existantes de "Martel"', () => {
  const attendu = [
    ['Cahors Nord', 8.1, 12.1],
    ['Cahors Sud', 10.6, 16.3],
    ['Caussade', 13.6, 20.2],
    ['Labastide Murat', 5.8, 9.6],
    ['Montauban Nord', 15.9, 24.6],
    ['Souillac', 2.2, 3.6],
  ];
  assert.equal(idx('Martel') >= 0, true);
  for (const [dest, c1, c2] of attendu) {
    const v = prix('Martel', dest);
    assert.ok(v, 'Martel <-> ' + dest + ' doit exister');
    assert.equal(v[0], c1, 'Martel <-> ' + dest + ' classe 1');
    assert.equal(v[1], c2, 'Martel <-> ' + dest + ' classe 2');
  }
});
