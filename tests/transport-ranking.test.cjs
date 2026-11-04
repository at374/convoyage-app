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
 {...legTime('2026-11-02T07:00:00+01:00','2026-11-02T07:40:00+01:00'),fromPoint:{lat:45.9,lon:6.12},toPoint:{lat:45.91,lon:6.13}},
 {...legTime('2026-11-02T07:45:00+01:00','2026-11-02T08:15:00+01:00'),fromPoint:{lat:45.91,lon:6.13},toPoint:{lat:45.92,lon:6.14}}
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

assert.equal(evaluate({...connectedJourney,legs:[
 {serviceConfirmed:true},
 legTime('2026-11-02T07:45:00+01:00','2026-11-02T08:15:00+01:00')
]},{deadline}).feasible,false,'A confirmed multi-leg route cannot omit the first leg schedule');
assert.equal(evaluate({...connectedJourney,legs:[
 legTime('2026-11-02T07:00:00+01:00','2026-11-02T07:40:00+01:00'),
 {serviceConfirmed:true}
]},{deadline}).feasible,false,'A confirmed multi-leg route cannot omit the final leg schedule');

const gpsLegs=[
 {...legTime('2026-11-02T07:00:00+01:00','2026-11-02T07:40:00+01:00'),fromPoint:{lat:45.901,lon:6.121},toPoint:{lat:45.902,lon:6.122}},
 {...legTime('2026-11-02T07:45:00+01:00','2026-11-02T08:15:00+01:00'),fromPoint:{lat:45.910,lon:6.130},toPoint:{lat:45.911,lon:6.131}}
];
assert.equal(evaluate({...connectedJourney,legs:gpsLegs},{deadline}).feasible,false,'Disconnected stops cannot be treated as a confirmed connection');
assert.equal(evaluate({...connectedJourney,legs:[gpsLegs[0],{...gpsLegs[1],fromPoint:{lat:45.902,lon:6.122}}]},{deadline}).feasible,true,'Connected stops preserve valid transfer');

assert.equal(evaluate({...connectedJourney,legs:[connectedJourney.legs[0],{...connectedJourney.legs[1],fromPoint:null}]},{deadline}).feasible,false,'Missing transfer stop coordinates cannot certify a multi-leg route');

const shortTransfer={...connectedJourney,legs:[
 connectedJourney.legs[0],
 {...connectedJourney.legs[1],departure:'2026-11-02T07:42:00+01:00'}
]};
assert.equal(evaluate(shortTransfer,{deadline}).feasible,false,'Two-minute interchange is below the three-minute default');
assert.equal(evaluate(shortTransfer,{deadline,minTransferMinutes:2}).feasible,true,'Configured two-minute interchange is allowed');
assert.equal(evaluate(connectedJourney,{deadline,minTransferMinutes:6}).feasible,false,'Configured six-minute interchange rejects five minutes');

const walkingConnection={...base,legs:[
 {...legTime('2026-11-02T07:00:00+01:00','2026-11-02T07:30:00+01:00'),mode:'pt_pub_bus',fromPoint:{lat:45.9,lon:6.12},toPoint:{lat:45.9,lon:6.12}},
 {...legTime('2026-11-02T07:30:00+01:00','2026-11-02T07:31:00+01:00'),mode:'wa_wal',fromPoint:{lat:45.9,lon:6.12},toPoint:{lat:45.901,lon:6.12}},
 {...legTime('2026-11-02T07:34:00+01:00','2026-11-02T08:15:00+01:00'),mode:'pt_pub_bus',fromPoint:{lat:45.901,lon:6.12},toPoint:{lat:45.902,lon:6.12}}
]};
assert.equal(evaluate(walkingConnection,{deadline}).feasible,true,'One-minute walk of about 111 metres is plausible');
assert.equal(evaluate({...walkingConnection,legs:walkingConnection.legs.map((leg,i)=>i===1?{...leg,toPoint:{lat:45.903,lon:6.12}}:i===2?{...leg,fromPoint:{lat:45.903,lon:6.12}}:leg)},{deadline}).feasible,false,'One-minute walk of about 334 metres is not plausible');

