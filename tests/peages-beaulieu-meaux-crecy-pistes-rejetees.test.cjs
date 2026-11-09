'use strict';
// Pistes explorées le 9 nov. 2026 (recherche élargie dans gares-peage-2025.csv,
// data.gouv.fr) pour les dangling "BEAULIEU" et "MEAUX / CRECY" -- toutes deux
// REJETÉES, aucun prix ni GPS ajouté.
//
// 1. "BEAULIEU" (dangling, 7 relations : Chatellerault Nord/Sud, Futuroscope,
//    Poitiers Nord/Sud, Sainte Maure, Tours Centre (Sorigny) -- toutes des
//    destinations du corridor A10 Poitou). Le référentiel officiel contient
//    "Beaulieu Sur Layon" (Bpv, A87, dept 49, GPS ~47,3266/-0,6043) -- à <0,5km de
//    "Thouarcé" déjà intégré. REJETÉ : aucune des 7 destinations dangling de
//    "BEAULIEU" n'est sur l'A87/Anjou -- elles sont toutes sur l'A10, à une
//    centaine de km de là. Collision de nom (plusieurs lieux "Beaulieu" en
//    France), pas le même point physique.
//
// 2. "MEAUX / CRECY" (dangling, nombreuses relations dont "ST-JEAN-LES-DEUX-
//    JUMEAUX" déjà résolu). Le référentiel officiel contient "Saint Jean les Deux
//    Jumeaux Sortie/Entree" (Ech, dept 77, A140) -- confirme la justesse du GPS
//    déjà en base pour ST-JEAN-LES-DEUX-JUMEAUX (<0,1km), mais ne contient AUCUNE
//    entrée "Meaux" ou "Crécy" sous quelque forme que ce soit. Absence confirmée
//    dans la source la plus autoritative disponible -- "MEAUX / CRECY" reste
//    non résolu.
//
// Run: node --test tests/peages-beaulieu-meaux-crecy-pistes-rejetees.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('BEAULIEU reste dangling (collision de nom avec Beaulieu Sur Layon A87, corridors non apparentes)', () => {
  const names = new Set([...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom)]);
  assert.equal(names.has('BEAULIEU'), false);
  const rel = overlay.paires.filter(p => p[0] === 'BEAULIEU' || p[1] === 'BEAULIEU');
  const destinations = rel.map(p => (p[0] === 'BEAULIEU' ? p[1] : p[0]));
  for (const d of destinations) {
    assert.ok(!/layon|thouarce|anjou/i.test(d), d + ' ne doit pas etre un destination A87/Anjou (corridor incompatible)');
  }
});

test('ST-JEAN-LES-DEUX-JUMEAUX (deja resolu) correspond au point officiel, confirmant la justesse de la base', () => {
  function dist(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const g = overlay.gares.find(x => x.nom === 'ST-JEAN-LES-DEUX-JUMEAUX');
  assert.ok(g);
  const officiel = [48.95228, 3.038188];
  assert.ok(dist(g.points[0], officiel) < 0.1);
});

test('MEAUX / CRECY reste dangling (absent du referentiel officiel des 1266 gares)', () => {
  const names = new Set([...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom)]);
  assert.equal(names.has('MEAUX / CRECY'), false);
  const rel = overlay.paires.some(p => p[0] === 'MEAUX / CRECY' || p[1] === 'MEAUX / CRECY');
  assert.ok(rel, 'les relations dangling doivent rester presentes, non fusionnees');
});
