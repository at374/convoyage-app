// Correction GPS : "MOLINET OUEST" (overlay.gares) était positionné à 11,8 km du vrai
// point (ALIAE, A79), suite à un balayage de cohérence déclenché par la découverte du
// même type d'erreur sur l'ancienne intégration partielle ALICORNE/A88 (cf.
// tests/peages-alicorne-a88-falaise-sees.test.cjs).
//
// Méthode : comparaison de tous les noms d'overlay.gares avec les points homonymes des
// référentiels OSM (osm-peages-france.json) et data.gouv.fr (gares-peage-officiel.json).
// "MOLINET OUEST" était l'un des rares vrais écarts (>2km) — les autres candidats
// (ex. "Vienne nord/sud" vs "Vienne", "Saint-Omer") sont des correspondances de noms
// non pertinentes (gares distinctes portant un nom proche, pas des erreurs).
//
// Source corrigée : OSM, highway=toll_gantry, name="Molinet Ouest", operator="aliae",
// deux points quasi identiques à 46.45625/3.90424 et 46.45634/3.90425 — à comparer avec
// "Molinet Est" (même source, déjà correct dans overlay.gares à 46.4632325/3.9772761).
// Aucun tarif changé par cette correction (les prix MOLINET OUEST<->MOLINET et
// MOLINET OUEST<->MOLINET EST restent 1,2/1,7 et 1,3/2,0, uniquement le GPS était faux).

const assert = require('node:assert');
const test = require('node:test');
const overlay = require('../peages-overlay.json');

test('MOLINET OUEST : GPS corrigé (vrai point ALIAE, pas le point erroné à 11,8km)', () => {
  const g = overlay.gares.find((x) => x.nom === 'MOLINET OUEST');
  assert.ok(g, 'MOLINET OUEST doit exister dans overlay.gares');
  const [lat, lon] = g.points[0];
  assert.ok(Math.abs(lat - 46.45625) < 0.001 && Math.abs(lon - 3.90424) < 0.001, 'GPS doit être le point ALIAE officiel, pas l\'ancien point erroné (46.5073864, 3.7685746)');
});

test('MOLINET OUEST : toujours à une distance plausible de MOLINET EST (même barrière ALIAE)', () => {
  const ouest = overlay.gares.find((x) => x.nom === 'MOLINET OUEST');
  const est = overlay.gares.find((x) => x.nom === 'MOLINET EST');
  assert.ok(ouest && est);
  function dist(a, b) {
    return 111 * Math.sqrt((a[0] - b[0]) ** 2 + ((a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180)) ** 2);
  }
  const d = dist(ouest.points[0], est.points[0]);
  assert.ok(d < 10, `distance Molinet Ouest<->Est doit être plausible (<10km), trouvé ${d.toFixed(2)}km`);
});

test('MOLINET OUEST : les 2 relations de prix existantes restent inchangées', () => {
  const attendu = [
    ['MOLINET OUEST', 'MOLINET', 1.2, 1.7],
    ['MOLINET OUEST', 'MOLINET EST', 1.3, 2.0],
  ];
  for (const [a, b, c1, c2] of attendu) {
    const p = overlay.paires.find((x) => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    assert.ok(p, `${a} <-> ${b} doit exister`);
    assert.strictEqual(p[2], c1);
    assert.strictEqual(p[3], c2);
  }
});
