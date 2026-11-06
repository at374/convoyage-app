'use strict';
// Verification exhaustive de la grille AREA complete (6 nov. 2026), suite a
// "Continue cherche bien" / "Continue". Fichier officiel local
// TARIFS_AREA_public.pdf -> area_public.txt (extraction texte complete,
// format "Code Entree / Gare entree / Code Sortie / Gare sortie / Distance /
// Classe1-5"), parse par regex (955 relations, 0 echec de parsing).
//
// Verification contre la base existante (peages-aprr.json + overlay) :
//   - 950 relations resolues avec un prix existant : 0 divergence.
//   - 5 relations "Systeme Ouvert" (code 3400, mecanisme barriere a tarif
//     fixe, pas une gare point-a-point) : 4 des 5 (Chesnes, Cruseilles A,
//     Le Crozet, Saint Exupery) etaient deja dans overlay.barrieres sous
//     "aprr-area-ouvert-*", prix EXACTEMENT identiques (2,3/3,6 - 3,2/4,9 -
//     4,5/7,1 - 2,3/3,6). La 5e, "Chignin Bretelle", existait deja comme
//     gare connue dans peages-aprr.json (coordonnees officielles, utilisee
//     ailleurs pour "Chignin Barriere"/"Chignin Les Marches") mais n'avait
//     AUCUN tarif "systeme ouvert" attache -- ajoutee ici (1,0 / 1,6 EUR,
//     source TARIFS_AREA_public.pdf, meme mecanisme que les 4 autres).
//
// AREA est desormais integralement verifiee.
//
// MISE A JOUR (meme jour) : en verifiant que chaque gare du dictionnaire OUV
// (routes-ui.js) a bien sa barriere "systeme ouvert" correspondante, deux
// BUGS DE GPS MAJEURS decouverts sur des barrieres deja existantes (ajoutees
// lors d'une session anterieure) :
//   - "aprr-area-ouvert-fontaine-lariviere" etait a 31,1 km de son point
//     officiel (47.677,6.986, confirme par data.gouv.fr ET par la gare
//     "FONTAINE-LARIVIERE" deja connue dans peages-aprr.json).
//   - "aprr-area-ouvert-le-crozet" etait a 188,6 km (!) de son point
//     officiel (45.046,5.679) -- l'erreur de GPS la plus grave trouvee dans
//     tout ce chantier, bien pire que le bug Monts-Sorigny (5,6km).
// Un trajet reel passant par ces deux echangeurs ne declenchait donc JAMAIS
// barrieresTraversees() (detection a moins de 0,3km) : exactement le type de
// peage silencieusement omis que l'audit de Laurent visait a trouver. Les
// DEUX prix (PROUVE, sources inchangees) sont corrects et n'ont pas change
// -- seul le GPS est corrige, vers les coordonnees exactes de la gare P.g
// deja connue (verifie : aucune nouvelle collision a moins de 0,3km).
// Un troisieme cas, "aprr-area-ouvert-cruseilles-a" (1,5km d'ecart), n'est
// PAS corrige ici : il figure deja dans la liste SUSPECTES de routes-ui.js
// (ligne ~140), un garde-fou EXISTANT et DELIBERE qui degrade la confiance
// du prix affiche (reste=99) plutot que de le bloquer ou le corriger sans
// plus d'information -- modifier son GPS sortirait du cadre de cette
// verification et demanderait sa propre investigation.
//
// Egalement : "CHIGNIN BRETELLE" et "TOURNEAU Système Ouvert" (la gare
// renommee ci-dessus "aprr-area-ouvert-tourneau-syst-me-ouvert" pour que son
// id corresponde exactement au slug que le moteur calcule a partir du nom
// P.g) ont ete ajoutees au dictionnaire OUV de routes-ui.js : sans cette
// entree, ces 2 gares isolees (aucun tarif point-a-point, seulement le tarif
// systeme-ouvert) auraient pu, rencontrees au milieu d'un trajet avec
// d'autres gares deja tarifees, faire refuser ou mal calculer le prix du
// reste du trajet (cf. le garde-fou ligne ~284 de routes-ui.js).
//
// Run: node --test tests/peages-area-grille-complete-chignin-bretelle.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

