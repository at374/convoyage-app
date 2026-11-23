'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evidenceFromStops,quote,quoteFromStops}=require('../transport-isere-zonal-fares.js');
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
