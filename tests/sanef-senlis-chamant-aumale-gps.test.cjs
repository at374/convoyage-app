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
// AUMALE : le point Google Maps resolu pour "Aumale" tombait en fait a 59 m de
// NEUFCHÂTEL-EN-BRAY (nom confondu avec "Péage d'Haudricourt", le vrai nom de la
// barriere Neufchâtel-en-Bray) — verifie par requete OSM/Overpass (session du
// 2026-11-04) : les noeuds barrier=toll_booth tagges "Aumale" forment un groupe
// distinct et coherent (3 noeuds) a ~325 m de la barriere "Péage d'Haudricourt"
// (= Neufchâtel-en-Bray), largement au-dela du seuil de fusion "gares jumelles"
// (0,06 km). Un 4e noeud "Aumale" isole, colocalise avec Haudricourt, a ete
// ecarte comme erreur de saisie OSM (incoherent avec les 3 autres). GPS retenu :
// centroide des 3 noeuds coherents (49.75800343, 1.69822863).
//
// HOCHFELDEN N°45 et CHARMONT-SOUS-BARBUISE N°22 restent volontairement NON
// geolocalisees : pour Hochfelden, la requete OSM renvoie des noeuds "Hochfelden"
// contradictoires (3 sur 5 a moins de 110 m de "Péage de Schwindratzheim" =
// Strasbourg, tarif different ; 1 seul a ~213 m) — signal trop ambigu pour
// trancher sans risque. Pour Charmont-sous-Barbuise, les requetes Overpass sur
// la zone sont restees sans reponse (serveur indisponible) ; a reprendre avec
// une autre source. Dans les deux cas, ajouter un point risquerait une fusion
// "gares jumelles" (jum(), V246) donnant un prix faux. Ce test verifie qu'on ne
// les a PAS ajoutees par erreur.
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

test('HOCHFELDEN N°45 and CHARMONT-SOUS-BARBUISE N°22 remain ungeolocated (ambiguous/unreachable source, left for safety)', () => {
  for (const name of ['HOCHFELDEN N°45', 'CHARMONT-SOUS-BARBUISE N°22']) {
    assert.equal(point(name), null, name + ' should not have been geolocated yet');
  }
});

test('AUMALE now has an OSM-verified GPS point, more than 0.3km from any other barriere/gare', () => {
  const pts = point('AUMALE');
  assert.ok(pts && pts.length, 'AUMALE missing GPS');
  assert.equal(pts[0][0], 49.75800343);
  assert.equal(pts[0][1], 1.69822863);
  const allPts = [];
  aprr.g.forEach(g => g[1].forEach(p => allPts.push([g[0], p])));
  overlay.gares.forEach(g => g.points.forEach(p => allPts.push([g.nom, p])));
  let minD = Infinity, minName = null;
  for (const [n, p] of allPts) {
    if (n === 'AUMALE') continue;
    const d = dist(pts[0][0], pts[0][1], p[0], p[1]);
    if (d < minD) { minD = d; minName = n; }
  }
  assert.ok(minD > 0.3, 'AUMALE too close to ' + minName + ': ' + minD.toFixed(3) + 'km');
});

test('AUMALE official SANEF fares (both exact-named directions) are present and proven', () => {
  const toBoulogne = overlay.paires.find(p => p[0] === 'BOULOGNE EST' && p[1] === 'AUMALE');
  assert.ok(toBoulogne, 'missing BOULOGNE EST <-> AUMALE');
  assert.equal(toBoulogne[2], 14.8);
  assert.equal(toBoulogne[3], 23.2);
  const toNeufchatel = overlay.paires.find(p => p[0] === 'AUMALE' && p[1] === 'NEUFCHÂTEL-EN-BRAY');
  assert.ok(toNeufchatel, 'missing AUMALE <-> NEUFCHÂTEL-EN-BRAY (exact gare name)');
  assert.equal(toNeufchatel[2], 1.2);
  assert.equal(toNeufchatel[3], 1.7);
});

test('official SENLIS N°8 / PARIS-ROISSY fares already present in overlay.paires are untouched and still proven', () => {
  const row = overlay.paires.find(p => p[0] === 'SENLIS N°8' && p[1] === 'PARIS / ROISSY (péage de Chamant)');
  assert.ok(row, 'expected SANEF relation missing');
  assert.equal(row[2], 2.2);
  assert.equal(row[3], 3.3);
});
