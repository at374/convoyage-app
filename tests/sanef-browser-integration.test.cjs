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
 const a=html.indexOf('<script src="sanef-gps-protection.js"></script>');
 const b=html.indexOf('<script src="routes-ui.js"></script>');
 assert.ok(a>=0&&b>a);
});
test('the actual overlay engine is protected when available',()=>{
 assert.match(routes,/CPSanefGpsProtection\.protectEngine\(moteur\)/);
 assert.match(routes,/window\.CPPeage\.creerMoteur\(\{ versions \}\)/);
});
test('the offline service worker includes the new guard',()=>{
 assert.match(sw,/'sanef-gps-protection\.js'/);
 assert.match(sw,/cp-app-sanef-guard-20261103/);
});
