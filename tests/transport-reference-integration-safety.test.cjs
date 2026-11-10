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

test('local GTFS candidates keep unknown fares after the common fare pipeline',()=>{
 const adapters=require('../transport-adapters.js');
 const journey={departure:'2026-11-10T09:00:00+01:00',
  arrival:'2026-11-10T10:00:00+01:00',legs:[{route:'Y62',
   fromStop:'Annecy',toStop:'La Clusaz',
   departure:'2026-11-10T09:00:00+01:00',
   arrival:'2026-11-10T10:00:00+01:00',
   verifiedPriceEUR:4.50,fareVerified:true}]};
 const result=adapters.withVerifiedFares(adapters.adaptGTFS([journey],'Réseau local'));
 assert.equal(result.length,1);
 assert.equal(result[0].priceEUR,null);
 assert.equal(result[0].fareStatus,'Tarif non vérifié');
 assert.equal(result[0].fareBreakdown[0].verified,false);
});

test('adapter accepts independently verified exact-trip fare evidence',()=>{
 const adapters=require('../transport-adapters.js');
 const leg={provider:'Operator',line:'L1',from:'Stop A',to:'Stop B',
  departure:'2026-11-10T09:00:00+01:00',arrival:'2026-11-10T09:30:00+01:00',
  fareVerified:false,verifiedPriceEUR:null};
 const journey={id:'exact-journey',departure:leg.departure,arrival:leg.arrival,legs:[leg]};
 const evidence={journeyId:journey.id,legIndex:0,provider:leg.provider,line:leg.line,
  from:leg.from,to:leg.to,departure:leg.departure,arrival:leg.arrival,
  fareVerified:true,verifiedPriceEUR:2.50,
  fareSource:'https://example.org/test-only-evidence',
  fareValidFrom:'2026-11-01',fareValidUntil:'2026-11-30'};
 const result=adapters.withVerifiedFares(adapters.applyFareEvidence([journey],[evidence]),
  {travelDate:'2026-11-10'});
 assert.equal(result[0].legs[0].fareVerified,true);
 assert.equal(result[0].priceEUR,2.50);
 assert.equal(result[0].fareBreakdown[0].verified,true);
});

test('GTFS adapter strips a self-declared verified amount before fare calculation',()=>{
 const adapters=require('../transport-adapters.js');
 const leg={line:'Y62',from:'Annecy',to:'La Clusaz',
  departure:'2026-11-10T09:00:00+01:00',arrival:'2026-11-10T10:00:00+01:00',
  verifiedPriceEUR:4.50,fareVerified:true,
  fareSource:'https://example.org/untrusted-feed',
  fareValidFrom:'2026-11-01',fareValidUntil:'2026-11-30'};
 const [journey]=adapters.adaptGTFS([{departure:leg.departure,arrival:leg.arrival,legs:[leg]}],'Réseau local');
 assert.equal(journey.legs[0].verifiedPriceEUR,null);
 assert.equal(journey.legs[0].fareVerified,false);
 assert.equal(adapters.withVerifiedFares([journey])[0].priceEUR,null);
});

test('mixed walking, verified and unknown rides show only a verified subtotal',()=>{
 const walking={provider:'Marche',mode:'wa_wal',
  departure:'2026-11-10T08:40:00+01:00'};
 const verified={provider:'Bus A',mode:'bus',
  departure:'2026-11-10T09:00:00+01:00',
  verifiedPriceEUR:2.50,fareVerified:true,
  fareSource:'https://example.org/test-only-evidence',
  fareValidFrom:'2026-11-01',fareValidUntil:'2026-11-30'};
 const unknown={provider:'Bus B',mode:'bus',
  departure:'2026-11-10T10:00:00+01:00',
  verifiedPriceEUR:3.00,fareVerified:false};
 const quote=fares.fare([walking,verified,unknown],{travelDate:'2026-11-10'});
 assert.equal(quote.known,false);
 assert.equal(quote.totalEUR,null);
 assert.equal(quote.knownSubtotalEUR,2.50);
 assert.equal(quote.unknownLegCount,1);
 assert.equal(quote.breakdown[0].amountEUR,0);
 assert.match(fares.describe(quote),/Sous-total vérifié : 2,50 €/);
 assert.match(fares.describe(quote),/Bus B : prix inconnu/);
});
