'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {rank,evaluate}=require('../transport-ranking.js');
const trip={
 id:'return-1',departure:'2026-11-04T10:00:00+01:00',
 arrival:'2026-11-04T11:58:00+01:00',
 priceEUR:4.5,exactOrigin:false,exactDestination:false,accessVerified:false,
 legs:[{departure:'2026-11-04T10:00:00+01:00',arrival:'2026-11-04T11:58:00+01:00',serviceConfirmed:true}]
};
test('return ranking does not impose pickup margin',()=>{
 const options={direction:'return',deadline:'2026-11-04T12:00:00+01:00',marginMinutes:15};
 assert.equal(evaluate(trip,options).slackMinutes,2);
 assert.equal(rank([trip],options).length,1);
 assert.equal(rank([trip],options)[0].journey.id,'return-1');
});
test('outbound ranking retains the pickup margin',()=>{
 const options={direction:'outbound',deadline:'2026-11-04T12:00:00+01:00',marginMinutes:15};
 assert.equal(rank([trip],options).length,0);
});
test('return ranking still rejects journeys past a supplied deadline',()=>{
 const late={...trip,id:'late',arrival:'2026-11-04T12:01:00+01:00',
  legs:[{...trip.legs[0],arrival:'2026-11-04T12:01:00+01:00'}]};
 assert.equal(rank([late],{direction:'return',deadline:'2026-11-04T12:00:00+01:00'}).length,0);
});
