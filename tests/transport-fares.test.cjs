const assert=require('node:assert/strict');
const {fare,describe}=require('../transport-fares.js');
assert.equal(fare([]).totalEUR,null);
assert.equal(fare([{provider:'TER'}]).known,false);
assert.equal(fare([{provider:'TER',fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR:8.5}]).totalEUR,8.5);
assert.equal(fare([{provider:'TER',fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR:8.5},{provider:'Bus',fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR:2}]).totalEUR,10.5);
const sibra={provider:'SIBRA',fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR:2,passAccepted:true,passProduct:'SIBRA',passEligibilityVerified:true,passEligibilitySource:'conditions officielles'};
assert.equal(fare([sibra],{sibraPassActive:true}).totalEUR,0);
assert.equal(fare([sibra],{sibraPassActive:false}).totalEUR,2);
assert.equal(fare([{...sibra,passEligibilityVerified:false}],{sibraPassActive:true}).totalEUR,2);
assert.equal(fare([{...sibra,fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR:null,passEligibilityVerified:false}],{sibraPassActive:true}).known,false);
assert.equal(fare([sibra,{provider:'TER'}],{sibraPassActive:true}).totalEUR,null);
assert.equal(fare([{provider:'Bus',fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR:-1}]).known,false);
assert.match(describe(fare([{provider:'TER',fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR:8.5},{provider:'Bus'}])),/Total inconnu/);
assert.match(describe(fare([{provider:'TER',fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR:8.5}])),/Total : 8,50 €/);
assert.match(describe(fare([sibra],{sibraPassActive:true})),/abonnement vérifié/);
const dated={provider:'TER',verifiedPriceEUR:8.5,fareVerified:true,fareSource:'source vérifiée',fareValidFrom:'2026-11-01T00:00:00+01:00',fareValidUntil:'2026-11-30T23:59:59+01:00'};
assert.equal(fare([dated],{travelDate:'2026-11-15T12:00:00+01:00'}).totalEUR,8.5);
assert.equal(fare([dated],{travelDate:'2026-12-01T12:00:00+01:00'}).known,false);
assert.equal(fare([{...dated,fareValidUntil:null}],{travelDate:'2026-11-15T12:00:00+01:00'}).known,false);
const eligible={...sibra,passValidFrom:'2026-01-01T00:00:00+01:00',passValidUntil:'2026-12-31T23:59:59+01:00'};
assert.equal(fare([eligible],{sibraPassActive:true,travelDate:'2026-11-02T10:00:00+01:00'}).totalEUR,0);
assert.equal(fare([eligible],{sibraPassActive:true,travelDate:'2027-01-02T10:00:00+01:00'}).totalEUR,null);
assert.equal(fare([sibra],{sibraPassActive:true,travelDate:'2026-11-02T10:00:00+01:00'}).totalEUR,null);
console.log('transport fares: 19 assertions passed');

const test=require('node:test');
test('each leg uses its own boarding date across a tariff change',()=>{
  const first={...dated,departure:'2026-11-30T23:50:00+01:00'};
  const second={...dated,departure:'2026-12-01T00:10:00+01:00'};
  const result=fare([first,second],{travelDate:first.departure});
  assert.equal(result.totalEUR,null);
  assert.equal(result.breakdown[0].amountEUR,8.5);
  assert.equal(result.breakdown[1].verified,false);
  assert.equal(result.breakdown[1].source,null);
  assert.equal(result.breakdown[0].source,dated.fareSource);
  assert.equal(result.breakdown[0].validUntil,dated.fareValidUntil);
});
test('SIBRA pass expiry is evaluated at each boarding, with strict booleans',()=>{
  const first={...eligible,departure:'2026-12-31T23:50:00+01:00'};
  const second={...eligible,departure:'2027-01-01T00:10:00+01:00'};
  const result=fare([first,second],{sibraPassActive:true,travelDate:first.departure});
  assert.equal(result.totalEUR,null);
  assert.equal(result.breakdown[0].passApplied,true);
  assert.equal(result.breakdown[0].verified,true);
  assert.equal(result.breakdown[0].source,eligible.passEligibilitySource);
  assert.equal(result.breakdown[1].passApplied,false);
  assert.equal(result.breakdown[1].verified,false);
});
test('leg date takes precedence over a conflicting itinerary date',()=>{
  assert.equal(fare([{...dated,departure:'2026-12-01T12:00:00+01:00'}],{travelDate:'2026-11-02T12:00:00+01:00'}).known,false);
  assert.equal(fare([{...dated,departure:'2026-11-02T12:00:00+01:00'}],{travelDate:'2026-12-01T12:00:00+01:00'}).known,true);
  assert.equal(fare([{...dated,departure:'invalid'}],{travelDate:'2026-11-02T12:00:00+01:00'}).known,false);
  assert.equal(fare([{...dated,departure:''}],{travelDate:'2026-11-02T12:00:00+01:00'}).known,false);
  assert.equal(fare([{...eligible,departure:''}],{sibraPassActive:true}).known,false);
  assert.equal(fare([{...dated,departure:null}],{travelDate:'2026-11-02T12:00:00+01:00'}).known,true);
});
test('expired pass falls back to an independently valid paid fare',()=>{
  const leg={...eligible,departure:'2027-01-01T00:10:00+01:00',fareValidFrom:'2027-01-01T00:00:00+01:00',fareValidUntil:'2027-01-31T23:59:59+01:00'};
  const result=fare([leg],{sibraPassActive:true});
  assert.equal(result.totalEUR,2);
  assert.equal(result.breakdown[0].passApplied,false);
  assert.equal(result.breakdown[0].source,leg.fareSource);
});

