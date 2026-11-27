'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const routes=fs.readFileSync(path.join(root,'routes-ui.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
test('SANEF guard loads before the actual route calculator',()=>{
 // Les scripts peuvent porter une version de cache (?v=…) : seul l'ordre de chargement est vérifié.
 const a=html.search(/<script src="sanef-gps-protection\.js(\?v=[^"]*)?"><\/script>/);
 const b=html.search(/<script src="routes-ui\.js(\?v=[^"]*)?"><\/script>/);
 assert.ok(a>=0&&b>a);
});
test('the actual overlay engine is protected when available',()=>{
 assert.match(routes,/CPSanefGpsProtection\.protectEngine\(moteur\)/);
 assert.match(routes,/window\.CPPeage\.creerMoteur\(\{ versions \}\)/);
});
test('the offline service worker includes the new guard',()=>{
 assert.match(sw,/'sanef-gps-protection\.js'/);
 // Le nom exact de version de cache change à chaque mise à jour du service worker
 // (bump légitime, y compris lors d'une fusion de branches) : on vérifie seulement
 // qu'une version de cache est bien déclarée, pas sa valeur littérale figée.
 assert.match(sw,/const CACHE = '[^']+';/);
});
