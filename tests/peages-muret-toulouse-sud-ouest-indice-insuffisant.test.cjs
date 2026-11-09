'use strict';
// Piste explorée le 9 nov. 2026 (référentiel officiel data.gouv.fr,
// gares-peage-2025.csv) puis volontairement ABANDONNÉE faute de preuve
// suffisante : "MURET vers Toulouse"/"Muret depuis Toulouse" (barrières Bpv
// officielles, A0064, PK278, dept 31) se trouvent à <0,03km de la gare déjà
// résolue "TOULOUSE-SUD/OUEST" (overlay.gares, GPS [43.5054869,1.3520096]).
//
// Hypothèse testée : le nom dangling "MURET" (overlay.paires, une seule
// relation connue : "MURET"<->"TOULOUSE OUEST" = 1,8/2,9€) pourrait désigner
// le même point physique que "TOULOUSE-SUD/OUEST".
//
// REJETÉE : aucune preuve par prix possible -- "MURET" et "TOULOUSE OUEST"
// (tous deux dangling) n'apparaissent QUE dans cette unique relation
// mutuelle, sans aucune troisième destination partagée avec
// "TOULOUSE-SUD/OUEST" (qui a pourtant plus de 40 relations) permettant de
// confirmer ou d'infirmer l'identité. Le seul indice disponible est la
// coïncidence GPS + le nom "Muret" (ville adjacente), insuffisant à lui seul
// selon la méthodologie du projet (cf. le cas HOCHFELDEN N°45, où un indice
// GPS/nom similaire avait justement été invalidé par la preuve de prix). Le
// périphérique de Toulouse comporte plusieurs barrières rapprochées
// (Muret, Toulouse-Sud/Ouest, Toulouse Ouest), ce qui rend une fusion sans
// preuve de prix particulièrement risquée (cf. l'erreur évitée de justesse
// sur NŒUX-LES-MINES N°6.1 le 8 nov. 2026, où une coïncidence de nom seule
// se serait révélée fausse).
//
// "MURET" et "TOULOUSE OUEST" restent donc volontairement non résolus, sans
// qu'aucun prix ni GPS n'ait été ajouté ou modifié.
//
// Run: node --test tests/peages-muret-toulouse-sud-ouest-indice-insuffisant.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('MURET et TOULOUSE OUEST restent dangling (aucune fusion effectuee, preuve insuffisante)', () => {
  const names = new Set([...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom)]);
  for (const n of ['MURET', 'TOULOUSE OUEST']) {
    assert.equal(names.has(n), false, n + ' ne doit pas avoir ete ajoute sans preuve suffisante');
  }
});

test('TOULOUSE-SUD/OUEST (deja resolu) reste inchange, et sa coincidence GPS avec "Muret" officiel ne suffit pas seule', () => {
  const g = overlay.gares.find(x => x.nom === 'TOULOUSE-SUD/OUEST');
  assert.ok(g);
  function dist(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const officiel = [43.50524, 1.35211]; // "Muret vers Toulouse" (gares-peage-2025.csv, Lambert93 -> WGS84)
  assert.ok(dist(g.points[0], officiel) < 0.05);
  // Malgre cette proximite, aucune relation n'a ete ajoutee/modifiee pour TOULOUSE-SUD/OUEST
  const rel = overlay.paires.filter(p => p[0] === 'TOULOUSE-SUD/OUEST' || p[1] === 'TOULOUSE-SUD/OUEST');
  assert.ok(rel.length > 40, 'le nombre de relations existantes ne doit pas avoir change (pas de fusion effectuee)');
});

test('aucun prix invente pour MURET<->TOULOUSE OUEST (relation isolee, inchangee)', () => {
  const p = overlay.paires.find(x => (x[0] === 'MURET' && x[1] === 'TOULOUSE OUEST') || (x[1] === 'MURET' && x[0] === 'TOULOUSE OUEST'));
  assert.ok(p);
  assert.equal(p[2], 1.8);
  assert.equal(p[3], 2.9);
});
