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
// concernent des gares non encore dans la base (candidates a un futur
// "chantier SANEF" distinct, non traite ici : La Cote Picarde, L'Isle-Adam,
// Poix-de-Picardie, Aumale, Saint-Omer, Nœux-les-Mines, Amiens Est, Hordain,
// Bapaume, Senlis -- plusieurs ont un nom officiel proche mais distinct dans
// data/gares-peage-officiel.json, ex. "Poix-de-Picardie Sortie/Entree",
// "Aumale Est/Ouest Sortie/Entree", "Hordain BPV", "Bapaume Sortie/Entree",
// "Senlis-Bonsecours/Chamant" -- a traiter avec la meme rigueur que le
// chantier COFIROUTE si Laurent souhaite poursuivre).
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
