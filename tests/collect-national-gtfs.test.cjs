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

test('shouldSkip ne retélécharge que si URL et date PAN sont inchangées', () => {
  const url = 'https://example.org/feed.zip';
  const updatedAt = '2026-11-01T00:00:00Z';
  const resource = { datasetId: 'd1', id: 'r1', url, updatedAt };
  assert.equal(collector.shouldSkip(resource, { status: 'ok', url, updatedAt }), true);
  assert.equal(collector.shouldSkip(resource, { status: 'unchanged', url, updatedAt }), true);
  assert.equal(collector.shouldSkip(resource, { status: 'ok', url, updatedAt: '2026-10-01T00:00:00Z' }), false);
  assert.equal(collector.shouldSkip(resource, { status: 'ok', updatedAt }), false);
  assert.equal(collector.shouldSkip({ ...resource, url: undefined }, { status: 'ok', updatedAt }), false);
  assert.equal(collector.shouldSkip(resource, null), false);
  assert.equal(collector.shouldSkip(resource, { status: 'error', url, updatedAt }), false);
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
      'tac-annemasse-r2': { id: 'tac-annemasse-r2', datasetId: '43', resourceId: 'r2', status: 'ok', url: 'https://example.org/tac.zip', updatedAt: '2026-09-01T00:00:00Z', lastValidatedAt: '2026-11-22T00:00:00Z', lastServiceDate: '2027-12-31', regularConnectedTrip: true, activeRegularNext30Days: true, flexServiceCount: 0, activeFlexNext30Days: false, sha256: 'x' },
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

test('collect() : publie chaque archive validée immédiatement sans conserver les ZIP en mémoire', async () => {
  const good = zip(baseFiles);
  const network = {
    id: 'memory-test', title: 'Réseau mémoire',
    resources: [{ id: 'resource-1', format: 'GTFS', url: 'https://example.org/memory.zip', updated_at: '2026-11-23T00:00:00Z' }],
  };
  const fetcher = async url => {
    if (String(url).includes('transport.data.gouv.fr')) return { ok: true, json: async () => [network] };
    return new Response(good, { headers: { 'content-type': 'application/zip' } });
  };
  const written = [];
  const result = await collector.collect({
    fetcher,
    retainUploads: false,
    concurrency: 1,
    onValidatedArchive: async archive => written.push({ id: archive.id, sha256: collector.sha256(archive.bytes) }),
    now: '2026-11-23T00:00:00Z',
  });
  const entry = Object.values(result.manifest.networks)[0];
  assert.equal(result.manifest.totals.ok, 1);
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(written, [{ id: entry.id, sha256: entry.sha256 }]);
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
    status: 'unchanged', url: resource.url, updatedAt: resource.updated_at,
    lastValidatedAt: '2026-11-22T00:00:00Z', lastServiceDate: '2027-12-31',
    regularConnectedTrip: true, activeRegularNext30Days: true, flexServiceCount: 0, activeFlexNext30Days: false,
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

test('processResource signale les produits tarifaires GTFS Fares v2 sans inventer de prix', async () => {
  const fareV2 = {
    ...baseFiles,
    'fare_products.txt': 'fare_product_id,fare_product_name,amount,currency\nFP1,Billet,2.50,EUR\n'
  };
  const fetcher = async () => new Response(zip(fareV2), {
    headers: { 'content-type': 'application/zip' }
  });
  const entry = await collector.processResource({
    id: 'r7', datasetId: 'd7', network: 'Réseau Fares v2',
    format: 'GTFS', url: 'https://example.org/fare-v2.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry: null, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.fares, true);
  assert.equal(Object.hasOwn(entry, 'price'), false);
});

test('processResource ne déclare pas de tarifs quand Fares v1/v2 ne contient que des en-têtes', async () => {
  const emptyFares = {
    ...baseFiles,
    'fare_attributes.txt': 'fare_id,price,currency_type,payment_method,transfers\n',
    'fare_products.txt': 'fare_product_id,fare_product_name,amount,currency\n'
  };
  const fetcher = async () => new Response(zip(emptyFares), {
    headers: { 'content-type': 'application/zip' }
  });
  const entry = await collector.processResource({
    id: 'r8', datasetId: 'd8', network: 'Réseau tarifs vides',
    format: 'GTFS', url: 'https://example.org/empty-fares.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry: null, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.fares, false);
});

test('lastServiceDate respecte les années bissextiles', () => {
  const files = {
    'calendar.txt': 'service_id,end_date\nWK,20240229\nWK,20250229\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20260229,1\n'
  };
  assert.equal(collector.lastServiceDate(files), '2024-02-29');
});

test('shouldSkip retélécharge si l’URL PAN change sans modification de date', () => {
  const resource = { datasetId: 'd1', id: 'r1', url: 'https://example.org/new.zip', updatedAt: '2026-11-01T00:00:00Z' };
  const previous = { status: 'ok', url: 'https://example.org/old.zip', updatedAt: resource.updatedAt };
  assert.equal(collector.shouldSkip(resource, previous), false);
  assert.equal(collector.shouldSkip(resource, { ...previous, url: resource.url }), true);
  assert.equal(collector.shouldSkip(resource, { ...previous, url: undefined }), false);
});

test('activeWithinDays respecte les suppressions et ajouts de service', () => {
  const today = new Date('2026-06-01T00:00:00Z');
  const removed = {
    ...baseFiles,
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20260601,2\n'
  };
  assert.equal(collector.activeWithinDays(removed, 1, today), false);
  assert.equal(collector.activeWithinDays(removed, 2, today), true);
  const added = {
    ...baseFiles,
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,0,0,0,0,0,0,0,20260101,20271231\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20260601,1\n'
  };
  assert.equal(collector.activeWithinDays(added, 1, today), true);
  assert.equal(collector.activeWithinDays({ ...added, 'calendar_dates.txt': 'service_id,date,exception_type\n' }, 1, today), false);
});

test('processResource revalide un calendrier expiré même si la date PAN et le ZIP sont identiques', async () => {
  const good = zip(baseFiles);
  let downloads = 0;
  const resource = {
    id: 'r9', datasetId: 'd9', network: 'Réseau calendrier',
    format: 'GTFS', url: 'https://example.org/calendar.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  };
  const previousEntry = {
    status: 'ok', url: resource.url, updatedAt: resource.updatedAt,
    lastServiceDate: '2026-11-20', activeNext30Days: true,
    sha256: collector.sha256(good)
  };
  const fetcher = async () => {
    downloads++;
    return new Response(good, { headers: { 'content-type': 'application/zip' } });
  };
  const entry = await collector.processResource(resource, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(downloads, 1);
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.activeNext30Days, true);
  assert.equal(entry.lastServiceDate, '2027-12-31');
});

test('processResource actualise le statut glissant après sept jours malgré un ZIP identique', async () => {
  const good = zip(baseFiles);
  let downloads = 0;
  const resource = {
    id: 'r10', datasetId: 'd10', network: 'Réseau statut glissant',
    format: 'GTFS', url: 'https://example.org/rolling.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  };
  const previousEntry = {
    status: 'ok', url: resource.url, updatedAt: resource.updatedAt,
    lastCheckedAt: '2026-11-15T00:00:00Z',
    lastServiceDate: '2027-12-31', activeNext30Days: false,
    sha256: collector.sha256(good)
  };
  const fetcher = async () => {
    downloads++;
    return new Response(good, { headers: { 'content-type': 'application/zip' } });
  };
  const entry = await collector.processResource(resource, {
    fetcher, maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(downloads, 1);
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.activeNext30Days, true);
});

test('processResource conserve la date de validation lors des simples passages du cache', async () => {
  const resource = {
    id: 'r11', datasetId: 'd11', network: 'Réseau cache',
    format: 'GTFS', url: 'https://example.org/cache.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  };
  const previousEntry = {
    status: 'ok', url: resource.url, updatedAt: resource.updatedAt,
    lastCheckedAt: '2026-11-22T00:00:00Z',
    lastValidatedAt: '2026-11-20T00:00:00Z',
    lastServiceDate: '2027-12-31', activeNext30Days: true,
    regularConnectedTrip: true, activeRegularNext30Days: true, flexServiceCount: 0, activeFlexNext30Days: false,
    sha256: 'previous-hash'
  };
  const entry = await collector.processResource(resource, {
    fetcher: async () => { throw new Error('ne doit pas télécharger'); },
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'unchanged');
  assert.equal(entry.lastCheckedAt, '2026-11-23T00:00:00Z');
  assert.equal(entry.lastValidatedAt, '2026-11-20T00:00:00Z');
});

test('processResource revalide si URL PAN change même avec une archive identique', async () => {
  const good = zip(baseFiles);
  const resource = {
    id: 'r12', datasetId: 'd12', network: 'Réseau URL changée',
    format: 'GTFS', url: 'https://example.org/new.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  };
  const previousEntry = {
    status: 'ok', url: 'https://example.org/old.zip',
    updatedAt: resource.updatedAt,
    lastValidatedAt: '2026-11-22T00:00:00Z',
    lastServiceDate: '2027-12-31', activeNext30Days: false,
    sha256: collector.sha256(good)
  };
  let downloads = 0;
  const entry = await collector.processResource(resource, {
    fetcher: async () => {
      downloads++;
      return new Response(good, { headers: { 'content-type': 'application/zip' } });
    },
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    previousEntry, now: '2026-11-23T00:00:00Z'
  });
  assert.equal(downloads, 1);
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.url, resource.url);
  assert.equal(entry.lastValidatedAt, '2026-11-23T00:00:00Z');
  assert.equal(entry.activeNext30Days, true);
});

test('collect dédoublonne une même ressource PAN malgré deux URL', async () => {
  const resources = [
    { id: 'r1', format: 'GTFS', url: 'https://example.org/old.zip', updated_at: '2026-11-01T00:00:00Z' },
    { id: 'r1', format: 'GTFS', url: 'https://example.org/new.zip', updated_at: '2026-11-22T00:00:00Z' }
  ];
  const requested = [];
  const fetcher = async url => {
    if (String(url).includes('transport.data.gouv.fr')) return {
      ok: true, json: async () => [{ id: 'dataset', title: 'Réseau Test', resources }]
    };
    requested.push(String(url));
    return new Response(zip(baseFiles), { headers: { 'content-type': 'application/zip' } });
  };
  const { manifest } = await collector.collect({ fetcher, now: '2026-11-23T00:00:00Z' });
  assert.equal(manifest.totals.found, 1);
  assert.deepEqual(requested, ['https://example.org/new.zip']);
  assert.equal(Object.values(manifest.networks)[0].url, 'https://example.org/new.zip');
});

test('activeWithinDays ignore les services sans courses reliées éligibles', () => {
  const files = {
    'trips.txt': 'route_id,service_id,trip_id\nR1,ACTIVE,T1\nR1,UNLINKED,T2\n',
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nACTIVE,1,1,1,1,1,1,1,20260101,20271231\nUNLINKED,1,1,1,1,1,1,1,20260101,20271231\n'
  };
  const today = new Date('2026-11-23T00:00:00Z');
  assert.equal(collector.activeWithinDays(files, 30, today, new Set(['ACTIVE'])), true);
  assert.equal(collector.activeWithinDays(files, 30, today, new Set(['UNKNOWN'])), false);
});

test('lastServiceDate exclut les services sans courses connectées', () => {
  const files = {
    'calendar.txt': 'service_id,end_date\nCONNECTED,20261231\nORPHAN,20291231\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nORPHAN,20300101,1\nCONNECTED,20270115,1\n'
  };
  assert.equal(collector.lastServiceDate(files), '2030-01-01');
  assert.equal(collector.lastServiceDate(files, new Set(['CONNECTED'])), '2027-01-15');
  assert.equal(collector.lastServiceDate(files, new Set(['UNKNOWN'])), null);
});

test('processResource ne déclare pas actif un service dont seules les courses sont déconnectées', async () => {
  const files = {
    ...baseFiles,
    'trips.txt': 'route_id,service_id,trip_id\nR1,EXPIRED,T1\nR1,CURRENT,T2\n',
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
      'T1,10:00:00,10:00:00,A,1\nT1,11:00:00,11:00:00,B,2\n' +
      'T2,10:00:00,10:00:00,A,1\nT2,11:00:00,11:00:00,INCONNU,2\n',
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'EXPIRED,1,1,1,1,1,1,1,20260101,20260131\n' +
      'CURRENT,1,1,1,1,1,1,1,20260101,20271231\n'
  };
  const entry = await collector.processResource({
    id: 'r13', datasetId: 'd13', network: 'Réseau service orphelin',
    format: 'GTFS', url: 'https://example.org/orphan.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.activeNext30Days, false);
  assert.equal(entry.lastServiceDate, '2026-01-31');
});

test('lastServiceDate ne prolonge pas un calendrier sans aucun jour actif', () => {
  const files = {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'DORMANT,0,0,0,0,0,0,0,20260101,20301231\n' +
      'ACTIF,1,0,0,0,0,0,0,20260101,20271231\n',
    'calendar_dates.txt': 'service_id,date,exception_type\n'
  };
  assert.equal(collector.lastServiceDate(files), '2027-12-27'); // dernier lundi réellement actif
  assert.equal(collector.lastServiceDate(files, new Set(['DORMANT'])), null);
});

test('lastServiceDate ignore les périodes inversées ou les débuts impossibles', () => {
  const files = {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'INVERSE,1,1,1,1,1,1,1,20300101,20291231\n' +
      'IMPOSSIBLE,1,1,1,1,1,1,1,20260230,20311231\n' +
      'VALID,1,1,1,1,1,1,1,20260101,20271231\n'
  };
  assert.equal(collector.lastServiceDate(files), '2027-12-31');
  assert.equal(collector.lastServiceDate(files, new Set(['INVERSE', 'IMPOSSIBLE'])), null);
});

test('processResource rejette une liaison où montée et descente sont interdites', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n' +
      'T1,10:00:00,10:00:00,A,1,1,0\nT1,11:00:00,11:00:00,B,2,0,1\n'
  };
  const entry = await collector.processResource({
    id: 'r14', datasetId: 'd14', network: 'Réseau accès interdits',
    format: 'GTFS', url: 'https://example.org/forbidden.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
  assert.match(entry.error, /aucune course/);
});

test('processResource conserve le TAD avec réservation sans déclarer de trajet régulier', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n' +
      'T1,10:00:00,10:00:00,A,1,2,0\nT1,11:00:00,11:00:00,B,2,0,3\n'
  };
  const entry = await collector.processResource({
    id: 'r15', datasetId: 'd15', network: 'Réseau réservation',
    format: 'GTFS', url: 'https://example.org/reservation.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.activeNext30Days, true);
  assert.equal(entry.regularConnectedTrip, false);
  assert.equal(entry.activeRegularNext30Days, false);
});

test('toCSV expose séparément les services actifs réguliers et sur réservation', () => {
  const csv = collector.toCSV({ networks: {
    tad: { id: 'tad', network: 'TAD', status: 'ok',
      activeNext30Days: true, activeRegularNext30Days: false,
      regularConnectedTrip: false }
  } });
  assert.match(csv, /activeRegularNext30Days/);
  assert.match(csv, /regularConnectedTrip/);
  assert.match(csv, /true,false,false/);
});

test('processResource repère une liaison régulière après un premier arrêt réservé', async () => {
  const files = {
    ...baseFiles,
    'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\nA,Départ,45.9,6.1\nB,Intermédiaire,45.8,6.2\nC,Arrivée,45.7,6.3\n',
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n' +
      'T1,09:00:00,09:00:00,A,1,2,0\n' +
      'T1,09:15:00,09:15:00,B,2,0,0\n' +
      'T1,09:30:00,09:30:00,C,3,0,0\n'
  };
  const entry = await collector.processResource({
    id: 'r16', datasetId: 'd16', network: 'Réseau mixte',
    format: 'GTFS', url: 'https://example.org/mixed.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.regularConnectedTrip, true);
  assert.equal(entry.activeRegularNext30Days, true);
});

test('processResource revalide les manifestes anciens sans indicateurs TAD', async () => {
  const bytes = zip(baseFiles);
  const resource = {
    id: 'r17', datasetId: 'd17', network: 'Réseau migration',
    format: 'GTFS', url: 'https://example.org/migration.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  };
  let downloads = 0;
  const entry = await collector.processResource(resource, {
    fetcher: async () => {
      downloads++;
      return new Response(bytes, { headers: { 'content-type': 'application/zip' } });
    },
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z',
    previousEntry: {
      status: 'ok', url: resource.url, updatedAt: resource.updatedAt,
      lastValidatedAt: '2026-11-22T00:00:00Z',
      lastServiceDate: '2027-12-31', sha256: collector.sha256(bytes)
    }
  });
  assert.equal(downloads, 1);
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.regularConnectedTrip, true);
  assert.equal(entry.activeRegularNext30Days, true);
});

test('processResource accepte une boucle avec arrêt de départ répété', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n' +
      'T1,09:00:00,09:00:00,A,1,0,0\n' +
      'T1,09:15:00,09:15:00,A,2,0,0\n' +
      'T1,09:30:00,09:30:00,B,3,0,0\n'
  };
  const entry = await collector.processResource({
    id: 'r18', datasetId: 'd18', network: 'Réseau circulaire',
    format: 'GTFS', url: 'https://example.org/loop.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.regularConnectedTrip, true);
  assert.equal(entry.activeRegularNext30Days, true);
});

test('lastServiceDate ignore une période sans jour de circulation effectif', () => {
  const files = {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'WK,1,0,0,0,0,0,0,20261124,20261125\n'
  };
  assert.equal(collector.lastServiceDate(files), null);
});

test('lastServiceDate retourne le dernier lundi circulé et non la fin théorique', () => {
  const files = {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'WK,1,0,0,0,0,0,0,20261123,20261125\n'
  };
  assert.equal(collector.lastServiceDate(files), '2026-11-23');
});

test('lastServiceDate recule quand le dernier service régulier est supprimé', () => {
  const files = {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'WK,1,0,0,0,0,0,0,20261116,20261130\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20261130,2\n'
  };
  assert.equal(collector.lastServiceDate(files), '2026-11-23');
});

test('lastServiceDate ne conserve pas un service dont toutes les dates sont annulées', () => {
  const files = {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'WK,1,0,0,0,0,0,0,20261123,20261130\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20261123,2\nWK,20261130,2\n'
  };
  assert.equal(collector.lastServiceDate(files), null);
});

test('lastServiceDate conserve un ajout exceptionnel après les suppressions', () => {
  const files = {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'WK,1,0,0,0,0,0,0,20261123,20261130\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nWK,20261130,2\nWK,20261202,1\n'
  };
  assert.equal(collector.lastServiceDate(files), '2026-12-02');
});

test('lastServiceDate accepte les dates GTFS AAAAMMJJ valides', () => {
  const files = {
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
      'WK,1,1,1,1,1,1,1,20261123,20261130\n'
  };
  assert.equal(collector.lastServiceDate(files), '2026-11-30');
});

test('processResource reconnaît GTFS-Flex sans fabriquer de départ régulier', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window\n' +
      'T1,1,G1,09:00:00,10:00:00\n' +
      'T1,2,G2,09:30:00,11:00:00\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG1,Zone A\nG2,Zone B\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG1,A\nG2,B\n',
    'booking_rules.txt': 'booking_rule_id,booking_type\nBR1,1\n'
  };
  const entry = await collector.processResource({
    id: 'flex1', datasetId: 'flex', network: 'Réseau TAD',
    format: 'GTFS', url: 'https://example.org/flex.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.flexServiceCount, 1);
  assert.equal(entry.flexBookingRuleCount, 0);
  assert.equal(entry.flexBookingNoticeMinMinutes, null);
  assert.equal(entry.flexBookingNoticeComplete, false);
  assert.equal(entry.activeFlexNext30Days, true);
  assert.equal(entry.activeNext30Days, true);
  assert.equal(entry.regularConnectedTrip, false);
  assert.equal(entry.activeRegularNext30Days, false);
});

test('processResource rejette une fenêtre GTFS-Flex sans groupe desservi', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window\n' +
      'T1,1,G1,09:00:00,10:00:00\n' +
      'T1,2,G2,09:30:00,11:00:00\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG1,Zone A\nG2,Zone B\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG1,A\n'
  };
  const entry = await collector.processResource({
    id: 'flex2', datasetId: 'flex', network: 'TAD incomplet',
    format: 'GTFS', url: 'https://example.org/flex-invalid.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
});

test('processResource GTFS-Flex refuse une montée interdite', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window,pickup_type,drop_off_type\n' +
      'T1,1,G1,09:00:00,10:00:00,1,0\n' +
      'T1,2,G2,09:30:00,11:00:00,0,0\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG1,Zone A\nG2,Zone B\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG1,A\nG2,B\n'
  };
  const entry = await collector.processResource({
    id: 'flex3', datasetId: 'flex', network: 'TAD montée interdite',
    format: 'GTFS', url: 'https://example.org/flex-no-pickup.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
});

test('processResource GTFS-Flex refuse une destination avant le départ', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window,pickup_type,drop_off_type\n' +
      'T1,1,G1,11:00:00,12:00:00,0,0\n' +
      'T1,2,G2,09:00:00,10:00:00,0,0\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG1,Zone A\nG2,Zone B\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG1,A\nG2,B\n'
  };
  const entry = await collector.processResource({
    id: 'flex4', datasetId: 'flex', network: 'TAD fenêtres inversées',
    format: 'GTFS', url: 'https://example.org/flex-inverted.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
});

test('toCSV distingue activité GTFS-Flex et régulière', () => {
  const csv = collector.toCSV({ networks: {
    flex: { id: 'flex', network: 'TAD', status: 'ok', activeNext30Days: true,
      activeRegularNext30Days: false, regularConnectedTrip: false,
      flexServiceCount: 1, activeFlexNext30Days: true }
  } });
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  const fields = lines[1].split(',');
  assert.equal(fields[headers.indexOf('flexServiceCount')], '1');
  assert.equal(fields[headers.indexOf('activeFlexNext30Days')], 'true');
  assert.equal(fields[headers.indexOf('activeRegularNext30Days')], 'false');
});

test('processResource GTFS-Flex accepte une fenêtre sur arrêt précis et zone', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,stop_id,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window\n' +
      'T1,1,A,,09:00:00,10:00:00\n' +
      'T1,2,,G2,09:30:00,11:00:00\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG2,Zone B\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG2,B\n'
  };
  const entry = await collector.processResource({
    id: 'flex-mixed', datasetId: 'flex', network: 'TAD mixte',
    format: 'GTFS', url: 'https://example.org/flex-mixed.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.flexServiceCount, 1);
  assert.equal(entry.activeFlexNext30Days, true);
  assert.equal(entry.activeRegularNext30Days, false);
});

test('processResource GTFS-Flex ne confond pas deux groupes couvrant le même arrêt', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window\n' +
      'T1,1,G1,09:00:00,10:00:00\n' +
      'T1,2,G2,09:30:00,11:00:00\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG1,Zone A\nG2,Zone B\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG1,A\nG2,A\n'
  };
  const entry = await collector.processResource({
    id: 'flex-same-stop', datasetId: 'flex', network: 'TAD groupes identiques',
    format: 'GTFS', url: 'https://example.org/flex-same-stop.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
});

test('processResource GTFS-Flex accepte des zones qui partagent un arrêt mais desservent deux arrêts distincts', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window\n' +
      'T1,1,G1,09:00:00,10:00:00\n' +
      'T1,2,G2,09:30:00,11:00:00\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG1,Zone A\nG2,Zone B\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG1,A\nG2,A\nG2,B\n'
  };
  const entry = await collector.processResource({
    id: 'flex-shared-stop', datasetId: 'flex', network: 'TAD zones partagées',
    format: 'GTFS', url: 'https://example.org/flex-shared-stop.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.flexServiceCount, 1);
});

test('processResource GTFS-Flex refuse arrêt A vers groupe contenant uniquement A', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,stop_id,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window\n' +
      'T1,1,A,,09:00:00,10:00:00\n' +
      'T1,2,,G1,09:30:00,11:00:00\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG1,Zone A\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG1,A\n'
  };
  const entry = await collector.processResource({
    id: 'flex-stop-group-same', datasetId: 'flex', network: 'TAD sans déplacement',
    format: 'GTFS', url: 'https://example.org/flex-stop-group-same.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
});

test('processResource GTFS-Flex refuse une règle de réservation absente', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window,pickup_booking_rule_id,drop_off_booking_rule_id\n' +
      'T1,1,G1,09:00:00,10:00:00,MISSING,\n' +
      'T1,2,G2,09:30:00,11:00:00,,MISSING\n',
    'location_groups.txt': 'location_group_id,location_group_name\nG1,Zone A\nG2,Zone B\n',
    'location_group_stops.txt': 'location_group_id,stop_id\nG1,A\nG2,B\n',
    'booking_rules.txt': 'booking_rule_id,booking_type\nOTHER,1\n'
  };
  const entry = await collector.processResource({
    id: 'flex-rule-missing', datasetId: 'flex', network: 'TAD réservation inconnue',
    format: 'GTFS', url: 'https://example.org/flex-rule-missing.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
});

test('toCSV exporte les préavis Flex sans les interpréter comme réservation confirmée', () => {
  const csv = collector.toCSV({ networks: { flex: {
    id: 'flex', network: 'TAD', status: 'ok', flexServiceCount: 1,
    flexBookingRuleCount: 2, flexBookingNoticeMinMinutes: 60,
    flexBookingNoticeMaxMinutes: 120, flexBookingNoticeComplete: true
  } } });
  const [header, values] = csv.trim().split('\n').map(row => row.split(','));
  for (const [column, expected] of [
    ['flexBookingRuleCount', '2'],
    ['flexBookingNoticeMinMinutes', '60'],
    ['flexBookingNoticeMaxMinutes', '120'],
    ['flexBookingNoticeComplete', 'true']
  ]) assert.equal(values[header.indexOf(column)], expected);
});

test('GTFS-Flex ne compte pas les préavis de courses sans liaison exploitable', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,stop_id,start_pickup_drop_off_window,end_pickup_drop_off_window,pickup_booking_rule_id,drop_off_booking_rule_id\n' +
      'T1,1,A,09:00:00,10:00:00,VALID,\n' +
      'T1,2,B,09:30:00,11:00:00,,VALID\n' +
      'T2,1,A,09:00:00,10:00:00,UNUSED,\n' +
      'T2,2,A,09:30:00,11:00:00,,UNUSED\n',
    'booking_rules.txt': 'booking_rule_id,prior_notice_duration_min\nVALID,60\nUNUSED,900\n'
  };
  const entry = await collector.processResource({
    id: 'flex-notice-scope', datasetId: 'flex', network: 'TAD préavis',
    format: 'GTFS', url: 'https://example.org/flex-notice-scope.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.flexBookingRuleCount, 1);
  assert.equal(entry.flexBookingNoticeMinMinutes, 60);
  assert.equal(entry.flexBookingNoticeMaxMinutes, 60);
  assert.equal(entry.flexBookingNoticeComplete, true);
});

test('GTFS-Flex: un préavis vide reste inconnu et non égal à zéro', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,stop_id,start_pickup_drop_off_window,end_pickup_drop_off_window,pickup_booking_rule_id,drop_off_booking_rule_id\n' +
      'T1,1,A,09:00:00,10:00:00,UNKNOWN,\n' +
      'T1,2,B,09:30:00,11:00:00,,UNKNOWN\n',
    'booking_rules.txt': 'booking_rule_id,prior_notice_duration_min\nUNKNOWN,\n'
  };
  const entry = await collector.processResource({
    id: 'flex-notice-empty', datasetId: 'flex', network: 'TAD préavis inconnu',
    format: 'GTFS', url: 'https://example.org/flex-notice-empty.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'ok', entry.error);
  assert.equal(entry.flexBookingRuleCount, 1);
  assert.equal(entry.flexBookingNoticeMinMinutes, null);
  assert.equal(entry.flexBookingNoticeMaxMinutes, null);
  assert.equal(entry.flexBookingNoticeComplete, false);
});

test('GTFS-Flex refuse les types embarquement et débarquement inconnus', async () => {
  const files = {
    ...baseFiles,
    'stop_times.txt': 'trip_id,stop_sequence,stop_id,start_pickup_drop_off_window,end_pickup_drop_off_window,pickup_type,drop_off_type\n' +
      'T1,1,A,09:00:00,10:00:00,9,1\n' +
      'T1,2,B,09:30:00,11:00:00,1,9\n'
  };
  const entry = await collector.processResource({
    id: 'flex-invalid-types', datasetId: 'flex', network: 'TAD types invalides',
    format: 'GTFS', url: 'https://example.org/flex-invalid-types.zip',
    updatedAt: '2026-11-01T00:00:00Z'
  }, {
    fetcher: async () => new Response(zip(files), { headers: { 'content-type': 'application/zip' } }),
    maxBytes: 200 * 1024 * 1024, timeoutMs: 3000,
    now: '2026-11-23T00:00:00Z'
  });
  assert.equal(entry.status, 'error');
  assert.match(entry.error, /aucune course régulière ou GTFS-Flex structurée exploitable/);
});
