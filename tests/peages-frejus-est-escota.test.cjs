'use strict';
// Resolution du 6 nov. 2026 : "Frejus Est" (A8, angle mort de l'audit data.gouv.fr,
// voir tests/peages-audit-officiel-data-gouv-gaps.test.cjs et
// tests/peages-unk-type-ech-vs-bpv.test.cjs) sort de UNK.
//
// Source : grille tarifaire ESCOTA 2026 complete (A8/A52/A57/A50/A51), fournie
// localement par Laurent (fichier texte extrait d'un PDF officiel ESCOTA). Avant
// d'accepter la nouvelle relation, le fichier entier a ete valide contre
// overlay.paires existant : 123 relations deja PROUVE correspondent EXACTEMENT
// (0 divergence), ce qui confirme que le fichier est une extraction fidele de la
// grille officielle (pas une approximation ni une hallucination).
//
// La grille place "FREJUS EST" entre "PUGET SUR ARGENS" et "MANDELIEU" dans la
// chaine ESCOTA (A8;FREJUS EST;A8;MANDELIEU;3,0;4,7;7,0;10,2;1,7 -- classe1=3,0,
// classe2=4,7). Une seule relation est donnee pour FREJUS EST (vers MANDELIEU) :
// ce schema (un seul lien direct, pas de chaine retour vers les gares anterieures)
// est le meme que celui observe pour "PUGET SUR ARGENS" plus haut dans la meme
// grille -- coherent avec une paire entree/sortie ouverte au meme echangeur que
// "Frejus Ouest" (deja connue), pas une incoherence d'extraction.
//
// Verifications avant ajout :
//   - GPS officiel data.gouv.fr de "Frejus Est" : 43.47233,6.74324 (type "Ech").
//   - Distance a "Frejus Ouest" (deja connue, GPS aprr.g) : 1,16-1,23 km --
//     au-dela du seuil de fusion-jumelle (0,06 km) ET du seuil de detection de
//     barriere (0,3 km) : point physiquement distinct, pas un doublon.
//   - Distance a Mandelieu (destination du prix) : 17,6-18,0 km -- aucun risque
//     de confusion avec Frejus Ouest<->Mandelieu (meme prix car meme bande de
//     distance : Frejus Ouest<->Mandelieu = 3,0/4,7 aussi, deja dans overlay.
//     paires, coherent et non suspect : Frejus Est et Frejus Ouest ne sont qu'a
//     1,2 km l'un de l'autre, donc une distance quasi identique vers Mandelieu,
//     d'ou le meme prix arrondi -- pas une erreur d'extraction).
//   - Aucune overlay.barriere a proximite (la plus proche, escota-la-turbie, est
//     a 61 km) : aucun risque de double facturation barriere + point-a-point.
//
// Run: node --test tests/peages-frejus-est-escota.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function dist(a, b, c, d) {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function lireUNK() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes-ui.js'), 'utf8');
  const m = src.match(/const UNK = \[([\s\S]*?)\];/);
  assert.ok(m, 'UNK introuvable dans routes-ui.js');
  return JSON.parse('[' + m[1] + ']');
}

test('"Frejus Est" a maintenant un GPS verifie dans overlay.gares', () => {
  const g = overlay.gares.find(x => x.nom === 'Frejus Est');
  assert.ok(g, 'Frejus Est devrait exister dans overlay.gares');
  assert.equal(g.points.length, 1);
  assert.equal(g.points[0][0], 43.47233);
  assert.equal(g.points[0][1], 6.74324);
});

test('"Frejus Est" <-> Mandelieu est PROUVE a 3,0/4,7 (source ESCOTA 2026 locale)', () => {
  const p = overlay.paires.find(x => (x[0] === 'Frejus Est' && x[1] === 'Mandelieu') || (x[1] === 'Frejus Est' && x[0] === 'Mandelieu'));
  assert.ok(p, 'la relation Frejus Est <-> Mandelieu doit exister');
  assert.equal(p[2], 3.0);
  assert.equal(p[3], 4.7);
});

test('"Frejus Est" est a plus de 0,3km de "Frejus Ouest" (point distinct, pas un doublon)', () => {
  const fo = aprr.g.find(x => x[0] === 'Frejus Ouest');
  assert.ok(fo, 'Frejus Ouest devrait exister dans peages-aprr.json');
  const fe = overlay.gares.find(x => x.nom === 'Frejus Est').points[0];
  for (const p of fo[1]) {
    const d = dist(fe[0], fe[1], p[0], p[1]);
    assert.ok(d > 0.3, 'Frejus Est devrait etre a plus de 0,3km de Frejus Ouest, trouve ' + d.toFixed(3) + 'km');
  }
});

test('"Frejus Est" est retire de UNK (ne bloque plus le prix exact)', () => {
  const UNK = lireUNK();
  const min = Math.min(...UNK.map(([lat, lon]) => dist(43.47233, 6.74324, lat, lon)));
  assert.ok(min > 0.05, 'Frejus Est ne doit plus etre dans UNK, trouve a ' + min.toFixed(3) + 'km');
});

test('aucune barriere a proximite de Frejus Est (pas de risque de double facturation)', () => {
  let minD = Infinity;
  for (const b of overlay.barrieres) for (const p of b.points) {
    const d = dist(43.47233, 6.74324, p[0], p[1]);
    if (d < minD) minD = d;
  }
  assert.ok(minD > 0.5, 'aucune barriere ne doit etre a moins de 0,5km de Frejus Est, trouve a ' + minD.toFixed(3) + 'km');
});
