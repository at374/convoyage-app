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

// 2 bis. Une liaison sans coordonnées ne doit pas produire de faux conflit de transport.
{
  const a = mission('a-unknown', '2026-10-27T09:00:00+01:00', '2026-10-27T10:00:00+01:00');
  const b = mission('b-unknown', '2026-10-27T10:10:00+01:00', '2026-10-27T11:00:00+01:00');
  const result = CPAgenda.analyser([a, b], { marge_minutes: 45 }, now);
  assert.equal(result.conflits.length, 0);
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

// 24. Une distance à vol d'oiseau ne remplace pas un trajet piéton vérifié.
{
  const planner = require('../sibra-planner.js');
  const start = [6.1, 45.9], end = [6.11, 45.91];
  const route = { status: 'VERIFIE_PIETON', provider: 'test-router',
    duration_seconds: 720, distance_meters: 950, geometry: [start, end] };
  assert.equal(planner.verifiedWalkingSeconds(route, start, end), 720);
  assert.equal(planner.verifiedWalkingSeconds({ ...route, status: 'ESTIME' }, start, end), null);
  assert.equal(planner.verifiedWalkingSeconds(route, start, [6.3, 46.0]), null);
}

// 25. Lecture des fichiers GTFS CSV : BOM, guillemets, virgules et CRLF.
{
  const planner = require('../sibra-planner.js');
  const rows = planner.parseGtfsCsv('\uFEFFstop_id,stop_name,stop_lat\r\n1,"Annecy, Gare",45.9\r\n2,"Arret ""Centre""",45.91\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].stop_name, 'Annecy, Gare');
  assert.equal(rows[1].stop_name, 'Arret "Centre"');
  assert.equal(planner.parseGtfsCsv('stop_id,stop_name\n1,"non termine'), null);
}

// 26. Refuser les references GTFS manquantes avant tout calcul de trajet.
{
  const planner = require('../sibra-planner.js');
  const tables = {
    stops: [{ stop_id: 'A' }, { stop_id: 'B' }],
    trips: [{ trip_id: 'T1', service_id: 'S1' }],
    stop_times: [
      { trip_id: 'T1', stop_id: 'A', stop_sequence: '1', arrival_time: '09:00:00', departure_time: '09:00:00' },
      { trip_id: 'T1', stop_id: 'B', stop_sequence: '2', arrival_time: '09:10:00', departure_time: '09:10:00' }
    ],
    calendar: [{ service_id: 'S1' }], calendar_dates: []
  };
  assert.equal(planner.validateGtfsTables(tables).valid, true);
  assert.equal(planner.validateGtfsTables({ ...tables, stops: [{ stop_id: 'A' }] }).valid, false);
  assert.equal(planner.validateGtfsTables({ ...tables, calendar: [] }).valid, false);
  assert.equal(planner.validateGtfsTables({ ...tables, stop_times: [] }).valid, false);
}

// 27. Le chargeur GTFS journalier ne doit jamais confirmer un trajet théorique.
(async () => {
  const feed = require('../sibra-feed.js');
  const day = '2026-10-28';
  const valid = { date: day, transportConfirmed: false, realtime: false,
    stops: [['A', 'Arrêt A', 45.9, 6.1]], routes: [['L1', '1', 'Ligne 1']],
    trips: [['T1', 'L1', 'Centre']], stop_times: [['T1', 'A', 1, '09:00:00', '09:00:00']] };
  const loaded = await feed.loadDay(day, async url => {
    assert.equal(url, 'data/sibra/sibra-2026-10-28.json');
    return { ok: true, json: async () => valid };
  });
  assert.equal(loaded.usable, true);
  assert.equal(loaded.transportConfirmed, false);
  const absent = await feed.loadDay(day, async () => ({ ok: false }));
  assert.equal(absent.status, 'horaires_jour_absents');
  const unsafe = await feed.loadDay(day, async () => ({
    ok: true, json: async () => ({ ...valid, transportConfirmed: true })
  }));
  assert.equal(unsafe.usable, false);
  const empty = await feed.loadDay(day, async () => ({
    ok: true, json: async () => ({ ...valid, stop_times: [] })
  }));
  assert.equal(empty.status, 'donnees_gtfs_invalides');
  assert.equal((await feed.loadDay('2026-02-30', async () => ({ ok: true }))).usable, false);
    // 28. Le format compact journalier doit être normalisé et contrôlé.
  const compact = {
    stops: [['A', 'Arrêt A', 45.9, 6.1], ['B', 'Arrêt B', 45.91, 6.11]],
    routes: [['L1', '1', 'Ligne 1']],
    trips: [['T1', 'L1', 'Centre']],
    stop_times: [['T1', 'A', 1, '09:00:00', '09:00:00'], ['T1', 'B', 2, '09:10:00', '09:10:00']]
  };
  const normalized = feed.normalizeDay(compact);
  assert.equal(normalized.stop_times[1].stop_id, 'B');
  assert.equal(feed.normalizeDay({ ...compact, stop_times: [['T1', 'INCONNU', 1, '09:00:00', '09:00:00']] }), null);
  assert.equal(feed.normalizeDay({ ...compact, stop_times: [['T1', 'A', 1, 'bad', 'bad']] }), null);
    // 29. Une course réelle dans le tableau journalier respecte les arrêts et heures.
  const direct = feed.directDayJourneys(compact, 'A', 'B', 8 * 3600);
  assert.equal(direct.length, 1);
  assert.equal(direct[0].departureSeconds, 9 * 3600);
  assert.equal(direct[0].arrivalSeconds, 9 * 3600 + 600);
  assert.equal(direct[0].transportConfirmed, false);
  assert.equal(feed.directDayJourneys(compact, 'B', 'A', 0).length, 0);
  assert.equal(feed.directDayJourneys(compact, 'A', 'B', 10 * 3600).length, 0);
    // 30. Les arrêts proches sont des distances à vol d'oiseau, pas des trajets à pied validés.
  const near = feed.nearbyDayStops(compact, 45.9, 6.1, 100, 5);
  assert.equal(near.length, 1);
  assert.equal(near[0].stopId, 'A');
  assert.equal(near[0].straightLineMeters, 0);
  assert.equal(near[0].walkingVerified, false);
  assert.equal(feed.nearbyDayStops(compact, 95, 6.1).length, 0);
  // 31. Plusieurs missions le même jour ne déclenchent qu'un seul téléchargement.
  let downloads = 0;
  const cachedFetch = async () => {
    downloads++;
    return { ok: true, json: async () => valid };
  };
  const [first, second] = await Promise.all([
    feed.loadDayCached(day, cachedFetch),
    feed.loadDayCached(day, cachedFetch)
  ]);
  assert.equal(downloads, 1);
  assert.equal(first.usable, true);
  assert.equal(second.usable, true);
  // 32. Recherche par coordonnées: horaires réels GTFS, approche non vérifiée.
  const candidates = feed.coordinateDayJourneys(compact, 45.9, 6.1, 45.91, 6.11, 8 * 3600, { radiusMeters: 100 });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].originStop.stopId, 'A');
  assert.equal(candidates[0].destinationStop.stopId, 'B');
  assert.equal(candidates[0].approachVerified, false);
  assert.equal(candidates[0].transportConfirmed, false);
  assert.equal(feed.coordinateDayJourneys(compact, 44, 4, 45.91, 6.11, 0).length, 0);
  process.stdout.write('Agenda/SIBRA tests passed: 32 scenarios\\n');
})().catch(error => { console.error(error); process.exitCode = 1; });

