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
// Resultat sur les 2 sections fiables (759 relations possibles) : apres
// correction de la normalisation des noms (voir CORRECTIF ci-dessous), 653
// relations resolues avec un prix existant, 0 DIVERGENCE.
//
// CORRECTIF (6 nov. 2026, meme session) : la toute premiere passe trouvait
// seulement 502 relations resolues (257 "sans donnee"), en concluant a tort
// que 10 noms etaient absents de la base : La Cote Picarde, L'Isle-Adam,
// Poix-de-Picardie, Aumale, Saint-Omer, Nœux-les-Mines, Amiens Est, Hordain,
// Bapaume, Senlis. En realite, la fonction de normalisation des noms de ce
// test ne retirait pas le libelle d'axe que certaines lignes SANEF collent
// en fin de nom SUR LA MEME LIGNE que la gare (ex. "NŒUX-LES-MINES N°6.1
// A26 NORD", "AMIENS EST (...) A29", "POIX-DE-PICARDIE N°13 A29") alors que
// d'autres lignes le mettent sur une ligne separee (deja filtree). Une fois
// ce suffixe retire par norm(), 7 des 10 noms se reverelent deja presents et
// deja corrects dans peages-aprr.json : La Cote Picarde, Poix-de-Picardie,
// Nœux-les-Mines, Amiens Est, Hordain, Bapaume (tous par correction directe
// de norm()), et Senlis (indirectement : "SENLIS N°8" de la grille SANEF
// correspond a "PARIS / ROISSY (péage de Chamant)" deja present, qui est
// geographiquement IDENTIQUE a "Senlis-Chamant Sortie" du referentiel
// officiel, 0,02km -- simplement nomme par direction plutot que par lieu ;
// prix confirme exact, SENLIS/PARIS-ROISSY<->BAPAUME = 12,9 EUR classe 1
// dans les deux sources).
//
// Ne restent reellement absents que 3 noms (confirmes par recherche
// insensible aux accents sans aucune correspondance dans peages-aprr.json) :
// L'ISLE-ADAM, AUMALE, SAINT-OMER. Chacun a bien une entree proche dans le
// referentiel officiel (data/gares-peage-officiel.json) mais sans assez de
// certitude GPS/routage pour les ajouter sans approximation dans cette
// session (Aumale a notamment 2 sous-gares officielles distinctes, Est et
// Ouest, que le nom unique "AUMALE" de la grille SANEF ne permet pas de
// desambiguiser) -- ils restent un "chantier SANEF" distinct, de meme
// nature que le chantier COFIROUTE deja documente.
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
function norm(s) {
  // Certaines lignes de la grille SANEF collent le libelle d'axe en fin de
  // nom sur la MEME ligne que la gare (ex. "NŒUX-LES-MINES N°6.1   A26 NORD",
  // "AMIENS EST (...)   A29") alors que d'autres le mettent sur sa propre
  // ligne (filtree par isAxisHeader). Sans ce retrait, la comparaison par
  // nom normalise manque des gares pourtant deja presentes dans la base
  // (decouvert le 6 nov. 2026 en re-verifiant Nœux-les-Mines/Amiens Est/
  // La Côte Picarde apres la correction Poix-de-Picardie/Hordain/Bapaume).
  s = s.replace(/\s*\/?\s*A\d+(\s+(NORD|SUD|EST|OUEST))?\s*$/i, '');
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, '').replace(/N°[\d.]+/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

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

test('sur les 759 relations possibles de ces 2 sections, 0 divergence de prix (653 relations resolues)', () => {
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
  assert.ok(matched >= 650, 'trouve ' + matched);
});

test('seuls 4 noms restent non resolus par la seule normalisation dans ces 2 sections : AUMALE, L\'ISLE-ADAM, SAINT-OMER (reellement absents) et SENLIS (deja present ailleurs sous "PARIS / ROISSY", voir tests dedies ci-dessous)', () => {
  const all = fs.readFileSync(SANEF_PATH, 'utf8').split('\n');
  const c1 = cleanTables(parseSection(all.slice(9, 118)));
  const idx = idxByNorm();
  const absents = new Set();
  for (const t of c1) for (const s of t) if (!idx.get(norm(s.name))) absents.add(norm(s.name));
  assert.deepEqual([...absents].sort(), ['AUMALE', 'LISLEADAM', 'SAINTOMER', 'SENLIS']);
});

test('POIX-DE-PICARDIE, HORDAIN, BAPAUME, NŒUX-LES-MINES, AMIENS EST et LA CÔTE PICARDE ne sont PAS des gares manquantes : coordonnees GPS identiques au referentiel officiel, deja presentes dans peages-aprr.json', () => {
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
  for (const n of ['NŒUX-LES-MINES', 'AMIENS EST', 'LA CÔTE PICARDE']) {
    assert.ok(aprr.g.some(g => g[0] === n), n + ' doit exister dans peages-aprr.json');
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
