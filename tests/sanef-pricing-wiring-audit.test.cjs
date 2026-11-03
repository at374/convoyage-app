'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('SANEF guard is available as a browser-safe module',()=>{
 const source=fs.readFileSync(path.join(root,'sanef-gps-protection.js'),'utf8');
 assert.match(source,/CPSanefGpsProtection/);
});
test('Google Routes prices remain estimates, never official tariffs',()=>{
 const src=fs.readFileSync(path.join(root,'routes-pricing.js'),'utf8');
 assert.match(src,/status: 'estimation'/);
 assert.match(src,/priceIsGuaranteed: false/);
});
test('application has not silently wired the guard without a reviewed pricing integration',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/routes-pricing\.js/);
 assert.doesNotMatch(html,/<script[^>]+src="peage-engine\.js"/);
});
