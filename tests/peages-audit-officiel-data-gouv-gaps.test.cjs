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
// enregistrements) a TOUS les points GPS deja connus par l'application :
// peages-aprr.json + peages-overlay.json.gares (mecanisme gareProche/paires) +
// peages-overlay.json.barrieres (mecanisme barrieresTraversees/tarifs, SEPARE
// -- IMPORTANT, voir l'erreur ci-dessous) + la liste UNK de routes-ui.js.
//
// ERREUR DE METHODE CORRIGEE LE MEME JOUR : la toute premiere passe de cet audit
// avait compare les points officiels au GPS connu SANS inclure
// overlay.barrieres, et avait donc ajoute a tort 11 points a UNK qui etaient
// DEJA correctement tarifes via ce mecanisme separe (Cluses Aval, Dordives Est,
// Saint Witz, Nangy, BPV Nord Saugnacq-et-Muret, BPV Sud Castets, Gares de
// Saint Germain, Bouville, Peage Pont Tancarville, Peage Pont Normandie,
// Puymorens A-PO). Les y laisser aurait BLOQUE a tort le calcul de trajets deja
// correctement tarifes -- l'inverse exact de l'objectif. Corrige en retirant ces
// 11 points de UNK.
//
// Resultat final (apres correction) :
//   - 2 barrieres avaient deja un prix prouve (point-a-point) sous leur propre
//     nom, et n'avaient besoin que d'un GPS : "VALLEE DE LA HEM" et "TARARE EST
//     ENTREE O"/"TARARE EST SORTIE O" (voir tests dedies). Resolues avec GPS,
//     aucune approximation.
//   - BUG DECOUVERT EN RESOLVANT "VALLEE DE LA HEM" : une fausse entree
//     "barriere" ("sanef-vallee-de-la-hem-2", tarifs flat c1=1,3/c2=2,0)
//     dupliquait EXACTEMENT la relation point-a-point deja existante
//     CALAIS<->VALLEE DE LA HEM (1,3/2,0, meme source). En ajoutant le GPS de
//     VALLEE DE LA HEM a overlay.gares, les DEUX mecanismes (gareProche/paires
//     ET barrieresTraversees/tarifs) seraient devenus actifs simultanement pour
//     le meme point physique -- risque de double facturation explicitement
//     signale dans les regles du projet. Corrige en supprimant la fausse entree
//     barriere (et ses 5 tarifs), en gardant la relation point-a-point
//     (complete, 15 relations, deja prouvee) comme unique source de prix.
//   - 6 points restent de VERITABLES angles morts (aucun tarif nulle part) :
//     Audomarois B (secteur Saint-Omer/A26), St Michel amont (A43), Fréjus Est
//     (A8), Le Mans Ouest (A11), Buchelay BPV et Dozulé BPV Nord (A13). AUCUN
//     tarif n'est invente pour eux : ajoutes a UNK (routes-ui.js), qui fait
//     REFUSER le prix exact (plutot que l'omettre silencieusement) a tout
//     trajet qui en passe a moins de 500m -- exactement le mecanisme deja en
//     place pour les autres gares officielles sans tarif (cf. V265).
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

// Les seuls 6 points genuinement sans tarif (ajoutes a UNK).
const NOUVEAUX_UNK = [
  [50.72292, 2.16534],   // Audomarois B (secteur Saint-Omer/A26, 0,6-0,7km de CALAIS -- distinct, pas fusionne)
  [50.7231, 2.16714],    // Audomarois B (second point, meme barriere)
  [45.21646, 6.46587],   // St Michel amont (A43, 73)
  [43.47233, 6.74324],   // Fréjus Est (A8, 83)
  [47.98195, 0.05435],   // Le Mans Ouest (A11)
  [48.98384, 1.68125],   // Buchelay BPV (A13)
  [49.23071, -0.07124],  // Dozule BPV Nord (A13)
];