const AREA_PATH = '/tmp/claude-0/-home-claude/c7c9ce3a-820f-532b-bac1-cdca9bdf0d53/scratchpad/area_public.txt';
const RE = /^(\d+)\s+(.+?)\s+(\d+)\s+(.+?)\s+([\d,]+)\s+([\d,]+)\s*€\s+([\d,]+)\s*€/;

function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
function decoderPrix() {
  const lignes = aprr.p.split(';');
  const prix = new Map();
  for (const l of lignes) {
    const [a, b, c1, c2] = l.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10]);
  }
  return prix;
}
function idxByNorm() {
  const m = new Map();
  aprr.g.forEach((g, i) => { const n = norm(g[0]); if (!m.has(n)) m.set(n, []); m.get(n).push(i); });
  return m;
}

function dist(a, b, c, d) { const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t, h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

test('la grille AREA locale reste disponible, parse integralement par regex (955 relations)', () => {
  const lines = fs.readFileSync(AREA_PATH, 'utf8').split('\n');
  let ok = 0;
  for (const l of lines) { if (!/^\s*\d+/.test(l)) continue; if (RE.test(l)) ok++; }
  assert.equal(ok, 955);
});

test('grille AREA complete : 0 divergence de prix sur toutes les relations point-a-point resolvables', () => {
  const lines = fs.readFileSync(AREA_PATH, 'utf8').split('\n');
  const prix = decoderPrix();
  const idx = idxByNorm();
  let matched = 0, mismatched = 0;
  for (const l of lines) {
    if (!/^\s*\d+/.test(l)) continue;
    const m = l.match(RE);
    if (!m) continue;
    const origin = m[2].trim(), dest = m[4].trim();
    if (dest === 'Système Ouvert') continue;
    const c1 = parseFloat(m[6].replace(',', '.')), c2 = parseFloat(m[7].replace(',', '.'));
    const oi = idx.get(norm(origin)), di = idx.get(norm(dest));
    if (!oi || !di) continue;
    let found = false;
    for (const o of oi) for (const d of di) {
      const v = prix.get(Math.min(o, d) * 1000 + Math.max(o, d));
      if (v) { found = true; if (Math.abs(v[0] - c1) < 0.05 && Math.abs(v[1] - c2) < 0.05) matched++; else mismatched++; break; }
      if (found) break;
    }
  }
  assert.equal(mismatched, 0);
  assert.ok(matched >= 900, 'trouve ' + matched);
});

test('4 des 5 relations "Systeme Ouvert" AREA correspondent exactement aux barrieres deja presentes', () => {
  const attendus = {
    'aprr-area-ouvert-chesnes': [2.3, 3.6],
    'aprr-area-ouvert-cruseilles-a': [3.2, 4.9],
    'aprr-area-ouvert-le-crozet': [4.5, 7.1],
    'aprr-area-ouvert-saint-exupery': [2.3, 3.6],
  };
  for (const [id, [c1, c2]] of Object.entries(attendus)) {
    const t1 = overlay.tarifs.find(t => t.b === id && t.c === 1);
    const t2 = overlay.tarifs.find(t => t.b === id && t.c === 2);
    assert.ok(t1 && t2, id + ' doit exister');
    assert.equal(t1.a, c1); assert.equal(t2.a, c2);
  }
});

test('nouvelle barriere "aprr-area-ouvert-chignin-bretelle" ajoutee (GPS deja officiel, prix 1,0/1,6 PROUVE)', () => {
  const b = overlay.barrieres.find(x => x.id === 'aprr-area-ouvert-chignin-bretelle');
  assert.ok(b, 'la barriere doit exister');
  const t1 = overlay.tarifs.find(t => t.b === b.id && t.c === 1);
  const t2 = overlay.tarifs.find(t => t.b === b.id && t.c === 2);
  assert.equal(t1.a, 1.0); assert.equal(t1.s, 'PROUVE');
  assert.equal(t2.a, 1.6); assert.equal(t2.s, 'PROUVE');
  // GPS identique au point "CHIGNIN BRETELLE" deja connu dans peages-aprr.json
  const g = aprr.g.find(x => x[0] === 'CHIGNIN BRETELLE');
  assert.ok(g, 'CHIGNIN BRETELLE doit deja exister comme gare connue');
  assert.equal(b.points[0][0], g[1][0][0]);
  assert.equal(b.points[0][1], g[1][0][1]);
});

test('la nouvelle barriere ne cree aucune collision a moins de 0,3km avec une autre barriere', () => {
  const b = overlay.barrieres.find(x => x.id === 'aprr-area-ouvert-chignin-bretelle');
  for (const other of overlay.barrieres) {
    if (other.id === b.id) continue;
    for (const p of b.points) for (const q of other.points) {
      assert.ok(dist(p[0], p[1], q[0], q[1]) > 0.3, b.id + ' trop proche de ' + other.id);
    }
  }
});

test('GPS corrige : "aprr-area-ouvert-fontaine-lariviere" est maintenant a son point officiel (etait a 31,1km)', () => {
  const b = overlay.barrieres.find(x => x.id === 'aprr-area-ouvert-fontaine-lariviere');
  assert.equal(b.points[0][0], 47.677);
  assert.equal(b.points[0][1], 6.986);
  const t1 = overlay.tarifs.find(t => t.b === b.id && t.c === 1);
  const t2 = overlay.tarifs.find(t => t.b === b.id && t.c === 2);
  assert.equal(t1.a, 3.1); assert.equal(t2.a, 4.9); // prix inchange
});

test('GPS corrige : "aprr-area-ouvert-le-crozet" est maintenant a son point officiel (etait a 188,6km)', () => {
  const b = overlay.barrieres.find(x => x.id === 'aprr-area-ouvert-le-crozet');
  assert.equal(b.points[0][0], 45.046);
  assert.equal(b.points[0][1], 5.679);
  const t1 = overlay.tarifs.find(t => t.b === b.id && t.c === 1);
  const t2 = overlay.tarifs.find(t => t.b === b.id && t.c === 2);
  assert.equal(t1.a, 4.5); assert.equal(t2.a, 7.1); // prix inchange
});

test('les 2 GPS corriges ne creent aucune collision a moins de 0,3km avec un autre point connu', () => {
  for (const id of ['aprr-area-ouvert-fontaine-lariviere', 'aprr-area-ouvert-le-crozet']) {
    const b = overlay.barrieres.find(x => x.id === id);
    for (const other of overlay.barrieres) {
      if (other.id === id) continue;
      for (const p of b.points) for (const q of other.points) {
        assert.ok(dist(p[0], p[1], q[0], q[1]) > 0.3, id + ' trop proche de ' + other.id);
      }
    }
  }
});

test('"Cruseilles A" (1,5km d\'ecart, deja connu) reste dans la liste SUSPECTES de routes-ui.js -- non touche ici', () => {
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'routes-ui.js'), 'utf8');
  assert.match(src, /const SUSPECTES = \['CRUSEILLES A'\]/);
});

test('"CHIGNIN BRETELLE" et "TOURNEAU Système Ouvert" sont dans le dictionnaire OUV de routes-ui.js', () => {
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'routes-ui.js'), 'utf8');
  assert.match(src, /'CHIGNIN BRETELLE': \[1\.0, 1\.6\]/);
  assert.match(src, /'TOURNEAU Système Ouvert': \[3\.8, 5\.8\]/);
});

test('"aprr-area-ouvert-tourneau-syst-me-ouvert" (renomme pour correspondre au slug du moteur) a le bon prix et aucun doublon', () => {
  const matches = overlay.barrieres.filter(b => /tourneau/i.test(b.id));
  assert.equal(matches.length, 1, 'un seul barriere Tourneau, pas de doublon');
  assert.equal(matches[0].id, 'aprr-area-ouvert-tourneau-syst-me-ouvert');
  const t1 = overlay.tarifs.find(t => t.b === matches[0].id && t.c === 1);
  const t2 = overlay.tarifs.find(t => t.b === matches[0].id && t.c === 2);
  assert.equal(t1.a, 3.8); assert.equal(t2.a, 5.8);
});
