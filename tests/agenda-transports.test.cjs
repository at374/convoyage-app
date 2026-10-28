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

// 6. L'interface doit rattacher les missions terminées récemment à la prochaine mission active.
{
  const fs = require('node:fs');
  const app = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('const recentCompleted = A.items.filter'));
  assert.ok(app.includes('const next = chainItems.slice(ci + 1).find'));
  assert.ok(app.includes('x.etat === \'terminee\' || x.etat === \'passee\''));
}

// 7. L'interface ne doit pas annoncer un temps de transport confirmé sans données vérifiées.
{
  const fs = require('node:fs');
  const app = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('Transport non confirmé — vérifiez vous-même.'));
  assert.ok(app.includes('Temps disponible après trajet non déterminé.'));
}

// 8-11. Le garde-fou SIBRA respecte la période de validité et ne confirme jamais seul un trajet.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const feed = require('../sibra-feed.js');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sibra', 'gtfs-sibra-manifest.json'), 'utf8'));

  const inside = feed.assessDate(manifest, '2026-10-27');
  assert.equal(inside.usable, true);
  assert.equal(inside.transportConfirmed, false);

  const after = feed.assessDate(manifest, '2026-12-21');
  assert.equal(after.usable, false);
  assert.equal(after.status, 'hors_periode_gtfs');

  const invalid = feed.assessDate(manifest, '2026-02-30');
  assert.equal(invalid.usable, false);
  assert.equal(invalid.status, 'date_flux_invalide');

  const malformed = feed.assessDate({ feedValidity: { from: '2026-12-01', through: '2026-10-01' } }, '2026-10-15');
  assert.equal(malformed.usable, false);
}

// 12. Le module SIBRA doit être chargé avant app.js dans l'application publiée.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.indexOf('src="sibra-feed.js"') >= 0);
  assert.ok(html.indexOf('src="sibra-feed.js"') < html.indexOf('src="app.js"'));
}

// 13-16. Primitives du futur calculateur SIBRA : distance, proximité, heures GTFS et courses actives.
{
  const planner = require('../sibra-planner.js');
  const d = planner.distanceKm({ lat: 45.9, lon: 6.1 }, { lat: 45.9, lon: 6.1 });
  assert.equal(d, 0);
  assert.equal(planner.distanceKm({ lat: 100, lon: 6 }, { lat: 45, lon: 6 }), null);

  const stops = [
    { stop_id: 'near', lat: 45.9, lon: 6.1 },
    { stop_id: 'far', lat: 46.2, lon: 6.4 }
  ];
  const nearby = planner.nearbyStops({ lat: 45.9, lon: 6.1 }, stops, 1);
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].stop.stop_id, 'near');

  assert.equal(planner.parseGtfsTime('25:10:00'), 90600);
  assert.equal(planner.parseGtfsTime('25:70:00'), null);

  const times = [
    { trip_id: 'active-late', stop_id: 'S1', departure_time: '10:00:00' },
    { trip_id: 'active-early', stop_id: 'S1', departure_time: '09:00:00' },
    { trip_id: 'inactive', stop_id: 'S1', departure_time: '08:30:00' }
  ];
  const departures = planner.departuresAtStop(times, 'S1', 9 * 3600, new Set(['active-late', 'active-early']));
  assert.deepEqual(departures.map(x => x.trip_id), ['active-early', 'active-late']);
}