// Barrieres deja presentes et deja tarifees via overlay.barrieres/overlay.tarifs
// AVANT cet audit, que la premiere passe erronee avait a tort traitees comme
// des angles morts. Ce test garde la preuve que ces 10 barrieres restent
// correctement couvertes et absentes de UNK (ne doivent jamais y etre).
const DEJA_TARIFEES_BARRIERE = [
  { id: 'atmb-cluses-aval', point: [46.04951, 6.58714] },
  { id: 'aprr-ouvert-dordives', point: [48.1725312, 2.7664017] },
  { id: 'sanef-survilliers-saint-witz-7', point: [49.08422, 2.55159] },
  { id: 'atmb-nangy', point: [46.15312, 6.29524] },
  { id: 'atlandes-saugnacq-et-muret', point: [44.34718, -0.86052] },
  { id: 'atlandes-castets', point: [43.83527, -1.18058] },
  { id: 'cevm-saint-germain', point: [44.13405, 3.02553] },
  { id: 'albea-bouville', point: [49.54823, 0.92179] },
  { id: 'pont-tancarville', point: [49.46377, 0.47389] },
  { id: 'pont-normandie', point: [49.44987, 0.27172] },
  { id: 'tunnel-puymorens', point: [42.53961, 1.82396] },
];

test('le referentiel officiel data.gouv.fr est bien present et plausible (1266 enregistrements)', () => {
  assert.equal(OFFICIEL.d.length, 1266);
  assert.match(OFFICIEL.src, /data\.gouv\.fr/);
});

test('VALLEE DE LA HEM et TARARE EST ENTREE/SORTIE O sont desormais couverts par un GPS (point-a-point, pas par UNK)', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  for (const n of ['VALLEE DE LA HEM', 'TARARE EST ENTREE O', 'TARARE EST SORTIE O']) {
    assert.ok(gareNames.has(n), n + ' devrait avoir une entree overlay.gares');
  }
});

test('le doublon "sanef-vallee-de-la-hem-2" (barriere flat dupliquant CALAIS<->VALLEE DE LA HEM) a ete supprime', () => {
  assert.ok(!overlay.barrieres.some(b => b.id === 'sanef-vallee-de-la-hem-2'), 'la fausse barriere doit avoir ete retiree');
  assert.ok(!overlay.tarifs.some(t => t.b === 'sanef-vallee-de-la-hem-2'), 'ses tarifs doivent avoir ete retires');
  const p = overlay.paires.find(x => (x[0] === 'CALAIS' && x[1] === 'VALLEE DE LA HEM') || (x[1] === 'CALAIS' && x[0] === 'VALLEE DE LA HEM'));
  assert.ok(p, 'la relation point-a-point CALAIS<->VALLEE DE LA HEM doit rester (seule source de prix pour ce trajet)');
  assert.equal(p[2], 1.3);
  assert.equal(p[3], 2);
});

test('les 10 barrieres deja correctement tarifees ne sont PAS dans UNK (ne jamais bloquer un trajet deja correctement calcule)', () => {
  const UNK = extraireUNK();
  for (const { id, point } of DEJA_TARIFEES_BARRIERE) {
    const b = overlay.barrieres.find(x => x.id === id);
    assert.ok(b, id + ' devrait exister dans overlay.barrieres');
    const t = overlay.tarifs.filter(x => x.b === id);
    assert.ok(t.length > 0, id + ' devrait avoir des tarifs');
    const min = Math.min(...UNK.map(([ulat, ulon]) => dist(point[0], point[1], ulat, ulon)));
    assert.ok(min > 0.5, id + ' ne doit pas etre dans UNK (deja tarife), trouve a ' + min.toFixed(3) + 'km');
  }
});

test('les 6 veritables angles morts (aucun tarif nulle part) sont desormais dans UNK (routes-ui.js)', () => {
  const UNK = extraireUNK();
  for (const [lat, lon] of NOUVEAUX_UNK) {
    const min = Math.min(...UNK.map(([ulat, ulon]) => dist(lat, lon, ulat, ulon)));
    assert.ok(min < 0.05, 'point ' + lat + ',' + lon + ' absent de UNK (plus proche a ' + min.toFixed(3) + 'km)');
  }
});

test('audit complet : chaque point du referentiel officiel est a moins de 0,5km d\'un point connu (GPS aprr/overlay.gares/overlay.barrieres) ou de UNK', () => {
  const UNK = extraireUNK();
  const connus = [];
  for (const g of aprr.g) for (const p of g[1]) connus.push(p);
  for (const g of overlay.gares) for (const p of g.points) connus.push(p);
  for (const b of overlay.barrieres) for (const p of b.points) connus.push(p);
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
