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
  assert.deepEqual(counts, { regular: 1, school: 1, demandResponsive: 1, unknown: 1 });
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

test('shouldSkip ne retélécharge pas quand la date de mise à jour PAN est inchangée', () => {
  const resource = { datasetId: 'd1', id: 'r1', updatedAt: '2026-11-01T00:00:00Z' };
  assert.equal(collector.shouldSkip(resource, { status: 'ok', updatedAt: '2026-11-01T00:00:00Z' }), true);
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
      'tac-annemasse-r2': { id: 'tac-annemasse-r2', datasetId: 43, resourceId: 'r2', status: 'ok', updatedAt: '2026-09-01T00:00:00Z', sha256: 'x' },
    },
  };
  const { manifest, uploads } = await collector.collect({ fetcher, previousManifest, now: '2026-11-23T00:00:00Z' });
  assert.equal(manifest.totals.found, 2);
  assert.equal(manifest.totals.ok, 1);
  assert.equal(manifest.totals.unchanged, 1);
  const okEntry = Object.values(manifest.networks).find((e) => e.status === 'ok');
  assert.equal(okEntry.network, 'SIBRA Grand Annecy');
  assert.equal(okEntry.routes, 4);
  assert.deepEqual(okEntry.lines, { regular: 1, school: 1, demandResponsive: 1, unknown: 1 });
  assert.equal(okEntry.fares, false);
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
