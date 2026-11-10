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

test('adapter rejects unverified reference evidence even with matching trip identity',()=>{
 const adapters=require('../transport-adapters.js');
 const leg={provider:'Cars Région',line:'272',from:'Annecy',to:'Genève',
  departure:'2026-11-10T09:00:00+01:00',arrival:'2026-11-10T10:00:00+01:00',
  fareVerified:false,verifiedPriceEUR:null};
 const journey={id:'trip-272',departure:leg.departure,arrival:leg.arrival,legs:[leg]};
 const reference=line272.reference({line:'272',fromSector:'Annecy',
  toSector:'Genève ou Saint-Julien Douane',travelDate:'2026-11-10',
  product:'parcours',profile:'adult'});
 const evidence={journeyId:journey.id,legIndex:0,...leg,
  fareVerified:reference.fareVerified,verifiedPriceEUR:reference.amount,
  fareSource:reference.source,fareValidFrom:'2026-11-07',fareValidUntil:'2026-12-12'};
 const result=adapters.applyFareEvidence([journey],[evidence]);
 assert.equal(result[0].legs[0].fareVerified,false);
 assert.equal(result[0].legs[0].verifiedPriceEUR,null);
});

test('adapter rejects a fare belonging to another departure or an expired tariff',()=>{
 const adapters=require('../transport-adapters.js');
 const leg={provider:'Cars Région',line:'272',from:'Annecy',to:'Genève',
  departure:'2026-11-10T09:00:00+01:00',arrival:'2026-11-10T10:00:00+01:00',
  fareVerified:false,verifiedPriceEUR:null};
 const journey={id:'trip-272-0900',departure:leg.departure,arrival:leg.arrival,legs:[leg]};
 const evidence={journeyId:journey.id,legIndex:0,provider:leg.provider,line:leg.line,
  from:leg.from,to:leg.to,departure:leg.departure,arrival:leg.arrival,
  fareVerified:true,verifiedPriceEUR:11.30,fareSource:'https://example.org/verified-quote',
  fareValidFrom:'2026-11-07',fareValidUntil:'2026-12-12'};
 for(const mismatch of [{departure:'2026-11-10T10:00:00+01:00'},
  {journeyId:'another-trip'},{to:'Another stop'},{fareValidUntil:'2026-11-09'},
  {fareValidFrom:'2026-11-11'}]){
  const adapted=adapters.applyFareEvidence([journey],[{...evidence,...mismatch}]);
  assert.equal(adapted[0].legs[0].fareVerified,false);
  assert.equal(adapted[0].legs[0].verifiedPriceEUR,null);
 }
});
