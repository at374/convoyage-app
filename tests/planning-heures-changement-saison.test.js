// node tests/planning-heures-changement-saison.test.js
'use strict';
const assert=require('node:assert/strict');
const planning=require('../planning.js');
const p=planning.parisVersMs;
assert.equal(p('2026-10-25','02:30'),null,'repeated autumn hour rejected');
assert.notEqual(p('2026-10-25','01:30'),null,'before autumn transition valid');
assert.notEqual(p('2026-10-25','03:30'),null,'after autumn transition valid');
assert.equal(p('2027-03-28','02:30'),null,'missing spring hour rejected');
assert.notEqual(p('2027-03-28','01:30'),null,'before spring transition valid');
assert.notEqual(p('2027-03-28','03:30'),null,'after spring transition valid');
assert.notEqual(p('2026-10-24','02:30'),null,'ordinary day unaffected');
console.log('Paris daylight-saving time boundaries: 7 assertions passed');
