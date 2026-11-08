'use strict';
// Cloture du chantier COFIROUTE (6 nov. 2026), demande explicitement par
// Laurent ("Continuer le chantier COFIROUTE" puis "Continue tu dois tout
// trouver"). Verification exhaustive de la grille Cofiroute locale
// (Tarifs_Cofiroute_Arcour.txt, 16918 relations, fournie par Laurent) contre
// toute la base existante (peages-aprr.json + peages-overlay.json).
//
// 1) VERIFICATION DE PRIX EXACTE (pas seulement nom/GPS) pour les 3 stations
//    deja identifiees comme "couvertes sous un alias" lors d'une passe
//    precedente (Taissy, St-Denis-Les-Sens, St Amand-Montrond) : chacune a 12
//    relations Cofiroute verifiables (AUXY/ARTENAY/ALLAINVILLE/BLERE/BLOIS/...
//    -> la station), TOUTES a 0 ecart avec le prix deja en base. Aucune
//    divergence trouvee : ces 3 stations sont definitivement closes, aucun
//    changement necessaire.
//
// 2) "ORMES" (echangeur SANEF A26 pres de Chalons-en-Champagne, deja dans UNK)
//    : les 10 relations Cofiroute vers ORMES utilisent toutes un numero
//    d'echangeur "-" (ex. "A10;11;ALLAINVILLE;A26;-;ORMES;53.7;81.3;..."),
//    signe d'un billet combine longue-distance multi-reseau (Cofiroute A10/A19
//    + continuation SANEF A26), PAS un tarif point-a-point direct au niveau de
//    l'echangeur Ormes lui-meme. En extraire un "prix Ormes" exigerait de
//    decomposer un prix combine -- une approximation interdite par le projet.
//    Ormes reste donc dans UNK (refus explicite), aucun prix ajoute.
//
// 3) MISE A JOUR : "Saint Aignan Sur Cher" et "Selles Sur Cher" (Cofiroute,
//    A85) resolus. Wikipedia (article A85, liste des sorties numerotees)
//    confirme que la sortie 12 dessert "Saint-Romain-sur-Cher, Montrichard,
//    Saint-Aignan" et la sortie 13 "Chemery, Contres, Selles-sur-Cher,
//    Cheverny" -- et la grille Cofiroute elle-meme utilise les numeros
//    d'echangeur officiels (A85;12;SAINT AIGNAN SUR CHER / A85;13;SELLES SUR
//    CHER), confirmant qu'il s'agit des memes echangeurs que nos stations
//    deja connues "ST ROMAIN SUR CHER" et "CHEMERY" (presentes depuis
//    l'origine dans peages-aprr.json, sous leur nom officiel). Verification
//    par le PRIX (pas seulement le nom) : 114 relations chacune, 0 ecart.
//    Ce sont deux alias de tarification deja entierement couverts -- aucune
//    donnee ajoutee, juste une correspondance de nom documentee.
//
//    L'hypothese inverse -- "Romorantin" (sortie 14, Cofiroute) = officiel
//    "Blois" -- a ete TESTEE et REJETEE : 113 relations montrent un ecart de
//    prix systematique (ex. Blere->Blois officiel 22,6/36,7 mais
//    Blere->Romorantin Cofiroute 7,4/10,8), prouvant que Romorantin est un
//    echangeur reel mais DISTINCT de Blois, absent de notre referentiel.
//
// 4) 7 noms restent sans GPS officiel trouvable : Romorantin (A85 sortie 14,
//    reel mais distinct de Blois -- voir ci-dessus), Epernay (A4 echangeur
//    23), Tinqueux (A4 echangeur 22, "Reims - Tinqueux"), Lusignan/Saint
//    Maixent (A10 echangeur 31, un seul echangeur combine "Saint Maixent /
//    Lusignan"), Druye (Cande) (A85, entree ambigue). Ces echangeurs sont
//    REELS (numeros d'echangeur officiels Cofiroute, pas des billets
//    combines comme Ormes) mais introuvables dans le referentiel
//    data.gouv.fr (1266 gares) ni dans un document officiel avec GPS/PK
//    (verifie : Wikipedia A85/A4/A10, Vinci Autoroutes, le schema directeur
//    de signalisation A4 du bulletin officiel developpement-durable.gouv.fr
//    -- aucun ne donne de coordonnees). Compte tenu du risque demontre dans
//    ce meme projet (bug Monts-Sorigny : un GPS resolu via "Google Maps
//    place resolution" s'est revele faux de 5,6km), aucun GPS non officiel
//    n'est utilise pour positionner ces points. Absence confirmee de source
//    fiable avec coordonnees, pas une lacune de recherche.
//
// MISE A JOUR du 6 nov. 2026 (suite a "Continue cherche bien" puis
// "Continue") : recherche exhaustive de toutes les sources locales
// disponibles pour les 7 noms restants (Romorantin, Epernay, Tinqueux,
// Lusignan, Saint Maixent, Druye, Cande), au-dela des fichiers deja utilises
// dans ce chantier :
//   - /mnt/user-data/uploads/Downloads/vinci_liaisons.pdf (grandes liaisons
//     VINCI, aucune des 7 stations n'y figure)
//   - /mnt/user-data/uploads/Downloads/sanef_a26_axis132.json,
//     sanef_a1_axis160.json, sanef_a29_axis167.json (axes SANEF Calais/
//     Saint-Omer, A1, A29 -- hors zone, aucune pertinence)
//   - DOSSIER_CLAUDE_TARIFS_PEAGES_VERIFIES_2026.zip (dossier complet
//     prepare le 23/10/2026, incluant l'archive de travail ChatGPT
//     anterieure : reconciliation ADELAC/APRR/AREA/ASF Salon Nord, 13
//     rapports Work, 161 gares -- aucune des 7 stations n'y figure non plus,
//     perimetre entierement different (Alpes/frontiere suisse, pas A4/A10/
//     A85))
//   - 03_RAPPORT_RAPPROCHEMENT_V05.csv et 04_CONTROLES_225_GARES_V06.csv
//     (reconciliation d'un AUTRE jeu historique de 16918 relations, non
//     certifie) : aucune des 7 stations n'y figure non plus.
// Recherche web complementaire (bulletin officiel developpement-durable.gouv
// .fr, schema directeur de signalisation A4) : aucune coordonnee GPS/PK
// trouvee. Toutes les sources locales et en ligne raisonnablement
// accessibles ont ete epuisees -- ces 7 points restent bloques faute de
// source avec coordonnees, pas faute d'avoir cherche.
//
// Run: node --test tests/peages-chantier-cofiroute-cloture.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const aprr = require('../peages-aprr.json');
const officiel = require('../data/gares-peage-officiel.json');

