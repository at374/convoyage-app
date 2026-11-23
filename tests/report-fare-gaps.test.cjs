'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {build}=require('../scripts/report-fare-gaps.cjs');
test('ranks unpriced journeys and labels fare occurrences accurately',()=>{
 const report=build({at:'2026-11-23',when:'2026-11-30',source:'diagnostic',axes:[
  {name:'Axe B',trips:5,priced:4,missingFareByOperator:{SNCF:1}},
  {name:'Axe A',trips:12,priced:0,missingFareByOperator:{SNCF:8,FlixBus:4}}
 ]});
 assert.ok(report.indexOf('Axe A')<report.indexOf('Axe B'));
 assert.match(report,/SNCF \| 9 \|/);
 assert.match(report,/occurrences par axe/);
 assert.match(report,/pas une confirmation de tarifs/);
});
test('rejects invalid diagnostics and does not invent prices',()=>{
 assert.throws(()=>build({}),/axes missing/);
 const report=build({axes:[{name:'Sans prix',trips:3,priced:0}]});
 assert.match(report,/Sans prix \| 3 \| 0 \| 3/);
 assert.doesNotMatch(report,/\d+[,.]\d{2} €/);
});

test('highlights partially priced journeys without double counting fare gaps',()=>{
 const report=build({axes:[{name:'A',trips:10,priced:3,missingFareByOperator:{SNCF:7}}],totals:{trips:10,priced:3,partialMissingByOperator:{SNCF:2,'Cars Région':1}}});
 assert.match(report,/3 trajets entièrement tarifés sur 10 \(30\.0 %\)/);
 assert.match(report,/Priorité : portions bloquant les trajets partiellement tarifés/);
 assert.match(report,/SNCF \| 2 \|/);
 assert.match(report,/ne doivent pas être additionnées/);
});

test('lists observed missing fare lines without inferring prices',()=>{
 const report=build({axes:[{name:'Annecy → Genève',trips:4,priced:0,partialMissingLineSamples:{'Cars Région Haute-Savoie':['274','274'],'SNCF':['B L2']}}]});
 assert.match(report,/Lignes à rechercher en priorité/);
 assert.match(report,/Annecy → Genève \| Cars Région Haute-Savoie \| 274 \|/);
 assert.match(report,/Annecy → Genève \| SNCF \| B L2 \|/);
 assert.doesNotMatch(report,/274, 274/);
});
