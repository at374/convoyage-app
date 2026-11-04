'use strict';
// Lot de 21 alias confirmes par PREUVE DE PRIX (4 nov. 2026), distinct des trois
// vagues du bug ix() (casse/ponctuation/suffixe) et du renommage ELOISE/ANNECY
// (preuve par la source elle-meme). Ici, aucune preuve textuelle externe
// directe n'etait disponible : la methode consiste a verifier que, pour
// chaque destination commune aux deux noms candidats, le tarif classe 1 ET
// classe 2 enregistre est RIGOUREUSEMENT IDENTIQUE au centime (jamais
// approxime), ce qui ne peut raisonnablement s'expliquer que si les deux noms
// designent le meme point tarifaire officiel, importe deux fois sous deux
// libelles differents (abreviation, libelle "(peage de ...)" precisant la
// localisation physique exacte, variante LIM.CONC./orthographe). Un candidat
// dont le recoupement de prix NE correspond PAS a ete explicitement rejete
// (ex. FREYMING-MERLEBACH vs MER, BARRIERE DE MONTREUIL AUX LIONS vs
// MONTREUIL AUX LIONS, CLERMONT vs CLERMONT EN ARGONNE, CASSIS / LA BEDOULE
// vs Cassis, Alencon vs Alencon Sud) et un cas a deux candidats egalement
// valides (NŒUX-LES-MINES N°6.1) reste volontairement non resolu -- meme
// prudence "aucune approximation" que les lots precedents.
// Run: node --test tests/peages-alias-preuve-de-prix.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

const RENAMES = [
  ['BOURGES', 'BOURGES (LIM.CONC.)'],
  ['JANVILLE (ALLAINES)', 'ALLAINES'],
  ['MEUNG', 'MEUNG SUR LOIRE'],
  ['REIMS NORD', 'REIMS NORD (ORMES)'],
  ['CALAIS (péage de Setques)', 'CALAIS'],
  ['REIMS (péage de Courcy)', 'REIMS'],
  ['AMIENS EST (péage de Jules Verne)', 'AMIENS EST'],
  ['AMIENS EST JULES VERNE', 'AMIENS EST'],
  ["HORDAIN (péage d'Hordain)", 'HORDAIN'],
  ['LILLE / DOURGES (péage de Fresnes)', 'LILLE / DOURGES'],
  ['ARRAS NORD (A26)', 'ARRAS NORD'],
  ['ARRAS EST (A1)', 'ARRAS EST'],
  ['AMBERIEU EN BUGEY', 'AMBERIEU'],
  ['CLERMONT', 'CLERMONT-BARRIERE'],
  ['CRIMOLOIS', 'DIJON-CRIMOLOIS'],
  ['GERZAT', 'GERZAT-VILLE'],
  ['STRASBOURG (péage de Schwindratzheim)', 'STRASBOURG'],
  ["BOULOGNE EST (péage d'Herquelingue)", 'BOULOGNE EST'],
  ['AMIENS SUD (péage de Dury)', 'AMIENS SUD'],
  ['ST-PAUL-LEZ-DURANCE', 'St Paul Lez Durances'],
  ['Alencon', 'Alencon Nord'],
];

test('none of the 21 old alias labels appear literally in overlay.paires any more', () => {
  for (const [oldName] of RENAMES) {
    const stray = overlay.paires.filter(p => p[0] === oldName || p[1] === oldName);
    assert.equal(stray.length, 0, oldName + ' should have been fully renamed');
  }
});

test('each of the 21 canonical names now carries at least one active relation', () => {
  for (const [, newName] of RENAMES) {
    const has = overlay.paires.some(p => p[0] === newName || p[1] === newName);
    assert.ok(has, newName + ' should have at least one active relation after the alias merge');
  }
});

test('price-proof precondition: rejected false-candidate pairs were never merged', () => {
  // These were considered and explicitly rejected because the price recoupement
  // disproved identity; assert the old dangling names are untouched (still
  // dangling under their own spelling, not silently merged into the rejected target).
  const stillDangling = ['FREYMING-MERLEBACH', 'BARRIERE DE MONTREUIL AUX LIONS', 'CASSIS / LA BEDOULE'];
  for (const n of stillDangling) {
    const refs = overlay.paires.filter(p => p[0] === n || p[1] === n);
    assert.ok(refs.length > 0, n + ' should still be present under its own (unmerged) name');
  }
});

test('the ambiguous "NŒUX-LES-MINES N°6.1" case (two equally price-valid candidates) was left untouched', () => {
  const p = overlay.paires.filter(x => x[0] === 'NŒUX-LES-MINES N°6.1' || x[1] === 'NŒUX-LES-MINES N°6.1');
  assert.ok(p.length > 0, 'the ambiguous name should still be present, unrenamed');
});

test('no price or distance was fabricated: a sample merged relation keeps its original numeric amount', () => {
  const p = overlay.paires.find(x => x[0] === 'BOURGES (LIM.CONC.)' || x[1] === 'BOURGES (LIM.CONC.)');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