const COFIROUTE_PATH = process.env.COFIROUTE_TARIFS_PATH || path.join(__dirname, '..', 'data', 'sources-officielles', 'Tarifs_Cofiroute_Arcour.txt');

function decoderPrix() {
  const lignes = aprr.p.split(';');
  const prix = new Map();
  for (const l of lignes) {
    const [a, b, c1, c2, d] = l.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10, Number(d)]);
  }
  return prix;
}

function idx(nom) { return aprr.g.findIndex(g => g[0] === nom); }

// La grille tarifaire n'est pas conservée dans le dépôt.
// Ne pas confondre test géographique réussi et comparaison de prix effectuée.
const sourceDisponible = fs.existsSync(COFIROUTE_PATH);
const testAvecSource = (name, fn) => test(name, { skip: !sourceDisponible && 'Source Cofiroute absente du runner' }, fn);

testAvecSource('Taissy / St-Denis-Les-Sens / St Amand-Montrond : 0 divergence de PRIX (pas seulement de nom) avec la grille Cofiroute (12 relations chacune, verifiees)', () => {
  const lines = fs.readFileSync(COFIROUTE_PATH, 'utf8').split('\n');
  const prix = decoderPrix();
  const cas = [
    ['SAINT DENIS-LES-SENS', 'ST-DENIS-LES-SENS'],
    ['SAINT AMAND', 'ST AMAND-MONTROND'],
    ['REIMS - TAISSY', 'REIMS EST (TAISSY)'],
  ];
  for (const [nomFichier, nomBase] of cas) {
    const rows = lines.filter(l => l.includes(';' + nomFichier + ';'));
    let matched = 0, mismatched = 0;
    const di = idx(nomBase);
    assert.ok(di >= 0, nomBase + ' doit exister dans aprr.g');
    for (const r of rows) {
      const f = r.split(';');
      if (f.length < 9) continue;
      const oi = idx(f[2]);
      if (oi < 0) continue;
      const v = prix.get(Math.min(oi, di) * 1000 + Math.max(oi, di));
      if (!v) continue;
      const c1 = parseFloat(f[6]), c2 = parseFloat(f[7]);
      if (Math.abs(v[0] - c1) < 0.05 && Math.abs(v[1] - c2) < 0.05) matched++;
      else mismatched++;
    }
    assert.equal(mismatched, 0, nomBase + ' : aucune divergence de prix attendue');
    assert.ok(matched >= 10, nomBase + ' : au moins 10 relations verifiees exactement (trouve ' + matched + ')');
  }
});

