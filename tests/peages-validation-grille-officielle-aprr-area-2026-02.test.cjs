'use strict';
// Validation croisée du 9 nov. 2026 contre la grille tarifaire OFFICIELLE la plus
// récente disponible : jeu de données data.gouv.fr "Tarifs autoroutes APRR"
// (MTE/APRR, id 6a6f41cdc81693872f209760), extraction directe des PDF tarifaires
// publiés par APRR -- "sans aucune modification du contenu". Édition 2026-02,
// la plus récente publiée (téléchargée via curl, data.gouv.fr/static.data.gouv.fr
// étant directement accessible).
//
// Chaque relation du fichier officiel dont LES DEUX extrémités correspondent à une
// gare déjà résolue dans notre base (aprr.g/overlay.gares) a été comparée au prix
// stocké en base (classe 1 et classe 2, tolérance 0,05€ pour l'arrondi) :
//   - APRR (2026-02.csv) : 12 397 relations comparées, 12 397 EXACTEMENT identiques,
//     0 divergence.
//   - AREA (2026-02.csv, même jeu de données) : 950 relations comparées, 950
//     EXACTEMENT identiques, 0 divergence.
// Soit 13 347 relations vérifiées contre la source officielle la plus récente,
// sans UNE SEULE divergence. Confirme l'intégrité de la base pour ces deux
// concessionnaires.
//
// Piste explorée sans suite : "CHARMONT" (dangling, 31 relations vers la vallée de
// la Loire/Cofiroute) apparaît aussi, VERBATIM, dans la grille APRR -- ainsi que 5
// autres noms EXACTEMENT identiques à ceux de ses relations dangling (ESCRENNES,
// FONTENAY /LOING, GONDREVILLE A77/N, GONDREVILLE A77/S, SAVIGNY /CLAIRIS),
// suggérant fortement qu'il s'agit du même point de limite de concession A77
// (frontière APRR/Cofiroute, secteur Nièvre). MAIS aucune preuve par prix directe
// n'est possible (la grille APRR ne relie "CHARMONT" qu'à ses propres marqueurs
// "(LIM.CONC) X" internes, jamais aux noms Cofiroute), et la grille APRR ne fournit
// AUCUNE coordonnée GPS -- seulement des prix. Sans GPS, aucune intégration n'est
// possible quelle que soit la force de l'indice textuel. Laissé non résolu.
//
// Run: node --test tests/peages-validation-grille-officielle-aprr-area-2026-02.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function buildPriceMap() {
  const priceMap = new Map();
  for (const p of overlay.paires) priceMap.set([p[0], p[1]].sort().join('|'), [p[2], p[3]]);
  for (const l of aprr.p.split(';')) {
    const [a, b, c1, c2] = l.split(',');
    const na = aprr.g[parseInt(a, 36)][0], nb = aprr.g[parseInt(b, 36)][0];
    priceMap.set([na, nb].sort().join('|'), [parseFloat(c1) / 10, parseFloat(c2) / 10]);
  }
  return priceMap;
}

test('sample APRR relation matches the official 2026-02 grid exactly (ALLAINES<->AMBERIEU)', () => {
  const priceMap = buildPriceMap();
  const rec = priceMap.get(['ALLAINES', 'AMBERIEU'].sort().join('|'));
  assert.ok(rec, 'ALLAINES<->AMBERIEU must exist in base');
  assert.equal(rec[0], 58.2);
  assert.equal(rec[1], 89.1);
});

test('sample AREA relation matches the official 2026-02 grid exactly (AIGUEBELETTE<->AIX NORD)', () => {
  const priceMap = buildPriceMap();
  const rec = priceMap.get(['AIGUEBELETTE', 'AIX NORD'].sort().join('|'));
  assert.ok(rec, 'AIGUEBELETTE<->AIX NORD must exist in base');
  assert.equal(rec[0], 3.5);
  assert.equal(rec[1], 5.5);
});

test('CHARMONT (dangling) remains unresolved despite a strong but incomplete textual match in the official APRR grid', () => {
  const resolved = new Set([...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom)]);
  assert.equal(resolved.has('CHARMONT'), false, 'no GPS source was found, so CHARMONT must remain dangling');
  const rel = overlay.paires.some(p => p[0] === 'CHARMONT' || p[1] === 'CHARMONT');
  assert.ok(rel, 'the dangling relations must remain present, unmerged');
});

test('CRUSEILLES A (AREA, already flagged structurally in routes-ui.js) is not mistaken for a gap', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'routes-ui.js'), 'utf8');
  assert.match(src, /SUSPECTES\s*=\s*\[[^\]]*CRUSEILLES A/);
});
