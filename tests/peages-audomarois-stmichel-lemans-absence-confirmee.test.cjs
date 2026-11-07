'use strict';
// Confirmation du 6 nov. 2026 : pour les 3 derniers angles morts de l'audit
// data.gouv.fr (Audomarois B, St Michel amont, Le Mans Ouest -- voir
// tests/peages-audit-officiel-data-gouv-gaps.test.cjs et
// tests/peages-unk-type-ech-vs-bpv.test.cjs), Laurent a fourni localement les
// grilles tarifaires officielles COMPLETES des trois exploitants concernes
// (SANEF/A26, AREA/A43, COFIROUTE/A11-A28-A85). Verification faite : aucun des
// trois n'apparait nulle part dans la grille complete de son reseau, sous AUCUN
// nom (ni le nom officiel data.gouv.fr, ni une variante proche).
//
// Ce n'est donc plus "je n'ai pas trouve de source" (lacune de recherche) mais
// "la source officielle complete ne publie aucun tarif a ce point" (absence
// confirmee) -- coherent avec leur type "Ech" (echangeur sans tarif de
// barriere propre, cf. tests/peages-unk-type-ech-vs-bpv.test.cjs). A la
// difference de "Frejus Est" (meme type Ech, mais UNE relation point-a-point
// existe bel et bien dans la grille ESCOTA -- voir
// tests/peages-frejus-est-escota.test.cjs), ces 3 points n'ont realise AUCUNE
// relation nulle part dans leur grille respective.
//
// Sources locales utilisees pour cette verification (fournies par Laurent,
// dossiers "Robot Peages Ultra" / extraction scratchpad) :
//   - SANEF : 2026_02-Grille-Sanef.pdf (texte brut extrait, 6 pages, grille
//     complete A1/A2/A16/A26/A29, section "CALAIS (peage de Setques)").
//   - AREA : TARIFS_AREA_public.pdf -> area_public.txt (extraction complete).
//   - COFIROUTE : Tarifs_Cofiroute_Arcour.txt (722 Ko, grille complete
//     A11/A28/A85, tous les echangeurs numerotes).
//
// Decision : aucun tarif ajoute pour ces 3 points (en ajouter un serait une
// approximation interdite). Ils restent dans UNK, qui est desormais la
// representation CONFIRMEE correcte (pas provisoire).
//
// Run: node --test tests/peages-audomarois-stmichel-lemans-absence-confirmee.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

function lireUNK() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes-ui.js'), 'utf8');
  const m = src.match(/const UNK = \[([\s\S]*?)\];/);
  assert.ok(m, 'UNK introuvable dans routes-ui.js');
  return JSON.parse('[' + m[1] + ']');
}

function dist(a, b, c, d) {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const TOUJOURS_BLOQUES = [
  ['Audomarois B', 50.72292, 2.16534],
  ['Audomarois B (2e point)', 50.7231, 2.16714],
  ['St Michel amont', 45.21646, 6.46587],
  ['Le Mans Ouest', 47.98195, 0.05435],
];

test('les 3 points a absence confirmee restent dans UNK', () => {
  const UNK = lireUNK();
  for (const [nom, lat, lon] of TOUJOURS_BLOQUES) {
    const min = Math.min(...UNK.map(([ulat, ulon]) => dist(lat, lon, ulat, ulon)));
    assert.ok(min < 0.05, nom + ' devrait etre dans UNK, plus proche a ' + min.toFixed(3) + 'km');
  }
});

test('"Frejus Est" (resolu, absence non confirmee -- un prix existe) n\'est PAS dans cette categorie', () => {
  // Garde de regression : s'assurer que la distinction entre "resolu" et
  // "absence confirmee" reste correcte si la liste ci-dessus est modifiee.
  assert.ok(!TOUJOURS_BLOQUES.some(([, lat, lon]) => lat === 43.47233 && lon === 6.74324));
});

test('aucun prix n\'a ete invente pour ces 3 points (overlay.paires/gares ne les contient pas)', () => {
  const overlay = require('../peages-overlay.json');
  const noms = ['Audomarois B', 'St Michel amont', 'Le Mans Ouest'];
  for (const n of noms) {
    assert.ok(!overlay.gares.some(g => g.nom === n), n + ' ne doit pas avoir d\'entree overlay.gares (aucun tarif a lui attacher)');
    assert.ok(!overlay.paires.some(p => p[0] === n || p[1] === n), n + ' ne doit avoir aucune relation point-a-point');
  }
});