// L'écart théorique à l'arrêt ne doit pas être présenté comme une marge vérifiée.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('écart théorique avant prise en charge'));
  assert.ok(app.includes('hors marche et marge de sécurité'));
}

// L'Agenda privilégie une fenêtre théorique de 30 à 45 minutes à l'arrêt.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('advance >= 30 && advance <= 45'));
  assert.ok(app.includes('marche non vérifiée'));
}

// Une correspondance GTFS doit respecter le même arrêt, l'ordre des bus et le délai minimal.
{
  const feed = require('../sibra-feed.js');
  const day = {
    stops: [['A', 'Départ', 45.9, 6.1], ['X', 'Correspondance', 45.91, 6.11], ['B', 'Arrivée', 45.92, 6.12]],
    routes: [['R1', 'Ligne 1'], ['R2', 'Ligne 2']],
    trips: [['T1', 'R1'], ['T2', 'R2']],
    stop_times: [
      ['T1', 'A', 1, '09:00:00', '09:00:00'],
      ['T1', 'X', 2, '09:10:00', '09:10:00'],
      ['T2', 'X', 1, '09:16:00', '09:16:00'],
      ['T2', 'B', 2, '09:30:00', '09:30:00']
    ]
  };
  const journeys = feed.oneTransferDayJourneys(day, 'A', 'B', 8 * 3600);
  assert.equal(journeys.length, 1);
  assert.equal(journeys[0].transferStopId, 'X');
  assert.equal(journeys[0].transferWaitSeconds, 360);
  assert.equal(journeys[0].transportConfirmed, false);
  assert.equal(feed.oneTransferDayJourneys(day, 'A', 'B', 8 * 3600, { minTransferSeconds: 420 }).length, 0);
}