test('partial fare exposes only verified costs and never fabricates a full total',()=>{
 const result=fare([{...dated,departure:'2026-11-15T12:00:00+01:00'},{provider:'Interurban',departure:'2026-11-15T13:00:00+01:00'}]);
 assert.equal(result.known,false);
 assert.equal(result.totalEUR,null);
 assert.equal(result.knownSubtotalEUR,8.5);
 assert.equal(result.unknownLegCount,1);
 assert.match(describe(result),/Total inconnu/);
 assert.match(describe(result),/Sous-total vérifié : 8,50 €/);
 assert.match(describe(result),/1 portion sans prix/);
 const complete=fare([{...dated,departure:'2026-11-15T12:00:00+01:00'}]);
 assert.equal(complete.knownSubtotalEUR,complete.totalEUR);
 assert.equal(complete.unknownLegCount,0);
});

test('empty itinerary has stable partial-fare metadata',()=>{
 const result=fare([]);
 assert.equal(result.totalEUR,null);
 assert.equal(result.knownSubtotalEUR,0);
 assert.equal(result.unknownLegCount,0);
 assert.equal(result.known,false);
});
test('verified fare subtotal adds cents without binary floating point drift',()=>{
 const legs=[0.1,0.2,0.3].map(verifiedPriceEUR=>({provider:'TER',fareVerified:true,fareSource:'source vérifiée',verifiedPriceEUR}));
 const result=fare(legs);
 assert.equal(result.knownSubtotalEUR,0.6);
 assert.equal(result.totalEUR,0.6);
});

test('TripGo walking and stationary legs need no ticket but unknown bus fare remains unknown',()=>{
 const legs=[{mode:'wa_wal',provider:'Marche'},{mode:'stationary_transfer'},{mode:'pt_pub_bus',provider:'Bus'},{mode:'wa_wal'}];
 const result=fare(legs);
 assert.equal(result.totalEUR,null);
 assert.equal(result.knownSubtotalEUR,0);
 assert.equal(result.unknownLegCount,1);
 assert.equal(result.breakdown[0].amountEUR,0);
 assert.equal(result.breakdown[1].verified,true);
 assert.equal(result.breakdown[2].verified,false);
 assert.equal(result.breakdown[3].verified,true);
 assert.match(describe(result),/Total inconnu/);
 assert.doesNotMatch(describe(result),/Sous-total vérifié/);
});
test('a walking-only route has zero ticket cost',()=>{
 const result=fare([{mode:'wa_wal'}]);
 assert.equal(result.totalEUR,0);
 assert.equal(result.known,true);
 assert.equal(result.unknownLegCount,0);
 assert.equal(result.status,'Aucun billet requis');
 assert.match(describe(result),/^Aucun billet requis/);
});

test('fare description labels walking and transfers as no-ticket, not verified transit tickets',()=>{
 const result=fare([{mode:'wa_wal'},{mode:'stationary_wait'},{mode:'pt_pub_bus',provider:'Bus'}]);
 assert.equal(result.unknownLegCount,1);
 assert.equal(result.breakdown[0].nonTicketed,true);
 assert.equal(result.breakdown[1].nonTicketed,true);
 assert.equal(result.breakdown[2].nonTicketed,false);
 assert.match(describe(result),/Marche \/ correspondance : sans billet/);
 assert.doesNotMatch(describe(result),/abonnement vérifié/);
});

