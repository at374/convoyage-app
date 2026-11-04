const assert=require('node:assert/strict');
const {evaluate,rank}=require('../transport-ranking.js');
const deadline='2026-11-02T09:00:00+01:00';
const base={departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T08:15:00+01:00',priceEUR:4,exactOrigin:true,exactDestination:true,accessVerified:true,legs:[{serviceConfirmed:true}]};
assert.equal(evaluate(base,{deadline}).feasible,true);
assert.equal(evaluate({...base,exactDestination:false},{deadline}).feasible,false);
assert.equal(evaluate({...base,priceEUR:null},{deadline}).priceEUR,null);
assert.equal(evaluate({...base,legs:[{serviceConfirmed:false}]},{deadline}).feasible,false);
assert.equal(evaluate({...base,arrival:'2026-11-02T08:56:00+01:00'},{deadline}).feasible,false);
assert.equal(rank([{...base,priceEUR:5},{...base,priceEUR:2,arrival:'2026-11-02T08:30:00+01:00'}],{deadline}).length,2);
assert.equal(rank([{...base,departure:'invalid'}]).length,0);
assert.equal(evaluate(base).feasible,false);
assert.equal(evaluate(base).slackMinutes,null);
const unconfirmed={...base,priceEUR:1,exactDestination:false};
const choices=rank([unconfirmed,{...base,priceEUR:5}],{deadline});
assert.equal(choices[0].journey.feasible,true);
assert.equal(evaluate({...base,departure:'not a date'},{deadline}).feasible,false);
assert.equal(evaluate({...base,priceEUR:'0'},{deadline}).priceEUR,null);
const safe={...base,id:'safe',priceEUR:8,arrival:'2026-11-02T08:10:00+01:00'};
const tight={...base,id:'tight',priceEUR:3,arrival:'2026-11-02T08:40:00+01:00'};
const compromise=rank([tight,safe],{deadline,marginMinutes:15}).find(x=>x.label==='Compromis');
assert.equal(compromise?.journey.id,'safe');
const unknownFares=rank([{...base,id:'unknown-a',priceEUR:null},{...base,id:'unknown-b',priceEUR:null,departure:'2026-11-02T07:30:00+01:00'}],{deadline});
assert.equal(unknownFares.some(choice=>choice.label==='Moins cher'),false);
const mixedFares=rank([{...base,id:'unknown',priceEUR:null},{...base,id:'priced',priceEUR:7,departure:'2026-11-02T07:15:00+01:00'}],{deadline});
assert.equal(mixedFares.find(choice=>choice.label==='Moins cher')?.journey.id,'priced');
const atFive={...base,arrival:'2026-11-02T08:55:00+01:00'};
assert.equal(evaluate(atFive,{deadline}).feasible,false,'Five minutes without explicit reliable GPS is insufficient');
assert.equal(evaluate(atFive,{deadline,exactGPSReliable:true}).feasible,true,'Reliable exact GPS permits five minutes');
assert.equal(evaluate({...atFive,arrival:'2026-11-02T08:55:01+01:00'},{deadline,exactGPSReliable:true}).feasible,false,'Four minutes fifty-nine seconds is insufficient even with reliable GPS');
assert.equal(evaluate({...atFive,exactDestination:false},{deadline}).feasible,false,'Five minutes at an unverified stop does not confirm arrival at pickup');
assert.equal(evaluate({...atFive,accessVerified:false},{deadline}).feasible,false);
console.log('transport-ranking: 19 assertions passed');

assert.equal(evaluate({...base,departure:'2026-02-30T07:00:00+01:00'},{deadline}).durationMinutes,null,'Reject impossible calendar dates');
assert.equal(evaluate({...base,arrival:'2026-11-02T08:15:00+25:00'},{deadline}).durationMinutes,null,'Reject invalid timezone offsets');
assert.equal(evaluate({...base,departure:'2026-11-02T07:00:00+01:00garbage'},{deadline}).durationMinutes,null,'Reject trailing characters');
assert.equal(evaluate({...base,arrival:'2026-11-02T08:15:00+01:00'},{deadline}).feasible,true,'Preserve valid offset timestamps');

const timed={...base,legs:[{serviceConfirmed:true,departure:'2026-11-02T07:00:00+01:00',arrival:'2026-11-02T07:30:00+01:00'},{serviceConfirmed:true,departure:'2026-11-02T07:35:00+01:00',arrival:'2026-11-02T08:15:00+01:00'}]};
assert.equal(evaluate(timed,{deadline}).feasible,true,'Valid timed connection remains feasible');
assert.equal(evaluate({...timed,legs:[timed.legs[0],{...timed.legs[1],departure:'2026-11-02T07:29:00+01:00'}]},{deadline}).feasible,false,'Overlapping confirmed services cannot be feasible');
assert.equal(evaluate({...timed,legs:[timed.legs[0],{...timed.legs[1],arrival:'2026-11-02T08:20:00+01:00'}]},{deadline}).feasible,false,'Leg cannot finish after displayed arrival');
assert.equal(evaluate({...timed,legs:[{...timed.legs[0],departure:'invalid'},timed.legs[1]]},{deadline}).feasible,false,'Invalid leg time cannot certify feasibility');

assert.equal(evaluate({...timed,legs:[timed.legs[0],{serviceConfirmed:true}]},{deadline}).feasible,false,'Partially timed itinerary cannot confirm an unknown connection');
assert.equal(evaluate({...timed,legs:[{serviceConfirmed:true},timed.legs[1]]},{deadline}).feasible,false,'Missing first leg time cannot confirm connection');
assert.equal(evaluate(base,{deadline}).feasible,true,'Legacy all-untimed itinerary remains compatible');

assert.equal(evaluate({...timed,legs:[{...timed.legs[0],departure:'2026-11-02T07:01:00+01:00'},timed.legs[1]]},{deadline}).feasible,false,'Unaccounted first-minute transfer cannot certify a journey');
assert.equal(evaluate({...timed,legs:[timed.legs[0],{...timed.legs[1],arrival:'2026-11-02T08:14:00+01:00'}]},{deadline}).feasible,false,'Unaccounted final transfer cannot certify exact arrival');
assert.equal(evaluate(timed,{deadline}).feasible,true,'Fully covered timed journey remains feasible');

const geographic={...timed,legs:[
 {...timed.legs[0],fromPoint:{lat:45.900,lon:6.120},toPoint:{lat:45.901,lon:6.121}},
 {...timed.legs[1],fromPoint:{lat:45.901,lon:6.121},toPoint:{lat:45.902,lon:6.122}}
]};
assert.equal(evaluate(geographic,{deadline}).feasible,true,'Connected transfer remains feasible');
assert.equal(evaluate({...geographic,legs:[geographic.legs[0],{...geographic.legs[1],fromPoint:{lat:45.910,lon:6.121}}]},{deadline}).feasible,false,'Distant stops without connecting leg cannot be feasible');
assert.equal(evaluate({...geographic,legs:[geographic.legs[0],{...geographic.legs[1],fromPoint:{lat:999,lon:6.121}}]},{deadline}).feasible,false,'Malformed stop coordinates cannot certify feasibility');

assert.equal(evaluate(null,{deadline}).feasible,false,'Null provider candidate must not crash the agenda');
assert.equal(evaluate(undefined,{deadline}).feasible,false,'Missing provider candidate must not crash the agenda');
assert.equal(evaluate(base,null).feasible,false,'Missing ranking options must not crash');
assert.equal(rank([null,undefined,{...base,id:'valid'}],{deadline})[0].journey.id,'valid','Malformed provider candidates must not hide a valid journey');
assert.equal(rank([base],null).length,1,'Null ranking options must be tolerated');

assert.equal(evaluate({...timed,interNetwork:true,transferVerified:false},{deadline}).feasible,false,'An unverified inter-network walk must never be called realizable');
assert.equal(evaluate({...timed,interNetwork:true},{deadline}).feasible,false,'Missing interchange evidence cannot certify a cross-network journey');
assert.equal(evaluate({...timed,interNetwork:true,transferVerified:true},{deadline}).feasible,true,'A verified inter-network interchange preserves feasible confirmed services');
assert.equal(evaluate({...timed,interNetwork:false,transferVerified:false},{deadline}).feasible,true,'Ordinary journeys do not require inter-network transfer evidence');
