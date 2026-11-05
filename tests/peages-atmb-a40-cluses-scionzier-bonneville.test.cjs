'use strict';
// Ajout de 4 nouvelles gares sur l'Autoroute Blanche (A40, ATMB, Haute-Savoie,
// 5 nov. 2026), source officielle : "Nouvelle grille des tarifs à compter du 1er
// février 2026 sur l'Autoroute Blanche" (communiqué de presse ATMB, PDF fourni par
// l'utilisateur, page 2, tableau "LE FAYET - GAILLARD"). Ce tableau liste les 6
// barrières physiques de la section et confirme EXACTEMENT les 7 relations deja
// presentes dans overlay.paires (classe 1 ET classe 2, 0 ecart) :
//   LE FAYET - CLUSES CENTRE      : 2,50 / 4,30  (Péage de Cluses centre - Barrière Amont)
//   LE FAYET - SCIENTRIER         : 4,80 / 8,60  (Péage de Cluses centre - Barrière)
//   CLUSES CENTRE - SCIENTRIER    : 2,30 / 4,30  (Péage de Cluses centre - Barrière Aval)
//   SCIONZIER - SCIENTRIER        : 2,30 / 4,30  (Péage de Scionzier)
//   BONNEVILLE OUEST - SCIENTRIER : 1,30 / 2,30  (Péage de Bonneville Ouest)
//   BONNEVILLE EST - SCIENTRIER   : 1,70 / 3,10  (Péage de Bonneville Est)
//   SCIENTRIER - GAILLARD         : 2,20 / 3,90  (Péage de Nangy)
//
// GPS ajoute pour les 4 barrieres PHYSIQUEMENT distinctes et confirmees par Google
// Places sous un nom explicite (aucune approximation) :
//   CLUSES CENTRE      -> "Péage de Cluses" (46.0469292, 6.5965979)
//   SCIONZIER          -> "Péage de Scionzier - A40 - Sortie N°18" (46.0683799, 6.5537908)
//   BONNEVILLE OUEST   -> "Péage de Bonneville-ouest" (46.0730418, 6.3821568)
//   BONNEVILLE EST     -> "Péage de bonneville -Est" (46.070189, 6.4245371)
// Aucun conflit de seuil : le point existant le plus proche de chacun de ces 4
// candidats est a plus de 20km (ALLONZIER / CRUSEILLES, autre reseau AREA), tres
// largement au-dela du seuil de detection de barriere (0,3km).
//
// SCIENTRIER, GAILLARD et LE FAYET sont volontairement LAISSES SANS GPS : la page
// officielle ATMB (tarifs-peage-autoroute-blanche-a40-vehicules-legers) le confirme
// explicitement -- "Scientrier and Gaillard appear only as route endpoints, not as
// toll stations" -- ce sont des points de reference logiques en systeme ouvert (la
// perception reelle se fait aux barrieres Cluses centre / Scionzier / Bonneville
// Ouest / Bonneville Est / Nangy), pas des gares physiques propres. Meme prudence
// que pour le cas Cote d'Azur (CASSIS / LA BEDOULE etc., A50) deja documente.
//
// Run: node --test tests/peages-atmb-a40-cluses-scionzier-bonneville.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

for (const nom of ['CLUSES CENTRE', 'SCIONZIER', 'BONNEVILLE OUEST', 'BONNEVILLE EST']) {
  test(`${nom} now has verified GPS`, () => {
    const g = overlay.gares.find(x => x.nom === nom);
    assert.ok(g, `${nom} should now exist in overlay.gares`);
    assert.ok(Array.isArray(g.points) && g.points.length === 1);
    assert.equal(typeof g.points[0][0], 'number');
    assert.equal(typeof g.points[0][1], 'number');
  });
}

test('SCIENTRIER, GAILLARD and LE FAYET were deliberately left without GPS (open-system endpoints)', () => {
  const gareNames = new Set(overlay.gares.map(g => g.nom));
  assert.equal(gareNames.has('SCIENTRIER'), false);
  assert.equal(gareNames.has('GAILLARD'), false);
  assert.equal(gareNames.has('LE FAYET'), false);
});

test('no price was fabricated or altered: all 7 ATMB relations keep their original numbers', () => {
  const expected = [
    ['LE FAYET', 'CLUSES CENTRE', 2.5, 4.3],
    ['LE FAYET', 'SCIENTRIER', 4.8, 8.6],
    ['CLUSES CENTRE', 'SCIENTRIER', 2.3, 4.3],
    ['SCIONZIER', 'SCIENTRIER', 2.3, 4.3],
    ['BONNEVILLE OUEST', 'SCIENTRIER', 1.3, 2.3],
    ['BONNEVILLE EST', 'SCIENTRIER', 1.7, 3.1],
    ['SCIENTRIER', 'GAILLARD', 2.2, 3.9],
  ];
  for (const [a, b, c1, c2] of expected) {
    const p = overlay.paires.find(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    assert.ok(p, `relation ${a} <-> ${b} should still exist`);
    assert.equal(p[2], c1, `${a} <-> ${b} classe 1`);
    assert.equal(p[3], c2, `${a} <-> ${b} classe 2`);
  }
});
