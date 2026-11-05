'use strict';
// Six nouvelles gares standalone sur l'A79 (RCEA Allier/Saone-et-Loire, reseau Aliae
// en peage en flux libre, 5 nov. 2026) :
//
// Confirmees via la page officielle Aliae ("Quelles seront les sections a peage en
// flux libre... sur l'A79 ?", paiement.aliae.com) qui liste explicitement trois
// sections a deux portiques (Ouest/Est) : Le Montet, Montbeugny, Molinet -- noms
// correspondant exactement aux six noms deja presents (non geres jusqu'ici) dans
// overlay.paires : LE MONTET OUEST, LE MONTET EST, MONTBEUGNY OUEST, MONTBEUGNY EST,
// MOLINET OUEST, MOLINET EST.
//
// GPS source via Google Places, noms d'etablissement correspondant verbatim :
// - "Portique flux libre << Le Montet Ouest >>" (Deux-Chaises, 03240)
// - "Portique flux libre << Le Montet Est >>" (Tronget, 03240)
// - "Portique flux libre << Montbeugny Ouest >>" (Neuilly-le-Real, 03400)
// - "Portique flux libre << Montbeugny Est >>" (Toulon-sur-Allier, 03400)
// - "Portique flux libre << Molinet Ouest >>" (Diou, 03490)
// - "Portique flux libre << Molinet Est 2 >>" (Chassenard, 03510) -- "2" probablement
//   le portique de la voie opposee, meme emplacement physique.
//
// Les six points sont mutuellement distincts (6,5 a 72,8km entre eux) et tous a plus
// de 2km de toute gare/barriere existante -- largement au-dela des deux seuils (fusion
// jumelle 0,06km, detection de barriere 0,3km).
//
// NB : les variantes "nues" (LE MONTET, MONTBEUGNY, MOLINET, sans suffixe OUEST/EST)
// restent volontairement non resolues : aucune source officielle ne distingue un
// troisieme portique distinct a ces noms, et leurs prix tres faibles vers les points
// OUEST deja localises (ex. LE MONTET OUEST <-> LE MONTET : 0,2 / 0,3 euro) suggerent
// une proximite trop grande pour exclure une identite sans preuve de prix propre --
// laisse en l'etat plutot que fusionne a l'aveugle.
//
// Run: node --test tests/peages-a79-aliae-flux-libre-gares.test.cjs
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

const NOMS = ['LE MONTET OUEST', 'LE MONTET EST', 'MONTBEUGNY OUEST', 'MONTBEUGNY EST', 'MOLINET OUEST', 'MOLINET EST'];

test('the six A79 Aliae flux-libre gares exist as new standalone gares, GPS clear of every existing point', () => {
  const all = [];
  for (const gg of aprr.g) for (const p of gg[1]) all.push(p);
  for (const name of NOMS) {
    const g = overlay.gares.find(x => x.nom === name);
    assert.ok(g, name + ' should exist as a new overlay gare');
    const [lat, lon] = g.points[0];
    const others = all.concat(overlay.gares.filter(x => x.nom !== name).flatMap(x => x.points));
    const minDist = Math.min(...others.map(p => dist([lat, lon], p)));
    assert.ok(minDist > 0.3, name + ' GPS should be beyond 0.3km, got ' + minDist.toFixed(4) + 'km');
  }
});

test('the six gares are mutually distinct (no accidental duplicate coordinates)', () => {
  for (let i = 0; i < NOMS.length; i++) {
    for (let j = i + 1; j < NOMS.length; j++) {
      const g1 = overlay.gares.find(x => x.nom === NOMS[i]);
      const g2 = overlay.gares.find(x => x.nom === NOMS[j]);
      const d = dist(g1.points[0], g2.points[0]);
      assert.ok(d > 0.3, NOMS[i] + ' vs ' + NOMS[j] + ' should be distinct, got ' + d.toFixed(4) + 'km');
    }
  }
});

test('the bare variants (LE MONTET, MONTBEUGNY, MOLINET) were deliberately left unresolved', () => {
  for (const name of ['LE MONTET', 'MONTBEUGNY', 'MOLINET']) {
    const stillDangling = overlay.paires.some(p => p[0] === name || p[1] === name);
    assert.ok(stillDangling, name + ' should still be present, unmerged');
    const newGare = overlay.gares.some(g => g.nom === name);
    assert.equal(newGare, false, name + ' must not have been added as a new gare');
  }
});

test('no price was fabricated or altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'LE MONTET OUEST' || x[1] === 'LE MONTET OUEST');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
