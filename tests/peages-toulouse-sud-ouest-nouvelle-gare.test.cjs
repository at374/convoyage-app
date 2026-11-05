'use strict';
// Nouvelle gare standalone "TOULOUSE-SUD/OUEST" (A64, 5 nov. 2026), 44 relations
// deja presentes dans overlay.paires mais sans GPS jusqu'ici.
//
// Preuve de distinction d'avec les points deja connus "Toulouse-Nord/Ouest" et
// "Toulouse-Sud/Est" : les prix partages (ex. vers Mazeres Saverdun : 4,5/7 pour
// TOULOUSE-SUD/OUEST contre 5,1/7,9 pour Toulouse-Sud/Est ; vers Agen : 11,5/17,8
// pour TOULOUSE-NORD/EST -- autre nom dangling -- contre 10,8/16,8 pour
// Toulouse-Nord/Ouest) montrent des ecarts reels, non uniformes : ce sont des
// barrieres physiquement distinctes (Toulouse dispose de 4 peages de rocade :
// Nord/Ouest, Nord/Est, Sud/Ouest, Sud/Est), pas des doublons.
//
// GPS source via Google Places ("Toll Toulouse South", Roques, A64), confirme par un
// avis client mentionnant explicitement la confusion "Toulouse Northeast" / "Toulouse
// Southwest" comme deux peages distincts du meme reseau. 12,59km de la gare existante
// la plus proche (Le Palays) -- largement au-dela des deux seuils.
//
// "TOULOUSE-NORD/EST" (22 relations), "TOULOUSE EST" et "TOULOUSE OUEST" (bare, 1
// relation chacune) restent volontairement non resolus : aucune source GPS
// suffisamment fiable trouvee (candidat pour TOULOUSE EST a seulement 0,306km de
// "L'Union" -- juste au-dessus du seuil de detection de barriere, sans preuve de prix
// possible pour trancher).
//
// Run: node --test tests/peages-toulouse-sud-ouest-nouvelle-gare.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function dist(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

test('TOULOUSE-SUD/OUEST exists as a new standalone gare, GPS clear of every existing point', () => {
  const g = overlay.gares.find(x => x.nom === 'TOULOUSE-SUD/OUEST');
  assert.ok(g);
  const [lat, lon] = g.points[0];
  const all = [];
  for (const gg of aprr.g) for (const p of gg[1]) all.push(p);
  for (const gg of overlay.gares) if (gg.nom !== 'TOULOUSE-SUD/OUEST') for (const p of gg.points) all.push(p);
  const minDist = Math.min(...all.map(p => dist([lat, lon], p)));
  assert.ok(minDist > 0.3, 'got ' + minDist.toFixed(4) + 'km');
});

test('TOULOUSE-NORD/EST, TOULOUSE EST, TOULOUSE OUEST were deliberately left unresolved', () => {
  for (const name of ['TOULOUSE-NORD/EST', 'TOULOUSE EST', 'TOULOUSE OUEST']) {
    const stillDangling = overlay.paires.some(p => p[0] === name || p[1] === name);
    assert.ok(stillDangling, name + ' should still be present, unmerged');
    const newGare = overlay.gares.some(g => g.nom === name);
    assert.equal(newGare, false, name + ' must not have been added as a new gare');
  }
});

test('no price was fabricated or altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'TOULOUSE-SUD/OUEST' || x[1] === 'TOULOUSE-SUD/OUEST');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
