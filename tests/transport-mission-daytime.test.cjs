const assert=require('node:assert/strict');
const hub=require('../transport-mission-hub.js');
const p={lat:46.05,lon:6.55};
const trip=(departure,arrival)=>({source:'Test horaire',sources:['Test horaire'],legs:[{kind:'transit',mode:'Train',line:'C13',fromPoint:p,toPoint:p,departure,arrival}]});
const task={from:p,to:p,latestArrival:'2026-11-18T09:00:00+01:00',marginMinutes:15};
const assess=(d,a,t=task)=>hub.assess(trip(d,a),t,()=>null);
const target=assess('2026-11-18T07:40:00+01:00','2026-11-18T08:40:00+01:00');
assert.equal(target.slackMinutes,20);
assert.ok(!target.reasons.some(r=>r.includes('arrivée trop tôt')));
const tooEarly=assess('2026-11-18T04:30:00+01:00','2026-11-18T05:30:00+01:00');
assert.ok(tooEarly.reasons.some(r=>r.includes('arrivée trop tôt')));
assert.ok(tooEarly.reasons.some(r=>r.includes('hors plage de jour')));
const tooLate=assess('2026-11-18T08:00:00+01:00','2026-11-18T08:50:00+01:00');
assert.ok(tooLate.reasons.some(r=>r.includes('marge insuffisante')));
const wrongDay=assess('2026-11-17T07:00:00+01:00','2026-11-17T08:00:00+01:00');
assert.ok(wrongDay.reasons.some(r=>r.includes('hors plage de jour')));
// 20/11/2026 (demande Laurent) : une arrivée en soirée le jour même (après 19h00, jusqu'à 23:59) n'est plus
// écartée comme « hors plage de jour » — seul un trajet qui change de jour calendaire (minuit franchi) l'est encore.
const lateEvening=assess('2026-11-18T20:30:00+01:00','2026-11-18T22:40:00+01:00', {from:p,to:p,earliestDeparture:'2026-11-18T18:00:00+01:00'});
assert.ok(!lateEvening.reasons.some(r=>r.includes('hors plage de jour')));
const pastMidnight=assess('2026-11-18T23:00:00+01:00','2026-11-19T00:40:00+01:00', {from:p,to:p,earliestDeparture:'2026-11-18T18:00:00+01:00'});
assert.ok(pastMidnight.reasons.some(r=>r.includes('hors plage de jour')));
console.log('OK: mission 09h, marge 15min, trajet trop tôt, date, nuit et soirée jusqu’à minuit');
