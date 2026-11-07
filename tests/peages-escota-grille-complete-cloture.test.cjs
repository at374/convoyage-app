'use strict';
// Cloture de la verification ESCOTA complete (6 nov. 2026), suite a "Continue
// cherche bien" / "Continue". Jusqu'ici, Tarifs_ESCOTA.txt (fichier officiel
// local fourni par Laurent, 141 relations, meme format que Tarifs_ASF.txt)
// n'avait servi qu'a resoudre un seul point (Frejus Est <-> Mandelieu, voir
// tests/peages-frejus-est-escota.test.cjs). Verification EXHAUSTIVE de la
// grille entiere contre la base existante (peages-aprr.json) :
//   - 91 relations resolues avec un prix existant : 0 divergence.
//   - 34 relations "introuvables" (nom absent de la base) + 16 lignes
//     "ORIGINE A8/A57 TOULON" (point d'origine fictif, pas une vraie gare).
//   - Sur les 34 introuvables, seuls 4 NOMS distincts (pas 34 relations
//     distinctes) manquent reellement : "AIX" (sur A51, distinct de "Aix
//     Nord"/"Aix Sud" qui sont sur A8), "ST LAURENT" (A8, pres d'Antibes/
//     Cagnes/Nice -- St-Laurent-du-Var), "LE CASTELLET" (A50, pres de
//     Bandol/Aubagne), "PONT DES GAUX" (A50, pres d'Ollioules). Confirme
//     absents du referentiel officiel data.gouv.fr (1266 gares) : aucune
//     correspondance, meme partielle, pour aucun des 4. "Bandol Echangeur"
//     (la contrepartie dans 2 de ces relations) existe bien officiellement,
//     seule la gare d'entree/sortie elle-meme manque.
// Decision : aucun prix ajoute pour ces 4 noms (ce serait une approximation
// sans GPS officiel verifiable), coherent avec la methodologie du chantier
// COFIROUTE. ESCOTA est desormais integralement verifiee : tout prix deja
// present est confirme correct, tout ce qui manque est documente comme
// absence confirmee plutot que lacune de recherche.
//
// Run: node --test tests/peages-escota-grille-complete-cloture.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const aprr = require('../peages-aprr.json');
const officiel = require('../data/gares-peage-officiel.json');

const ESCOTA_PATH = '/tmp/claude-0/-home-claude/c7c9ce3a-820f-532b-bac1-cdca9bdf0d53/scratchpad/Tarifs_ESCOTA.txt';

function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

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

test('la grille ESCOTA locale reste disponible pour verification', () => {
  assert.ok(fs.existsSync(ESCOTA_PATH));
});

test('grille ESCOTA complete (141 relations) : 0 divergence de prix sur toutes les relations resolvables', () => {
  const lines = fs.readFileSync(ESCOTA_PATH, 'utf8').split('\n').slice(1).filter(Boolean);
  const prix = decoderPrix();
  const idx = idxByNorm();
  let matched = 0, mismatched = 0;
  for (const l of lines) {
    const f = l.split(';');
    if (f.length < 6) continue;
    const origin = f[1], dest = f[3];
    if (/^ORIGINE/.test(origin)) continue;
    const c1 = parseFloat(f[4].replace(',', '.')), c2 = parseFloat(f[5].replace(',', '.'));
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
  assert.ok(matched >= 85, 'trouve ' + matched);
});

test('4 noms ESCOTA (AIX sur A51, ST LAURENT, LE CASTELLET, PONT DES GAUX) restent absents du referentiel officiel', () => {
  const ABSENTS = ['ST LAURENT', 'CASTELLET', 'GAUX'];
  for (const terme of ABSENTS) {
    const matches = officiel.d.filter(r => r[0].toUpperCase().includes(terme));
    assert.equal(matches.length, 0, terme + ' ne devrait avoir aucune correspondance dans le referentiel officiel');
  }
  // "AIX" seul (A51) est distinct de "Aix Nord"/"Aix Sud" (A8, deja connus) :
  // on verifie qu'aucune entree officielle nommee exactement "Aix" n'existe.
  assert.ok(!officiel.d.some(r => r[0].toUpperCase() === 'AIX'));
});

test('"Bandol Echangeur" (contrepartie de Le Castellet dans la grille ESCOTA) existe bien officiellement -- seule la gare Le Castellet elle-meme manque', () => {
  assert.ok(officiel.d.some(r => r[0] === 'Bandol Echangeur'));
});
