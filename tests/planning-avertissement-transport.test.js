// node tests/planning-avertissement-transport.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const start=app.indexOf('function afficherPlans(res)');
const end=app.indexOf('// V90 : alerte',start);
assert.ok(start>=0,'planning results renderer exists');
assert.ok(end>start,'renderer section found');
const section=app.slice(start,end);
assert.match(section,/Transport non confirmé/,'explicit warning');
assert.match(section,/vérifiez vous-même les transports avant d’accepter cette mission/,'required wording');
assert.match(section,/box\.innerHTML = avertissementTransport \+ res\.plans\.map/,'warning precedes each proposal');
assert.match(section,/if \(!res\.plans\.length\)/,'no-plan state remains separate');
assert.match(section,/Rien n’est réservé/,'no reservation claim');
console.log('Multiday transport warning: 5 assertions passed');
