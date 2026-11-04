'use strict';
// Investigation (4 nov. 2026): un audit national avait signale GAUCHY et
// COURBES (overlay.gares) comme ayant un GPS mais aucun tarif nulle part
// (overlay.paires), les laissant apparaitre comme un "trou" tarifaire a
// combler. Verification sur le simulateur officiel SANEF (axes A1, A26,
// A29 - les seuls plausibles geographiquement) : ces deux noms ne
// correspondent a AUCUN echangeur nomme dans le simulateur. En revanche,
// leurs coordonnees GPS sont rigoureusement identiques (0,00km) a deux
// gares DEJA actives et DEJA pleinement tarifees sous un autre nom :
// GAUCHY == SAINT-QUENTIN SUD (34 relations PROUVEes), COURBES == LA FERE
// (34 relations PROUVEes). Ce ne sont donc pas des gares orphelines avec
// un vrai tarif manquant : ce sont des alias (noms de commune) de deux
// barrieres physiques deja integralement couvertes sous leur denomination
// officielle ASF/SANEF. Aucune paire ne reference "GAUCHY" ou "COURBES"
// litteralement, donc ix() (comparaison exacte) ne les active jamais et
// aucun risque de double-charge ou de prix errone n'existe : ce sont des
// entrees mortes et inoffensives, pas un trou a combler. Aucune donnee
// n'a ete modifiee suite a cette investigation.
// Run: node --test tests/peages-gauchy-courbes-alias-not-gap.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

const dist = (a, b, c, d) => {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

test('GAUCHY is co-located (<0.01km) with the already fully-priced "SAINT-QUENTIN SUD" gare', () => {
  const gauchy = overlay.gares.find(g => g.nom === 'GAUCHY');
  assert.ok(gauchy, 'GAUCHY should still exist in overlay.gares');
  const sqs = aprr.g.find(g => g[0] === 'SAINT-QUENTIN SUD');
  assert.ok(sqs, 'SAINT-QUENTIN SUD should exist in peages-aprr.json');
  const d = dist(gauchy.points[0][0], gauchy.points[0][1], sqs[1][0][0], sqs[1][0][1]);
  assert.ok(d < 0.01, 'expected GAUCHY to be co-located with SAINT-QUENTIN SUD, got ' + d.toFixed(4) + 'km');
});

test('COURBES is co-located (<0.01km) with the already fully-priced "LA FÈRE" gare', () => {
  const courbes = overlay.gares.find(g => g.nom === 'COURBES');
  assert.ok(courbes, 'COURBES should still exist in overlay.gares');
  const laFere = aprr.g.find(g => g[0] === 'LA FÈRE');
  assert.ok(laFere, 'LA FÈRE should exist in peages-aprr.json');
  const d = dist(courbes.points[0][0], courbes.points[0][1], laFere[1][0][0], laFere[1][0][1]);
  assert.ok(d < 0.01, 'expected COURBES to be co-located with LA FÈRE, got ' + d.toFixed(4) + 'km');
});

test('SAINT-QUENTIN SUD and LA FÈRE already carry real PROUVE tariffs (so GAUCHY/COURBES are not a missing-price gap)', () => {
  const sqsPaires = overlay.paires.filter(p => p[0] === 'SAINT-QUENTIN SUD' || p[1] === 'SAINT-QUENTIN SUD');
  const laFerePaires = overlay.paires.filter(p => p[0] === 'LA FÈRE' || p[1] === 'LA FÈRE');
  assert.ok(sqsPaires.length > 0, 'SAINT-QUENTIN SUD should already have priced relations');
  assert.ok(laFerePaires.length > 0, 'LA FÈRE should already have priced relations');
});

test('no paire anywhere references the literal names "GAUCHY" or "COURBES" (dead aliases, zero price/double-charge risk)', () => {
  const gauchyPaires = overlay.paires.filter(p => p[0] === 'GAUCHY' || p[1] === 'GAUCHY');
  const courbesPaires = overlay.paires.filter(p => p[0] === 'COURBES' || p[1] === 'COURBES');
  assert.equal(gauchyPaires.length, 0);
  assert.equal(courbesPaires.length, 0);
});
