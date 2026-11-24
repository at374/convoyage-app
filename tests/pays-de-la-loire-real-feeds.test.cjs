'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loader = require('../transport-gtfs-loader.js');
const indexer = require('../transport-gtfs-index.js');

const DATA_DIR = process.env.GTFS_TEST_DATA_DIR || path.join(__dirname, '..', 'data', 'gtfs');
const NETWORKS = [
 ['pdl-irigo-angers','IRIGO Angers'],['pdl-brevibus','Brévibus'],['pdl-tul-laval','TUL Laval'],
 ['pdl-naolib-nantes','Naolib Nantes'],['pdl-choletbus','Choletbus'],['pdl-oleane-les-sables','OLEANE'],
 ['pdl-illygo','illyGO'],['pdl-sovetours','SOVETOURS'],['pdl-yceo-saint-nazaire','Ycéo'],
 ['pdl-impulsyon-la-roche','Impulsyon'],['pdl-aleop-sarthe','Aléop en Sarthe'],
 ['pdl-aleop-vendee','Aléop en Vendée'],['pdl-aleop-ler','Aléop Lignes Express régionales'],
 ['pdl-aleop-mayenne','Aléop en Mayenne'],['pdl-aleop-loire-atlantique','Aléop en Loire-Atlantique'],
 ['pdl-aleop-maine-et-loire','Aléop en Maine-et-Loire'],['pdl-reso-sable','Réso'],['pdl-heoh-clisson','héoh'],
];
const dates = Array.from({length:30}, (_, offset) => {
 const d = new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10);
});

for (const [id,name] of NETWORKS) {
 test(`${name} réel : GTFS Destinéo indexable et course active`,
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
    assert.ok(routes.every(row => row.route_type !== '4'), `${file}: ferry inclus`);
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
