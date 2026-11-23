// Le worker des réseaux locaux est branché (hors fil de l'écran) avec repli sur l'ancien calcul si le worker est indisponible.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const hub=fs.readFileSync(__dirname+'/../transport-mission-hub.js','utf8'),w=fs.readFileSync(__dirname+'/../transport-hub-local-worker.js','utf8'),sw=fs.readFileSync(__dirname+'/../sw.js','utf8');
test('le hub calcule les réseaux locaux dans un Web Worker, avec repli',()=>{
 assert.match(hub,/new r\.Worker\('transport-hub-local-worker\.js(\?v=[^']+)?'\)/);
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
 assert.match(sw,/'transport-hub-local-worker\.js(\?v=[^']+)?'/);
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
test('runCorrespondances rend la main entre deux paires de réseaux (23/11/2026 : « worker en échec » répété — un calcul de correspondances long bloquait le worker mono-thread et faisait expirer à 90 s toutes les autres demandes en attente, SNCF/FlixBus/BlaBlaCar Bus et trajets locaux compris)',()=>{
 assert.match(w,/yieldToOtherPendingRequests\s*=\s*\(\)\s*=>\s*new Promise\(resolve=>setTimeout\(resolve,0\)\)/);
 const body=w.slice(w.indexOf('const runCorrespondances'),w.indexOf('const runNational'));
 const yields=(body.match(/await yieldToOtherPendingRequests\(\)/g)||[]).length;
 assert.ok(yields>=2,'au moins une cession après le traitement même-réseau et une après chaque paire inter-réseaux');
});
test('le worker est chargé avec une version d’URL (cache-busting), alignée avec sw.js',()=>{
 assert.match(hub,/new r\.Worker\('transport-hub-local-worker\.js\?v=[^']+'\)/);
});
test('les paires de réseaux non adjacentes sont filtrées avant crossNetworkTrips, worker et repli sur le fil principal (23/11/2026 : « toutes les recherches sont trop longues »)',()=>{
 // bbox transmise au worker, pour que bboxesNear puisse filtrer les paires non pertinentes là-bas.
 assert.match(hub,/nets:nets\.map\(n=>\(\{id:n\[0\],name:n\[1\],urls:urlsFor\(n\[2\]\),bbox:n\[3\]\}\)\)/);
 // Filtre appliqué aussi dans le repli sur le fil principal, avant l'appel coûteux.
 assert.match(hub,/if\(!r\.CPGTFSFederation\.bboxesNear\(nets\[i\]\[3\],nets\[j\]\[3\]\)\)continue;/);
 // Filtre appliqué dans le worker, avant crossNetworkTrips, avec repli sûr (true) si bbox absente.
 assert.match(w,/if\(!CPGTFSFederation\.bboxesNear\(loaded\[i\]\.__bbox,loaded\[j\]\.__bbox\)\)/);
});
