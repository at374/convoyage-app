'use strict';
// "TARARE EST ENTREE O" <-> "TARARE EST SORTIE O" (1,8/2,8, A89, 5 nov. 2026) :
// confirme comme points de systeme ouvert, physiquement DISTINCTS de la gare
// fermee deja geolocalisee "Tarare Est F", et desormais GEOLOCALISES.
//
// Preuve de la distinction (C2-TARIFS-WEB-2026-maille_maj062026.pdf, page 8,
// texte brut extrait via pdfplumber par positions de caracteres -- la grille
// triangulaire a en-tetes pivotes est illisible par pdftotext/extract_text()
// standard) : la legende de la grille mentionne explicitement deux peages
// distincts au meme echangeur :
//   "Tarare est (peage en systeme ouvert)" et "Tarare est (peage en systeme ferme)".
// Le "O" dans "TARARE EST ENTREE O" / "TARARE EST SORTIE O" designe donc "Ouvert"
// (systeme ouvert), PAS "Ouest" comme on pourrait le supposer par analogie avec
// "Tarare Ouest" (gare distincte, deja geolocalisee, a l'autre bout de la section).
//
// GPS resolu le 5 nov. 2026 via le referentiel officiel data.gouv.fr
// (gares-peage-officiel.json, MTE 2025) : "Tarare Est ouvert E" (Entree) a
// 45.87626,4.52199 et "Tarare Est ouvert S" (Sortie) a 45.87638,4.5221 -- a
// 1,13km/1,14km de "Tarare Est F", largement au-dela du seuil de detection de
// barriere (0,3km) : point physiquement distinct confirme, pas un doublon. Voir
// tests/peages-audit-officiel-data-gouv-gaps.test.cjs pour la methode d'audit
// complete.
//
// Run: node --test tests/peages-tarare-est-ouvert-ferme.test.cjs
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

test('"Tarare Est F" (systeme ferme) already has verified GPS', () => {
  const g = aprr.g.find(x => x[0] === 'Tarare Est F');
  assert.ok(g, '"Tarare Est F" missing from peages-aprr.json');
  assert.ok(Array.isArray(g[1]) && g[1].length >= 1);
});

test('"TARARE EST ENTREE O" and "TARARE EST SORTIE O" now have verified GPS (data.gouv.fr), clear of "Tarare Est F"', () => {
  const ferme = aprr.g.find(x => x[0] === 'Tarare Est F')[1][0];
  for (const n of ['TARARE EST ENTREE O', 'TARARE EST SORTIE O']) {
    const g = overlay.gares.find(x => x.nom === n);
    assert.ok(g, n + ' should now have a gare entry');
    const [lat, lon] = g.points[0];
    const d = dist([lat, lon], ferme);
    assert.ok(d > 0.3, n + ' should be beyond 0.3km of Tarare Est F, got ' + d.toFixed(4) + 'km');
  }
});

test('the ENTREE O <-> SORTIE O relation is isolated (no overlap with any other geolocated Tarare gare)', () => {
  function dests(n) {
    return overlay.paires.filter(p => p[0] === n || p[1] === n).map(p => p[0] === n ? p[1] : p[0]);
  }
  assert.deepEqual(dests('TARARE EST ENTREE O'), ['TARARE EST SORTIE O']);
  assert.deepEqual(dests('TARARE EST SORTIE O'), ['TARARE EST ENTREE O']);
});

test('no price was fabricated or altered (sample)', () => {
  const p = overlay.paires.find(x => (x[0] === 'TARARE EST ENTREE O' && x[1] === 'TARARE EST SORTIE O') || (x[1] === 'TARARE EST ENTREE O' && x[0] === 'TARARE EST SORTIE O'));
  assert.ok(p);
  assert.equal(p[2], 1.8);
  assert.equal(p[3], 2.8);
});
