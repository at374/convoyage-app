'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loader = require('../transport-gtfs-loader.js');
const indexer = require('../transport-gtfs-index.js');

const DATA_DIR = process.env.GTFS_TEST_DATA_DIR || path.join(__dirname, '..', 'data', 'gtfs');
const NETWORKS = [
 ['jvmalin-amelys-montargis','Amelys Montargis'],['jvmalin-azalys-blois','Azalys Blois'],
 ['jvmalin-agglobus-bourges','Agglobus Bourges'],['jvmalin-fil-bleu-tours','Fil Bleu Tours'],
 ['jvmalin-filibus-chartres','Filibus Chartres'],['jvmalin-horizon-chateauroux','HORIZON Châteauroux'],
 ['jvmalin-linead-dreux','Linéad Dreux'],['jvmalin-vib-vierzon','Le VIB Vierzon'],
 ['jvmalin-move-vendomois','MOVE Vendômois'],['jvmalin-nosbus-nogent','Nosbus Nogent-le-Rotrou'],
 ['jvmalin-remi-18','Rémi Car 18'],['jvmalin-remi-28','Rémi Car 28'],
 ['jvmalin-remi-36','Rémi Car 36'],['jvmalin-remi-37','Rémi Car 37'],
 ['jvmalin-remi-41','Rémi Car 41'],['jvmalin-remi-45','Rémi Car 45'],
 ['jvmalin-tao-orleans','TAO Orléans'],['jvmalin-tigr-issoudun','TIG+R Issoudun'],
 ['jvmalin-le-bus-amboise','Le Bus Amboise'],
];
const dates = Array.from({length:30}, (_, offset) => {
 const d = new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10);
});

for (const [id,name] of NETWORKS) {
 test(`${name} JVMALIN réel : GTFS indexable et course active`,
  {skip: !fs.existsSync(path.join(DATA_DIR, `${id}-part-01.zip`)) && !fs.existsSync(path.join(DATA_DIR, `${id}.zip`)) && process.env.REQUIRE_REAL_GTFS !== '1'}, async () => {
   const manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
   const entry = manifest.networks?.[id];
   assert.ok(entry && entry.license === 'ODbL 1.0 + conditions particulières PAN', `${id}: entrée/licence manquante`);
   const files = entry.files || (entry.file ? [entry.file] : [`${id}.zip`]);
   assert.ok(files.length, `${id}: fragments absents du manifeste`);
   assert.ok(Array.isArray(entry.bounds) && entry.bounds.length === 4, `${id}: emprise manquante`);
   const seenTrips = new Set(); let candidate = null;
   for (const file of files) {
    const archive = path.join(DATA_DIR, file);
    assert.ok(fs.existsSync(archive), `${id}: fragment manquant ${file}`);
    const bytes = fs.readFileSync(archive);
    assert.ok(bytes.length < 12*1024*1024, `${id}/${file}: archive dépasse 12 Mio`);
    let feed;
    try {
     feed = await loader.loadResource({format:'GTFS',url:`https://example.org/${file}`},
      {fetcher:async()=>new Response(bytes),retainSourceTables:true});
    } catch(error) {
     const profile=loader.inspectZip(bytes,{...loader.DEFAULT_LIMITS,maxFileBytes:512*1024*1024,maxExpandedBytes:1024*1024*1024});
     const tables=profile.entries.map(item=>({table:item.table,bytes:item.uncompressedSize})).sort((a,b)=>b.bytes-a.bytes);
     const detail=`archive=${profile.archiveBytes} expanded=${profile.expandedBytes} largestTables=${JSON.stringify(tables.slice(0,6))}`;
     console.error(`GTFS size profile ${id}/${file}: ${detail}`);
     throw new Error(`${error.message}; ${detail}`);
    }
    assert.ok(feed.index.counts.routes > 0, `${id}/${file}: aucune ligne indexée`);
    assert.ok(feed.index.counts.stops > 0, `${id}/${file}: aucun arrêt indexé`);
    const lines=String(feed.files['trips.txt']||'').trim().split(/\r?\n/);
    const header=lines.shift()?.split(',')||[]; const tripColumn=header.indexOf('trip_id');
    assert.ok(tripColumn>=0, `${id}/${file}: trip_id absent`);
    for(const line of lines){const tripId=line.split(',')[tripColumn];assert.ok(!seenTrips.has(tripId), `${id}: course dupliquée entre fragments ${tripId}`);seenTrips.add(tripId);}
    if(!candidate) for(const date of dates){for(const trip of indexer.scheduledTrips(feed.files,feed.index,date)){if(trip.stops.length>=2){candidate={date,trip,feed};break;}}if(candidate)break;}
   }
   assert.equal(seenTrips.size,entry.trips, `${id}: nombre de courses des fragments différent du manifeste`);
   assert.ok(candidate, `${id}: aucune course active dans les 30 prochains jours`);
   assert.ok(candidate.trip.stops[0].arrival&&candidate.trip.stops.at(-1).arrival, `${id}: horaires absents`);
   for(const stop of [candidate.trip.stops[0],candidate.trip.stops.at(-1)]){
    const indexed=candidate.feed.index.stopById.get(stop.stopId);
    assert.ok(indexed, `${id}: arrêt de course absent de l’index`);
    const lat=Number(indexed.stop_lat),lon=Number(indexed.stop_lon);
    assert.ok(Number.isFinite(lat)&&Number.isFinite(lon), `${id}: coordonnées GPS absentes`);
    assert.ok(lat>=entry.bounds[0]&&lat<=entry.bounds[2]&&lon>=entry.bounds[1]&&lon<=entry.bounds[3], `${id}: arrêt hors emprise`);
   }
  });
}
