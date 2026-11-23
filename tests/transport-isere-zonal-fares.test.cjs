'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evidenceFromStops,quote}=require('../transport-isere-zonal-fares.js');
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
