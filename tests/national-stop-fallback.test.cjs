'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const hub=require('../transport-mission-hub.js');
const task={
 from:{lat:45.7600,lon:4.8600},
 to:{lat:45.1885,lon:5.7245},
 earliestDeparture:'2026-11-16T07:00:00+01:00'
};
function harness(results,opts={}){
 const calls=[];
 const root={CPNationalGTFSJourneys:{loadAndSearch:async args=>{
  calls.push(args);
  return results[calls.length-1]||{journeys:[]};
 }}};
 const providers=hub.makeProviders(root,{nationalGTFSResources:{
  flixbus:{url:'https://example.org/flixbus.zip'}
 },...opts});
 return {calls,provider:providers.national_flixbus};
}
test('national fallback widens from 3 to 6 km only on empty search',async()=>{
 const h=harness([{journeys:[]},{journeys:[]}]);
 await h.provider.run(task);
 assert.deepEqual(h.calls.map(c=>c.radiusMeters),[3000,6000]);
 assert.ok(h.calls.every(c=>c.operator==='flixbus'));
});
test('national fallback does not widen when initial candidates exist',async()=>{
 const h=harness([{journeys:[{operator:'flixbus',date:'2026-11-16',line:'A',departure:'08:00:00',arrival:'09:00:00',originStop:{name:'Lyon',lat:45.76,lon:4.86},destinationStop:{name:'Grenoble',lat:45.19,lon:5.72}}]}]);
 const journeys=await h.provider.run(task);
 assert.equal(h.calls.length,1);
 assert.equal(journeys.length,1);
});
test('national fallback is opt-out',async()=>{
 const h=harness([{journeys:[]}],{nationalStopFallback:false});
 await h.provider.run(task);
 assert.deepEqual(h.calls.map(c=>c.radiusMeters),[3000]);
});
test('national fallback respects cancellation',async()=>{
 const h=harness([{journeys:[]}]);
 const controller=new AbortController();
 controller.abort();
 await h.provider.run(task,controller.signal);
 assert.deepEqual(h.calls.map(c=>c.radiusMeters),[3000]);
});

test('expanded search candidates are returned to the mission hub',async()=>{
 const stop={operator:'flixbus',date:'2026-11-16',line:'F99',departure:'08:00:00',arrival:'09:00:00',
  originStop:{name:'Lyon Perrache',lat:45.748,lon:4.826},
  destinationStop:{name:'Grenoble Gare',lat:45.191,lon:5.714}};
 const h=harness([{journeys:[]},{journeys:[stop]}]);
 const journeys=await h.provider.run(task);
 assert.deepEqual(h.calls.map(c=>c.radiusMeters),[3000,6000]);
 assert.equal(journeys.length,1);
 assert.equal(journeys[0].legs[0].line,'F99');
 assert.ok(journeys[0].missing.includes('prix commercial et disponibilité non vérifiés'));
});
