'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {compareWithRegional}=require('../transport-long-distance-search.js');
const offer={
 id:'coach',provider:'TripGo',
 departure:'2026-11-04T09:00:00+01:00',
 arrival:'2026-11-04T10:00:00+01:00',
 priceEUR:5,legs:[{departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T10:00:00+01:00',serviceConfirmed:false}]
};
const result={offers:[offer],providers:[]};
test('return deadline is enforced without pickup margin',()=>{
 const onTime=compareWithRegional([],result,{direction:'return',deadline:'2026-11-04T10:02:00+01:00'});
 assert.equal(onTime.candidates.length,1);
 assert.equal(onTime.choices.length,1);
 const tooLate=compareWithRegional([],result,{direction:'return',deadline:'2026-11-04T09:59:00+01:00'});
 assert.equal(tooLate.candidates.length,0);
 assert.equal(tooLate.choices.length,0);
});
test('return without deadline remains eligible',()=>{
 const ranked=compareWithRegional([],result,{direction:'return'});
 assert.equal(ranked.candidates.length,1);
});
test('outbound still needs fifteen minutes before pickup',()=>{
 const ranked=compareWithRegional([],result,{direction:'outbound',deadline:'2026-11-04T10:02:00+01:00'});
 assert.equal(ranked.candidates.length,0);
});
test('malformed explicit return deadline fails closed',()=>{
 const ranked=compareWithRegional([],result,{direction:'return',deadline:'bad-date'});
 assert.deepEqual(ranked.choices,[]);
 assert.deepEqual(ranked.candidates,[]);
});