// Le moteur de correspondances doit pouvoir partir des coordonnées GPS des missions.
{
  const feed = require('../sibra-feed.js');
  assert.equal(typeof feed.coordinateOneTransferDayJourneys, 'function');
  assert.deepEqual(feed.coordinateOneTransferDayJourneys(null, 45.9, 6.1, 45.92, 6.12, 9 * 3600), []);
}

// L'Agenda affiche les correspondances théoriques sans les annoncer confirmées.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('feed.coordinateOneTransferDayJourneys'));
  assert.ok(app.includes('Correspondance à '));
  assert.ok(app.includes('Transport non confirmé — vérifiez vous-même.'));
}

// La date SIBRA doit être au format ISO indépendamment des conventions locales du navigateur.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("formatToParts(date)"));
  assert.ok(app.includes("get('year') + '-' + get('month') + '-' + get('day')"));
  assert.ok(app.includes("const date = (date =>"));
  assert.ok(app.includes("const nextDate = (date =>"));
}

// Repeated searches of the same GTFS day reuse the normalized tables on mobile.
{
  const feed = require('../sibra-feed.js');
  const day = { stops: [['A','A',45.9,6.1],['B','B',45.91,6.11]], routes: [['R','R']], trips: [['T','R']], stop_times: [['T','A',1,'09:00:00','09:00:00'],['T','B',2,'09:10:00','09:10:00']] };
  const first = feed.normalizeDay(day);
  assert.strictEqual(feed.normalizeDay(day), first);
  assert.notStrictEqual(feed.normalizeDay({...day}), first);
}

// Transfer matching must ignore unrelated intermediate stops while preserving the valid connection.
{
  const feed = require('../sibra-feed.js');
  const day = { stops: [['A','A',45.9,6.1],['X','X',45.91,6.11],['Y','Y',45.92,6.12],['B','B',45.93,6.13]], routes: [['R1','1'],['R2','2'],['R3','3']], trips: [['T1','R1'],['T2','R2'],['T3','R3']], stop_times: [['T1','A',1,'09:00:00','09:00:00'],['T1','X',2,'09:10:00','09:10:00'],['T2','Y',1,'09:15:00','09:15:00'],['T2','B',2,'09:30:00','09:30:00'],['T3','X',1,'09:17:00','09:17:00'],['T3','B',2,'09:35:00','09:35:00']] };
  const results = feed.oneTransferDayJourneys(day, 'A', 'B', 8 * 3600);
  assert.equal(results.length, 1);
  assert.equal(results[0].transferStopId, 'X');
  assert.equal(results[0].secondLeg.tripId, 'T3');
}


// SIBRA day cache: concurrent requests deduplicate; completed data expires after 15 minutes.
{
  const feed = require('../sibra-feed.js');
  const originalNow = Date.now;
  let now = 1000000, requests = 0;
  Date.now = () => now;
  const fetchDay = async () => {
    requests++;
    return { ok: true, json: async () => ({
      date: '2026-10-28', stops: [['A','A',45.9,6.1]],
      routes: [['R','R']], trips: [['T','R']],
      stop_times: [['T','A',1,'09:00:00','09:00:00']],
      transportConfirmed: false, realtime: false
    }) };
  };
  (async () => {
    try {
      const first = await Promise.all([
        feed.loadDayCached('2026-10-28', fetchDay, 'test-cache-ttl'),
        feed.loadDayCached('2026-10-28', fetchDay, 'test-cache-ttl')
      ]);
      assert(first.every(result => result.usable));
      assert.equal(requests, 1);
      now += 14 * 60 * 1000;
      await feed.loadDayCached('2026-10-28', fetchDay, 'test-cache-ttl');
      assert.equal(requests, 1);
      now += 2 * 60 * 1000;
      await feed.loadDayCached('2026-10-28', fetchDay, 'test-cache-ttl');
      assert.equal(requests, 2);
    } finally { Date.now = originalNow; }
  })().catch(error => { process.nextTick(() => { throw error; }); });
}


