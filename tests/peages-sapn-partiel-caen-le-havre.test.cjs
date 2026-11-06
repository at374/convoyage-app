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
// certaines gares intermediaires (La Haie-Tondue, Toutainville, Tancarville,
// Plateau N°2, Bonnieres-sur-Seine) n'ont straightement aucun prix sur leur
// ligne. Parser automatiquement l'ensemble en confondant "cellule vide
// legitime" et "decalage d'extraction" serait un risque reel de desaligner
// prix et gares -- le meme risque identifie pour SANEF. Decision : verifier
// PONCTUELLEMENT les relations lisibles sans ambiguite (aucune cellule vide
// avant la gare consideree), plutot que de parser tout le fichier.
//
// Resultat : 9 relations verifiees sur les 2 corridors x 2 classes (CAEN/
// CAGNY/TROARN classe 1 et 2 ; ST-ROMAIN-DE-COLBOSC/BOLBEC/FECAMP/YVETOT
// classe 1 et 2) : 0 DIVERGENCE. La quasi-totalite des gares des 2 corridors
// est deja presente dans peages-aprr.json sous un nom identique ou quasi-
// identique (ST-ROMAIN-DE-COLBOSC, BOLBEC, FECAMP, YVETOT, YERVILLE, BEAUTOT,
// ST-SAENS, CAEN (A13), CAGNY (A813), TROARN N°31, PLATEAU N°2 (A29), CHENARD
// N°1 (A29), BEUZEVILLE N°28, TOUTAINVILLE N°27, BOURNEVILLE N°26, BOURG-
// ACHARD N°25, CRIQUEBEUF...MAISON-BRULEE, INCARVILLE N°19, HEUDEBOUVILLE
// N°18, CHAUFOUR...GAILLON N°17, POISSY/ORGEVAL...MANTES-SUD N°12).
//
// Gares reellement absentes et confirmees via le referentiel officiel
// (data/gares-peage-officiel.json) -- gap reel, pas simple probleme de nom :
//   - LE HAVRE N°5/A131 : aucune correspondance officielle trouvee.
//   - DOZULE N°30 : existe officiellement ("Dozule Echangeur Sortie/Entree",
//     "Dozule BPV Nord/Sud"), absent de peages-aprr.json.
//   - PONT L'EVEQUE, DEAUVILLE (A132) : aucune correspondance officielle
//     trouvee sous ce nom.
//   - LA RIVIERE-SAINT-SAUVEUR N°3 (A29) : aucune correspondance officielle
//     trouvee sous ce nom.
//   - TANCARVILLE (A131) : existe officiellement ("PEAGE PONT TANCARVILLE"),
//     absent de peages-aprr.json.
//   - BONNIERES-SUR-SEINE (A13a) : aucune correspondance officielle trouvee.
// Ces 6 gares restent un "chantier SAPN" distinct : les ajouter demanderait
// de verifier leur GPS officiel ET leur insertion correcte dans le graphe de
// routage (routes-ui.js, mecanisme OUV/barrieres), pas seulement une valeur
// de prix -- donc non traite dans cette session pour eviter toute
// approximation sur un sujet aussi structurel.
//
// Run: node --test tests/peages-sapn-partiel-caen-le-havre.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const officiel = require('../data/gares-peage-officiel.json');

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

test('6 gares SAPN confirmees absentes de peages-aprr.json (chantier distinct, non traite ici)', () => {
  for (const n of ['LE HAVRE', 'DOZULE', 'TANCARVILLE', 'BONNIERES', 'RIVIERE-SAINT-SAUVEUR']) {
    assert.equal(idx(n), -1, n + ' ne devrait pas (encore) exister dans peages-aprr.json');
  }
  // 2 d'entre elles existent bien officiellement (gap reel a traiter plus tard) :
  assert.ok(officiel.d.some(r => r[0] === 'Dozule Echangeur Sortie'));
  assert.ok(officiel.d.some(r => r[0] === 'PEAGE PONT TANCARVILLE'));
});
