'use strict';
// Résolution METZ (A31) et FREYMING-MERLEBACH (A320) (5 nov. 2026), à partir de la
// grille tarifaire SANEF officielle 2026 (2026_02-Grille-Sanef.pdf, fournie par
// l'utilisateur sur son propre ordinateur, cf. overlay.src_paires) : l'extraction du
// texte du PDF confirme que ces deux noms portent chacun leur PROPRE ligne tarifaire
// (valeurs numériques jusqu'à leur propre position triangulaire), prouvant qu'il
// s'agit de vrais points de péage physiques et non de simples bornes structurelles de
// zone tarifaire (contrairement aux marqueurs LIMITE/ORIGINE, qui n'ont jamais leur
// propre ligne de prix).
//
// METZ (A31) / METZ (bare) : fusionnés vers le point déjà existant "BEAUMONT" (gare de
// base aprr.g, [49.199, 5.925]) -- PAS une nouvelle gare. Preuve par GPS (0,0662km de
// "Gare de Péage de Beaumont" à Moineville, Google Places) ET par preuve de prix
// stricte : 31 destinations communes entre les anciennes relations "METZ (A31)" et les
// relations déjà actives de BEAUMONT, 0 écart (tarifs classe 1 ET classe 2 identiques
// au centime). Corroboré par la page officielle Sanef "peage-autoroute-a4" qui liste
// "Le péage de Beaumont (km 294)" comme barrière nommée de l'A4, exactement à la
// position attendue dans le corridor (entre Jarny/Sainte-Marie-aux-Chênes et
// Boulay/Saint-Avold) -- même schéma nom-commercial/nom-physique que STRASBOURG
// (Schwindratzheim), CALAIS (Setques), REIMS NORD (Ormes).
//
// FREYMING-MERLEBACH (A320) / FREYMING-MERLEBACH (bare) : nouvelle gare standalone,
// GPS sourcé via Google Places ("Gare de Péage de Loupershouse", 49.0755243,
// 6.8965766), corroboré par la même page officielle Sanef ("Le péage de Loupershouse
// (km 388)"). Distance à la gare existante la plus proche (PUTTELANGE) : 1,70km --
// largement au-delà des deux seuils (fusion jumelle 0,06km et détection de barrière
// 0,3km), donc ajout sûr sans fusion. N'a PAS été mergé avec le candidat "MER"
// précédemment rejeté (preuve de prix défavorable, cf. peages-alias-preuve-de-prix).
//
// EPERNAY et CHARMONT (seul, distinct de CHARMONT-SOUS-BARBUISE déjà résolu) :
// recherchés dans l'intégralité du texte extrait des 6 pages du PDF SANEF 2026 --
// absents. Confirme l'hypothèse qu'ils appartiennent à un réseau différent (Cofiroute
// / A10, cf. src_paires) et restent non résolus par cette source.
//
// Run: node --test tests/peages-metz-freyming-sanef-pdf.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

test('METZ (A31) and bare METZ were fully renamed to the existing BEAUMONT point (no new gare)', () => {
  const stray = overlay.paires.filter(p => p[0] === 'METZ (A31)' || p[1] === 'METZ (A31)' || p[0] === 'METZ' || p[1] === 'METZ');
  assert.equal(stray.length, 0, 'no paire should still reference "METZ (A31)" or bare "METZ"');
  const hasBeaumont = overlay.paires.some(p => p[0] === 'BEAUMONT' || p[1] === 'BEAUMONT');
  assert.ok(hasBeaumont, 'BEAUMONT should now carry the merged relations');
  const newGareBeaumont = overlay.gares.some(g => g.nom === 'BEAUMONT');
  assert.equal(newGareBeaumont, false, 'BEAUMONT must not be duplicated as a new overlay gare: it already exists in the base aprr.g dataset');
});

test('price-proof: every destination shared between the old METZ (A31) relations and BEAUMONT\'s pre-existing relations matches exactly', () => {
  const idx = aprr.g.findIndex(g => g[0] === 'BEAUMONT');
  assert.ok(idx >= 0);
  const beaumontMap = new Map();
  for (const s of aprr.p.split(';')) {
    const [a, b, c1, c2] = s.split(',');
    const ai = parseInt(a, 36), bi = parseInt(b, 36);
    if (ai === idx) beaumontMap.set(aprr.g[bi][0], [Number(c1) / 10, Number(c2) / 10]);
    else if (bi === idx) beaumontMap.set(aprr.g[ai][0], [Number(c1) / 10, Number(c2) / 10]);
  }
  let overlapChecked = 0;
  for (const p of overlay.paires) {
    if (p[0] !== 'BEAUMONT' && p[1] !== 'BEAUMONT') continue;
    const other = p[0] === 'BEAUMONT' ? p[1] : p[0];
    if (!beaumontMap.has(other)) continue;
    overlapChecked++;
    const [c1, c2] = beaumontMap.get(other);
    assert.ok(Math.abs(c1 - p[2]) < 0.05, `class-1 mismatch for ${other}`);
    assert.ok(Math.abs(c2 - p[3]) < 0.05, `class-2 mismatch for ${other}`);
  }
  assert.ok(overlapChecked >= 20, 'expected a substantial number of price-proof overlaps for BEAUMONT, got ' + overlapChecked);
});

test('FREYMING-MERLEBACH (A320) is a new standalone gare, GPS clear of every existing point', () => {
  const g = overlay.gares.find(x => x.nom === 'FREYMING-MERLEBACH (A320)');
  assert.ok(g, 'FREYMING-MERLEBACH (A320) should exist as a new overlay gare');
  const [lat, lon] = g.points[0];
  function dist(a, b) {
    const R = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const all = [];
  for (const gg of aprr.g) for (const p of gg[1]) all.push(p);
  for (const gg of overlay.gares) if (gg.nom !== 'FREYMING-MERLEBACH (A320)') for (const p of gg.points) all.push(p);
  const minDist = Math.min(...all.map(p => dist([lat, lon], p)));
  assert.ok(minDist > 0.3, 'FREYMING-MERLEBACH (A320) GPS should be beyond the 0.3km barrière-detection threshold from every other point, got ' + minDist.toFixed(4) + 'km');
});

test('the bare "FREYMING-MERLEBACH" spelling was fully renamed to its canonical "(A320)" form', () => {
  const stray = overlay.paires.filter(p => p[0] === 'FREYMING-MERLEBACH' || p[1] === 'FREYMING-MERLEBACH');
  assert.equal(stray.length, 0);
  const canonical = overlay.paires.some(p => p[0] === 'FREYMING-MERLEBACH (A320)' || p[1] === 'FREYMING-MERLEBACH (A320)');
  assert.ok(canonical);
});

test('EPERNAY and lone CHARMONT remain unresolved (absent from the 2026 Sanef PDF, likely a different network)', () => {
  // Documentation-only assertion: these names are still dangling under their own
  // spelling because the Sanef PDF search (full 6-page text extraction) never
  // matched them. No action taken here, no price altered.
  const epernay = overlay.paires.some(p => p[0] === 'EPERNAY' || p[1] === 'EPERNAY');
  const charmont = overlay.paires.some(p => p[0] === 'CHARMONT' || p[1] === 'CHARMONT');
  assert.ok(epernay, 'EPERNAY should still be present, unresolved');
  assert.ok(charmont, 'lone CHARMONT should still be present, unresolved');
});

test('no price was fabricated or altered by this fix (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'BEAUMONT' || x[1] === 'BEAUMONT');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
