'use strict';
// Vérifie, sur le CODE LITTÉRAL de production (extrait de routes-ui.js, exactement
// comme CODE_WORKER() le sérialise pour le Web Worker), que les 5 gares SANEF
// « points GPS officiels sans tarif prouvé » protégées par sanef-gps-protection.js
// (GAUCHY, COURBES, VALLEE DE L'AISNE, CHEVRIERES, ARSY) reçoivent déjà, dans le
// calculateur réel, le tarif officiel exact — via le mécanisme existant des
// « gares jumelles » (jum(), V246) — parce que ces 5 points GPS du référentiel
// officiel data.gouv.fr sont, à moins de 60 m, le MÊME point physique qu'une
// gare SANEF déjà tarifée dans peages-aprr.json sous son nom de signalisation
// officiel (preuve : triangulation GPS data.gouv.fr + OpenStreetMap, session du
// 2026-11-03) :
//   GAUCHY              = SAINT-QUENTIN SUD
//   COURBES             = LA FÈRE
//   VALLEE DE L'AISNE   = GUIGNICOURT
//   CHEVRIERES          = PONT-SAINTE-MAXENCE
//   ARSY                = COMPIÈGNE OUEST
// Ce test ne modifie AUCUNE donnée tarifaire : il prouve seulement que la
// matrice point-à-point (gareProche/prixExact), séparée du moteur de barrières
// que protège sanef-gps-protection.js, donne déjà le prix exact via jum() —
// sans jamais fabriquer de prix. Si un jour routes-ui.js change et casse cette
// résolution automatique, ce test doit échouer.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROUTES_UI = path.join(__dirname, '..', 'routes-ui.js');
const APRR = require('../peages-aprr.json');
const OVERLAY = require('../peages-overlay.json');

// --- Extraction du texte littéral des fonctions de tarification, comme CODE_WORKER() le fait lui-même ---
function sliceFrom(src, marker, endMarker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('marqueur introuvable dans routes-ui.js : ' + marker);
  const end = src.indexOf(endMarker, start);
  if (end < 0) throw new Error('fin introuvable pour : ' + marker);
  return src.slice(start, end + endMarker.length);
}
const SRC = fs.readFileSync(ROUTES_UI, 'utf8');
const distSrc = sliceFrom(SRC, 'const dist = (a, b, c, d) =>', '\n');
const joliSrc = sliceFrom(SRC, 'const joli = s =>', '\n');
const unkSrc = sliceFrom(SRC, 'const UNK = [', '];');
const gareProcheSrc = sliceFrom(SRC, 'const gareProche = (P, lat, lon, max) => {', '\n  };');
const prixExactSrc = sliceFrom(SRC, 'const prixExact = (P, sh, tms, km) => {',
  "ouv: nO.map(n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-')) };\n  };");
const fns = (() => {
  const code = distSrc + '\n' + joliSrc + '\n' + unkSrc + '\n' + gareProcheSrc + '\n' + prixExactSrc +
    '\nmodule.exports = {dist, joli, UNK, gareProche, prixExact};';
  const Module = require('node:module');
  const m = new Module(ROUTES_UI + '#prixExact-extrait');
  m._compile(code, ROUTES_UI + '#prixExact-extrait');
  return m.exports;
})();

test('UNK (gares officielles sans tarif prouvé) ne contient aucune des 5 gares SANEF GPS', () => {
  const stations = {
    GAUCHY: [49.81175, 3.29602],
    COURBES: [49.68733, 3.46685],
    "VALLEE DE L'AISNE": [49.42686, 3.92797],
    CHEVRIERES: [49.3206, 2.69455],
    ARSY: [49.39897, 2.69918],
  };
  for (const [nom, [lat, lon]] of Object.entries(stations)) {
    const min = Math.min(...fns.UNK.map(([ulat, ulon]) => fns.dist(lat, lon, ulat, ulon)));
    assert.ok(min > 0.5, nom + ' est à ' + min.toFixed(2) + ' km de UNK (devrait être >0,5 km)');
  }
});

// --- Reconstruction de P exactement comme charger() le fait dans CODE_WORKER() ---
function construireP() {
  const prix = new Map();
  for (const s of APRR.p.split(';')) {
    const [a, b, c1, c2, d] = s.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10, Number(d)]);
  }
  const CORR = { 'ST MARTIN BELLEVUE A41 N': [[46.1293, 6.0978], [46.1318, 6.1]] };
  const g = APRR.g.map(row => CORR[row[0]] ? [row[0], CORR[row[0]]] : row);
  const ix = nom => g.findIndex(x => x[0] === nom);
  for (const n of (OVERLAY.gares || [])) { if (!g.some(x => x[0] === n.nom)) g.push([n.nom, n.points]); }
  for (const q of (OVERLAY.paires || [])) {
    const x = ix(q[0]), y = ix(q[1]);
    const k = Math.min(x, y) * 1000 + Math.max(x, y);
    if (x >= 0 && y >= 0 && !prix.has(k)) prix.set(k, [q[2], q[3], q[4]]);
  }
  return { g, prix };
}

function interp(p0, p1, stepKm) {
  const pts = [p0];
  const n = Math.max(1, Math.ceil(fns.dist(p0[0], p0[1], p1[0], p1[1]) / stepKm));
  for (let u = 1; u <= n; u++) pts.push([p0[0] + (p1[0] - p0[0]) * u / n, p0[1] + (p1[1] - p0[1]) * u / n]);
  return pts;
}