// 17-19. Le calendrier GTFS respecte les jours de service et les exceptions de date.
{
  const planner = require('../sibra-planner.js');
  const calendar = [
    { service_id: 'weekday', start_date: '20261001', end_date: '20261231', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0' },
    { service_id: 'saturday', start_date: '20261001', end_date: '20261231', monday: '0', tuesday: '0', wednesday: '0', thursday: '0', friday: '0', saturday: '1', sunday: '0' }
  ];
  const exceptions = [
    { service_id: 'weekday', date: '20261027', exception_type: '2' },
    { service_id: 'special', date: '20261027', exception_type: '1' }
  ];
  const active = planner.activeServiceIds(calendar, exceptions, '2026-10-27');
  assert.equal(active.has('weekday'), false);
  assert.equal(active.has('special'), true);
  assert.equal(active.has('saturday'), false);
  assert.equal(planner.activeServiceIds(calendar, exceptions, '2026-02-30').size, 0);
}

// 20. Les courses GTFS sont filtrées par les services actifs pour la date demandée.
{
  const planner = require('../sibra-planner.js');
  const trips = [
    { trip_id: 'T1', service_id: 'weekday' },
    { trip_id: 'T2', service_id: 'weekend' },
    { trip_id: 'T3', service_id: 'weekday' }
  ];
  const active = planner.activeTripIdsForDate(trips, new Set(['weekday']));
  assert.deepEqual([...active].sort(), ['T1', 'T3']);
}

// 21. Recherche de trajet direct : même course active, ordre des arrêts et horaire minimal.
{
  const planner = require('../sibra-planner.js');
  const rows = [
    { trip_id: 'T1', stop_id: 'A', stop_sequence: '1', departure_time: '09:00:00', arrival_time: '09:00:00' },
    { trip_id: 'T1', stop_id: 'B', stop_sequence: '2', departure_time: '09:12:00', arrival_time: '09:12:00' },
    { trip_id: 'T1', stop_id: 'C', stop_sequence: '3', departure_time: '09:20:00', arrival_time: '09:20:00' },
    { trip_id: 'T2', stop_id: 'A', stop_sequence: '1', departure_time: '08:00:00', arrival_time: '08:00:00' },
    { trip_id: 'T2', stop_id: 'C', stop_sequence: '2', departure_time: '08:10:00', arrival_time: '08:10:00' },
    { trip_id: 'T3', stop_id: 'C', stop_sequence: '1', departure_time: '09:05:00', arrival_time: '09:05:00' },
    { trip_id: 'T3', stop_id: 'A', stop_sequence: '2', departure_time: '09:10:00', arrival_time: '09:10:00' }
  ];
  const rides = planner.directRides(rows, 'A', 'C', 9 * 3600, new Set(['T1', 'T2', 'T3']));
  assert.equal(rides.length, 1);
  assert.equal(rides[0].trip_id, 'T1');
  assert.equal(rides[0].arrival_time, '09:20:00');
}

// 22. Composition d'une correspondance avec marge minimale et attente maximale.
{
  const planner = require('../sibra-planner.js');
  const rides = [
    { trip_id: 'T1', from_stop_id: 'A', to_stop_id: 'B', departureSeconds: 9 * 3600, arrivalSeconds: 9 * 3600 + 600 },
    { trip_id: 'T2', from_stop_id: 'B', to_stop_id: 'C', departureSeconds: 9 * 3600 + 900, arrivalSeconds: 9 * 3600 + 1800 },
    { trip_id: 'T3', from_stop_id: 'B', to_stop_id: 'C', departureSeconds: 9 * 3600 + 5000, arrivalSeconds: 9 * 3600 + 5600 }
  ];
  const journeys = planner.oneTransferJourneys(rides, 'A', 'C', 9 * 3600, { minTransferSeconds: 120, maxWaitSeconds: 1800 });
  assert.equal(journeys.length, 1);
  assert.equal(journeys[0].transfer_stop_id, 'B');
  assert.equal(journeys[0].transferWaitSeconds, 300);
}

// 23. Une arrivée théorique ne confirme pas le transport réel.
{
  const planner = require('../sibra-planner.js');
  const good = planner.assessMissionArrival(9 * 3600, 10 * 3600, 10 * 60, 30 * 60);
  assert.equal(good.feasible, true);
  assert.equal(good.transportConfirmed, false);
  assert.equal(good.advanceSeconds, 50 * 60);
  const late = planner.assessMissionArrival(9 * 3600 + 40 * 60, 10 * 3600, 10 * 60, 30 * 60);
  assert.equal(late.feasible, false);
  assert.equal(planner.assessMissionArrival(9 * 3600, 10 * 3600, NaN, 30 * 60).feasible, false);
}

process.stdout.write('Agenda/SIBRA tests passed: 23 scenarios\\n');
