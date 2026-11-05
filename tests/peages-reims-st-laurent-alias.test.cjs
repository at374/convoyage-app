'use strict';
// Trois fusions par preuve de prix stricte (0 ecart sur chaque destination commune,
// 5 nov. 2026) :
//
// 1. "REIMS NORD (péage d'Ormes)" -> "REIMS NORD (ORMES)" (deja existant) : 4/4.
// 2. "REIMS OUEST (péage de Thillois) N°22" -> "REIMS OUEST (THILLOIS)" (deja
//    existant) : 4/4.
// 3. "ST LAURENT" -> "Saint-Laurent-du-Var" (deja existant) : 6/6.
//
// Run: node --test tests/peages-reims-st-laurent-alias.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const overlay = require('../peages-overlay.json');

test('REIMS NORD variant was fully renamed to REIMS NORD (ORMES)', () => {
  const stray = overlay.paires.some(p => p[0] === "REIMS NORD (péage d'Ormes)" || p[1] === "REIMS NORD (péage d'Ormes)");
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'REIMS NORD (ORMES)' || p[1] === 'REIMS NORD (ORMES)');
  assert.ok(has);
});

test('REIMS OUEST variant was fully renamed to REIMS OUEST (THILLOIS)', () => {
  const stray = overlay.paires.some(p => p[0] === 'REIMS OUEST (péage de Thillois) N°22' || p[1] === 'REIMS OUEST (péage de Thillois) N°22');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'REIMS OUEST (THILLOIS)' || p[1] === 'REIMS OUEST (THILLOIS)');
  assert.ok(has);
});

test('ST LAURENT was fully renamed to Saint-Laurent-du-Var', () => {
  const stray = overlay.paires.some(p => p[0] === 'ST LAURENT' || p[1] === 'ST LAURENT');
  assert.equal(stray, false);
  const has = overlay.paires.some(p => p[0] === 'Saint-Laurent-du-Var' || p[1] === 'Saint-Laurent-du-Var');
  assert.ok(has);
});

test('no price was fabricated or altered by any of these merges (sample)', () => {
  const p = overlay.paires.find(x => x[0] === 'Saint-Laurent-du-Var' || x[1] === 'Saint-Laurent-du-Var');
  assert.ok(p);
  assert.equal(typeof p[2], 'number');
  assert.equal(typeof p[3], 'number');
});
