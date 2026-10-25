// node tests/planning-heure-hiver-occurrences.test.js
'use strict';
const assert=require('node:assert/strict');
const {parisVersMs:p}=require('../planning.js');
const first=p('2026-10-25','02:30',1);
const second=p('2026-10-25','02:30',2);
assert.equal(p('2026-10-25','02:30'),null,'ambiguous without explicit occurrence');
assert.equal(new Date(first).toISOString(),'2026-10-25T00:30:00.000Z','first is summer offset');
assert.equal(new Date(second).toISOString(),'2026-10-25T01:30:00.000Z','second is winter offset');
assert.equal(second-first,3600000,'occurrences separated by one hour');
assert.equal(p('2027-03-28','02:30',1),null,'missing spring hour remains invalid');
assert.equal(p('2026-10-24','02:30',2),null,'ordinary hour has no second occurrence');
assert.notEqual(p('2026-10-24','02:30',1),null,'ordinary hour first occurrence works');
console.log('Paris repeated winter hour: 7 assertions passed');
