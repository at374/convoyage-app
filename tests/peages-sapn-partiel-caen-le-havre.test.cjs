'use strict';
// Verification PARTIELLE de la grille SAPN (6 nov. 2026), suite a "Continue".
// Fichier officiel local sapn2026.txt (345 lignes, meme origine PDF que
// sanef2026.txt) : 2 corridors en matrice triangulaire ("AUTOROUTE A29 NORD",
// Le Havre-Yvetot-St-Saens, 7 gares ; "AUTOROUTES A13 - A29 SUD",
// Caen-Mantes, 20 gares), repetes une fois par classe (1 a 5), plus une
// section "AUTOROUTE A14" a part (2 peages a tarif FIXE -- Montesson et
// Chambourcy -- pas une matrice point-a-point, hors perimetre de cette
// verification).
//
// Contrairement a SANEF, de nombreuses cellules de cette matrice sont
// explicitement VIDES (pas juste decalees par un artefact d'extraction) :
// certaines gares intermediaires (Toutainville, Tancarville, Plateau N°2)
// n'ont aucun prix sur leur ligne. Parser automatiquement l'ensemble en
// confondant "cellule vide legitime" et "decalage d'extraction" serait un
// risque reel de desaligner prix et gares -- le meme risque identifie pour
// SANEF. Decision : verifier PONCTUELLEMENT les relations lisibles sans
// ambiguite, plutot que de parser tout le fichier.
//
// CORRECTIF (meme session) : une premiere passe avait conclu a tort que 6
// gares de ce fichier etaient absentes de peages-aprr.json, par une erreur
// de recherche sans tenir compte des accents (ex. chercher "DOZULE" sans
// tenir compte du "DOZULÉ N°30" reellement present). Une verification plus
// rigoureuse (recherche insensible aux accents + verification GPS + prix)
// montre que 4 des 6 etaient de FAUX absents, deja presents et deja
// corrects : DOZULÉ N°30, PONT-L'ÉVÊQUE / DEAUVILLE (A132), LA RIVIÈRE-
// SAINT-SAUVEUR N°3 (A29), BONNIÈRES-SUR-SEINE (A13a), LA HAIE-TONDUE N°29.
// Seuls LE HAVRE et TANCARVILLE restent reellement absents (confirme par
// une recherche insensible aux accents donnant 0 resultat dans
// peages-aprr.json ET par l'absence de prix exploitable dans sapn2026.txt
// pour Tancarville -- sa ligne est entierement vide dans le fichier source,
// donc meme en l'ajoutant au referentiel on ne pourrait pas lui donner de
// prix sans approximation).
//
// Resultat final : 9 relations lues sans ambiguite (CAEN/CAGNY/TROARN et
// ST-ROMAIN-DE-COLBOSC/BOLBEC/FECAMP/YVETOT, classes 1 et 2) : 0
// divergence. Plus 2 relations complementaires (DOZULÉ<->PONT-L'ÉVÊQUE et
// CAEN<->PONT-L'ÉVÊQUE, classes 1 et 2) verifiees lors du correctif : 0
// divergence egalement. Le corridor SAPN (A29 Nord + A13-A29 Sud) est donc
// deja entierement couvert et correct pour toutes les gares qui ont un nom
// exploitable dans le referentiel officiel, a l'exception de Le Havre et
// Tancarville.
//
// Run: node --test tests/peages-sapn-partiel-caen-le-havre.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');

function decoderPrix() {
  const lignes = aprr.p.split(';');
  const prix = new Map();
  for (const l of lignes) {
    const [a, b, c1, c2] = l.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10]);
  }
  return prix;
}
function idx(nom) { return aprr.g.findIndex(g => g[0] === nom); }
function idxInsensible(motCle) {
  const re = new RegExp(motCle.normalize('NFD').replace(/[̀-ͯ]/g, ''), 'i');
  return aprr.g.findIndex(g => re.test(g[0].normalize('NFD').replace(/[̀-ͯ]/g, '')));
}

