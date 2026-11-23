'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const collector = require('../scripts/collect-national-gtfs.cjs');

// Même fabrique de ZIP de test que tests/transport-gtfs-loader.test.cjs (gardée indépendante ici :
// un script de collecte ne doit pas dépendre des fixtures internes d'un autre fichier de test).
function zip(input) {
  const locals = [], central = [];
  let offset = 0;
  for (const [filename, text] of Object.entries(input)) {
    const name = Buffer.from(filename), plain = Buffer.from(text), body = zlib.deflateRawSync(plain);
    const crc = zlib.crc32(plain), local = Buffer.alloc(30), entry = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(plain.length, 22);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(8, 10); entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20); entry.writeUInt32LE(plain.length, 24); entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, name, body); central.push(entry, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const baseFiles = {
  'agency.txt': 'agency_name,agency_timezone\nSIBRA,Europe/Paris\n',
  'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\nA,Annecy,45.901,6.122\nB,Albertville,45.675,6.390\n',
  'routes.txt': 'route_id,route_short_name,route_long_name,route_type\n' +
    'R1,10,Bus 10,3\n' +
    'R2,Scolaire A,Ligne scolaire Collège,3\n' +
    'R3,TAD,Transport à la demande,3\n' +
    'R4,X,Mystère,999\n',
  'trips.txt': 'route_id,service_id,trip_id\nR1,WK,T1\nR2,WK,T2\nR3,WK,T3\nR4,WK,T4\n',
  'stop_times.txt':
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n' +
    'T1,10:30:00,10:30:00,A,1,,\nT1,11:48:00,11:48:00,B,2,,\n' +
    'T2,10:30:00,10:30:00,A,1,,\nT2,11:48:00,11:48:00,B,2,,\n' +
    'T3,10:30:00,10:30:00,A,1,2,2\nT3,11:48:00,11:48:00,B,2,2,2\n' +
    'T4,10:30:00,10:30:00,A,1,,\nT4,11:48:00,11:48:00,B,2,,\n',
  'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
    'WK,1,1,1,1,1,1,1,20260101,20271231\n',
};

test('classifyRoutes : régulière, scolaire, TAD (route_type dédié ou pickup/drop_off), et jamais régulière par défaut pour un type inconnu', () => {
  const counts = collector.classifyRoutes(baseFiles);
  assert.deepEqual(counts, { regular: 0, school: 1, demandResponsive: 1, unknown: 2 });
});

test('isAggregateSuspect repère les agrégats régionaux/nationaux sans faux positif sur un réseau local', () => {
  assert.equal(collector.isAggregateSuspect('Agrégat régional Oùra'), true);
  assert.equal(collector.isAggregateSuspect('Réseau régional des Alpes'), true);
  assert.equal(collector.isAggregateSuspect('SIBRA Grand Annecy'), false);
});

test('activeWithinDays trouve un service actif dans la fenêtre et aucun hors fenêtre', () => {
  const today = new Date('2026-06-01T00:00:00Z');
  assert.equal(collector.activeWithinDays(baseFiles, 30, today), true);
  const expired = { ...baseFiles, 'calendar.txt': baseFiles['calendar.txt'].replace('20271231', '20260101') };
  assert.equal(collector.activeWithinDays(expired, 30, new Date('2026-06-01T00:00:00Z')), false);
});

test('activeWithinDays ignore un calendrier actif sans courses associées', () => {
  const withoutTrips = {
    ...baseFiles,
    'trips.txt': 'route_id,service_id,trip_id\nR1,OTHER,T1\n'
  };
  assert.equal(collector.activeWithinDays(withoutTrips, 30, new Date('2026-06-01T00:00:00Z')), false);
});

test('shouldSkip ne retélécharge pas quand la date de mise à jour PAN est inchangée', () => {
  const resource = { datasetId: 'd1', id: 'r1', updatedAt: '2026-11-01T00:00:00Z' };
  assert.equal(collector.shouldSkip(resource, { status: 'ok', updatedAt: '2026-11-01T00:00:00Z' }), true);
  assert.equal(collector.shouldSkip(resource, { status: 'unchanged', updatedAt: '2026-11-01T00:00:00Z' }), true);
  assert.equal(collector.shouldSkip(resource, { status: 'ok', updatedAt: '2026-10-01T00:00:00Z' }), false);
  assert.equal(collector.shouldSkip(resource, null), false);
  assert.equal(collector.shouldSkip(resource, { status: 'error', updatedAt: '2026-11-01T00:00:00Z' }), false);
});

test('toCSV produit un en-tête et une ligne par réseau, avec échappement des virgules', () => {
  const manifest = { networks: { a: { id: 'a', network: 'Réseau, test', status: 'ok', lines: { regular: 1 } } } };
  const csv = collector.toCSV(manifest);
  assert.match(csv, /^id,network,status/);
  assert.match(csv, /"Réseau, test"/);
});

test('collect() : découvre, télécharge, valide et classe un flux réel simulé, et saute un flux inchangé', async () => {
  const good = zip(baseFiles);
  const network = {
    id: 42, title: 'SIBRA Grand Annecy',
    resources: [{ id: 'r1', format: 'GTFS', url: 'https://example.org/sibra.zip', updated_at: '2026-11-01T00:00:00Z' }],
  };
  const unchanged = {
    id: 43, title: 'TAC Annemasse',
    resources: [{ id: 'r2', format: 'GTFS', url: 'https://example.org/tac.zip', updated_at: '2026-09-01T00:00:00Z' }],
  };
  const fetcher = async (url) => {
    if (String(url).includes('transport.data.gouv.fr')) return { ok: true, json: async () => [network, unchanged] };
    if (String(url).includes('sibra.zip')) return new Response(good, { headers: { 'content-type': 'application/zip' } });
    throw new Error('url inattendue : ' + url);
  };
  const previousManifest = {
    networks: {
      'tac-annemasse-r2': { id: 'tac-annemasse-r2', datasetId: '43', resourceId: 'r2', status: 'ok', updatedAt: '2026-09-01T00:00:00Z', sha256: 'x' },
    },
  };
  const { manifest, uploads } = await collector.collect({ fetcher, previousManifest, now: '2026-11-23T00:00:00Z' });
  assert.equal(manifest.totals.found, 2);
  assert.equal(manifest.totals.ok, 1);
  assert.equal(manifest.totals.unchanged, 1);
  const okEntry = Object.values(manifest.networks).find((e) => e.status === 'ok');
  assert.equal(okEntry.network, 'SIBRA Grand Annecy');
  assert.equal(okEntry.routes, 4);
  assert.deepEqual(okEntry.lines, { regular: 0, school: 1, demandResponsive: 1, unknown: 2 });
  assert.equal(okEntry.fares, false);
  assert.equal(okEntry.lastServiceDate, '2027-12-31');
  assert.equal(okEntry.agencies[0].name, 'SIBRA');
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].id, okEntry.id);
  const skipped = Object.values(manifest.networks).find((e) => e.status === 'unchanged');
  assert.equal(skipped.sha256, 'x');
});

