'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evidenceFromStops,quote,quoteFromStops,evidenceFromGTFS}=require('../transport-isere-zonal-fares.js');
const source='https://carsisere.auvergnerhonealpes.fr/referentiel-zones';
const stops=['stop-1','stop-2'];
const zones={'stop-1':'A','stop-2':'B'};
test('Isere fare requires certified complete stop-level zones',()=>{
 const evidence=evidenceFromStops({stopIds:stops,stopZones:zones,source,complete:true});
 assert.ok(evidence);
 assert.equal(quote({zones:2,departure:'2026-11-30',zoneEvidence:evidence}).amount,6);
 assert.equal(quote({zones:2,departure:'2026-11-30',zoneEvidence:{...evidence,source:'https://example.com/zones'}}),null);
 assert.equal(quote({zones:2,departure:'2026-11-30',zoneEvidence:{...evidence,stopIds:[]}}),null);
 assert.equal(quote({zones:2,departure:'2026-11-30',zoneEvidence:{...evidence,traversedZones:['A']}}),null);
 assert.equal(evidenceFromStops({stopIds:stops,stopZones:zones,source,complete:false}),null);
});

test('Isere fare rejects incomplete stop evidence and out-of-range dates',()=>{
 assert.equal(evidenceFromStops({stopIds:stops,stopZones:{'stop-1':'A'},source,complete:true}),null);
 assert.equal(evidenceFromStops({stopIds:stops,stopZones:zones,source:'https://example.com/zone',complete:true}),null);
 const evidence=evidenceFromStops({stopIds:stops,stopZones:zones,source,complete:true});
 assert.equal(quote({zones:2,departure:'2026-02-28',zoneEvidence:evidence}),null);
 assert.equal(quote({zones:7,departure:'2026-11-30',zoneEvidence:evidence}),null);
 assert.equal(quote({zones:2,departure:'2026-11-30',zoneEvidence:evidence,profile:'eco'}),null);
 assert.equal(quote({zones:2,departure:'2026-11-30',zoneEvidence:evidence,profile:'eco',ecoEligible:true}).amount,4.40);
 assert.equal(quote({zones:2,departure:'2026-11-30',zoneEvidence:evidence,network:'Cars Région Savoie'}),null);
 assert.equal(quote({zones:2,departure:'2026-11-30',zoneEvidence:evidence,line:'Transaltitude'}),null);
});

test('Isere GTFS stop-sequence adapter fails closed without complete official zone mapping',()=>{
 const params={stopIds:stops,stopZones:zones,source,departure:'2026-11-30'};
 assert.equal(quoteFromStops({...params,complete:true}).amount,6);
 assert.equal(quoteFromStops({...params,complete:false}),null);
 assert.equal(quoteFromStops({...params,complete:true,stopIds:['stop-1','missing','stop-2']}),null);
 assert.equal(quoteFromStops({...params,complete:true,source:'https://example.com/zones'}),null);
});

test('Isere: GTFS trip extracts all intermediate zones, rejects loops and missing mapping',()=>{
 const index={timesByTrip:new Map([['T1',[
  {stop_id:'A',stop_sequence:'1'},{stop_id:'M',stop_sequence:'2'},
  {stop_id:'B',stop_sequence:'3'}]]])};
 const params={tripId:'T1',fromStopId:'A',toStopId:'B',source,
  stopZones:{A:'A',M:'B',B:'C'}};
 assert.deepEqual(evidenceFromGTFS(index,params).traversedZones,['A','B','C']);
 assert.equal(evidenceFromGTFS(index,{...params,stopZones:{A:'A',B:'C'}}),null);
 assert.equal(evidenceFromGTFS(index,{...params,fromStopId:'B',toStopId:'A'}),null);
 index.timesByTrip.get('T1').push({stop_id:'A',stop_sequence:'4'});
 assert.equal(evidenceFromGTFS(index,params),null);
});

test('Isere: GTFS audit counts only served stops, never infers zones',()=>{
 const {auditGTFSZones}=require('../transport-isere-zonal-fares.js');
 const index={stopById:new Map([['A',{}],['B',{}],['C',{}],['UNUSED',{}]]),
  timesByTrip:new Map([['T1',[{stop_id:'A'},{stop_id:'B'}]],['T2',[{stop_id:'B'},{stop_id:'C'}]]])};
 assert.deepEqual(auditGTFSZones(index,{A:'A',B:'?',UNUSED:'C'}),{
  total:3,covered:1,missing:['C'],invalid:['B'],coveragePercent:33.33});
 assert.equal(auditGTFSZones(null,{}),null);
});

test('Isere: journey coverage requires all intermediate stop zones',()=>{
 const {auditGTFSJourneys}=require('../transport-isere-zonal-fares.js');
 const index={timesByTrip:new Map([['T1',[{stop_id:'A',stop_sequence:'1'},
  {stop_id:'M',stop_sequence:'2'},{stop_id:'B',stop_sequence:'3'}]]])};
 const journeys=[{tripId:'T1',from:'A',to:'B'},
  {tripId:'T1',from:'A',to:'M'},{tripId:'T1',from:'B',to:'A'},
  {tripId:'MISSING',from:'A',to:'B'}];
 const report=auditGTFSJourneys(index,journeys,{source:'https://www.laregionvoustransporte.fr/',
  stopZones:{A:'A',M:'B'}});
 assert.deepEqual(report,{total:4,priced:1,missingZone:1,ambiguous:1,invalidJourney:1,coveragePercent:25});
});
