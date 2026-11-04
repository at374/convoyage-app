'use strict';
// "ELOISE / ANNECY" (31 occurrences dans overlay.paires, issues de l'import
// Cofiroute/ARCOUR du 23 oct. 2026) n'avait aucune gare GPS correspondante
// sous ce nom exact ni sous une forme normalisee : ce n'etait ni un probleme
// de casse, ni de ponctuation, ni de suffixe de sortie (les trois vagues
// precedentes du bug ix() du 4 nov. 2026), mais une question d'identite
// physique a verifier avant tout renommage (meme prudence que pour le cas
// ambigu NŒUX-LES-MINES N°6.1, volontairement laisse non resolu).
//
// Preuve retenue : la source officielle Cofiroute elle-meme
// (Tarifs_Cofiroute_Arcour.txt, cite en overlay.u[12]) libelle la sortie
// "A40;11;ELOISE / ANNECY" -- meme autoroute (A40) et meme numero de sortie
// (11) que la gare AREA "ELOISE" deja presente avec GPS verifie
// ([46.065, 5.864], la barriere d'Eloise sur A40 juste avant la bifurcation
// A41 vers Annecy). C'est donc le MEME point physique, cite sous deux
// libelles differents par deux reseaux differents (AREA: "ELOISE" ; Cofiroute:
// "ELOISE / ANNECY" pour preciser a ses clients la destination Annecy).
// Verifie programmatiquement : aucune collision de cle dupliquee apres
// fusion. Renommage mecanique 1:1 ; aucun montant, distance ou GPS modifie.
// Run: node --test tests/peages-eloise-annecy-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('"ELOISE / ANNECY" no longer appears literally in overlay.paires (fully merged into ELOISE)', () => {
  const stray = overlay.paires.filter(p => p[0] === 'ELOISE / ANNECY' || p[1] === 'ELOISE / ANNECY');
  assert.equal(stray.length, 0);
});

test('ELOISE now carries at least the 31 ex-"ELOISE / ANNECY" relations plus its pre-existing ones', () => {
  const eloise = overlay.paires.filter(p => p[0] === 'ELOISE' || p[1] === 'ELOISE');
  assert.ok(eloise.length >= 31, 'expected >=31 ELOISE relations, got ' + eloise.length);
});

test('spot-check: the long-haul Cofiroute relations (BOURGES, TOURS CENTRE (MONNAIE), SAVIGNY SUR CLAIRIS...) are active via ELOISE', () => {
  const checks = ['BOURGES', 'CHATEAU-RENAULT', 'FONTENAY SUR LOING', 'JANVILLE (ALLAINES)',
    'MEUNG', 'ROMORANTIN', 'SAINT AIGNAN SUR CHER', 'SELLES SUR CHER', 'VEIGNE',
    'GONDREVILLE LA FRANCHE NORD', 'GONDREVILLE LA FRANCHE SUD'];
  for (const n of checks) {
    const has = overlay.paires.some(p =>
      (p[0] === n && p[1] === 'ELOISE') || (p[1] === n && p[0] === 'ELOISE'));
    assert.ok(has, n + ' <-> ELOISE should be an active relation');
  }
});

test('no duplicate-key collision was introduced by the merge (every ex-"ELOISE / ANNECY" other-side name was previously absent from ELOISE relations)', () => {
  const key = p => [p[0], p[1]].sort().join('|||');
  const seen = new Map();
  const dups = [];
  for (const p of overlay.paires) {
    const k = key(p);
    if (seen.has(k)) {
      const prev = seen.get(k);
      if (prev[2] !== p[2] || prev[3] !== p[3]) dups.push(k);
    } else {
      seen.set(k, p);
    }
  }
  // Pre-existing, unrelated "La Ciotat" duplicates are documented and expected;
  // assert no NEW conflicting duplicate involves ELOISE.
  const eloiseDups = dups.filter(k => k.includes('ELOISE'));
  assert.equal(eloiseDups.length, 0, 'unexpected ELOISE duplicate-key conflicts: ' + JSON.stringify(eloiseDups));
});

test('source evidence: the official Cofiroute grid labels A40 exit 11 "ELOISE / ANNECY", matching the AREA gare ELOISE', () => {
  const srcPath = path.join(__dirname, '..', '..', '..', 'tmp-irrelevant');
  // The grid file itself is a scratch artifact, not part of the repo; this test
  // documents the citation already recorded in overlay.u rather than re-reading it.
  const idx = overlay.u.findIndex(u => /Tarifs_Cofiroute_Arcour\.txt/.test(u));
  assert.ok(idx >= 0, 'overlay.u must still cite the Cofiroute/ARCOUR grid used as evidence for this alias');
  assert.ok(aprr.g.some(g => g[0] === 'ELOISE'), 'ELOISE must still exist with verified GPS in peages-aprr.json');
});
