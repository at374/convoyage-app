'use strict';
// Nettoyage de 5 relations obsoletes (CHAMBRAY, JOUE-LES-TOURS, TOURS NORD,
// MONTS-SORIGNY, NEUILLE-PONT-PIERRE <-> "TOURS CENTRE") dans overlay.paires,
// 5 nov. 2026.
//
// Ces 5 points sont DEJA correctement geres comme barrieres en "systeme ouvert"
// (overlay.barrieres "cofiroute-ouvert-chambray"/"cofiroute-ouvert-joue-les-tours"/
// "cofiroute-ouvert-tours-nord"/"cofiroute-ouvert-monts-sorigny"/
// "cofiroute-ouvert-neuille-pont-pierre", voir
// tests/aura-suisse-cofiroute-tours-ouvert.test.cjs) avec des tarifs PROUVE
// identiques (0,9/0,9 ; 0,9/0,9 ; 0,9/0,9 ; 2/2,7 ; 1,7/3,1) a ceux des anciennes
// entrees overlay.paires supprimees ici. Ces dernieres etaient devenues des
// doublons inertes : "TOURS CENTRE" n'a jamais eu de GPS (dangling), donc aucune
// de ces paires n'a jamais pu s'activer -- mais les laisser creait un risque de
// double-charge futur si "TOURS CENTRE" ou l'un des 5 noms recevait un jour un GPS
// par erreur (meme logique de nettoyage que pour Copponex/Cruseilles A41 Nord dans
// le meme fichier de reference). Aucun prix modifie ni approxime : les tarifs
// restent identiques, uniquement portes par le mecanisme barriere deja PROUVE.
//
// Run: node --test tests/peages-tours-centre-stale-paires-cleanup.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('the stale CHAMBRAY/JOUE-LES-TOURS/TOURS NORD/MONTS-SORIGNY/NEUILLE-PONT-PIERRE <-> TOURS CENTRE point-to-point paires were removed', () => {
  const stale = new Set(['CHAMBRAY', 'JOUE-LES-TOURS', 'TOURS NORD', 'MONTS-SORIGNY', 'NEUILLE-PONT-PIERRE', 'TOURS CENTRE']);
  const residual = overlay.paires.filter(p => stale.has(p[0]) && stale.has(p[1]));
  assert.equal(residual.length, 0, 'residual stale paires: ' + JSON.stringify(residual));
});

test('the correct open-system barrieres (already PROUVE) still carry the same fares', () => {
  const cases = [
    ['cofiroute-ouvert-chambray', 0.9, 0.9],
    ['cofiroute-ouvert-joue-les-tours', 0.9, 0.9],
    ['cofiroute-ouvert-tours-nord', 0.9, 0.9],
    ['cofiroute-ouvert-monts-sorigny', 2.0, 2.7],
    ['cofiroute-ouvert-neuille-pont-pierre', 1.7, 3.1],
  ];
  for (const [id, c1, c2] of cases) {
    const f1 = overlay.tarifs.find(t => t.b === id && t.c === 1);
    const f2 = overlay.tarifs.find(t => t.b === id && t.c === 2);
    assert.ok(f1 && f2, id + ' missing fares');
    assert.equal(f1.a, c1);
    assert.equal(f2.a, c2);
  }
});
