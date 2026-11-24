'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loader = require('../transport-gtfs-loader.js');
const indexer = require('../transport-gtfs-index.js');

const DATA_DIR = process.env.GTFS_TEST_DATA_DIR || path.join(__dirname, '..', 'data', 'gtfs');
const NETWORKS = [
 ['bretagne-star-rennes','STAR Rennes'],['bretagne-qub-quimper','QUB Quimper'],
 ['bretagne-tub-saint-brieuc','TUB Saint-Brieuc'],['bretagne-mat-saint-malo','MAT Saint-Malo'],
 ['bretagne-kiceo-vannes','Kicéo Vannes'],['bretagne-aleop-finistere','BreizhGo en Finistère'],
 ['bretagne-bibus-brest','Bibus Brest'],['bretagne-izilo-lorient','Izilo Lorient'],
 ['bretagne-aleop-cotes-armor','BreizhGo en Côtes d’Armor'],['bretagne-distribus-lamballe','Distribus Lamballe'],
 ['bretagne-tbk-quimperle','TBK Quimperlé'],['bretagne-arbus-landerneau','Ar Bus Landerneau'],
 ['bretagne-guingamp-paimpol','Guingamp-Paimpol Mobilité'],['bretagne-coralie-concarneau','Coralie Concarneau'],
 ['bretagne-tudbus-douarnenez','Tud’Bus Douarnenez'],['bretagne-auraybus','Auray Bus'],
 ['bretagne-pondibus-pontivy','PondiBUS et MOOVI'],['bretagne-aleop-ille-et-vilaine','BreizhGo en Ille-et-Vilaine'],
 ['bretagne-tilt-lannion','TILT Lannion'],['bretagne-surf-fougeres','SURF Fougères'],
 ['bretagne-riv-ploermel','RIV Ploërmel'],['bretagne-lineotim-morlaix','Linéotim Morlaix urbain'],
 ['bretagne-aleop-morbihan','BreizhGo en Morbihan'],['bretagne-lineotim-periurbain','Linéotim Morlaix périurbain'],
];
const dates = Array.from({length:30}, (_, offset) => {
 const d = new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10);
});

for (const [id,name] of NETWORKS) {
 test(`${name} réel : KORRIGO terrestre indexable et course active`,
  {skip: !fs.existsSync(path.join(DATA_DIR, `${id}.zip`)) && process.env.REQUIRE_REAL_GTFS !== '1'}, async () => {
   const manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
   const entry = manifest.networks?.[id];
   assert.ok(entry && entry.license === 'ODbL 1.0 + conditions particulières PAN', `${id}: entrée/licence manquante`);
   assert.ok(Array.isArray(entry.bounds) && entry.bounds.length === 4, `${id}: emprise manquante`);
   const files = entry.files || [entry.file];
   assert.ok(files.length && files.every(file => fs.existsSync(path.join(DATA_DIR, file))),
    `REQUIRE_REAL_GTFS=1 exige toutes les archives déclarées pour ${id}`);
   let candidate = null;
   for (const file of files) {
    const bytes = fs.readFileSync(path.join(DATA_DIR,file));
    assert.ok(bytes.length < 12*1024*1024, `${file}: archive dépasse 12 Mio`);
    const feed = await loader.loadResource({format:'GTFS',url:`https://example.org/${file}`},
     {fetcher:async()=>new Response(bytes),retainSourceTables:true});
    assert.ok(feed.index.counts.routes > 0, `${file}: aucune ligne indexée`);
    assert.ok(feed.index.counts.stops > 0, `${file}: aucun arrêt indexé`);
    const routes = indexer.parseCSV(feed.files['routes.txt'] || '');
    assert.ok(routes.every(row => !['4','1100'].includes(String(row.route_type))), `${file}: ferry ou aérien inclus`);
    for (const date of dates) {
     for (const trip of indexer.scheduledTrips(feed.files, feed.index, date)) {
      if (trip.stops.length >= 2 && !candidate) candidate = {date, trip, feed};
      if (candidate) break;
     }
     if (candidate) break;
    }
   }
   assert.ok(candidate, `${id}: aucune course active dans les 30 prochains jours`);
   assert.ok(candidate.trip.stops[0].arrival && candidate.trip.stops.at(-1).arrival, `${id}: horaires absents`);
   for (const stop of candidate.trip.stops) {
    const indexed = candidate.feed.index.stopById.get(stop.stopId);
    if (!indexed) continue;
    const lat = Number(indexed.stop_lat), lon = Number(indexed.stop_lon);
    assert.ok(Number.isFinite(lat) && Number.isFinite(lon), `${id}: coordonnées GPS absentes`);
    assert.ok(lat >= entry.bounds[0] && lat <= entry.bounds[2] && lon >= entry.bounds[1] && lon <= entry.bounds[3], `${id}: arrêt hors emprise`);
   }
  });
}
