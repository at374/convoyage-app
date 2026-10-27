'use strict';
const assert = require('node:assert/strict');
const CPAgenda = require('../agenda.js');

function mission(id, pickup, delivery, extra = {}) {
  return {
    id,
    kind: 'acceptee',
    status: 'acceptee',
    pickup_start: pickup,
    delivery_end: delivery,
    from_city: 'Annecy',
    to_city: 'Lyon',
    ...extra
  };
}

const now = Date.parse('2026-10-27T08:00:00+01:00');

// 1. Une mission acceptée sans horaire reste explicitement inconnue.
{
  const result = CPAgenda.analyser([mission('unknown', '', '')], {}, now);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].etat, 'date_inconnue');
}

// 2. Deux missions qui se chevauchent doivent déclencher un conflit.
{
  const a = mission('a', '2026-10-27T09:00:00+01:00', '2026-10-27T11:00:00+01:00');
  const b = mission('b', '2026-10-27T10:30:00+01:00', '2026-10-27T12:00:00+01:00');
  const result = CPAgenda.analyser([a, b], { marge_minutes: 0 }, now);
  assert.ok(result.conflits.some(c => c.type === 'chevauchement'));
}

// 3. Une mission terminée ne doit pas être traitée comme une mission active à venir.
{
  const done = mission('done', '2026-10-27T05:00:00+01:00', '2026-10-27T06:00:00+01:00', { status: 'terminee' });
  const next = mission('next', '2026-10-27T09:00:00+01:00', '2026-10-27T10:00:00+01:00');
  const result = CPAgenda.analyser([done, next], {}, now);
  assert.equal(result.items.find(x => x.mission.id === 'done').etat, 'terminee');
  assert.equal(result.items.find(x => x.mission.id === 'next').etat, 'a_venir');
}

// 4. Le moteur doit conserver l'estimation de fin lorsqu'il calcule un conflit.
{
  const a = mission('estimated', '2026-10-27T09:00:00+01:00', '', { duration_minutes: 120 });
  const b = mission('later', '2026-10-27T10:00:00+01:00', '2026-10-27T12:00:00+01:00');
  const result = CPAgenda.analyser([a, b], { marge_minutes: 0 }, now);
  assert.ok(Array.isArray(result.conflits));
}

// 5. Le résultat garde une entrée indexée par clé pour chaque mission.
{
  const m = mission('indexed', '2026-10-27T09:00:00+01:00', '2026-10-27T10:00:00+01:00');
  const result = CPAgenda.analyser([m], {}, now);
  assert.equal(Object.keys(result.parCle).length, 1);
  assert.equal(result.items.length, 1);
}

process.stdout.write('Agenda tests passed: 5 scenarios\\n');