test('collect() : une archive invalide pour un réseau ne bloque pas les autres (statut error isolé)', async () => {
  const bad = Buffer.from('ceci n’est pas un zip');
  const network = {
    id: 1, title: 'Réseau cassé',
    resources: [{ id: 'r1', format: 'GTFS', url: 'https://example.org/broken.zip', updated_at: '2026-11-01T00:00:00Z' }],
  };
  const fetcher = async (url) => {
    if (String(url).includes('transport.data.gouv.fr')) return { ok: true, json: async () => [network] };
    return new Response(bad, { headers: { 'content-type': 'application/zip' } });
  };
  const { manifest, uploads } = await collector.collect({ fetcher, now: '2026-11-23T00:00:00Z' });
  assert.equal(manifest.totals.found, 1);
  assert.equal(manifest.totals.error, 1);
  assert.equal(uploads.length, 0);
  assert.match(Object.values(manifest.errors)[0], /téléchargement|validation/);
});


test('collect() : une archive absente de la Release est retéléchargée même si PAN indique inchangé', async () => {
  const good = zip(baseFiles);
  let downloads = 0;
  const resource = { id: 'r1', format: 'GTFS', url: 'https://example.org/reseau.zip', updated_at: '2026-11-01T00:00:00Z' };
  const fetcher = async (url) => {
    if (String(url).includes('transport.data.gouv.fr')) return {
      ok: true, json: async () => [{ id: 'd1', title: 'Réseau Test', resources: [resource] }]
    };
    downloads++;
    return new Response(good, { headers: { 'content-type': 'application/zip' } });
  };
  const prior = { networks: { 'reseau-test-r1': {
    id: 'reseau-test-r1', datasetId: 'd1', resourceId: 'r1',
    status: 'unchanged', updatedAt: resource.updated_at,
    sha256: collector.sha256(good)
  } } };
  const missing = await collector.collect({
    fetcher, previousManifest: prior, availableAssets: new Set(), now: '2026-11-23T00:00:00Z'
  });
  assert.equal(downloads, 1);
  assert.equal(missing.manifest.totals.ok, 1);
  assert.equal(missing.uploads.length, 1);
  downloads = 0;
  const present = await collector.collect({
    fetcher, previousManifest: prior, availableAssets: new Set(['reseau-test-r1.zip']),
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(downloads, 0);
  assert.equal(present.manifest.totals.unchanged, 1);
});

test('shouldSkip refuse les dates de catalogue invalides', () => {
  assert.equal(collector.shouldSkip(
    { updatedAt: 'invalid' }, { status: 'ok', updatedAt: 'also invalid' }
  ), false);
});

test('processResource : calendrier impossible isolé comme erreur sans interrompre la collecte', async () => {
  const archive = zip(baseFiles);
  const fetcher = async () => new Response(archive, { headers: { 'content-type': 'application/zip' } });
  const entry = await collector.processResource({
    id: 'r1', datasetId: 'd1', network: 'Réseau test',
    format: 'GTFS', url: 'https://example.org/feed.zip', updatedAt: '2026-11-01T00:00:00Z'
  }, { fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000, previousEntry: null, now: 'invalid-date' });
  assert.equal(entry.status, 'error');
  assert.match(entry.error, /calendrier/);
});

test('lastServiceDate inclut les ajouts calendar_dates sans confondre les suppressions', () => {
  const files = {
    'calendar.txt': 'service_id,end_date\nWK,20261130\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20261202,2\nWK,20261201,1\n'
  };
  assert.equal(collector.lastServiceDate(files), '2026-12-01');
  assert.equal(collector.lastServiceDate({}), null);
});

test('processResource : CSV agency.txt malformé est une erreur isolée', async () => {
  const badFiles = {
    ...baseFiles,
    'agency.txt': 'agency_name,agency_timezone\n"Agence non terminée,Europe/Paris\n'
  };
  const fetcher = async () => new Response(zip(badFiles), {
    headers: { 'content-type': 'application/zip' }
  });
  const entry = await collector.processResource({
    id: 'r2', datasetId: 'd2', network: 'Agence test',
    format: 'GTFS', url: 'https://example.org/feed.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry: null, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
  assert.match(entry.error, /agency.txt/);
});

test('collect refuse les collisions de noms ZIP au lieu de perdre un réseau', async () => {
  const resources = [
    { id: 'abcdef123456-A', format: 'GTFS', url: 'https://example.org/a.zip' },
    { id: 'abcdef123456-B', format: 'GTFS', url: 'https://example.org/b.zip' }
  ];
  const fetcher = async url => {
    if (String(url).includes('transport.data.gouv.fr')) return {
      ok: true, json: async () => [{ id: 'dataset', title: 'Réseau Test', resources }]
    };
    return new Response(Buffer.from('invalid ZIP'), { headers: { 'content-type': 'application/zip' } });
  };
  await assert.rejects(collector.collect({ fetcher }), /Collision identifiant GTFS/);
});

test('processResource refuse des horaires non reliés à deux arrêts connus', async () => {
  const disconnected = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
      'T1,10:30:00,10:30:00,INCONNU,1\n' +
      'T1,11:00:00,11:00:00,A,2\n'
  };
  const fetcher = async () => new Response(zip(disconnected), {
    headers: { 'content-type': 'application/zip' }
  });
  const entry = await collector.processResource({
    id: 'r3', datasetId: 'd3', network: 'Réseau incohérent',
    format: 'GTFS', url: 'https://example.org/disconnected.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry: null, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
  assert.match(entry.error, /aucune course/);
});

test('processResource refuse une course dont le deuxième arrêt précède le premier', async () => {
  const invalidTimes = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
      'T1,12:00:00,12:00:00,A,1\n' +
      'T1,11:00:00,11:00:00,B,2\n'
  };
  const fetcher = async () => new Response(zip(invalidTimes), {
    headers: { 'content-type': 'application/zip' }
  });
  const entry = await collector.processResource({
    id: 'r4', datasetId: 'd4', network: 'Réseau horaires inversés',
    format: 'GTFS', url: 'https://example.org/reversed.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry: null, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
  assert.match(entry.error, /aucune course/);
});

test('processResource refuse une course avec séquences d’arrêts identiques', async () => {
  const invalidSequence = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
      'T1,10:00:00,10:00:00,A,1\n' +
      'T1,11:00:00,11:00:00,B,1\n'
  };
  const fetcher = async () => new Response(zip(invalidSequence), {
    headers: { 'content-type': 'application/zip' }
  });
  const entry = await collector.processResource({
    id: 'r5', datasetId: 'd5', network: 'Réseau séquences invalides',
    format: 'GTFS', url: 'https://example.org/sequence.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry: null, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
  assert.match(entry.error, /aucune course/);
});

test('processResource accepte une course cohérente avec des horaires après minuit', async () => {
  const overnight = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
      'T1,24:10:00,24:10:00,A,1\n' +
      'T1,25:05:00,25:05:00,B,2\n'
  };
  const fetcher = async () => new Response(zip(overnight), {
    headers: { 'content-type': 'application/zip' }
  });
  const entry = await collector.processResource({
    id: 'r6', datasetId: 'd6', network: 'Réseau de nuit',
    format: 'GTFS', url: 'https://example.org/overnight.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry: null, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.stops, 2);
});

test('lastServiceDate ignore les dates impossibles et les exceptions de suppression', () => {
  const files = {
    'calendar.txt': 'service_id,end_date\nWK,20260230\nWK,20261231\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20261301,1\nWK,20270103,2\nWK,20270102,1\n'
  };
  assert.equal(collector.lastServiceDate(files), '2027-01-02');
  assert.equal(collector.lastServiceDate({
    'calendar.txt': 'service_id,end_date\nWK,20260230\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20261301,1\n'
  }), null);
});
