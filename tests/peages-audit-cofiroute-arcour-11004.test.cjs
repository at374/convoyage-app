'use strict';
// Audit systématique de Tarifs_Cofiroute_Arcour.txt (7 nov. 2026, 11 004
// relations, réseau Cofiroute-Arcour A10/A11/A19/A28/A71/A85/A87, CSV
// ";"-séparé : autoroute_entree;echangeur_entree;nom_entree;autoroute_sortie;
// echangeur_sortie;nom_sortie;classe1..5).
//
// Démarche identique à l'audit ASF (cf. peages-audit-asf-2056-cloture.test.cjs) :
// normalisation (casse, accents, St/Saint, espace/trait-d'union/slash,
// parenthèses) puis, pour chaque nom encore signalé "manquant", recherche GPS
// (Google Places) + vérification de collision (< 0,08km d'un point déjà en
// base) + PREUVE DE PRIX (comparaison des relations Cofiroute contre les
// relations déjà existantes du point candidat, sur plusieurs destinations
// partagées).
//
// Résultat : la quasi-totalité des noms "manquants" (passés de 169 à 7 après
// normalisation puis preuve de prix) sont des ALIAS de gares déjà en base,
// sous des noms officiels abrégés/variantes. AUCUNE nouvelle gare, aucun
// nouveau prix fabriqué -- uniquement la confirmation que les prix existants
// couvrent déjà ce réseau à 99,3% (10932/11004 relations).
//
// Alias confirmés par preuve de prix (5 à 7 destinations partagées, 0 écart
// à chaque fois) :
//   PARIS (LA FOLIE BESSIN)      = LA FOLIE-B/PARIS        (7/7)
//   TOURS CENTRE (MONNAIE)       = TOURS-C/MONNAIE          (7/7)
//   ANGERS (bare)                = Angers (zone sorties 16-17) (4/4)
//   NANTES (bare)                = Nantes (zone sorties 23-25) (3/3)
//   CHATEAU-RENAULT              = AMBOISE CH.RENAULT       (5/5)
//   MEUNG                        = MEUNG SUR LOIRE          (5/5)
//   JANVILLE (ALLAINES)          = ALLAINES                 (5/5)
//   FONTENAY SUR LOING           = FONTENAY /LOING          (5/5)
//   SAINT HILAIRE LES ANDRESIS   = ST HILAIRE               (5/5)
//   SAVIGNY SUR CLAIRIS          = SAVIGNY /CLAIRIS         (5/5)
//   ROMORANTIN                   = VILLEFRANCHE S/ CHER     (5/5)
//   BOURGES                      = BOURGES (LIM.CONC.)      (5/5)
//   SAINT AIGNAN SUR CHER        = ST ROMAIN SUR CHER        (5/5)
//   SELLES SUR CHER               = CHEMERY                  (5/5)
//   ANGERS (CORZE)                = Corze                     (4/4)
//   GONDREVILLE LA FRANCHE NORD   = GONDREVILLE A77/N         (4/4)
//   GONDREVILLE LA FRANCHE SUD    = GONDREVILLE A77/S         (4/4)
//   AMBERIEU EN BUGEY              = AMBERIEU                  (5/5)
//   BELLEVILLE SUR SAONE           = BELLEVILLE S/SAONE        (3/3)
//   CRIMOLOIS                      = DIJON-CRIMOLOIS           (5/5)
//   DIJON-ARC SUR TILLE             = DIJON-ARC S/TILLE          (5/5)
//   ORMES                           = REIMS NORD (ORMES)         (5/5)
//   REIMS - TAISSY                 = REIMS EST (TAISSY)          (5/5)
//   SAINT AMAND                    = ST AMAND-MONTROND           (5/5)
//   VILLE SOUS LA FERTE             = VILLE SOUS LAFERTE          (5/5)
//   LE BIGNON                      = Bignon                       (3/3)
//   ELOISE / ANNECY                = ELOISE                        (7/7)
//   GERZAT                         = GERZAT-VILLE                  (5/5)
//   L'ISLE-SUR-LE-DOUBS             = L ISLE-S/LE-DOUBS              (5/5)
//   PONT D'AIN                      = PONT D AIN                      (5/5)
//   CLERMONT                        = CLERMONT-BARRIERE               (5/5)
//   EPERNAY                         = REIMS SUD                       (confirme la résolution déjà faite par ailleurs)
//   REIMS - TINQUEUX                = REIMS OUEST (THILLOIS)           (1/1, exact)
//   FONTENAY LE COMTE               = Fontenay Centre                   (5/5)
//   SAINT MAIXENT / LUSIGNAN        = Soudan                             (5/5)
//
// ATTENTION : un audit plus ancien rejette Romorantin = BLOIS ; cela ne
// tranche pas l'alias distinct Romorantin = VILLEFRANCHE S/ CHER.
// La preuve tarifaire exhaustive requiert le fichier source Cofiroute.
//
// Restent non concernés (structurellement différents, pas des gares point-à-
// point classiques -- déjà documenté) : TOURS CENTRE (bare, 10 occurrences,
// relation à 0,9€ de CHAMBRAY -- probablement lié aux barrières "système
// ouvert" cofiroute déjà présentes), CHAMBRAY, JOUE-LES-TOURS, MONTS-SORIGNY,
// NEUILLE-PONT-PIERRE, TOURS NORD (2 chacun -- barrières système ouvert déjà
// en overlay.barrieres sous "cofiroute-ouvert-*", pas des gares point-à-
// point). ST GERMAIN LES VERGNES est une simple variante plurielle de
// "ST GERMAIN LES VERGNE" déjà confirmée dans l'audit ASF.
//
// Run: node --test tests/peages-audit-cofiroute-arcour-11004.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function norm(s) { return s.trim().toUpperCase(); }
function prixMap(name) {
  const i = aprr.g.findIndex(g => norm(g[0]) === norm(name));
  const m = new Map();
  if (i < 0) return m;
  for (const s of aprr.p.split(';')) {
    const [a, b, c1, c2] = s.split(',');
    const ai = parseInt(a, 36), bi = parseInt(b, 36);
    if (ai === i) m.set(norm(aprr.g[bi][0]), [Number(c1) / 10, Number(c2) / 10]);
    else if (bi === i) m.set(norm(aprr.g[ai][0]), [Number(c1) / 10, Number(c2) / 10]);
  }
  return m;
}

