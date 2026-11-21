// Le worker des réseaux locaux est branché (hors fil de l'écran) avec repli sur l'ancien calcul si le worker est indisponible.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const hub=fs.readFileSync(__dirname+'/../transport-mission-hub.js','utf8'),w=fs.readFileSync(__dirname+'/../transport-hub-local-worker.js','utf8'),sw=fs.readFileSync(__dirname+'/../sw.js','utf8');
test('le hub calcule les réseaux locaux dans un Web Worker, avec repli',()=>{
 assert.match(hub,/new r\.Worker\('transport-hub-local-worker\.js'\)/);
 assert.match(hub,/if\(rows===null\)\{/);
 assert.match(hub,/__cpHubWorkerOff/);
});
test('le worker charge les mêmes bibliothèques et est mis en cache hors ligne',()=>{
 // 21/11/2026 : le worker calcule aussi les correspondances (nearbyTransferTrips + crossNetworkTrips)
 // et la recherche nationale (SNCF/FlixBus/BlaBlaCar Bus), il lui faut donc transport-gtfs-time.js,
 // transport-gtfs-federation.js et transport-national-gtfs-journeys.js en plus des trajets directs.
 assert.match(w,/importScripts\('transport-catalogue\.js','transport-gtfs-index\.js','transport-gtfs-time\.js','transport-gtfs-federation\.js','transport-gtfs-loader\.js','transport-gtfs-fares\.js','transport-national-gtfs-journeys\.js'\)/);
 assert.match(w,/nearbyDirectTrips/);
 assert.match(w,/nearbyTransferTrips/);
 assert.match(w,/CPGTFSFederation\.crossNetworkTrips/);
 assert.match(w,/CPNationalGTFSJourneys\.loadAndSearch/);
 assert.ok(sw.includes("'transport-hub-local-worker.js'"));
 assert.ok(sw.includes('transport-gtfs-time.js'));
 assert.ok(sw.includes('transport-gtfs-federation.js'));
 assert.ok(sw.includes('transport-national-gtfs-journeys.js'));
});
test('local_correspondances calcule aussi hors du fil de l’écran, avec repli',()=>{
 assert.match(hub,/workerCorrespondances/);
 assert.match(hub,/op:'correspondances'/);
});
test('la recherche nationale (SNCF/FlixBus/BlaBlaCar Bus) calcule aussi hors du fil de l’écran, avec repli',()=>{
 assert.match(hub,/workerNationalSearch/);
 assert.match(hub,/op:'national'/);
});
