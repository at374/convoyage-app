'use strict';
// Regression guard for SENLIS N°8 / SENLIS / PARIS-ROISSY (péage de Chamant) :
// des centaines de tarifs SANEF 2026 officiels (classes 1 et 2) existaient déjà
// dans overlay.paires (session anterieure) mais ne s'appliquaient JAMAIS : aucune
// des gares referencees n'avait de point GPS dans aprr.g ni overlay.gares (meme
// bug que Copponex/Cruseilles A41 Nord corrige plus haut dans cette session).
// GPS source : Google Maps, lieu nomme et resolu precisement (jamais une vue de
// recherche), session du 2026-11-03.
//   SENLIS N°8 / SENLIS       = "Sortie n°8 - Péage de Senlis" (49.2070185, 2.609396)
//   PARIS / ROISSY (péage de Chamant) = alias de la gare "PARIS / ROISSY" déjà
//     geolocalisee dans peages-aprr.json (meme tarifs prouves par paires existantes,
//     ex. SENLIS<->PARIS/ROISSY et SENLIS N°8<->PARIS/ROISSY (péage de Chamant)
//     donnent toutes deux 2,2 / 3,3 : c'est la même barrière, pas une approximation).
//
// AUMALE, HOCHFELDEN N°45 et CHARMONT-SOUS-BARBUISE N°22 restent volontairement
// NON geolocalisees : le point Google Maps resolu pour chacune tombe a moins de
// 60 m d'une gare existante avec un tarif DIFFERENT (Neufchâtel-en-Bray, Strasbourg,
// et une "CHARMONT (LIM.CONC)" visiblement mal placee sur un autre reseau/A89) —
// les ajouter risquerait une fusion "gares jumelles" (jum(), V246) donnant un
// prix faux. Ce test verifie qu'on ne les a PAS ajoutees par erreur.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');
const aprr = require('../peages-aprr.json');

function point(name) {
  const o = overlay.gares.find(g => g.nom === name);
  if (o) return o.points;
  const a = aprr.g.find(g => g[0] === name);
  return a ? a[1] : null;
}

const dist = (a, b, c, d) => {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

test('SENLIS N°8 and SENLIS now have official GPS points', () => {
  for (const name of ['SENLIS N°8', 'SENLIS']) {
    const pts = point(name);
    assert.ok(pts && pts.length, name + ' missing GPS');
    assert.equal(pts[0][0], 49.2070185);
    assert.equal(pts[0][1], 2.609396);
  }
});

test('PARIS / ROISSY (péage de Chamant) reuses the exact point of the already-geolocated PARIS / ROISSY gare', () => {
  const chamant = point('PARIS / ROISSY (péage de Chamant)');
  const roissy = point('PARIS / ROISSY');
  assert.ok(chamant && roissy, 'both must exist');
  assert.deepEqual(chamant, roissy);
});

test('newly-geolocated SANEF stations stay more than 0.3km from every other barriere/gare', () => {
  const allPts = [];
  aprr.g.forEach(g => g[1].forEach(p => allPts.push([g[0], p])));
  overlay.gares.forEach(g => g.points.forEach(p => allPts.push([g.nom, p])));
  const groups = [
    ['SENLIS N°8', 'SENLIS'],
    ['PARIS / ROISSY (péage de Chamant)', 'PARIS / ROISSY'],
  ];
  for (const group of groups) {
    const pt = point(group[0])[0];
    let minD = Infinity, minName = null;
    for (const [n, p] of allPts) {
      if (group.includes(n)) continue;
      const d = dist(pt[0], pt[1], p[0], p[1]);
      if (d < minD) { minD = d; minName = n; }
    }
    assert.ok(minD > 0.3, group[0] + ' too close to ' + minName + ': ' + minD.toFixed(3) + 'km');
  }
});

test('AUMALE, HOCHFELDEN N°45 and CHARMONT-SOUS-BARBUISE N°22 remain ungeolocated (collision risk, left for safety)', () => {
  for (const name of ['AUMALE', 'HOCHFELDEN N°45', 'CHARMONT-SOUS-BARBUISE N°22']) {
    assert.equal(point(name), null, name + ' should not have been geolocated yet');
  }
});

test('official SENLIS N°8 / PARIS-ROISSY fares already present in overlay.paires are untouched and still proven', () => {
  const row = overlay.paires.find(p => p[0] === 'SENLIS N°8' && p[1] === 'PARIS / ROISSY (péage de Chamant)');
  assert.ok(row, 'expected SANEF relation missing');
  assert.equal(row[2], 2.2);
  assert.equal(row[3], 3.3);
});