// Scheduled arrival cannot be called feasible without a provider-verified final walk.
{
  const planner = require('../sibra-planner.js');
  const stop = [6.1, 45.9], missionPoint = [6.101, 45.901];
  const unknown = planner.assessVerifiedMissionApproach(9 * 3600, 10 * 3600,
    null, stop, missionPoint, 1800);
  assert.equal(unknown.feasible, false);
  assert.equal(unknown.status, 'approche_pietonne_non_verifiee');
  const walk = { status: 'VERIFIE_PIETON', provider: 'test-routing-provider',
    duration_seconds: 600, distance_meters: 750, geometry: [stop, missionPoint] };
  const compatible = planner.assessVerifiedMissionApproach(9 * 3600, 10 * 3600,
    walk, stop, missionPoint, 1800);
  assert.equal(compatible.feasible, true);
  assert.equal(compatible.walkingVerified, true);
  assert.equal(compatible.transportConfirmed, false);
  const tooLate = planner.assessVerifiedMissionApproach(9 * 3600 + 1500, 10 * 3600,
    walk, stop, missionPoint, 1800);
  assert.equal(tooLate.feasible, false);
}


// Pedestrian GeoJSON adapter rejects invalid route data and preserves endpoint checks.
{
  const planner = require('../sibra-planner.js');
  const from = [6.1, 45.9], to = [6.101, 45.901];
  const feature = { type: 'Feature', geometry: { type: 'LineString',
    coordinates: [from, to] }, properties: { duration: 540, distance: 700 } };
  const walk = planner.pedestrianRouteFromGeoJSON(feature, 'test-pedestrian-router');
  assert.equal(walk.duration_seconds, 540);
  assert.equal(planner.verifiedWalkingSeconds(walk, from, to), 540);
  assert.equal(planner.pedestrianRouteFromGeoJSON({ ...feature,
    properties: { duration: -1, distance: 700 } }, 'test-router'), null);
  assert.equal(planner.pedestrianRouteFromGeoJSON(feature, ''), null);
  assert.equal(planner.verifiedWalkingSeconds(walk, to, from), null);
}


// Missing GeoJSON duration/distance must never silently become zero.
{
  const planner = require('../sibra-planner.js');
  const base = { geometry: { type: 'LineString',
    coordinates: [[6.1, 45.9], [6.101, 45.901]] } };
  assert.equal(planner.pedestrianRouteFromGeoJSON({ ...base,
    properties: { distance: 500 } }, 'router'), null);
  assert.equal(planner.pedestrianRouteFromGeoJSON({ ...base,
    properties: { duration: 300 } }, 'router'), null);
  assert.equal(planner.pedestrianRouteFromGeoJSON({ ...base,
    properties: { duration: null, distance: 500 } }, 'router'), null);
  assert.equal(planner.pedestrianRouteFromGeoJSON({ ...base,
    properties: { duration: 0, distance: 0 } }, 'router').duration_seconds, 0);
}


// OSRM adapter accepts only explicitly pedestrian routes with valid GeoJSON geometry.
{
  const planner = require('../sibra-planner.js');
  const response = { code: 'Ok', routes: [{
    duration: 420, distance: 510,
    geometry: { type: 'LineString', coordinates: [[6.1, 45.9], [6.101, 45.901]] }
  }] };
  const walk = planner.pedestrianRouteFromOSRM(response, 'foot');
  assert.equal(walk.duration_seconds, 420);
  assert.equal(walk.transportConfirmed, undefined);
  assert.equal(planner.pedestrianRouteFromOSRM(response, 'driving'), null);
  assert.equal(planner.pedestrianRouteFromOSRM({ ...response, code: 'NoRoute' }, 'foot'), null);
  assert.equal(planner.pedestrianRouteFromOSRM({ code: 'Ok', routes: [{
    geometry: response.routes[0].geometry, distance: 510
  }] }, 'foot'), null);
}