assert.equal(evaluate({...base,departure:'2026-02-30T07:00:00+01:00'},{deadline}).feasible,false,'Impossible calendar day must be rejected');
assert.equal(evaluate({...base,departure:'2026-11-02T25:00:00+01:00'},{deadline}).feasible,false,'Impossible clock hour must be rejected');
assert.equal(evaluate({...base,departure:'2026-11-02T07:00:00+15:00'},{deadline}).feasible,false,'Impossible timezone offset must be rejected');

const reportedWalk={...walkingConnection,legs:walkingConnection.legs.map((leg,i)=>i===1?{...leg,distanceMeters:320}:leg)};
assert.equal(evaluate(reportedWalk,{deadline}).feasible,false,'A provider-reported 320-metre walking route cannot fit into one minute');
const unmeasuredWalk={...walkingConnection,legs:walkingConnection.legs.map((leg,i)=>i===1?{...leg,fromPoint:null,toPoint:null,distanceMeters:null}:leg)};
assert.equal(evaluate(unmeasuredWalk,{deadline}).feasible,false,'A walking leg without GPS or route length cannot be certified');
const plausibleReportedWalk={...walkingConnection,legs:walkingConnection.legs.map((leg,i)=>i===1?{...leg,distanceMeters:120}:leg)};
assert.equal(evaluate(plausibleReportedWalk,{deadline}).feasible,true,'A measured 120-metre walk in one minute remains possible');

assert.equal(evaluate({...base,departure:'2026-11-02T07:00:00+14:30'},{deadline}).feasible,false,'UTC+14:30 is not a valid offset');
assert.equal(evaluate({...base,departure:'2026-11-02T07:00:00-14:01'},{deadline}).feasible,false,'UTC-14:01 is not a valid offset');


const nearButNotConnected={...connectedJourney,legs:[
 connectedJourney.legs[0],
 {...connectedJourney.legs[1],fromPoint:{lat:45.9102,lon:6.13}}
]};
assert.equal(evaluate(nearButNotConnected,{deadline}).feasible,false,'Twenty-two metre transfer needs an explicit walking segment');
const unverifiedFare={...base,id:'unverified',priceEUR:1,fareVerified:false};
assert.equal(evaluate(unverifiedFare,{deadline}).priceEUR,null,'Unverified provider fare cannot be displayed as a known price');
assert.equal(rank([unverifiedFare,{...base,id:'verified',priceEUR:5,fareVerified:true}],{deadline}).find(x=>x.label==='Moins cher')?.journey.id,'verified','Cheapest option must not use an explicitly unverified price');
assert.equal(evaluate({...base,priceEUR:2,priceVerified:false},{deadline}).priceEUR,null,'Explicitly unverified price cannot be ranked');
const noBoardingBuffer={...walkingConnection,legs:[
 walkingConnection.legs[0],walkingConnection.legs[1],
 {...walkingConnection.legs[2],departure:'2026-11-02T07:31:00+01:00'}
]};
assert.equal(evaluate(noBoardingBuffer,{deadline}).feasible,false,'A bus cannot be certified with zero boarding time after walking');
assert.equal(evaluate(noBoardingBuffer,{deadline,minBoardingMinutes:0}).feasible,true,'Explicit zero-minute boarding setting remains supported');
assert.equal(evaluate(walkingConnection,{deadline,minBoardingMinutes:4}).feasible,false,'A requested four-minute boarding buffer rejects a three-minute gap');
assert.equal(evaluate(null,{deadline}).feasible,false,'Null provider result must not crash evaluation');
assert.equal(evaluate(undefined,{deadline}).feasible,false,'Undefined provider result must not crash evaluation');
assert.equal(rank([null,undefined,false,{},base],{deadline})[0].journey.feasible,true,'Malformed provider rows must be skipped');
assert.equal(rank([null,undefined],{deadline}).length,0,'All-invalid provider response returns no journeys');
assert.equal(rank([base],null).length,1,'Null ranking options must not crash');
assert.equal(rank([base],false).length,1,'Malformed ranking options must not crash');
assert.equal(rank(null,null).length,0,'Null journeys and options return empty results');
console.log('transport-ranking: all assertions passed');
