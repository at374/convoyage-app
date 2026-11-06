'use strict';
// Verification exhaustive de la grille APRR complete (6 nov. 2026), suite a
// "Continue cherche bien" / "Continue". Fichier officiel local
// TARIFS_APRR_public.pdf -> aprr_public.txt (extraction texte complete,
// format "Gare entree / Gare sortie / Distance / Classe1-5"), parse par
// regex (21 505 relations, 0 echec de parsing -- c'est la plus grande
// grille locale disponible, bien plus que les 16 918 relations historiques
// non certifiees du dossier de rapatriement).
//
// Verification contre la base existante : 21 492 relations resolues avec un
// prix existant, 0 DIVERGENCE sur l'ensemble. Seules 13 relations (sur
// 21 505) concernent des noms non trouves, et il n'y a que 4 noms distincts
// en cause :
//   - "Système Ouvert" : placeholder de destination, pas une vraie gare.
//   - "DORDIVES" : deja couvert par "aprr-ouvert-dordives" (6,0/9,0 EUR,
//     verifie identique).
//   - "QUINCIEUX" : deja couvert par "aprr-area-ouvert-quincieux"
//     (3,6/5,6 EUR, verifie identique).
//   - "LE TOURNEAU" : la gare "TOURNEAU Système Ouvert" existait deja dans
//     peages-aprr.json (coordonnees officielles) et avait deja un tarif
//     "systeme ouvert" (3,8/5,8 EUR) -- mais attache a un GPS FAUX de
//     188,6km -- voir tests/peages-area-grille-complete-chignin-bretelle.
//     test.cjs pour le detail de cette correction (meme chantier, decouverte
//     faite en recoupant ce fichier APRR avec la grille AREA).
//
// APRR est desormais integralement verifiee : 21 492 relations confirmees
// exactes, aucune divergence, aucune gare manquante restante (toutes les 4
// exceptions sont deja couvertes par le mecanisme systeme-ouvert).
//
// Run: node --test tests/peages-aprr-grille-complete-le-tourneau.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

const APRR_PATH = '/tmp/claude-0/-home-claude/c7c9ce3a-820f-532b-bac1-cdca9bdf0d53/scratchpad/aprr_public.txt';
const RE = /^([A-Z0-9].+?)\s{2,}([A-Z0-9].+?)\s+([\d,]+)\s+([\d,]+)\s*€\s+([\d,]+)\s*€/;

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

test('la grille APRR locale reste disponible, parse integralement par regex (21505 relations, 0 echec)', () => {
  const lines = fs.readFileSync(APRR_PATH, 'utf8').split('\n');
  let ok = 0, total = 0;
  for (const l of lines) { if (!/€/.test(l)) continue; total++; if (RE.test(l)) ok++; }
  assert.equal(ok, 21505);
  assert.equal(ok, total, 'aucune ligne avec un montant ne doit echouer au parsing');
});

test('grille APRR complete : 0 divergence de prix sur plus de 21000 relations', () => {
  const lines = fs.readFileSync(APRR_PATH, 'utf8').split('\n');
  const prix = decoderPrix();
  const idx = idxByNorm();
  let matched = 0, mismatched = 0;
  for (const l of lines) {
    if (!/€/.test(l)) continue;
    const m = l.match(RE);
    if (!m) continue;
    const origin = m[1].trim(), dest = m[2].trim();
    if (dest === 'Système Ouvert') continue;
    const c1 = parseFloat(m[4].replace(',', '.')), c2 = parseFloat(m[5].replace(',', '.'));
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
  assert.ok(matched >= 21000, 'trouve ' + matched);
});

test('les 3 relations "X -> Systeme Ouvert" de la grille APRR (Dordives, Quincieux, Le Tourneau) correspondent exactement aux barrieres existantes', () => {
  const attendus = {
    'aprr-ouvert-dordives': [6.0, 9.0],
    'aprr-area-ouvert-quincieux': [3.6, 5.6],
    'aprr-area-ouvert-tourneau-syst-me-ouvert': [3.8, 5.8],
  };
  for (const [id, [c1, c2]] of Object.entries(attendus)) {
    const t1 = overlay.tarifs.find(t => t.b === id && t.c === 1);
    const t2 = overlay.tarifs.find(t => t.b === id && t.c === 2);
    assert.ok(t1 && t2, id + ' doit exister');
    assert.equal(t1.a, c1); assert.equal(t2.a, c2);
  }
});
