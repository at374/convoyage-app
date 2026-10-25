// node tests/planning-ui-heure-hiver.test.js
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const {parisVersMs}=require('../planning.js');
assert.match(app,/id="pOccurrenceBox" hidden/,'selector hidden by default');
assert.match(app,/id="pOccurrence"/,'first or second occurrence selector exists');
assert.match(app,/PL\.parisVersMs\(p\.date, p\.heure, p\.occurrence\)/,'choice reaches planner');
assert.match(app,/\$\('pOccurrenceBox'\)\.hidden = !repetee/,'selector visible only when ambiguous');
assert.match(app,/\$\('pOccurrence'\)\.value = '1'/,'stale second occurrence reset');
assert.equal(parisVersMs('2026-10-25','02:30',2)-parisVersMs('2026-10-25','02:30',1),3600000);
assert.notEqual(parisVersMs('2026-10-26','02:30',1),null);
assert.equal(parisVersMs('2026-10-26','02:30',2),null);
console.log('Planning winter-hour UI wiring: 8 assertions passed');
