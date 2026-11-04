'use strict';
// ARCOS/A355 Ittenheim (4 nov. 2026) : premiere donnee reelle importee sous le nouveau
// mecanisme tariff_context.horaires (moteur V1.1). Remplace 4 anciennes entrees
// d'approximation ("tarif de base jour semaine 09h-15h29", k en chaine libre non
// interpretee par le moteur -> appliquee en permanence par defaut, ce qui etait en fait
// une approximation deguisee) par 104 entrees classes 1-2 (2 trajets x 2 classes x
// 26 plages horaires officielles), sourcees directement depuis le fichier officiel
// VINCI Autoroutes (Tarifs_Arcos.txt, https://public-content.vinci-autoroutes.com/
// PDF/Tarifs-peage-Arcos/Tarifs_Arcos.txt, confirme en ligne et identique au fichier
// local fourni), cross-verifiees contre la grille tarifaire publique VINCI
// (webzine.voyage, "TARIFS En euros TTC, applicables au 01/02/2026").
// Coordonnees GPS des 2 barrieres corrigees (les valeurs precedentes placaient le
// peage a ~3.3km a l'ouest d'Ittenheim, hors de la commune) via Google Places
// (POI toll_station) + la carte officielle VINCI (echangeur D1004).
// Run: node --test tests/peages-arcos-ittenheim-horo-saisonnier.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');
const CPPeage = require('../peage-engine.js');

function tarifs(b, c) { return overlay.tarifs.filter(t => t.b === b && t.c === c); }

test('104 nouvelles entrees tarifaires (2 trajets x 2 classes x 26 plages), aucune ancienne approximation restante', () => {
  const all = overlay.tarifs.filter(t => t.b === 'arcos-ittenheim-barriere' || t.b === 'arcos-ittenheim-gare-laterale');
  assert.equal(all.length, 104);
  for (const t of all) {
    assert.ok(t.k && Array.isArray(t.k.horaires), 'tariff_context.horaires doit etre un tableau de fenetres: ' + t.id);
    assert.notEqual(typeof t.k, 'string', 'l\'ancien k en chaine libre ne doit plus exister');
  }
});

test('chaque barriere/classe couvre exactement 26 fenetres (une par plage horaire officielle)', () => {
  for (const b of ['arcos-ittenheim-barriere', 'arcos-ittenheim-gare-laterale']) {
    for (const c of [1, 2]) {
      assert.equal(tarifs(b, c).length, 26, b + '/classe' + c);
    }
  }
});

test('les 2 barrieres existent avec des coordonnees GPS corrigees, a Ittenheim (pas a 3km a l\'ouest)', () => {
  const bB = overlay.barrieres.find(b => b.id === 'arcos-ittenheim-barriere');
  const bL = overlay.barrieres.find(b => b.id === 'arcos-ittenheim-gare-laterale');
  assert.ok(bB && bL);
  // longitude attendue ~7.60-7.63 (Ittenheim, Bas-Rhin) ; les anciennes valeurs (~7.57-7.58) sont rejetees
  assert.ok(bB.points[0][1] > 7.60 && bB.points[0][1] < 7.63);
  assert.ok(bL.points[0][1] > 7.60 && bL.points[0][1] < 7.63);
});

test('moteur : passage un mardi 08h00 (pointe lun-jeu 07h-08h59) a la Barriere classe 1 = 5,20 EUR', () => {
  const m = CPPeage.creerMoteur({ versions: overlay.tarifs.map(t => ({ id: t.id, barrier_station_id: t.b, vehicle_class: t.c, amount_eur: t.a, status: t.s, effective_from: t.f, effective_to: t.t || null, tariff_context: t.k || null })) });
  const r = m.barriere('arcos-ittenheim-barriere', 1, '2026-11-03', '08:00');
  assert.equal(r.status, 'PROUVE');
  assert.equal(r.amount, 5.20);
});

test('moteur : meme passage, Gare laterale classe 1 (exactement la moitie du tarif Barriere, prouve dans la source)', () => {
  const m = CPPeage.creerMoteur({ versions: overlay.tarifs.map(t => ({ id: t.id, barrier_station_id: t.b, vehicle_class: t.c, amount_eur: t.a, status: t.s, effective_from: t.f, effective_to: t.t || null, tariff_context: t.k || null })) });
  const r = m.barriere('arcos-ittenheim-gare-laterale', 1, '2026-11-03', '08:00');
  assert.equal(r.status, 'PROUVE');
  assert.equal(r.amount, 2.60);
});

test('moteur : creneau nuit (0h-5h) identique quel que soit le jour (dimanche/ferie inclus), Gare laterale classe 1 = 1,20 EUR (cross-verifie contre la grille VINCI publique)', () => {
  const m = CPPeage.creerMoteur({ versions: overlay.tarifs.map(t => ({ id: t.id, barrier_station_id: t.b, vehicle_class: t.c, amount_eur: t.a, status: t.s, effective_from: t.f, effective_to: t.t || null, tariff_context: t.k || null })) });
  for (const [date, heure] of [['2026-11-03', '02:00'], ['2026-11-01', '03:00'], ['2026-07-14', '01:00']]) {
    const r = m.barriere('arcos-ittenheim-gare-laterale', 1, date, heure);
    assert.equal(r.amount, 1.20, date + ' ' + heure);
  }
});

test('moteur : aucune heure fournie -> INCONNU explicite (jamais un montant devine pour une barriere 100% horo-dependante)', () => {
  const m = CPPeage.creerMoteur({ versions: overlay.tarifs.map(t => ({ id: t.id, barrier_station_id: t.b, vehicle_class: t.c, amount_eur: t.a, status: t.s, effective_from: t.f, effective_to: t.t || null, tariff_context: t.k || null })) });
  const r = m.barriere('arcos-ittenheim-barriere', 1, '2026-11-03');
  assert.equal(r.status, 'INCONNU');
  assert.equal(r.amount, null);
});

test('pour chaque barriere/classe, les fenetres horaires forment une partition complete et sans chevauchement de la semaine', () => {
  function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
  for (const b of ['arcos-ittenheim-barriere', 'arcos-ittenheim-gare-laterale']) {
    for (const c of [1, 2]) {
      const windows = tarifs(b, c).flatMap(t => t.k.horaires);
      for (const d of ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']) {
        const segs = windows.filter(w => w.jours.includes(d)).map(w => [toMin(w.debut), toMin(w.fin)]).sort((x, y) => x[0] - y[0]);
        let prevEnd = -1;
        for (const [s, e] of segs) { assert.ok(s <= prevEnd + 1, b + '/' + c + '/' + d + ': trou avant ' + s); prevEnd = Math.max(prevEnd, e); }
        assert.equal(prevEnd, 1439, b + '/' + c + '/' + d + ': couverture incomplete en fin de journee');
      }
    }
  }
});
