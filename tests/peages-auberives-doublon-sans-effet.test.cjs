'use strict';
// Audit d'integrite du 8 nov. 2026 : "Auberives" existe simultanement dans aprr.g
// (index fixe, GPS [45.3898, 4.8053]) ET dans overlay.gares (GPS [45.38885,
// 4.80564], a 0,109km -- au-dessus du seuil de fusion jumelle 0,06km, en-dessous du
// seuil de detection de barriere 0,3km). Seul cas de ce type trouve dans toute la
// base (0 autre nom duplique entre aprr.g et overlay.gares).
//
// Verifie SANS IMPACT FONCTIONNEL : le code de fusion des gares (CODE_WORKER,
// routes-ui.js) ignore une gare overlay si un nom identique existe deja dans
// aprr.g ("if(!Q.g.some(g=>g[0]===n.nom))Q.g.push(...)") -- le point GPS overlay
// d'Auberives n'est donc jamais utilise pour la detection de trajet ; seul le point
// aprr.g sert, mais TOUTES les relations de prix (aprr.p ET overlay.paires, 53+88)
// restent accessibles via le nom partage. Aucun conflit de prix trouve entre les
// deux sources pour les paires partagees (0 conflit sur verification croisee).
//
// Conclusion : redondance de donnees inoffensive (le point overlay est mort/non
// utilise), pas un bug de prix ni de position. Documente pour eviter une
// re-investigation future ; aucune modification de donnees necessaire.
//
// Run: node --test tests/peages-auberives-doublon-sans-effet.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function dist(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

test('Auberives est le seul nom present a la fois dans aprr.g et overlay.gares', () => {
  const aprrNames = new Set(aprr.g.map(g => g[0]));
  const dup = overlay.gares.filter(g => aprrNames.has(g.nom));
  assert.equal(dup.length, 1);
  assert.equal(dup[0].nom, 'Auberives');
});

test('les deux points Auberives sont a 0,109km (au-dessus du seuil jumelle 0,06km, en-dessous du seuil barriere 0,3km)', () => {
  const a = aprr.g.find(g => g[0] === 'Auberives')[1][0];
  const b = overlay.gares.find(g => g.nom === 'Auberives').points[0];
  const d = dist(a, b);
  assert.ok(d > 0.06 && d < 0.3, 'distance obtenue: ' + d.toFixed(4) + 'km');
});

test('aucun conflit de prix entre aprr.p et overlay.paires pour les relations partagees d\'Auberives', () => {
  const idx = n => aprr.g.findIndex(g => g[0] === n);
  const auberIdx = idx('Auberives');
  const prix = new Map();
  for (const l of aprr.p.split(';')) {
    const [a, b, c1, c2] = l.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    prix.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10]);
  }
  let conflicts = 0;
  for (const p of overlay.paires) {
    if (p[0] !== 'Auberives' && p[1] !== 'Auberives') continue;
    const other = p[0] === 'Auberives' ? p[1] : p[0];
    const oi = idx(other);
    if (oi < 0) continue;
    const v = prix.get(Math.min(oi, auberIdx) * 1000 + Math.max(oi, auberIdx));
    if (v && (Math.abs(v[0] - p[2]) > 0.05 || Math.abs(v[1] - p[3]) > 0.05)) conflicts++;
  }
  assert.equal(conflicts, 0);
});
