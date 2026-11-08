'use strict';
// Verification exhaustive du VRAI fichier officiel Tarifs_ASF.txt (fourni par
// Laurent le 8 nov. 2026, telecharge depuis
// https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-asf/Tarifs_ASF.txt,
// 2055 relations, meme format que Tarifs_ESCOTA.txt, tarifs au 1er juin 2026).
// Remplace l'audit historique peages-audit-asf-2056-cloture.test.cjs (qui
// utilisait une source locale anterieure, legerement differente) par une
// verification sur la source VINCI telechargee directement.
//
// Methode : correspondance de nom (normalisation casse/accents/ponctuation)
// contre aprr.g + overlay.gares + overlay.paires, puis preuve de prix exacte
// (classe 1 ET classe 2) pour chaque relation resolue -- jamais une simple
// correspondance de nom.
//
// Resultat : 2033/2055 relations confirmees (98,9 %), 0 DIVERGENCE DE PRIX.
// 3 lignes structurelles (en-tete CSV, marqueurs "A8: AIX-EN-PROVENCE" etc.).
// 19 relations non rapprochees, concentrees sur seulement 6 noms distincts :
//   - BIARRITZ ECHANGEUR, ST GERMAIN LES VERGN, GIGNAC : faux positifs de
//     normalisation deja documentes (aliases confirmes dans la base sous
//     "Biarritz (echangeur)", "St Germain les Vergnes", "Martel").
//   - PERIGUEUX, ST JEAN DE LUZ NORD : les 2 gaps physiques reels deja
//     documentes (ambiguite La Bachellerie / Mansac Terrasson pour le
//     premier, deux candidats PK198/PK183 sans certitude pour le second).
//   - "SALON NORD <-> SALON NORD" : auto-paire dans le fichier source
//     (meme nom en entree et en sortie) -- anomalie de donnee source, pas
//     une gare manquante.
//
// Run: node --test tests/peages-audit-asf-fichier-reel-2026.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

const ASF_PATH = process.env.ASF_TARIFS_PATH || path.join(__dirname, '..', 'data', 'sources-officielles', 'Tarifs_ASF.txt');

function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

function buildIndex() {
  const m = new Map();
  const add = (n, orig) => { const k = norm(n); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(orig); };
  aprr.g.forEach(g => add(g[0], g[0]));
  overlay.gares.forEach(g => add(g.nom, g.nom));
  overlay.paires.forEach(p => { add(p[0], p[0]); add(p[1], p[1]); });
  return m;
}

function priceBetween(nameA, nameB) {
  const ai = aprr.g.findIndex(g => g[0] === nameA), bi = aprr.g.findIndex(g => g[0] === nameB);
  if (ai >= 0 && bi >= 0) {
    for (const s of aprr.p.split(';')) {
      const [a, b, c1, c2] = s.split(',');
      const x = parseInt(a, 36), y = parseInt(b, 36);
      if ((x === ai && y === bi) || (x === bi && y === ai)) return [Number(c1) / 10, Number(c2) / 10];
    }
  }
  for (const p of overlay.paires) {
    if ((p[0] === nameA && p[1] === nameB) || (p[1] === nameA && p[0] === nameB)) return [p[2], p[3]];
  }
  return null;
}

function auditer() {
  const lines = fs.readFileSync(ASF_PATH, 'utf8').split('\n').slice(1).filter(Boolean);
  const idx = buildIndex();
  let matched = 0, mismatched = 0, unresolved = 0, structural = 0;
  const unresolvedNames = new Set();
  for (const l of lines) {
    const f = l.split(';');
    if (f.length < 6) continue;
    const origin = f[1], dest = f[3];
    if (/^ORIGINE|^A\d+:/.test(origin) || /^A\d+:/.test(dest)) { structural++; continue; }
    const c1raw = f[4], c2raw = f[5];
    if (c1raw === '#N/A' || c2raw === '#N/A') { structural++; continue; }
    const c1 = parseFloat(c1raw.replace(',', '.')), c2 = parseFloat(c2raw.replace(',', '.'));
    const oSet = idx.get(norm(origin)), dSet = idx.get(norm(dest));
    if (!oSet || !dSet) { unresolved++; unresolvedNames.add(!oSet ? origin : dest); continue; }
    const candidats = [];
    for (const o of oSet) for (const d of dSet) { const v = priceBetween(o, d); if (v) candidats.push(v); }
    if (candidats.length === 0) { unresolved++; unresolvedNames.add(origin === dest ? origin + ' <-> ' + dest : origin + ' | ' + dest); continue; }
    const sigs = new Set(candidats.map(v => v.join('/')));
    if (sigs.size !== 1) { mismatched++; continue; }
    const [bc1, bc2] = candidats[0];
    if (Math.abs(bc1 - c1) > 0.05 || Math.abs(bc2 - c2) > 0.05) { mismatched++; continue; }
    matched++;
  }
  return { total: lines.length, matched, mismatched, unresolved, structural, unresolvedNames };
}

test('fichier officiel reel Tarifs_ASF.txt (2055 relations) : 0 divergence de prix', { skip: !fs.existsSync(ASF_PATH) && 'Tarifs_ASF.txt absent : audit non execute' }, () => {
  const r = auditer();
  console.log(`# ASF reel lignes=${r.total} confirmees=${r.matched} divergentes=${r.mismatched} non_rapprochees=${r.unresolved} structurelles=${r.structural}`);
  assert.equal(r.mismatched, 0, 'aucune divergence de prix ne doit exister sur une relation resolue');
  assert.equal(r.total, 2055);
  assert.ok(r.matched >= 2000, 'au moins 2000 relations doivent etre confirmees');
});

test('seuls 6 noms distincts restent non rapproches dans le fichier ASF reel, tous deja documentes', { skip: !fs.existsSync(ASF_PATH) && 'Tarifs_ASF.txt absent' }, () => {
  const r = auditer();
  const attendus = new Set(['BIARRITZ ECHANGEUR', 'ST GERMAIN LES VERGN', 'GIGNAC', 'PERIGUEUX', 'ST JEAN DE LUZ NORD', 'SALON NORD <-> SALON NORD']);
  for (const n of r.unresolvedNames) {
    assert.ok(attendus.has(n), 'nom non rapproche inattendu, a investiguer : ' + n);
  }
});