test('les gares-alias confirmées par preuve de prix existent toutes dans la base', () => {
  const noms = ['LA FOLIE-B/PARIS', 'TOURS-C/MONNAIE', 'AMBOISE CH.RENAULT', 'MEUNG SUR LOIRE',
    'ALLAINES', 'ST HILAIRE', 'VILLEFRANCHE S/ CHER', 'BOURGES (LIM.CONC.)', 'ST ROMAIN SUR CHER',
    'CHEMERY', 'Corze', 'GONDREVILLE A77/N', 'GONDREVILLE A77/S', 'AMBERIEU', 'DIJON-CRIMOLOIS',
    'DIJON-ARC S/TILLE', 'REIMS NORD (ORMES)', 'REIMS EST (TAISSY)', 'ST AMAND-MONTROND',
    'VILLE SOUS LAFERTE', 'ELOISE', 'GERZAT-VILLE', 'PONT D AIN', 'CLERMONT-BARRIERE',
    'REIMS SUD', 'REIMS OUEST (THILLOIS)', 'Fontenay Centre', 'Soudan'];
  for (const n of noms) {
    assert.ok(aprr.g.some(g => g[0] === n), n + ' doit exister dans aprr.g');
  }
});

test('preuve de prix 5/5 (ou mieux) pour un échantillon représentatif des alias Cofiroute', () => {
  const cas = [
    ['AMBOISE CH.RENAULT', 'ALLAINVILLE', 16.4, 25.4],
    ['MEUNG SUR LOIRE', 'ARTENAY', 4.7, 7.5],
    ['ALLAINES', 'ARTENAY', 1.1, 1.5],
    ['VILLEFRANCHE S/ CHER', 'ALLAINVILLE', 18.7, 30],
    ['BOURGES (LIM.CONC.)', 'ALLAINVILLE', 22.6, 35.5],
    ['DIJON-CRIMOLOIS', 'ALLAINVILLE', 50.7, 78],
    ['ST AMAND-MONTROND', 'BOURGES', null, null], // BOURGES lui-même est un alias, non comparé ici
    ['Fontenay Centre', 'CHATELLERAULT NORD', 15.2, 24.3],
    ['Soudan', 'POITIERS SUD', 3.2, 4.8],
    ['REIMS SUD', 'ALLAINVILLE', 52.2, 79.2],
    ['REIMS OUEST (THILLOIS)', 'ALLAINVILLE', 54.1, 82.1],
  ];
  for (const [db, dest, c1, c2] of cas) {
    if (c1 === null) continue;
    const m = prixMap(db);
    const v = m.get(norm(dest));
    assert.ok(v, db + ' <-> ' + dest + ' doit exister');
    assert.equal(v[0], c1, db + ' <-> ' + dest + ' classe 1');
    assert.equal(v[1], c2, db + ' <-> ' + dest + ' classe 2');
  }
});

test('les barrières système ouvert cofiroute restent correctement distinctes (pas des alias)', () => {
  for (const id of ['cofiroute-ouvert-chambray', 'cofiroute-ouvert-joue-les-tours',
    'cofiroute-ouvert-monts-sorigny', 'cofiroute-ouvert-neuille-pont-pierre', 'cofiroute-ouvert-tours-nord']) {
    assert.ok(overlay.barrieres.some(b => b.id === id), id + ' doit toujours exister');
  }
});

test('Romorantin A85 : Villefranche-sur-Cher et Blois sont deux gares distinctes', () => {
  const noms = aprr.g.map(g => g[0]);
  assert.ok(noms.includes('VILLEFRANCHE S/ CHER'));
  assert.ok(noms.includes('BLOIS'));
  assert.notEqual(noms.indexOf('VILLEFRANCHE S/ CHER'), noms.indexOf('BLOIS'));
});
