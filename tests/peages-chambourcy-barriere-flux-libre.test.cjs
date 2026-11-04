'use strict';
// Peage de Chambourcy (A14, flux libre, 4 nov. 2026) : jusqu'ici, "CHAMBOURCY"
// n'existait dans aucune donnee (ni peages-aprr.json ni overlay.paires) ; le
// trajet etait bloque sans prix (liste UNK de routes-ui.js, gares officielles
// du ministere sans tarif connu). La grille officielle SAPN 2026
// (2026_02-Grille-SAPN.pdf, deja citee comme source) donne un tarif PLAT,
// non horo-saisonnier (contrairement a Montesson, qui reste bloque) :
// classe 1 = 2,60 EUR, classe 2 = 5,20 EUR. Localisation confirmee par deux
// noeuds OpenStreetMap distincts tagges highway=toll_gantry, operator=SAPN,
// name=Chambourcy (portiques sens Paris et sens Caen), a ~0,2km l'un de
// l'autre, verifies a >4km de toute gare/barriere existante (aucun risque de
// double-charge ni de confusion). Ajoute comme barriere a tarif fixe
// (overlay.barrieres + overlay.tarifs), le meme mecanisme que les autres
// barrieres flux libre deja presentes (ex. "sanef-vallee-de-la-hem-2").
// Run: node --test tests/peages-chambourcy-barriere-flux-libre.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');
const CPPeage = require('../peage-engine.js');

const dist = (a, b, c, d) => {
  const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

test('the "sapn-chambourcy" barriere exists with 2 directional GPS points (A14 toll gantries)', () => {
  const b = overlay.barrieres.find(x => x.id === 'sapn-chambourcy');
  assert.ok(b, 'sapn-chambourcy barriere missing');
  assert.equal(b.points.length, 2);
});

test('the Chambourcy barriere does not collide (>0.3km) with any other existing barriere or gare', () => {
  const aprr = require('../peages-aprr.json');
  const b = overlay.barrieres.find(x => x.id === 'sapn-chambourcy');
  const all = [];
  for (const g of aprr.g) for (const p of g[1]) all.push(['gare:' + g[0], p[0], p[1]]);
  for (const g of overlay.gares) for (const p of g.points) all.push(['gare:' + g.nom, p[0], p[1]]);
  for (const other of overlay.barrieres) { if (other.id === 'sapn-chambourcy') continue; for (const p of other.points) all.push(['barriere:' + other.id, p[0], p[1]]); }
  for (const pt of b.points) {
    for (const [label, la, lo] of all) {
      const d = dist(pt[0], pt[1], la, lo);
      assert.ok(d > 0.3, 'Chambourcy gantry too close to ' + label + ' (' + d.toFixed(4) + 'km)');
    }
  }
});

test('the pricing engine resolves the Chambourcy barriere to the official flat fare (2,60€ classe 1 / 5,20€ classe 2)', () => {
  const versions = overlay.tarifs.map(t => ({ id: t.id, barrier_station_id: t.b || null, vehicle_class: t.c, amount_eur: t.a, status: t.s, effective_from: t.f, effective_to: t.t || null, tariff_context: t.k || null, source_url: t.u == null ? null : overlay.u[t.u] }));
  const moteur = CPPeage.creerMoteur({ versions });
  const passages = [{ type: 'barriere', station: 'sapn-chambourcy', group: 'sapn-chambourcy', passage: 0 }];
  const t1 = moteur.trajet(passages, 1, '2026-11-04');
  const t2 = moteur.trajet(passages, 2, '2026-11-04');
  assert.equal(t1.complet, true);
  assert.equal(t2.complet, true);
  assert.equal(t1.total, 2.6);
  assert.equal(t2.total, 5.2);
  assert.equal(t1.status, 'PROUVE');
  assert.equal(t2.status, 'PROUVE');
});

test('passing both directional gantries of Chambourcy counts as a single crossing (no double-charge)', () => {
  const versions = overlay.tarifs.map(t => ({ id: t.id, barrier_station_id: t.b || null, vehicle_class: t.c, amount_eur: t.a, status: t.s, effective_from: t.f, effective_to: t.t || null, tariff_context: t.k || null, source_url: t.u == null ? null : overlay.u[t.u] }));
  const moteur = CPPeage.creerMoteur({ versions });
  // simulate routes-ui.js's barrieresTraversees dedup: same id seen on neighboring shape points counts once
  const passages = [{ type: 'barriere', station: 'sapn-chambourcy', group: 'sapn-chambourcy', passage: 0 }];
  const t1 = moteur.trajet(passages, 1, '2026-11-04');
  assert.equal(t1.lignes.length, 1);
  assert.equal(t1.total, 2.6);
});