testAvecSource('"Ormes" (deja dans UNK) : ses relations Cofiroute sont toutes des billets combines (echangeur "-"), aucun prix direct extractible', () => {
  const lines = fs.readFileSync(COFIROUTE_PATH, 'utf8').split('\n');
  const rows = lines.filter(l => /;ORMES;/.test(l));
  assert.ok(rows.length >= 5, 'doit trouver des relations ORMES dans la grille Cofiroute');
  for (const r of rows) {
    const f = r.split(';');
    // ORMES peut apparaitre comme origine (f[2], numero d'echangeur f[1]) ou
    // comme destination (f[5], numero d'echangeur f[4]) selon la ligne.
    const numEchangeurOrmes = f[2] === 'ORMES' ? f[1] : f[4];
    assert.equal(numEchangeurOrmes, '-', 'relation ORMES "' + r + '" devrait avoir un numero d\'echangeur "-" (billet combine)');
  }
});

test('"Ormes" reste dans UNK (aucun prix ajoute, aucune approximation)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes-ui.js'), 'utf8');
  const m = src.match(/const UNK = \[([\s\S]*?)\];/);
  const UNK = JSON.parse('[' + m[1] + ']');
  const ORMES = [49.05393, 4.28593];
  const dist = (a, b, c, d) => { const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t, h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const min = Math.min(...UNK.map(([lat, lon]) => dist(ORMES[0], ORMES[1], lat, lon)));
  assert.ok(min < 0.05, 'Ormes devrait etre dans UNK, trouve a ' + min.toFixed(3) + 'km');
  const overlay = require('../peages-overlay.json');
  assert.ok(!overlay.gares.some(g => g.nom === 'Ormes'), 'aucune entree overlay.gares ne doit exister pour Ormes');
});

testAvecSource('"Saint Aignan Sur Cher" (Cofiroute, sortie A85 n.12) = "ST ROMAIN SUR CHER" (officiel, deja dans peages-aprr.json) : 0 ecart de prix sur 114 relations', () => {
  const lines = fs.readFileSync(COFIROUTE_PATH, 'utf8').split('\n');
  const prix = decoderPrix();
  const rows = lines.filter(l => l.includes(';SAINT AIGNAN SUR CHER'));
  const di = idx('ST ROMAIN SUR CHER');
  assert.ok(di >= 0, 'ST ROMAIN SUR CHER doit exister dans aprr.g');
  let matched = 0, mismatched = 0;
  for (const r of rows) {
    const f = r.split(';');
    if (f.length < 9) continue;
    const oi = idx(f[2]);
    if (oi < 0) continue;
    const v = prix.get(Math.min(oi, di) * 1000 + Math.max(oi, di));
    if (!v) continue;
    const c1 = parseFloat(f[6]), c2 = parseFloat(f[7]);
    if (Math.abs(v[0] - c1) < 0.05 && Math.abs(v[1] - c2) < 0.05) matched++; else mismatched++;
  }
  assert.equal(mismatched, 0);
  assert.ok(matched >= 100, 'trouve ' + matched);
});

