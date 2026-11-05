'use strict';
// "TARARE EST ENTREE O" <-> "TARARE EST SORTIE O" (1,8/2,8, A89, 5 nov. 2026) :
// confirme comme points de systeme ouvert non physiques, PAS des points geographiques
// distincts de la gare fermee deja geolocalisee "Tarare Est F".
//
// Preuve (C2-TARIFS-WEB-2026-maille_maj062026.pdf, page 8, texte brut extrait via
// pdfplumber par positions de caracteres -- la grille triangulaire a en-tetes
// pivotes est illisible par pdftotext/extract_text() standard) : la legende de la
// grille mentionne explicitement deux peages distincts au meme echangeur :
//   "Tarare est (peage en systeme ouvert)" et "Tarare est (peage en systeme ferme)".
// Le "O" dans "TARARE EST ENTREE O" / "TARARE EST SORTIE O" designe donc "Ouvert"
// (systeme ouvert), PAS "Ouest" comme on pourrait le supposer par analogie avec
// "Tarare Ouest" (gare distincte, deja geolocalisee, a l'autre bout de la section).
// Entree/Sortie du systeme ouvert ne correspondent à aucune coordonnee GPS propre
// (comme les marqueurs LIMITE/ORIGINE, BRIVE, A9: ESPAGNE deja documentes) -- la
// relation est isolee (aucun recoupement avec "Tarare Est F", "Tarare Ouest" ou
// toute autre gare deja geolocalisee), donc aucune preuve de prix possible non plus.
// Reste volontairement sans GPS.
//
// Run: node --test tests/peages-tarare-est-ouvert-ferme.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('"Tarare Est F" (systeme ferme) already has verified GPS', () => {
  const g = aprr.g.find(x => x[0] === 'Tarare Est F');
  assert.ok(g, '"Tarare Est F" missing from peages-aprr.json');
  assert.ok(Array.isArray(g[1]) && g[1].length >= 1);
});

test('"TARARE EST ENTREE O" and "TARARE EST SORTIE O" (systeme ouvert) were deliberately left without GPS', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  for (const n of ['TARARE EST ENTREE O', 'TARARE EST SORTIE O']) {
    assert.equal(gareNames.has(n), false, n + ' must not have a gare entry');
    const stillDangling = overlay.paires.some(p => p[0] === n || p[1] === n);
    assert.ok(stillDangling, n + ' should still be present, unmerged');
  }
});

test('the ENTREE O <-> SORTIE O relation is isolated (no overlap with any geolocated Tarare gare)', () => {
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
