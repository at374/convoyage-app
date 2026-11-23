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

test('reports verified prices separately from feasibility and partial journeys',()=>{
 const report=build({axes:[{name:'Chambéry → Aix',trips:65,priced:45,feasible:0}],totals:{trips:965,priced:379,feasible:93,partialPricedJourneys:64}});
 assert.match(report,/379 trajets entièrement tarifés sur 965 \(39\.3 %\)/);
 assert.match(report,/Trajets déclarés faisables par le diagnostic : 93 \/ 965/);
 assert.match(report,/64 trajets possèdent au moins un tarif/);
 assert.match(report,/Ces deux compteurs sont indépendants/);
 assert.match(report,/Leur intersection n’est pas calculée ici/);
});

test('does not invent feasibility when it is absent from a diagnostic',()=>{
 const report=build({axes:[{name:'A',trips:3,priced:1}],totals:{trips:3,priced:1}});
 assert.doesNotMatch(report,/Trajets déclarés faisables/);
 assert.doesNotMatch(report,/Trajets partiellement tarifés/);
});

test('shows per-axis partial journeys without counting them as fully priced',()=>{
 const report=build({axes:[{name:'Annecy → Genève',trips:49,priced:0,partialPricedJourneys:18},{name:'Other',trips:3,priced:1}]});
 assert.match(report,/Annecy → Genève \| 49 \| 0 \| 18 \| 49 \|/);
 assert.match(report,/Other \| 3 \| 1 \| — \| 2 \|/);
});