test('walking plus unpriced bus does not imply a verified zero-euro subtotal',()=>{
 const result=fare([{mode:'wa_wal'},{mode:'pt_pub_bus',provider:'Bus'}]);
 assert.equal(result.knownSubtotalEUR,0);
 assert.equal(result.unknownLegCount,1);
 assert.match(describe(result),/^Total inconnu/);
 assert.doesNotMatch(describe(result),/Sous-total vérifié/);
});

test('walking leg cannot inherit a SIBRA pass or its validity metadata',()=>{
 const leg={mode:'wa_wal',provider:'Marche',passAccepted:true,passProduct:'SIBRA',passEligibilityVerified:true,passEligibilitySource:'SIBRA',passValidFrom:'2026-01-01T00:00:00+01:00',passValidUntil:'2026-12-31T23:59:59+01:00',departure:'2026-11-02T12:00:00+01:00'};
 const result=fare([leg],{sibraPassActive:true});
 assert.equal(result.totalEUR,0);
 assert.equal(result.breakdown[0].nonTicketed,true);
 assert.equal(result.breakdown[0].passApplied,false);
 assert.equal(result.breakdown[0].source,'Aucun titre de transport requis');
 assert.equal(result.breakdown[0].validFrom,null);
 assert.match(describe(result),/sans billet/);
});

test('pedestrian segment ignores stray paid fare evidence',()=>{
 const leg={mode:'wa_wal',provider:'Marche',fareVerified:true,fareSource:'tarif bus',verifiedPriceEUR:9.9,fareValidFrom:'2026-01-01T00:00:00+01:00',fareValidUntil:'2026-12-31T23:59:59+01:00',departure:'2026-11-02T12:00:00+01:00'};
 const result=fare([leg]);
 assert.equal(result.totalEUR,0);
 assert.equal(result.breakdown[0].source,'Aucun titre de transport requis');
 assert.equal(result.breakdown[0].validFrom,null);
 assert.equal(result.breakdown[0].validUntil,null);
 assert.match(describe(result),/sans billet/);
});

test('fare calculation tolerates null options without making unknown transit free',()=>{
 const result=fare([{mode:'pt_pub_bus',provider:'Bus'}],null);
 assert.equal(result.totalEUR,null);
 assert.equal(result.unknownLegCount,1);
 assert.equal(fare([{mode:'wa_wal'}],null).totalEUR,0);
});

test('Agenda per-leg labels are consistent with verified, pass, walk and unknown fare evidence',()=>{
 const {describeLeg}=require('../transport-fares.js');
 assert.equal(describeLeg(null),'Tarif inconnu');
 assert.equal(describeLeg(fare([{mode:'wa_wal'}]).breakdown[0]),'Sans billet');
 assert.equal(describeLeg(fare([{mode:'pt_pub_bus'}]).breakdown[0]),'Tarif inconnu');
 assert.equal(describeLeg(fare([{provider:'TER',fareVerified:true,fareSource:'officiel',verifiedPriceEUR:8.5}]).breakdown[0]),'Tarif vérifié : 8,50 €');
 assert.equal(describeLeg(fare([{...sibra}],{sibraPassActive:true}).breakdown[0]),'Couvert par abonnement vérifié');
});

test('date-only fare and pass expiry includes the whole boarding day but not the next',()=>{
 const fareLeg={...dated,fareValidFrom:'2026-11-01',fareValidUntil:'2026-11-30'};
 assert.equal(fare([{...fareLeg,departure:'2026-11-30T23:50:00+01:00'}]).totalEUR,8.5);
 assert.equal(fare([{...fareLeg,departure:'2026-12-01T00:10:00+01:00'}]).known,false);
 const passLeg={...eligible,passValidFrom:'2026-01-01',passValidUntil:'2026-12-31'};
 assert.equal(fare([{...passLeg,departure:'2026-12-31T23:50:00+01:00'}],{sibraPassActive:true}).totalEUR,0);
 assert.equal(fare([{...passLeg,departure:'2027-01-01T00:10:00+01:00'}],{sibraPassActive:true}).known,false);
 assert.equal(fare([{...fareLeg,fareValidUntil:'2026-11-31',departure:'2026-11-15T12:00:00+01:00'}]).known,false);
});