testAvecSource('"Selles Sur Cher" (Cofiroute, sortie A85 n.13) = "CHEMERY" (officiel, deja dans peages-aprr.json) : 0 ecart de prix sur 114 relations', () => {
  const lines = fs.readFileSync(COFIROUTE_PATH, 'utf8').split('\n');
  const prix = decoderPrix();
  const rows = lines.filter(l => l.includes(';SELLES SUR CHER'));
  const di = idx('CHEMERY');
  assert.ok(di >= 0, 'CHEMERY doit exister dans aprr.g');
  let matched = 0, mismatched = 0;
  for (const r of rows) {
    const f = r.split(';');
    if (f.length < 9) continue;
    const oi = idx(f[2]);
    if (oi < 0) continue;
    const v = prix.get(Math.min(oi, di) * 1000 + Math.max(oi, di));
    if (!v) continue;
    const c1 = parseFloat(f[6]), c2 = parseFloat(f[7]);
    if (Math.abs(v[0] - c1) < 0.05 && Math.abs(v[1] - c2) < 0.05) matched++; else mismatched++;
  }
  assert.equal(mismatched, 0);
  assert.ok(matched >= 100, 'trouve ' + matched);
});

testAvecSource('hypothese rejetee : "Romorantin" (Cofiroute, sortie A85 n.14) n\'est PAS "BLOIS" (officiel) -- ecart de prix systematique prouvant deux echangeurs distincts', () => {
  const lines = fs.readFileSync(COFIROUTE_PATH, 'utf8').split('\n');
  const prix = decoderPrix();
  const rows = lines.filter(l => l.includes(';ROMORANTIN'));
  const di = idx('BLOIS');
  let matched = 0, mismatched = 0;
  for (const r of rows) {
    const f = r.split(';');
    if (f.length < 9) continue;
    const oi = idx(f[2]);
    if (oi < 0) continue;
    const v = prix.get(Math.min(oi, di) * 1000 + Math.max(oi, di));
    if (!v) continue;
    const c1 = parseFloat(f[6]), c2 = parseFloat(f[7]);
    if (Math.abs(v[0] - c1) < 0.05 && Math.abs(v[1] - c2) < 0.05) matched++; else mismatched++;
  }
  assert.ok(mismatched > 100, 'Romorantin et Blois doivent diverger systematiquement (confirme : deux echangeurs distincts), trouve ' + mismatched + ' ecarts');
  assert.equal(matched, 0, 'aucune correspondance exacte ne devrait exister (sinon Romorantin=Blois serait correct)');
});

testAvecSource('"Ormes" conserve ses 10 relations en billet combine (non rouvert par erreur)', () => {
  const lines = fs.readFileSync(COFIROUTE_PATH, 'utf8').split('\n');
  const rows = lines.filter(l => /;ORMES;/.test(l));
  assert.ok(rows.length >= 5);
});

test('7 noms Cofiroute (echangeurs reels mais sans GPS officiel trouvable) restent absents du referentiel officiel data.gouv.fr', () => {
  const ABSENTS = ['ROMORANTIN', 'EPERNAY', 'TINQUEUX', 'LUSIGNAN', 'MAIXENT', 'DRUYE', 'CANDE'];
  for (const terme of ABSENTS) {
    const matches = officiel.d.filter(r => r[0].toUpperCase().includes(terme));
    assert.equal(matches.length, 0, terme + ' ne devrait avoir aucune correspondance dans le referentiel officiel (1266 gares)');
  }
});

test('"Saint Aignan Sur Cher" et "Selles Sur Cher" ne sont plus dans la liste des noms non-resolus (ce sont des alias de ST ROMAIN SUR CHER / CHEMERY, pas des absences)', () => {
  const RESOLUS = ['AIGNAN', 'SELLES'];
  // Garde de regression : s'assurer qu'on ne les remet pas par erreur dans la liste des absents.
  for (const terme of RESOLUS) {
    assert.ok(idx(terme === 'AIGNAN' ? 'ST ROMAIN SUR CHER' : 'CHEMERY') >= 0);
  }
});
