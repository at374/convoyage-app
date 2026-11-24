'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loader = require('../transport-gtfs-loader.js');
const indexer = require('../transport-gtfs-index.js');
const flex = require('../transport-gtfs-flex-courses.js');

const DATA_DIR = process.env.GTFS_TEST_DATA_DIR || path.join(__dirname, '..', 'data', 'gtfs');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');
const hasManifest = fs.existsSync(MANIFEST_PATH);
const REQUIRE_REAL = process.env.REQUIRE_REAL_GTFS === '1';
const dates = Array.from({length:7}, (_, offset) => {
 const d = new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10);
});

if (!hasManifest) {
 test('IDFM réel : opérateurs GTFS collectés', {skip:!REQUIRE_REAL}, () => {
  assert.fail('REQUIRE_REAL_GTFS=1 exige le manifeste GTFS collecté');
 });
} else {
 const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
 const networks = Object.entries(manifest.networks || {}).filter(([id]) => id.startsWith('idfm-'));
 test('IDFM réel : agences terrestres isolées et lignes RATP découpées, sans trains dupliqués', () => {
  assert.ok(networks.length >= 80, `au moins 80 flux opérateur/ligne attendus après découpage RATP; trouvé ${networks.length}`);
 });
 for (const [id, entry] of networks) {
  test(`${entry.network} réel : horaires actifs indexables et GPS valides`, async () => {
   assert.equal(entry.license, 'Licence Mobilités', `${id}: licence absente`);
   assert.ok(entry.routes > 0 && entry.trips > 0 && entry.stop_times > 0, `${id}: comptes GTFS manquants`);
   const files = entry.files || [entry.file];
   assert.ok(files.length > 0, `${id}: archive manquante`);
   let candidate = null;
   for (const name of files) {
    const archive = path.join(DATA_DIR, name);
    assert.ok(fs.existsSync(archive), `${id}: fichier absent ${name}`);
    const bytes = fs.readFileSync(archive);
    assert.ok(bytes.length < 12*1024*1024, `${name}: dépasse 12 Mio`);
    const feed = await loader.loadResource({format:'GTFS',url:`https://example.org/${name}`},
     {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
    assert.ok(feed.index.counts.routes > 0 && feed.index.counts.stops > 0, `${name}: index vide`);
    const routes = indexer.parseCSV(feed.files['routes.txt'] || '');
    assert.ok(routes.every(row=>String(row.route_type)!=='2'), `${name}: route ferroviaire incluse en doublon`);
    for (const date of dates) {
     const trip = indexer.scheduledTrips(feed.files,feed.index,date)
      .find(row=>row.stops.length>=2&&row.stops[0].departure&&row.stops.at(-1).arrival);
     if (trip) { candidate={trip,feed}; break; }
    }
    if (candidate) break;
   }
   assert.ok(candidate, `${id}: aucune course active dans les sept prochains jours`);
   for (const stop of candidate.trip.stops) {
    const indexed = candidate.feed.index.stopById.get(stop.stopId);
    assert.ok(indexed, `${id}: arrêt non indexé ${stop.stopId}`);
    const lat=Number(indexed.stop_lat),lon=Number(indexed.stop_lon);
    assert.ok(Number.isFinite(lat)&&Number.isFinite(lon),`${id}: coordonnées absentes`);
    assert.ok(lat>=entry.bounds[0]&&lat<=entry.bounds[2]&&lon>=entry.bounds[1]&&lon<=entry.bounds[3],`${id}: arrêt hors emprise`);
   }
  });
 }
 test('IDFM réel : la ligne RATP 1 produit un trajet direct dans le moteur GTFS', async () => {
  const match=networks.find(([,entry])=>entry.network==='RATP — ligne 1 (métro)');
  assert.ok(match,'archive de la ligne RATP 1 absente');
  const [id,entry]=match;
  const archive=path.join(DATA_DIR,entry.file);
  const bytes=fs.readFileSync(archive);
  let found=null;
  for(const date of dates){
   const feed=await loader.loadResource({format:'GTFS',url:`https://example.org/${entry.file}`},
    {fetcher:async()=>new Response(bytes),indexServiceDates:[date],retainSourceTables:true});
   for(const candidate of indexer.scheduledTrips(feed.files,feed.index,date).slice(0,20)){
    const stops=candidate.stops;
    search: for(let i=0;i<stops.length;i++)for(let j=i+1;j<stops.length;j++){
     const journeys=indexer.directTrips(feed.files,feed.index,date,stops[i].stopId,stops[j].stopId);
     const journey=journeys.find(row=>row.tripId===candidate.tripId);
     if(journey){found={id,date,journey};break search;}
    }
    if(found)break;
   }
   if(found)break;
  }
  assert.ok(found,`${id}: aucune course RATP 1 retournée par directTrips`);
  assert.equal(found.journey.line,'1');
  assert.match(found.journey.departure,/^\d{1,3}:\d{2}:\d{2}$/);
  assert.match(found.journey.arrival,/^\d{1,3}:\d{2}:\d{2}$/);
 });
 test('IDFM réel : le TAD conserve sa fenêtre, son préavis et son lien de réservation', async () => {
  const match=networks.find(([,entry])=>entry.network==='Centre et Sud Yvelines');
  assert.ok(match,'archive Centre et Sud Yvelines absente');
  const [id,entry]=match,bytes=fs.readFileSync(path.join(DATA_DIR,entry.file));
  let found=null;
  for(const date of dates){
   const feed=await loader.loadResource({format:'GTFS',url:`https://example.org/${entry.file}`},
    {fetcher:async()=>new Response(bytes),indexServiceDates:[date],retainSourceTables:true});
   const candidate=flex.extract(feed.files,feed.index,date,{limit:10})
    .find(row=>row.pickupRule?.bookingUrl&&row.pickupWindow.endSeconds>row.pickupWindow.startSeconds);
   if(candidate){found=candidate;break;}
  }
  assert.ok(found,`${id}: aucune fenêtre TAD IDFM avec règle de réservation indexée dans les sept prochains jours`);
  assert.equal(found.kind,'gtfs-flex-candidate');
  assert.ok(found.pickupRule.noticeMinutes>0,'préavis TAD absent');
  assert.match(found.pickupRule.bookingUrl,/reservation\.tad\.iledefrance-mobilites\.fr/);
  assert.equal(found.flexBooking.reservationConfirmed,false,'un créneau ne doit pas être présenté comme réservation confirmée');
 });
}
