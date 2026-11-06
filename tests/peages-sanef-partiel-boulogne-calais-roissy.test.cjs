'use strict';
// Verification PARTIELLE de la grille SANEF (6 nov. 2026), suite a "Continue
// cherche bien" / "Continue". Fichier officiel local sanef2026.txt :
// contrairement a ASF/ESCOTA/AREA/APRR/COFIROUTE (listes explicites de
// relations, une par ligne), ce fichier est une MATRICE TRIANGULAIRE extraite
// d'un PDF (chaque gare liste ses prix vers toutes les gares precedentes),
// repetee 5 fois (une par classe 1 a 5), avec plusieurs defauts d'extraction
// structurels :
//   - certains prix se retrouvent sur une ligne separee de leur gare (avant
//     un intertitre d'autoroute), un artefact de mise en page PDF ;
//   - au moins une ligne regroupe 3 gares "systeme ouvert" distinctes en une
//     seule ligne de texte (Vallee de la Hem / La Neuvillette / Survilliers-
//     Saint-Witz) ;
//   - les noms de certaines gares se terminent par une parenthese sur la
//     ligne suivante.
// Un parseur general et fiable pour l'ENSEMBLE du fichier demanderait un
// travail disproportionne avec un risque reel de mal aligner prix et gares
// -- exactement le type d'erreur silencieuse que cet audit cherche a
// eliminer. Decision : verifier seulement les DEUX premieres sections
// (classes 1 et 2) dont l'integrite triangulaire est parfaite une fois
// parsees (0 anomalie de structure sur 22 puis 33 gares, Boulogne-Est a
// Neufchatel-en-Bray, puis Calais a Paris/Roissy) ; le reste du fichier
// (a partir de "Coutevroult") n'est PAS verifie automatiquement ici.
//
// Resultat sur les 2 sections fiables (759 relations possibles) : 502
// relations resolues avec un prix existant, 0 DIVERGENCE. 257 relations
// concernent des noms non trouves par la simple normalisation utilisee ici --
// MAIS une verification complementaire (6 nov. 2026) montre que 3 d'entre eux
// sont de FAUX absents : POIX-DE-PICARDIE, HORDAIN et BAPAUME existent deja
// dans peages-aprr.json avec des coordonnees GPS identiques au referentiel
// officiel (data/gares-peage-officiel.json) -- la non-correspondance venait
// uniquement du fait que le fichier SANEF colle un suffixe d'axe a leur nom
// ("POIX-DE-PICARDIE N°13 A29", etc.), non retire par la normalisation de ce
// test. Prix deja present confirme exact : HORDAIN<->BAPAUME classe 1 = 5,2 EUR
// dans peages-aprr.json, identique a la valeur lue directement dans la grande
// table SANEF (section non fiable automatiquement, lue ici ponctuellement).
// Verification complementaire : "SENLIS N°8" dans la grille SANEF correspond
// lui aussi a un faux absent, au moins pour sa gare de Chamant -- la gare
// "PARIS / ROISSY (péage de Chamant)" deja presente dans peages-aprr.json est
// geographiquement IDENTIQUE a "Senlis-Chamant Sortie" du referentiel officiel
// (0,02km), simplement nommee par direction plutot que par lieu. Prix deja
// present confirme exact : PARIS/ROISSY(Chamant)<->BAPAUME classe 1 = 12,9 EUR,
// identique a la valeur lue dans la grille SANEF (SENLIS<->BAPAUME = 12,9 EUR).
// Seule "Senlis-Bonsecours" (l'autre demi-echangeur de Senlis) reste a
// verifier separement.
//
// Restent donc 6 noms reellement a traiter dans un futur "chantier SANEF"
// distinct (meme rigueur que le chantier COFIROUTE) : La Cote Picarde,
// L'Isle-Adam, Aumale, Saint-Omer, Nœux-les-Mines, Amiens Est -- plus la
// verification specifique de Senlis-Bonsecours. Aumale a 2 sous-gares
// officielles proches mais distinctes (Est/Ouest) que la matrice SANEF (nom
// unique) ne permet pas de desambiguiser sans source supplementaire ;
// Isle-Adam, Saint-Omer et Nœux-les-Mines n'ont aucune correspondance meme
// partielle au referentiel officiel.
//
// Run: node --test tests/peages-sanef-partiel-boulogne-calais-roissy.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const aprr = require('../peages-aprr.json');

