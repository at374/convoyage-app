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
