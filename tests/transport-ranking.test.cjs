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
assert.equal(evaluate(atFive,{deadline}).feasible,false,'Default pickup margin is fifteen minutes');
assert.equal(evaluate(atFive,{deadline,exactGPSReliable:true}).feasible,true,'Five-minute exception requires explicit reliable exact GPS');
assert.equal(evaluate({...atFive,arrival:'2026-11-02T08:55:01+01:00'},{deadline,exactGPSReliable:true}).feasible,false,'Four minutes fifty-nine seconds is insufficient even with reliable GPS');
assert.equal(evaluate({...atFive,exactDestination:false},{deadline}).feasible,false,'Five minutes at an unverified stop does not confirm arrival at pickup');
assert.equal(evaluate({...atFive,accessVerified:false},{deadline}).feasible,false);
console.log('transport-ranking: 19 assertions passed');

assert.equal(evaluate({...base,arrival:'2026-11-02T08:45:00+01:00'},{deadline}).feasible,true,'Exactly fifteen minutes is valid by default');
assert.equal(evaluate({...base,arrival:'2026-11-02T08:45:01+01:00'},{deadline}).feasible,false,'Below fifteen minutes is not confirmed');
assert.equal(rank([atFive],{deadline}).length,0,'Five-minute journey excluded without explicit GPS reliability');
assert.equal(rank([atFive],{deadline,exactGPSReliable:true}).length,1,'Reliable exact GPS allows five-minute option');

const atTwenty={...base,arrival:'2026-11-02T08:40:00+01:00'};
assert.equal(rank([atTwenty],{deadline,marginMinutes:30}).length,0,'Configured thirty-minute margin excludes a twenty-minute arrival');
assert.equal(rank([atTwenty],{deadline,marginMinutes:20}).length,1,'Exactly twenty minutes meets configured margin');
assert.equal(rank([atTwenty],{deadline,marginMinutes:30,exactGPSReliable:true}).length,0,'Reliable GPS never overrides a larger configured margin');

const legTime=(departure,arrival)=>({departure,arrival,serviceConfirmed:true});
const connectedJourney={...base,legs:[
 legTime('2026-11-02T07:00:00+01:00','2026-11-02T07:40:00+01:00'),
 legTime('2026-11-02T07:45:00+01:00','2026-11-02T08:15:00+01:00')
]};
assert.equal(evaluate(connectedJourney,{deadline}).feasible,true,'Chronological connection remains feasible');
assert.equal(evaluate({...connectedJourney,legs:[
 legTime('2026-11-02T07:00:00+01:00','2026-11-02T07:50:00+01:00'),
 legTime('2026-11-02T07:45:00+01:00','2026-11-02T08:15:00+01:00')
]},{deadline}).feasible,false,'Overlapping confirmed services cannot form a feasible journey');
assert.equal(evaluate({...connectedJourney,legs:[
 legTime('2026-11-02T07:00:00+01:00','2026-11-02T07:40:00+01:00'),
 legTime('2026-11-02T08:16:00+01:00','2026-11-02T08:20:00+01:00')
]},{deadline}).feasible,false,'Legs cannot end after itinerary arrival');

assert.equal(evaluate({...connectedJourney,legs:[
 legTime('2026-11-02T07:05:00+01:00','2026-11-02T07:40:00+01:00'),
 legTime('2026-11-02T07:45:00+01:00','2026-11-02T08:15:00+01:00')
]},{deadline}).feasible,false,'Unmodelled departure gap cannot be certified door to door');
assert.equal(evaluate({...connectedJourney,legs:[
 legTime('2026-11-02T07:00:00+01:00','2026-11-02T07:40:00+01:00'),
 legTime('2026-11-02T07:45:00+01:00','2026-11-02T08:10:00+01:00')
]},{deadline}).feasible,false,'Unmodelled arrival gap cannot be certified door to door');
