// Le worker des réseaux locaux est branché (hors fil de l'écran) avec repli sur l'ancien calcul si le worker est indisponible.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const hub=fs.readFileSync(__dirname+'/../transport-mission-hub.js','utf8'),w=fs.readFileSync(__dirname+'/../transport-hub-local-worker.js','utf8'),sw=fs.readFileSync(__dirname+'/../sw.js','utf8');
test('le hub calcule les réseaux locaux dans un Web Worker, avec repli',()=>{
 assert.match(hub,/new r\.Worker\('transport-hub-local-worker\.js'\)/);
 assert.match(hub,/if\(rows===null\)\{/);
 assert.match(hub,/__cpHubWorkerOff/);
});
test('le worker charge les mêmes bibliothèques et est mis en cache hors ligne',()=>{
 assert.match(w,/importScripts\('transport-catalogue\.js','transport-gtfs-index\.js','transport-gtfs-loader\.js','transport-gtfs-fares\.js'\)/);
 assert.match(w,/nearbyDirectTrips/);
 assert.ok(sw.includes("'transport-hub-local-worker.js'"));
});
