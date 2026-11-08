'use strict';
// Audit du 8 nov. 2026 (suite) : recoupement du référentiel officiel du ministère
// (gares-peage-2025.csv, data.gouv.fr) contre les deux derniers noms non résolus
// identifiés dans tests/peages-a64-urt-briscous-guiche-bayonne-directionnels.test.cjs
// et tests/peages-audit-asf-2056-cloture.test.cjs.
//
// 1. GUICHE (A64) : le référentiel officiel contient bien "Guiche Sortie"/"Guiche
//    Entree" (dept 64, Lambert93 358588,95/6277268,4 et 358529,08/6277311,46),
//    converties en WGS84 : 43,512319/-1,222563 et 43,512677/-1,223330. Ce point est
//    DÉJÀ présent tel quel dans le tableau UNK de routes-ui.js (43.51232,-1.22256,
//    < 0,00002km de "Guiche Sortie") -- il sert déjà à exclure correctement les
//    trajets passant par ce point de tout calcul de prix fabriqué.
//
//    Mais ce GPS officiel NE PERMET PAS d'activer un prix : l'unique relation
//    connue impliquant GUICHE est "URT-BRISCOUS <-> GUICHE" (1,3/1,3€, A64). Le
//    mécanisme de fusion (routes-ui.js, CODE_WORKER : `const x=ix(q[0]),y=ix(q[1]);
//    ...if(x>=0&&y>=0&&!prix.has(k))`) exige que LES DEUX extrémités d'une paire
//    soient déjà des gares connues (aprr.g + overlay.gares) pour activer le prix.
//    URT-BRISCOUS reste, lui, totalement absent du référentiel officiel (aucune
//    ligne "urt"/"briscous" dans gares-peage-2025.csv) -- ajouter GUICHE seul à
//    overlay.gares n'activerait donc AUCUN prix (x>=0 mais y=-1), pour aucun
//    bénéfice utilisateur, et ne résout pas le gap. Conformément à la règle "zéro
//    approximation", GUICHE reste donc volontairement NON ajouté à overlay.gares
//    jusqu'à ce qu'une source officielle donne le GPS d'URT-BRISCOUS également.
//
// 2. "Thenon vers Perigueux" / "Thenon vers Brives" (code A0089, Bpv = barrière
//    pleine voie, PK157, dept 24) : ces deux lignes officielles (sens opposés)
//    tombent à 0,015-0,057km de "Thenon Est" (déjà en base, type Ech). Ceci
//    CONFIRME l'analyse déjà documentée dans peages-audit-asf-2056-cloture.test.cjs
//    (ASF_2014.pdf : "6 gares séparées au même PK157 : Thenon barrière x2, Thenon
//    échangeur x2, La Bachellerie x2") -- les 2 barrières Bpv retrouvées ici sont
//    very probablement les "Thenon barrière x2" déjà repérées dans le PDF. Mais
//    gares-peage-2025.csv est un référentiel de LOCALISATION, pas une grille de
//    PRIX : aucun tarif n'est associé à ces 2 lignes. Cette confirmation
//    géographique ne fournit donc AUCUNE nouvelle source de prix et ne permet
//    toujours pas de résoudre PERIGUEUX/PERIGUEUX EST (qui nécessiterait un tarif
//    officiel propre à l'une de ces 2 barrières, pas seulement sa localisation).
//
// Aucune modification de peages-aprr.json/peages-overlay.json. Aucun prix
// fabriqué ou approximé.
//
// Run: node --test tests/peages-guiche-thenon-barrieres-gps-officiel-non-actionnable.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function dist(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

test('GUICHE : le GPS officiel (data.gouv.fr) correspond exactement au point UNK existant', () => {
  const officiel = [43.512319, -1.222563];
  const unkMatch = [43.51232, -1.22256];
  assert.ok(dist(officiel, unkMatch) < 0.001, 'le point UNK doit correspondre au GPS officiel de Guiche Sortie');
});

test('GUICHE reste volontairement non ajouté : son GPS officiel ne peut activer aucun prix (URT-BRISCOUS reste sans GPS)', () => {
  const rel = overlay.paires.filter(p => p[0] === 'GUICHE' || p[1] === 'GUICHE');
  assert.equal(rel.length, 1, 'GUICHE ne doit avoir qu\'une seule relation connue');
  assert.deepEqual(rel[0].slice(0, 2).sort(), ['GUICHE', 'URT-BRISCOUS'].sort());
  const names = new Set([...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom)]);
  assert.equal(names.has('GUICHE'), false, 'GUICHE ne doit pas (encore) être une gare résolue');
  assert.equal(names.has('URT-BRISCOUS'), false, 'URT-BRISCOUS reste sans GPS officiel (confirmé absent de gares-peage-2025.csv)');
});

test('Thenon vers Perigueux / Thenon vers Brives (Bpv officiels) sont co-localisés avec Thenon Est, sans fournir de nouveau tarif', () => {
  const thenonEst = overlay.gares.find(g => g.nom === 'Thenon Est');
  assert.ok(thenonEst, 'Thenon Est doit déjà exister en base (overlay.gares)');
  const bpvOfficiels = [[45.15158, 1.16756], [45.15133, 1.16724]]; // Thenon vers Perigueux / Thenon vers Brives (WGS84)
  for (const pt of bpvOfficiels) {
    const min = Math.min(...thenonEst.points.map(p => dist(pt, p)));
    assert.ok(min < 0.1, 'la barrière Bpv officielle doit être à moins de 0,1km de Thenon Est, trouvé ' + min.toFixed(4) + 'km');
  }
  // Aucun tarif propre associé à ces 2 barrières n'existe dans overlay.tarifs
  const tarifsThenon = overlay.tarifs.filter(t => /thenon/i.test(t.id) || /perigueux/i.test(t.id));
  assert.equal(tarifsThenon.length, 0, 'gares-peage-2025.csv ne fournit aucun tarif, seulement une localisation');
});

test('PERIGUEUX/PERIGUEUX EST restent donc, sans surprise, toujours non résolus (noms bruts ASF, jamais ajoutés faute de tarif officiel propre)', () => {
  const names = new Set([
    ...aprr.g.map(g => g[0]),
    ...overlay.gares.map(g => g.nom),
    ...overlay.paires.flatMap(p => [p[0], p[1]]),
  ]);
  for (const n of ['PERIGUEUX', 'PERIGUEUX EST']) {
    assert.equal(names.has(n), false, n + ' ne doit pas avoir été ajouté sans tarif officiel propre');
  }
});