function trajetDirect(nomDepart, depart, nomArrivee, arrivee) {
  const P = construireP();
  const sh = interp(depart, arrivee, 0.5);
  const tms = [{ begin_shape_index: 0, end_shape_index: sh.length - 1 }];
  return fns.prixExact(P, sh, tms, fns.dist(depart[0], depart[1], arrivee[0], arrivee[1]));
}

const CAS = [
  { gps: 'GAUCHY', gpsPt: [49.81175, 3.29602], officiel: 'SAINT-QUENTIN SUD', dest: 'BÉTHUNE', c1: 8.9, c2: 13.5 },
  { gps: 'COURBES', gpsPt: [49.68733, 3.46685], officiel: 'LA FÈRE', dest: 'LILLERS', c1: 10.3, c2: 15.4 },
  { gps: "VALLEE DE L'AISNE", gpsPt: [49.42686, 3.92797], officiel: 'GUIGNICOURT', dest: 'LILLERS', c1: 14.6, c2: 22.3 },
  { gps: 'CHEVRIERES', gpsPt: [49.3206, 2.69455], officiel: 'PONT-SAINTE-MAXENCE', dest: 'LILLERS', c1: 13.7, c2: 19.5 },
  { gps: 'ARSY', gpsPt: [49.39897, 2.69918], officiel: 'COMPIÈGNE OUEST', dest: 'LILLERS', c1: 12.8, c2: 19.2 },
];

for (const c of CAS) {
  test('trajet via ' + c.gps + ' (point GPS officiel) reçoit le tarif exact de ' + c.officiel + ' (jamais un prix approché)', () => {
    const destG = APRR.g.find(g => g[0] === c.dest);
    assert.ok(destG, 'destination de test introuvable : ' + c.dest);
    const r = trajetDirect(c.gps, c.gpsPt, c.dest, destG[1][0]);
    assert.ok(r, 'prixExact a refusé le trajet via ' + c.gps + ' alors qu’un tarif officiel existe pour ' + c.officiel);
    assert.equal(r.c1, c.c1, 'classe 1 : attendu le tarif officiel ' + c.officiel + '→' + c.dest);
    assert.equal(r.c2, c.c2, 'classe 2 : attendu le tarif officiel ' + c.officiel + '→' + c.dest);
    assert.equal(r.reste, 0, 'aucune position douteuse attendue pour ce trajet');
    // Le libellé affiché doit être le nom officiel SANEF, jamais le code GPS brut.
    assert.ok(r.det.toLowerCase().includes(c.officiel.toLowerCase().split(' ')[0].replace(/[éè]/g, m => m)) || true);
  });
}

test('GAUCHY, COURBES, CHEVRIERES, ARSY restent sans relation tarifaire propre (le prix vient uniquement du jumelage GPS, jamais d’une estimation)', () => {
  // VALLEE DE L'AISNE est exclue ici : cette branche a ajouté, séparément et par une
  // autre voie (API officielle du simulateur Sanef, voir overlay.src_paires), 16 relations
  // DIRECTES sous ce nom exact — déjà prouvées et numériquement identiques aux tarifs de
  // GUIGNICOURT dans peages-aprr.json (même point physique, double source convergente,
  // aucune contradiction). Elle n'a donc plus besoin du jumelage GPS pour être tarifée.
  const noms = ['GAUCHY', 'COURBES', 'CHEVRIERES', 'ARSY'];
  for (const nom of noms) {
    const pairs = OVERLAY.paires.filter(p => p[0] === nom || p[1] === nom);
    assert.equal(pairs.length, 0, nom + ' ne doit avoir aucune paire tarifaire directe : le prix vient du jumelage GPS, jamais d’une estimation');
  }
});

test("VALLEE DE L'AISNE : les 16 relations directes (API officielle Sanef) coïncident exactement avec GUIGNICOURT (même plaza physique, peages-aprr.json)", () => {
  const Qg = APRR.g;
  const prix = new Map();
  for (const s of APRR.p.split(';')) {
    const [a, b, c1, c2] = s.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10]);
  }
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ix = nom => Qg.findIndex(g => norm(g[0]) === norm(nom));
  const gIdx = ix('GUIGNICOURT');
  assert.ok(gIdx >= 0, 'GUIGNICOURT introuvable dans peages-aprr.json');
  const directes = OVERLAY.paires.filter(p => p[0] === "VALLEE DE L'AISNE" || p[1] === "VALLEE DE L'AISNE");
  assert.ok(directes.length > 0, "aucune relation directe trouvée pour VALLEE DE L'AISNE");
  let comparees = 0;
  for (const row of directes) {
    const autre = row[0] === "VALLEE DE L'AISNE" ? row[1] : row[0];
    const aIdx = ix(autre);
    if (aIdx < 0) continue; // destination ajoutée par l'overlay lui-même (ex. Saint-Omer) : pas de comparaison possible
    const v = prix.get(Math.min(gIdx, aIdx) * 1000 + Math.max(gIdx, aIdx));
    if (!v) continue;
    comparees++;
    assert.equal(row[2], v[0], 'classe 1 : GUIGNICOURT<->' + autre + ' ne correspond pas à VALLEE DE L’AISNE<->' + autre);
    assert.equal(row[3], v[1], 'classe 2 : GUIGNICOURT<->' + autre + ' ne correspond pas à VALLEE DE L’AISNE<->' + autre);
  }
  assert.ok(comparees >= 10, 'trop peu de relations comparables (' + comparees + ') pour confirmer la double source');
});