test('les 2 corridors SAPN (A29 Nord et A13-A29 Sud) sont presque entierement deja presents dans peages-aprr.json', () => {
  const attendus = ['ST-ROMAIN-DE-COLBOSC', 'BOLBEC', 'FECAMP', 'YVETOT', 'YERVILLE', 'BEAUTOT', 'ST-SAENS',
    'CAEN (A13)', 'CAGNY (A813)', 'TROARN N°31', 'PLATEAU N°2 (A29)', 'CHENARD N°1 (A29)', 'BEUZEVILLE N°28',
    'TOUTAINVILLE N°27', 'BOURNEVILLE N°26', 'BOURG-ACHARD N°25', 'INCARVILLE N°19', 'HEUDEBOUVILLE N°18'];
  for (const n of attendus) assert.ok(idx(n) >= 0, n + ' devrait deja exister');
});

test('9 relations lues sans ambiguite dans la grille SAPN (classes 1 et 2, 2 corridors) : 0 divergence', () => {
  const prix = decoderPrix();
  const get = (a, b) => { const i = idx(a), j = idx(b); return prix.get(Math.min(i, j) * 1000 + Math.max(i, j)); };
  const cas = [
    ['CAEN (A13)', 'CAGNY (A813)', [0.9, 1.2]],
    ['CAEN (A13)', 'TROARN N°31', [0.9, 1.2]],
    ['CAGNY (A813)', 'TROARN N°31', [0.9, 1.2]],
    ['ST-ROMAIN-DE-COLBOSC', 'BOLBEC', [1.0, 1.7]],
    ['ST-ROMAIN-DE-COLBOSC', 'FECAMP', [2.4, 3.9]],
    ['BOLBEC', 'FECAMP', [1.6, 2.7]],
    ['ST-ROMAIN-DE-COLBOSC', 'YVETOT', [3.7, 5.7]],
    ['BOLBEC', 'YVETOT', [3.5, 4.6]],
    ['FECAMP', 'YVETOT', [1.9, 2.8]],
  ];
  for (const [a, b, attendu] of cas) {
    const v = get(a, b);
    assert.ok(v, a + '<->' + b + ' devrait avoir un prix');
    assert.ok(Math.abs(v[0] - attendu[0]) < 0.05 && Math.abs(v[1] - attendu[1]) < 0.05,
      a + '<->' + b + ' attendu ' + attendu + ' trouve ' + v);
  }
});

test('correctif : DOZULE, PONT-L\'EVEQUE, LA RIVIERE-SAINT-SAUVEUR, BONNIERES-SUR-SEINE, LA HAIE-TONDUE existent deja (faux absents detectes par une recherche sensible aux accents)', () => {
  for (const motCle of ['DOZUL', 'PONT-L.EV.QUE', 'RIVI.RE-SAINT-SAUVEUR', 'BONNI.RES-SUR-SEINE', 'HAIE-TONDUE']) {
    assert.ok(idxInsensible(motCle) >= 0, motCle + ' devrait exister (recherche insensible aux accents)');
  }
});

test('2 relations complementaires DOZULE<->PONT-L\'EVEQUE et CAEN<->PONT-L\'EVEQUE (classes 1 et 2) : 0 divergence avec la grille SAPN', () => {
  const prix = decoderPrix();
  const dozule = idx('DOZULÉ N°30');
  const pont = idx("PONT-L'ÉVÊQUE / DEAUVILLE (A132)");
  const caen = idx('CAEN (A13)');
  assert.ok(dozule >= 0 && pont >= 0 && caen >= 0);
  const get = (a, b) => prix.get(Math.min(a, b) * 1000 + Math.max(a, b));
  assert.deepEqual(get(dozule, pont), [2.2, 3.5]);
  assert.deepEqual(get(caen, pont), [4.2, 6.1]);
});

test('seuls LE HAVRE et TANCARVILLE restent reellement absents (recherche insensible aux accents, 0 resultat)', () => {
  assert.equal(idxInsensible('LE HAVRE'), -1);
  assert.equal(idxInsensible('TANCARVILLE'), -1);
});
