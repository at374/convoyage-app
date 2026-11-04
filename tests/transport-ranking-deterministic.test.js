'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {rank}=require('../transport-ranking.js');
const base={
 departure:'2026-11-04T09:00:00+01:00',
 arrival:'2026-11-04T10:00:00+01:00',
 priceEUR:5,priceVerified:true,
 legs:[{departure:'2026-11-04T09:00:00+01:00',arrival:'2026-11-04T10:00:00+01:00',serviceConfirmed:false}]
};
test('equal-score provider arrival order does not change selected options',()=>{
 const a={...base,provider:'SNCF',id:'rail-1'};
 const b={...base,provider:'TripGo',id:'mixed-1'};
 const c={...base,provider:'GTFS',id:'bus-1'};
 const forward=rank([a,b,c],{direction:'return'});
 const backward=rank([c,b,a],{direction:'return'});
 assert.deepEqual(forward.map(x=>[x.label,x.journey.id]),backward.map(x=>[x.label,x.journey.id]));
 assert.equal(forward[0].journey.id,'bus-1');
});
test('lower verified price remains preferred over deterministic tie-break',()=>{
 const a={...base,provider:'Z',id:'cheap',priceEUR:2};
 const b={...base,provider:'A',id:'expensive',priceEUR:8};
 const choice=rank([b,a],{direction:'return'}).find(x=>x.label==='Moins cher');
 assert.equal(choice.journey.id,'cheap');
});
