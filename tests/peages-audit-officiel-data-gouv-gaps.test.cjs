'use strict';
// Audit de couverture complete (5 nov. 2026), demande explicite de Laurent :
// "verifier que TOUS les trajets possibles passent par un peage correctement
// calcule" -- c'est-a-dire detecter les barrieres officielles ABSENTES de toute
// notre base (ni tarifees, ni meme signalees comme "sans tarif connu"), qui
// pourraient faire calculer un prix FAUX (péage manquant, silencieusement omis)
// sur un trajet reel plutot qu'un refus explicite ("prix exact non disponible").
//
// Methode : comparer chaque point GPS du referentiel officiel
// data/gares-peage-officiel.json (data.gouv.fr, "Gares de peage du reseau
// routier national concede", MTE 2025, Licence Ouverte/ODC-BY, 1266
// enregistrements) a TOUS les points GPS deja connus par l'application
// (peages-aprr.json + peages-overlay.json + la liste UNK de routes-ui.js, qui
// signale deja volontairement les gares officielles sans tarif prouve). Tout
// point officiel a plus de 0,5km de CHACUN de ces points est un angle mort
// potentiel.
//
// Resultat (21 barrieres physiques distinctes identifiees) :
//   - 2 avaient deja un prix prouve sous un autre nom dans nos donnees, et
//     n'avaient besoin que d'un GPS : "VALLEE DE LA HEM" et "TARARE EST ENTREE
//     O"/"TARARE EST SORTIE O" (voir tests dedies). Resolues avec GPS, aucune
//     approximation.
//   - 19 restantes (reduites a 17 clusters physiques distincts) n'ont NI tarif
//     NI nom connu dans notre base : Audomarois B (secteur Saint-Omer/A26, a
//     0,6-0,7km de la gare tarifee "CALAIS" -- au-dela du seuil de detection de
//     barriere 0,3km, donc traite comme un point distinct plutot que fusionne),
//     St Michel amont (73), Cluses Aval (74), Dordives Est (77), Frejus Est
//     (83), Saint Witz (95), Le Mans Ouest (A11), Buchelay BPV et Dozule BPV
//     Nord (A13), Nangy (A40), BPV Nord Saugnacq-et-Muret et BPV Sud Castets
//     (A63), Gares de peage de Saint Germain (A75), Bouville (A150), Peage
//     Pont Tancarville (N182), Puymorens A-PO (N523), Peage Pont Normandie
//     (N1029). AUCUN tarif n'est invente pour elles : elles sont ajoutees a la
//     liste UNK de routes-ui.js, qui fait REFUSER le prix exact (plutot que
//     l'omettre silencieusement) a tout trajet qui en passe a moins de 500m --
//     exactement le mecanisme deja en place pour les autres gares officielles
//     sans tarif (cf. V265).
//
// Run: node --test tests/peages-audit-officiel-data-gouv-gaps.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');
const OFFICIEL = require('../data/gares-peage-officiel.json');

function dist(a, b, c, d) {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function extraireUNK() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes-ui.js'), 'utf8');
  const m = src.match(/const UNK = \[([\s\S]*?)\];/);
  assert.ok(m, 'UNK introuvable dans routes-ui.js');
  return JSON.parse('[' + m[1] + ']');
}

const NOUVEAUX_UNK = [
  [50.72292, 2.16534],   // Audomarois B (secteur Saint-Omer/A26, 0,6-0,7km de CALAIS -- distinct, pas fusionne)
  [50.7231, 2.16714],    // Audomarois B (second point, meme barriere)
  [45.21646, 6.46587],   // St Michel amont (A43, 73)
  [46.04951, 6.58714],   // Cluses Aval (A40, 74)
  [48.17145, 2.76708],   // Dordives Est (A77... secteur 77)
  [43.47233, 6.74324],   // Frejus Est (A8, 83)
  [49.08422, 2.55159],   // Saint Witz (A1, 95)
  [47.98195, 0.05435],   // Le Mans Ouest (A11)
  [48.98384, 1.68125],   // Buchelay BPV (A13)
  [49.23071, -0.07124],  // Dozule BPV Nord (A13)
  [46.15312, 6.29524],   // Nangy (A40)
  [44.34718, -0.86052],  // BPV Nord Saugnacq-et-Muret (A63)
  [43.83527, -1.18058],  // BPV Sud Castets (A63)
  [44.13405, 3.02553],   // Gares de peage de Saint Germain (A75)
  [49.54823, 0.92179],   // Bouville (A150)
  [49.46377, 0.47389],   // Peage Pont Tancarville (N182)
  [42.53961, 1.82396],   // Puymorens A-PO (N523)
  [49.44987, 0.27172],   // Peage Pont Normandie (N1029)
];

test('le referentiel officiel data.gouv.fr est bien present et plausible (1266 enregistrements)', () => {
  assert.equal(OFFICIEL.d.length, 1266);
  assert.match(OFFICIEL.src, /data\.gouv\.fr/);
});

test('VALLEE DE LA HEM et TARARE EST ENTREE/SORTIE O sont desormais couverts par un GPS (pas par UNK)', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  for (const n of ['VALLEE DE LA HEM', 'TARARE EST ENTREE O', 'TARARE EST SORTIE O']) {
    assert.ok(gareNames.has(n), n + ' devrait avoir une entree overlay.gares');
  }
});

test('les 17 barrieres officielles sans correspondance connue sont desormais dans UNK (routes-ui.js)', () => {
  const UNK = extraireUNK();
  for (const [lat, lon] of NOUVEAUX_UNK) {
    const min = Math.min(...UNK.map(([ulat, ulon]) => dist(lat, lon, ulat, ulon)));
    assert.ok(min < 0.05, 'point ' + lat + ',' + lon + ' absent de UNK (plus proche a ' + min.toFixed(3) + 'km)');
  }
});

test('audit complet : chaque point du referentiel officiel est a moins de 0,5km d\'un point connu (GPS aprr/overlay) ou de UNK', () => {
  const UNK = extraireUNK();
  const connus = [];
  for (const g of aprr.g) for (const p of g[1]) connus.push(p);
  for (const g of overlay.gares) for (const p of g.points) connus.push(p);
  for (const u of UNK) connus.push(u);
  const gaps = [];
  for (const [nom, route, lat, lon] of OFFICIEL.d) {
    let minD = Infinity;
    for (const p of connus) { const d = dist(lat, lon, p[0], p[1]); if (d < minD) minD = d; }
    if (minD > 0.5) gaps.push({ nom, route, lat, lon, minD: +minD.toFixed(3) });
  }
  assert.deepEqual(gaps, [], 'angles morts restants : ' + JSON.stringify(gaps));
});

test('aucun prix n\'a ete invente pour les points ajoutes a UNK (UNK ne porte jamais de tarif, seulement une position)', () => {
  const UNK = extraireUNK();
  for (const u of UNK) {
    assert.equal(u.length, 2, 'chaque entree UNK doit etre [lat, lon] uniquement, jamais de prix associe');
  }
});
