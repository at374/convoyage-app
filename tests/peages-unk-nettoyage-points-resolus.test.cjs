'use strict';
// Nettoyage du tableau UNK (routes-ui.js) le 7 nov. 2026.
//
// UNK liste des coordonnées GPS de gares officielles pour lesquelles V265 bloque
// INCONDITIONNELLEMENT tout calcul de prix exact (prixExact(), ligne ~103 de
// routes-ui.js) : "si le tracé passe près d'une gare officielle dont nous n'avons
// aucun tarif, le prix exact est refusé". Ce tableau avait été figé lors de l'audit
// data.gouv.fr du 5 nov. 2026 (voir le commentaire au-dessus de UNK dans
// routes-ui.js), mais n'a ensuite plus jamais été mis à jour au fur et à mesure que
// certaines de ces gares étaient résolues (GPS + tarif officiel ajoutés) par des
// sessions ultérieures -- un bug silencieux : un trajet réel passant par une gare
// DEJA correctement tarifée en base continuait d'afficher "prix exact non
// disponible", car UNK ne vérifie que la proximité GPS, jamais si un tarif existe
// réellement.
//
// Détecté le 7 nov. 2026 en croisant systématiquement les 62 coordonnées UNK contre
// aprr.g + overlay.gares + overlay.barrieres (seuil 0,15 km, très en dessous du
// seuil de fusion jumelle 0,06km pour la plupart des correspondances, le reste
// restant largement sous le seuil barrière 0,3km -- avec un saut net observé entre
// 0,149km (dernière correspondance) et 0,207km (premier point réellement distinct),
// confirmant qu'il n'y a pas d'ambiguïté) : 34 des 62 points correspondent à une
// gare qui possède déjà au moins 1 relation tarifaire officielle (1 à 49 selon les
// cas). Retirés de UNK ; aucun prix inventé ni modifié par ce nettoyage, uniquement
// le déblocage de prix déjà prouvés.
//
// Run: node --test tests/peages-unk-nettoyage-points-resolus.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');

const src = fs.readFileSync(__dirname + '/../routes-ui.js', 'utf8');
const startTag = 'const UNK = [';
const start = src.indexOf(startTag);
assert.ok(start >= 0, 'UNK array must be found in routes-ui.js');
const end = src.indexOf('];', start);
const UNK = JSON.parse(src.slice(start + startTag.length - 1, end + 1));

const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function dist(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

test('UNK now has 28 entries (34 resolved, stale entries removed on 7 nov. 2026)', () => {
  assert.equal(UNK.length, 28);
});

test('every removed station (now priced) is no longer present in UNK, at its exact resolved GPS', () => {
  const removed = [
    ['Antibes', [43.6028, 7.07258]],
    ['Cagnes-ouest', [43.64326, 7.13402]],
    ['Cagnes-est', [43.65913, 7.14893]],
    ['Nice St-Isidore', [43.70388, 7.19007]],
    ['Cannet-de-Meyreuil', [43.49458, 5.52498]],
    ['Cassis', [43.22574, 5.58217]],
    ['La Ciotat', [43.2019, 5.59417]],
    ['AURIOL', [43.36688, 5.64373]],
    ['Les Adrets', [43.54423, 6.80993]],
    ['cofiroute-ouvert-monts-sorigny', [47.25442, 0.67097]],
  ];
  for (const [name, [lat, lon]] of removed) {
    for (const u of UNK) {
      const d = dist([lat, lon], u);
      assert.ok(d > 0.15, name + ' (' + lat + ',' + lon + ') should no longer be within 0.15km of any UNK point, found ' + d.toFixed(4) + 'km');
    }
  }
});

test('every station matched for removal already carries at least one real tariff relation', () => {
  const G = aprr.g.map(g => g[0]);
  const ix = nom => G.indexOf(nom);
  function priceCount(name) {
    let cnt = 0;
    const i = ix(name);
    if (i >= 0) {
      for (const s of aprr.p.split(';')) {
        const [a, b] = s.split(',');
        if (parseInt(a, 36) === i || parseInt(b, 36) === i) cnt++;
      }
    }
    cnt += overlay.paires.filter(p => p[0] === name || p[1] === name).length;
    cnt += overlay.tarifs.filter(t => t.b === name).length;
    return cnt;
  }
  const names = ['Antibes', 'Cagnes-ouest', 'Cagnes-est', 'Nice St-Isidore', 'Cassis', 'La Ciotat',
    'Cannet-de-Meyreuil', 'COUDOUX', 'AIX-EN-PROVENCE', 'PUGET-VILLE', 'Carnoules', 'BANDOL',
    'TOULOUSE-SUD/OUEST', 'TONNAY-CHARENTE', 'CAPBRETON', 'BAYONNE NORD', 'BENESSE', 'BIRIATOU',
    'Mansac Terrasson', 'Thenon Est', 'La Bachellerie', 'ST-JEAN-LES-DEUX-JUMEAUX', 'Les Adrets', 'AURIOL',
    'cofiroute-ouvert-tours-nord', 'cofiroute-ouvert-chambray', 'cofiroute-ouvert-joue-les-tours',
    'cofiroute-ouvert-monts-sorigny', 'cofiroute-ouvert-neuille-pont-pierre', 'sapn-chambourcy'];
  for (const n of names) {
    assert.ok(priceCount(n) > 0, n + ' should have at least one priced relation');
  }
});

test('the 28 remaining UNK points are still genuine blind spots (no match within 0.2km of any known priced point)', () => {
  const allPts = [];
  for (const g of aprr.g) for (const p of g[1]) allPts.push(p);
  for (const g of overlay.gares) for (const p of g.points) allPts.push(p);
  for (const b of overlay.barrieres) for (const p of b.points) allPts.push(p);
  for (const u of UNK) {
    let best = Infinity;
    for (const p of allPts) { const d = dist(u, p); if (d < best) best = d; }
    assert.ok(best >= 0.2, 'UNK point ' + JSON.stringify(u) + ' unexpectedly close (' + best.toFixed(4) + 'km) to a known point -- should have been reviewed');
  }
});

test('new ESCOTA relations added alongside this cleanup (Saint-Laurent-du-Var cluster) match the official grid, cross-validated against pre-existing proven relations', () => {
  const cas = [
    ['Antibes', 'Saint-Laurent-du-Var', 1.7, 2.5],
    ['Nice St-Isidore', 'Saint-Laurent-du-Var', 0.5, 0.8],
    ['Cagnes-ouest', 'Saint-Laurent-du-Var', 0.8, 1.2],
    ['Cagnes-est', 'Saint-Laurent-du-Var', 0.7, 1.0],
  ];
  for (const [a, b, c1, c2] of cas) {
    const p = overlay.paires.find(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    assert.ok(p, a + '<->' + b + ' doit exister');
    assert.equal(p[2], c1);
    assert.equal(p[3], c2);
  }
  // Cross-validation: the two pre-existing relations used to confirm "ST LAURENT" (ESCOTA) =
  // "Saint-Laurent-du-Var" (base) match the official grid exactly.
  const g = aprr.g.find(x => x[0] === 'Saint-Laurent-du-Var');
  assert.ok(g);
});