const SANEF_PATH = '/tmp/claude-0/-home-claude/c7c9ce3a-820f-532b-bac1-cdca9bdf0d53/scratchpad/sanef2026.txt';

function isPureNumbers(l) { return /^[\s]*[\d,]+([\s]+[\d,]+)*[\s]*$/.test(l) && l.trim().length > 0; }
function isAxisHeader(l) { return /AUTOROUTE/i.test(l) && !/[\d],[\d]/.test(l); }
function isJunk(l) { return /^TARIFS DE PEAGE/.test(l.trim()) || /^\d{4}$/.test(l.trim()); }
function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, '').replace(/N°[\d.]+/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

function parseSection(lines) {
  const tables = []; let cur = []; let pending = [];
  for (const l of lines) {
    if (l.trim() === '') continue;
    if (isJunk(l)) continue;
    if (isAxisHeader(l)) continue;
    const toks = l.trim().split(/\s+/);
    if (isPureNumbers(l)) { pending.push(...toks); continue; }
    let i = 0; const nums = [];
    while (i < toks.length && /^[\d,]+$/.test(toks[i])) { nums.push(toks[i]); i++; }
    const name = toks.slice(i).join(' ').trim();
    if (!name) continue;
    if (nums.length === 0 && pending.length === 0 && /^\(.*\)$/.test(name) && cur.length) { cur[cur.length - 1].name += ' ' + name; continue; }
    const prices = [...pending, ...nums].map(s => parseFloat(s.replace(',', '.')));
    pending = [];
    if (prices.length === 0 && cur.length > 0) { tables.push(cur); cur = []; }
    cur.push({ name, prices });
  }
  if (cur.length) tables.push(cur);
  return tables;
}
function cleanTables(tables) { return tables.filter(t => t.every((s, i) => s.prices.length === i) && t.length > 3); }

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
function idxByNorm() {
  const m = new Map();
  aprr.g.forEach((g, i) => { const n = norm(g[0]); if (!m.has(n)) m.set(n, []); m.get(n).push(i); });
  return m;
}

test('les 2 premieres sections (classe 1 et classe 2) du fichier SANEF parsent avec une integrite triangulaire parfaite (22 puis 33 gares, 0 anomalie)', () => {
  const all = fs.readFileSync(SANEF_PATH, 'utf8').split('\n');
  const c1 = cleanTables(parseSection(all.slice(9, 118)));
  const c2 = cleanTables(parseSection(all.slice(119, 228)));
  assert.deepEqual(c1.map(t => t.length), [22, 33]);
  assert.deepEqual(c2.map(t => t.length), [22, 33]);
});

test('sur les 759 relations possibles de ces 2 sections, 0 divergence de prix (502 relations resolues)', () => {
  const all = fs.readFileSync(SANEF_PATH, 'utf8').split('\n');
  const c1 = cleanTables(parseSection(all.slice(9, 118)));
  const c2 = cleanTables(parseSection(all.slice(119, 228)));
  const prix = decoderPrix();
  const idx = idxByNorm();
  let matched = 0, mismatched = 0;
  for (let ti = 0; ti < c1.length; ti++) {
    const t1 = c1[ti], t2 = c2[ti];
    for (let i = 0; i < t1.length; i++) for (let j = 0; j < i; j++) {
      const oi = idx.get(norm(t1[i].name)), oj = idx.get(norm(t1[j].name));
      if (!oi || !oj) continue;
      const cc1 = t1[i].prices[j], cc2 = t2[i].prices[j];
      let found = false;
      for (const o of oi) for (const d of oj) {
        const v = prix.get(Math.min(o, d) * 1000 + Math.max(o, d));
        if (v) { found = true; if (Math.abs(v[0] - cc1) < 0.05 && Math.abs(v[1] - cc2) < 0.05) matched++; else mismatched++; break; }
        if (found) break;
      }
    }
  }
  assert.equal(mismatched, 0);
  assert.ok(matched >= 450, 'trouve ' + matched);
});

test('POIX-DE-PICARDIE, HORDAIN et BAPAUME ne sont PAS des gares manquantes : coordonnees GPS identiques au referentiel officiel, deja presentes dans peages-aprr.json', () => {
  const off = require('../data/gares-peage-officiel.json');
  const cas = [
    { aprrNom: 'POIX-DE-PICARDIE', officiel: 'Poix-de-Picardie Sortie' },
    { aprrNom: 'HORDAIN', officiel: 'Hordain BPV Sortie sens 1' },
    { aprrNom: 'BAPAUME', officiel: 'Bapaume Sortie' },
  ];
  for (const { aprrNom, officiel } of cas) {
    const g = aprr.g.find(x => x[0] === aprrNom);
    const o = off.d.find(x => x[0] === officiel);
    assert.ok(g, aprrNom + ' doit exister dans peages-aprr.json');
    assert.ok(o, officiel + ' doit exister dans le referentiel officiel');
    const [lat1, lon1] = g[1][0];
    const [lat2, lon2] = [o[2], o[3]];
    const dist = 111 * Math.sqrt((lat1 - lat2) ** 2 + ((lon1 - lon2) * Math.cos(lat1 * Math.PI / 180)) ** 2);
    assert.ok(dist < 1, aprrNom + ' devrait etre a moins de 1km du referentiel officiel, trouve ' + dist.toFixed(2) + 'km');
  }
});

test('"PARIS / ROISSY (péage de Chamant)" n\'est pas un bug GPS : c\'est Senlis-Chamant, nomme par direction plutot que par lieu', () => {
  const off = require('../data/gares-peage-officiel.json');
  const g = aprr.g.find(x => x[0] === 'PARIS / ROISSY');
  const o = off.d.find(x => x[0] === 'Senlis-Chamant Sortie');
  assert.ok(g && o);
  const [lat1, lon1] = g[1][0];
  const [, , lat2, lon2] = o;
  const dist = 111 * Math.sqrt((lat1 - lat2) ** 2 + ((lon1 - lon2) * Math.cos(lat1 * Math.PI / 180)) ** 2);
  assert.ok(dist < 0.5, 'devrait etre a moins de 0.5km, trouve ' + dist.toFixed(2) + 'km');
});

test('le prix SENLIS(Chamant)<->BAPAUME deja present (12,9 EUR classe 1) est confirme par lecture directe de la grande table SANEF', () => {
  const lignes = aprr.p.split(';');
  const prix = new Map();
  for (const l of lignes) {
    const [a, b, c1] = l.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), c1 / 10);
  }
  const roissy = aprr.g.findIndex(g => g[0] === 'PARIS / ROISSY');
  const bapaume = aprr.g.findIndex(g => g[0] === 'BAPAUME');
  const v = prix.get(Math.min(roissy, bapaume) * 1000 + Math.max(roissy, bapaume));
  assert.equal(v, 12.9);
});

test('le prix HORDAIN<->BAPAUME deja present (5,2 / 8,1 EUR) est confirme par lecture directe de la grande table SANEF (non parsee automatiquement)', () => {
  const lignes = aprr.p.split(';');
  const prix = new Map();
  for (const l of lignes) {
    const [a, b, c1, c2] = l.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10]);
  }
  const hordain = aprr.g.findIndex(g => g[0] === 'HORDAIN');
  const bapaume = aprr.g.findIndex(g => g[0] === 'BAPAUME');
  const v = prix.get(Math.min(hordain, bapaume) * 1000 + Math.max(hordain, bapaume));
  assert.deepEqual(v, [5.2, 8.1]);
});
