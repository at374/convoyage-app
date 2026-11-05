'use strict';
// Deuxieme occurrence du meme bug que "sanef-vallee-de-la-hem-2" (voir
// tests/peages-audit-officiel-data-gouv-gaps.test.cjs), trouvee en balayant
// systematiquement overlay.barrieres a la recherche d'autres doublons
// barriere/paire apres la correction du 5 nov. 2026 :
//
// Sur le reseau ATMB (A40 Autoroute Blanche, secteur Bonneville/Cluses/
// Scionzier, Haute-Savoie), 4 entrees "barriere" (sourcees de
// https://www.atmb.com/telepeage-tarifs/..., statut PROUVE, donc PAS des
// inventions -- simplement MAL CLASSEES comme peages a tarif fixe en systeme
// ouvert, alors que ce sont en realite les tarifs point-a-point normaux d'un
// court trajet adjacent sur un reseau a systeme FERME) dupliquaient EXACTEMENT
// des relations point-a-point deja existantes dans overlay.paires, sous les
// memes montants classe 1/classe 2 :
//   atmb-bonneville-centre (c1=1,3/c2=2,3) = BONNEVILLE OUEST<->SCIENTRIER
//   atmb-bonneville-zi     (c1=1,7/c2=3,1) = BONNEVILLE EST<->SCIENTRIER
//   atmb-cluses-amont      (c1=2,5/c2=4,3) = LE FAYET<->CLUSES CENTRE
//   atmb-scionzier         (c1=2,3/c2=4,3) = SCIONZIER<->SCIENTRIER
//
// Risque reel (standing rule du projet "barriere + point-a-point = risque de
// double facturation") : ces 4 barrieres ont leurs PROPRES coordonnees GPS,
// detectees par barrieresTraversees() INDEPENDAMMENT de gareProche()/paires.
// Un trajet reel traversant Bonneville, Cluses ou Scionzier aurait donc pu
// payer DEUX FOIS le meme peage (une fois via le tarif point-a-point x.c1/x.c2,
// une fois via le tarif barriere fixe t1.total/t2.total, additionnes dans
// estimerPeage() -- routes-ui.js). Corrige en supprimant les 4 entrees
// barriere + leurs 20 tarifs associes (4 barrieres x 5 classes), en gardant les
// relations point-a-point (deja prouvees, deja completes) comme unique source
// de prix. Aucun prix supprime, aucun prix invente -- seulement un doublon
// dangereux retire.
//
// Run: node --test tests/peages-atmb-doublons-barriere-paire.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

const SUPPRIMEES = ['atmb-bonneville-centre', 'atmb-bonneville-zi', 'atmb-cluses-amont', 'atmb-scionzier'];

test('les 4 barrieres ATMB dupliquees ont ete supprimees (ainsi que leurs tarifs)', () => {
  for (const id of SUPPRIMEES) {
    assert.ok(!overlay.barrieres.some(b => b.id === id), id + ' ne doit plus exister dans overlay.barrieres');
    assert.ok(!overlay.tarifs.some(t => t.b === id), id + ' ne doit plus avoir de tarifs');
  }
});

test('les relations point-a-point correspondantes restent intactes (seule source de prix desormais)', () => {
  const cas = [
    ['BONNEVILLE OUEST', 'SCIENTRIER', 1.3, 2.3],
    ['BONNEVILLE EST', 'SCIENTRIER', 1.7, 3.1],
    ['LE FAYET', 'CLUSES CENTRE', 2.5, 4.3],
    ['SCIONZIER', 'SCIENTRIER', 2.3, 4.3],
  ];
  for (const [a, b, c1, c2] of cas) {
    const p = overlay.paires.find(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    assert.ok(p, a + '<->' + b + ' doit exister');
    assert.equal(p[2], c1, a + '<->' + b + ' classe 1');
    assert.equal(p[3], c2, a + '<->' + b + ' classe 2');
  }
});

test('les gares physiques concernees gardent un GPS verifie (overlay.gares, inchange par cette correction)', () => {
  for (const nom of ['BONNEVILLE OUEST', 'BONNEVILLE EST', 'CLUSES CENTRE', 'SCIONZIER']) {
    const g = overlay.gares.find(x => x.nom === nom);
    assert.ok(g, nom + ' doit toujours avoir un GPS dans overlay.gares');
  }
  // SCIENTRIER et LE FAYET restent volontairement sans GPS (marqueurs non
  // physiques en systeme ouvert, deja documentes avant cette session) : cette
  // correction ne change pas leur statut.
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  assert.equal(gareNames.has('SCIENTRIER'), false);
  assert.equal(gareNames.has('LE FAYET'), false);
});
