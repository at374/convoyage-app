'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loader = require('../transport-gtfs-loader.js');
const indexer = require('../transport-gtfs-index.js');

const DATA_DIR = process.env.GTFS_TEST_DATA_DIR || path.join(__dirname, '..', 'data', 'gtfs');
const NETWORKS = [
 ['atoumod-altobus-alencon','Altobus Alençon'],['atoumod-tiva-vire-noireau','Tiva Vire au Noireau'],
 ['atoumod-argentanbus','ArgentanBus'],['atoumod-astrobus-lisieux','Astrobus Lisieux'],
 ['atoumod-bagnoles','Bagnoles de l’Orne'],['atoumod-ibus-bernay','I’BUS Bernay'],
 ['atoumod-bybus-bayeux','Bybus Bayeux'],['atoumod-cosibus-coutances','Cosibus Coutances'],
 ['atoumod-deep-mob-dieppe','Deep Mob Dieppe'],['atoumod-ficibus-fecamp','Ficibus Fécamp'],
 ['atoumod-hobus-honfleur','Hobus Honfleur'],['atoumod-le-bus-pont-audemer','Le Bus Pont-Audemer'],
 ['atoumod-lia-le-havre','LiA Le Havre'],['atoumod-navette-pontorson','Navette Pontorson–Mont-Saint-Michel'],
 ['atoumod-nemus-flers','Némus Flers'],['atoumod-neva-granville','Néva Granville'],
 ['atoumod-rezobus-caux-seine','Rézo’Bus Caux Seine'],['atoumod-semo-seine-eure','Semo Seine-Eure'],
 ['atoumod-slam-saint-lo','SLAM Saint-Lô'],['atoumod-nomad-train','Nomad Train Normandie'],
 ['atoumod-sngo-vernon','SN’go Vernon–Les Andelys'],['atoumod-astuce-rouen','Astuce Rouen'],
 ['atoumod-transurbain-evreux','Transurbain Évreux'],['atoumod-twisto-caen','Twisto Caen'],
 ['atoumod-vikibus-yvetot','Vikibus Yvetot'],['atoumod-cap-cotentin','Cap Cotentin'],
 ['atoumod-nomad-car','Nomad Car Normandie'],['atoumod-moca-caux-austreberthe','MOCA Caux-Austreberthe'],
];
const dates = Array.from({length:30}, (_, offset) => {
 const d = new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10);
});

for (const [id,name] of NETWORKS) {
 test(`${name} réel : archive GTFS indexable et course active`,
  {skip: !fs.existsSync(path.join(DATA_DIR, `${id}.zip`)) && process.env.REQUIRE_REAL_GTFS !== '1'}, async () => {
   const archive = path.join(DATA_DIR, `${id}.zip`);
   assert.ok(fs.existsSync(archive), `REQUIRE_REAL_GTFS=1 exige data/gtfs/${id}.zip`);
   const bytes = fs.readFileSync(archive);
   const manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
   const entry = manifest.networks?.[id];
   assert.ok(entry && entry.license === 'Licence Ouverte 2.0', `${id}: entrée/licence manquante`);
   assert.ok(bytes.length < 12*1024*1024, `${id}: archive dépasse 12 Mio`);
   assert.ok(Array.isArray(entry.bounds) && entry.bounds.length === 4, `${id}: emprise manquante`);
   const feed = await loader.loadResource({format:'GTFS',url:`https://example.org/${id}.zip`},
    {fetcher:async()=>new Response(bytes),indexServiceDates:dates,retainSourceTables:true});
   assert.ok(feed.index.counts.routes > 0, `${id}: aucune ligne indexée`);
   assert.ok(feed.index.counts.stops > 0, `${id}: aucun arrêt indexé`);
   const routes = indexer.parseCSV(feed.files['routes.txt'] || '');
   if (routes.some(row => Object.hasOwn(row, 'route_type')))
    assert.ok(routes.every(row => row.route_type !== '4'), `${id}: ferry inclus`);
   let candidate = null;
   for (const date of dates) {
    for (const trip of indexer.scheduledTrips(feed.files, feed.index, date)) {
     if (trip.stops.length >= 2) { candidate = {date, trip}; break; }
    }
    if (candidate) break;
   }
   assert.ok(candidate, `${id}: aucune course active dans les 30 prochains jours`);
   assert.ok(candidate.trip.stops[0].arrival && candidate.trip.stops.at(-1).arrival, `${id}: horaires absents`);
   for (const stop of candidate.trip.stops) {
    const indexed = feed.index.stopById.get(stop.stopId);
    if (!indexed) continue;
    const lat = Number(indexed.stop_lat), lon = Number(indexed.stop_lon);
    assert.ok(lat >= entry.bounds[0] && lat <= entry.bounds[2] && lon >= entry.bounds[1] && lon <= entry.bounds[3], `${id}: arrêt hors emprise`);
   }
  });
}