// Foot router must be explicitly configured and endpoint geometry verified.
{
  const planner = require('../sibra-planner.js');
  const from = [6.1, 45.9], to = [6.101, 45.901];
  let calls = 0;
  const fakeFetch = async url => {
    calls++;
    assert.match(url, /route\/v1\/foot/);
    assert.match(url, /geometries=geojson/);
    return { ok: true, json: async () => ({ code: 'Ok', routes: [{
      duration: 500, distance: 650,
      geometry: { type: 'LineString', coordinates: [from, to] }
    }] }) };
  };
  (async () => {
    const missing = await planner.requestPedestrianOSRM(from, to, fakeFetch,
      'https://example.test/route/v1/driving');
    assert.equal(missing, null);
    assert.equal(calls, 0);
    const route = await planner.requestPedestrianOSRM(from, to, fakeFetch,
      'https://example.test/route/v1/foot');
    assert.equal(route.duration_seconds, 500);
    assert.equal(calls, 1);
    const bad = await planner.requestPedestrianOSRM(from, to, async () => ({
      ok: true, json: async () => ({ code: 'NoRoute' })
    }), 'https://example.test/route/v1/foot');
    assert.equal(bad, null);
  })().catch(error => { process.nextTick(() => { throw error; }); });
}


// A misleading URL prefix must not bypass HTTPS routing endpoint validation.
{
  const planner = require('../sibra-planner.js');
  const from = [6.1, 45.9], to = [6.101, 45.901];
  let calls = 0;
  const fetchStub = async () => { calls++; throw new Error('unexpected request'); };
  (async () => {
    const bad = await planner.requestPedestrianOSRM(from, to, fetchStub,
      'https://example.test/route/v1/driving');
    assert.equal(bad, null);
    assert.equal(calls, 0);
  })().catch(error => { process.nextTick(() => { throw error; }); });
}


// Agenda empty state covers both direct and one-transfer SIBRA candidates.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /aucun trajet direct ou avec une correspondance identifié/);
}


// A bus connection is only timetable-compatible when both walking legs are verified.
{
  const planner = require('../sibra-planner.js');
  const a = [6.1, 45.9], b = [6.101, 45.901], c = [6.2, 45.95], d = [6.201, 45.951];
  const route = (from, to, seconds) => ({
    status: 'VERIFIE_PIETON', provider: 'test-foot', duration_seconds: seconds,
    distance_meters: 120, geometry: [from, to]
  });
  const check = (first, last) => planner.assessVerifiedBusConnection(
    8 * 3600, 8 * 3600 + 600, 9 * 3600, 10 * 3600,
    first, a, b, last, c, d, 1800);
  assert.equal(check(route(a, b, 300), route(c, d, 300)).feasible, true);
  assert.equal(check(route(a, b, 700), route(c, d, 300)).feasible, false);
  assert.equal(check(route(a, b, 300), null).status, 'marches_non_verifiees');
  assert.equal(check(route(a, b, 300), route(c, d, 300)).transportConfirmed, false);
}


// Date-scoped SIBRA candidate: exact stop coordinates and two verified walks.
{
  const planner = require('../sibra-planner.js');
  const a = [6.1, 45.9], b = [6.101, 45.901], c = [6.2, 45.95], d = [6.201, 45.951];
  const route = (from, to) => ({
    status: 'VERIFIE_PIETON', provider: 'test-foot', duration_seconds: 300,
    distance_meters: 120, geometry: [from, to]
  });
  const journey = {
    departureSeconds: 8 * 3600 + 600, arrivalSeconds: 9 * 3600,
    originStop: { latitude: b[1], longitude: b[0] },
    destinationStop: { latitude: c[1], longitude: c[0] }
  };
  const good = planner.assessScheduledSibraJourney(journey, 8 * 3600,
    10 * 3600, a, d, route(a, b), route(c, d));
  assert.equal(good.feasible, true);
  assert.equal(good.transportConfirmed, false);
  assert.equal(planner.assessScheduledSibraJourney(journey, 8 * 3600,
    10 * 3600, a, d, null, route(c, d)).feasible, false);
}
