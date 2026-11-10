// Regression: published reference prices must not be promoted to verified trip fares.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fares=require('../transport-fares.js');
const leman=require('../transport-lemanpass-fares.js');
const line272=require('../transport-272-fares.js');

function pricedLeg(reference){
 return {provider:'Reference only',mode:'bus',departure:'2026-11-10T09:00:00+01:00',
   verifiedPriceEUR:reference.amount, fareSource:reference.source,
   fareVerified:reference.fareVerified,
   fareValidFrom:'2026-11-07',fareValidUntil:'2026-12-12'};
}
test('272 published price is not an automatically verified fare',()=>{
 const ref=line272.reference({line:'272',fromSector:'Annecy',toSector:'Genève ou Saint-Julien Douane',travelDate:'2026-11-10',product:'parcours',profile:'adult'});
 assert.ok(ref);
 const result=fares.fare([pricedLeg(ref)],{travelDate:'2026-11-10'});
 assert.equal(result.known,false);
 assert.equal(result.totalEUR,null);
 assert.equal(result.unknownLegCount,1);
});
test('Léman Pass direct reference cannot silently become a confirmed fare',()=>{
 const fixture=require('./fixtures/lemanpass-annemasse-geneve-20261106.json');
 const result=leman.parse(fixture,{departure:'Annemasse (LEX)',arrival:'Genève (LEX)',class:'2'});
 assert.equal(result.offers.length,1);
 const ref=result.offers[0];
 assert.equal(ref.fareVerified,false);
 const quote=fares.fare([pricedLeg({amount:ref.prices.EUR,source:ref.source,fareVerified:ref.fareVerified})],{travelDate:'2026-11-10'});
 assert.equal(quote.totalEUR,null);
 assert.equal(quote.known,false);
});
