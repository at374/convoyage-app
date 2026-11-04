const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const ranking=require('../transport-ranking.js');
const pickup='2026-11-02T09:00:00+01:00';
const journey={departure:'2026-11-02T07:30:00+01:00',arrival:'2026-11-02T08:50:00+01:00',
 exactOrigin:true,exactDestination:true,accessVerified:true,
 legs:[{serviceConfirmed:true}]};
assert.match(app,/const securityMarginMin = 15;/,'Agenda must reserve 15 minutes before pickup');
assert.match(app,/latestArrival:pickupDate,marginMinutes:securityMarginMin/,'GTFS outbound search must use agenda margin');
assert.match(app,/latestArrival:next\.pickup_start,marginMinutes:securityMarginMin/,'GTFS junction search must use agenda margin');
assert.match(app,/nextPickupMs - securityMarginMin \* 60000/,'Regional junction filter must use agenda margin');
assert.doesNotMatch(app,/marge minimale de 5 min/i,'Do not display obsolete 5-minute pickup margin');
assert.doesNotMatch(app,/avec 5 min de marge minimale/i,'SIBRA text must match actual margin');
assert.equal(ranking.evaluate(journey,{deadline:pickup}).feasible,false,'10 minutes before pickup is insufficient');
assert.equal(ranking.evaluate({...journey,arrival:'2026-11-02T08:45:00+01:00'},{deadline:pickup}).feasible,true,'15 minutes before pickup is sufficient');
console.log('transport agenda margin regression: 8 assertions passed');
