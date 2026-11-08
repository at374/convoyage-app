'use strict';
// Documentation des fichiers officiels Tarifs_A86.txt (Duplex A86, 644 lignes)
// et Tarifs_Arcos.txt (Itthenheim, A35 pres de Strasbourg, 1092 lignes),
// fournis par Laurent le 8 nov. 2026 (telecharges depuis
// public-content.vinci-autoroutes.com, applicables respectivement au
// 1er janvier et au 1er fevrier 2026).
//
// CES DEUX RESEAUX SONT STRUCTURELLEMENT INCOMPATIBLES avec le moteur de prix
// actuel (peages-aprr.json / peages-overlay.json), qui n'a qu'un seul prix
// classe 1 et un seul prix classe 2 par relation :
//   - A86 (Duplex Rueil-Vaucresson-Velizy) : colonnes
//     "Type_jour;paiement_badge;Heure_debut;heure_fin;<6 trajets>" -- le
//     tarif depend du jour de la semaine, de la tranche horaire ET du mode
//     de paiement (badge ou non). Un seul trajet (ex. Rueil->Velizy) a donc
//     potentiellement plusieurs dizaines de prix differents selon l'heure.
//   - Arcos (Itthenheim) : colonnes "Trajet;plage horaire;classe;Tarif_TTC;
//     groupe_euro" -- meme logique, tarif variable par plage horaire et par
//     "groupe_euro" (norme d'emission du vehicule), pas de notion de
//     relation point-a-point classe1/classe2 fixe.
//
// Aucune des gares citees (Rueil, Vaucresson, Velizy, Itthenheim) n'existe
// dans la base actuelle (aprr.g, overlay.gares, overlay.paires) : ce sont
// deux angles morts reels, mais les ajouter necessiterait une extension du
// modele de donnees (dimension temporelle), pas une simple relation
// classe1/classe2. Conformement a la regle "zero approximation", aucun prix
// unique n'est invente pour remplacer une grille horaire.
//
// Run: node --test tests/peages-a86-arcos-structurellement-incompatibles.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

const A86_PATH = path.join(__dirname, '..', 'data', 'sources-officielles', 'Tarifs_A86.txt');
const ARCOS_PATH = path.join(__dirname, '..', 'data', 'sources-officielles', 'Tarifs_Arcos.txt');

test('A86 Duplex (Rueil/Vaucresson/Velizy) : tarification horaire confirmee, gares absentes de la base', { skip: !fs.existsSync(A86_PATH) && 'Tarifs_A86.txt absent' }, () => {
  const header = fs.readFileSync(A86_PATH, 'utf8').split('\n')[0];
  assert.match(header, /Type_jour/);
  assert.match(header, /Heure/);
  const allNames = [...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom), ...overlay.paires.flatMap(p => [p[0], p[1]])].map(n => n.toLowerCase());
  for (const n of ['rueil', 'vaucresson', 'velizy']) {
    assert.equal(allNames.some(x => x.includes(n)), false, n + ' ne doit pas avoir ete ajoute sans modele de prix horaire');
  }
});

test('Arcos (Itthenheim, A35) : tarification par plage horaire confirmee, gare absente de la base', { skip: !fs.existsSync(ARCOS_PATH) && 'Tarifs_Arcos.txt absent' }, () => {
  const header = fs.readFileSync(ARCOS_PATH, 'utf8').split('\n')[0];
  assert.match(header, /plage horaire/);
  assert.match(header, /Tarif_TTC/);
  const allNames = [...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom)].map(n => n.toLowerCase());
  assert.equal(allNames.some(x => x.includes('itthenheim')), false, 'Itthenheim ne doit pas avoir ete ajoute sans modele de prix horaire');
});
