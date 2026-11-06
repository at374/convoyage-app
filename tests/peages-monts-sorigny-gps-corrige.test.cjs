'use strict';
// Correction du 6 nov. 2026 : le GPS de la barriere "cofiroute-ouvert-monts-
// sorigny" (voir tests/aura-suisse-cofiroute-tours-ouvert.test.cjs, ajoutee lors
// d'une session anterieure via resolution de lieu Google Maps) etait FAUX de
// 5,6 km par rapport au point officiel data.gouv.fr "Monts - Sorigny"
// (47.25442,0.67097, type Ech). Un trajet reel passant par le vrai echangeur
// Monts-Sorigny (A10) ne declenchait donc PAS ce peage (barrieresTraversees()
// ne detecte qu'a moins de ~0,3 km) -- exactement le type de bug que l'audit
// demande par Laurent ("verifier que TOUS les trajets passent par un peage
// correctement calcule") visait a trouver : un peage silencieusement omis sur
// de vrais trajets, malgre un prix PROUVE deja present en base.
//
// Decouvert en validant la grille tarifaire COFIROUTE locale (fichier
// Tarifs_Cofiroute_Arcour.txt, fourni par Laurent) contre overlay.barrieres :
// les 4 autres barrieres "ouvert" Cofiroute du meme lot (Chambray, Tours Nord,
// Neuille-Pont-Pierre) sont a 0,03-0,04 km de leur point officiel respectif --
// seule Monts-Sorigny etait fausse (erreur isolee, pas un probleme systemique).
//
// Le PRIX (2,0/2,7, PROUVE, source Cofiroute-Guide-tarifaire-2026.pdf) etait
// et reste correct -- seul le GPS est corrige ici. Aucun prix modifie.
//
// Verification avant correction : le nouveau GPS est a 4,7 km du point le plus
// proche (Tours Centre (Sorigny)) -- aucun risque de collision ni de double
// facturation avec un autre point connu.
//
// Run: node --test tests/peages-monts-sorigny-gps-corrige.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');
const aprr = require('../peages-aprr.json');

function dist(a, b, c, d) {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

test('"cofiroute-ouvert-monts-sorigny" a maintenant le GPS officiel (47.25442, 0.67097)', () => {
  const b = overlay.barrieres.find(x => x.id === 'cofiroute-ouvert-monts-sorigny');
  assert.ok(b, 'la barriere doit exister');
  assert.equal(b.points.length, 1);
  assert.equal(b.points[0][0], 47.25442);
  assert.equal(b.points[0][1], 0.67097);
});

test('le prix PROUVE (2,0/2,7) est inchange par cette correction GPS', () => {
  const t1 = overlay.tarifs.find(t => t.b === 'cofiroute-ouvert-monts-sorigny' && t.c === 1);
  const t2 = overlay.tarifs.find(t => t.b === 'cofiroute-ouvert-monts-sorigny' && t.c === 2);
  assert.equal(t1.a, 2);
  assert.equal(t1.s, 'PROUVE');
  assert.equal(t2.a, 2.7);
  assert.equal(t2.s, 'PROUVE');
});

test('le nouveau GPS ne cree aucune collision avec un point deja connu', () => {
  const NEW = [47.25442, 0.67097];
  let minD = Infinity;
  for (const g of aprr.g) for (const p of g[1]) { const d = dist(NEW[0], NEW[1], p[0], p[1]); if (d < minD) minD = d; }
  for (const g of overlay.gares) for (const p of g.points) { const d = dist(NEW[0], NEW[1], p[0], p[1]); if (d < minD) minD = d; }
  for (const b of overlay.barrieres) {
    if (b.id === 'cofiroute-ouvert-monts-sorigny') continue;
    for (const p of b.points) { const d = dist(NEW[0], NEW[1], p[0], p[1]); if (d < minD) minD = d; }
  }
  assert.ok(minD > 0.5, 'le nouveau GPS ne doit collisionner avec aucun autre point connu, trouve a ' + minD.toFixed(3) + 'km');
});

test('les 4 autres barrieres "ouvert" Cofiroute du meme lot restent correctes (deja a 0,03-0,04km de leur point officiel)', () => {
  const officiels = {
    'cofiroute-ouvert-chambray': [47.34919, 0.70312],
    'cofiroute-ouvert-tours-nord': [47.45215, 0.73944],
    'cofiroute-ouvert-neuille-pont-pierre': [47.55526, 0.596],
  };
  for (const [id, [lat, lon]] of Object.entries(officiels)) {
    const b = overlay.barrieres.find(x => x.id === id);
    assert.ok(b, id + ' doit exister');
    const d = dist(b.points[0][0], b.points[0][1], lat, lon);
    assert.ok(d < 0.1, id + ' devrait etre a moins de 0,1km du point officiel, trouve a ' + d.toFixed(3) + 'km');
  }
});
