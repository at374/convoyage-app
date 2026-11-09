const test=require('node:test');
const assert=require('node:assert/strict');
const {fare,describe,urbanReference}=require('../transport-fares.js');
const networks=['pan-jybus','oura-haute-savoie','oura-ain','oura-express'];
test('no GTFS network is silently priced from its identity alone',()=>{
 for(const networkId of networks){
  assert.equal(urbanReference({networkId,line:'1',departure:'2026-11-12T09:00:00+01:00'}),null,networkId);
  const result=fare([{provider:networkId,mode:'bus',departure:'2026-11-12T09:00:00+01:00'}]);
  assert.equal(result.totalEUR,null,networkId);
  assert.equal(result.unknownLegCount,1,networkId);
  assert.match(describe(result),/Total inconnu/);
 }
});
test('multi-operator connection cannot show a false full total',()=>{
 const result=fare([
  {provider:'TAC',mode:'bus',fareVerified:true,verifiedPriceEUR:1.70,fareSource:'https://www.tac-mobilites.fr/nos-tarifs/guide-des-tarifs',fareValidFrom:'2026-11-09',fareValidUntil:'2026-12-31',departure:'2026-11-12T10:00:00+01:00'},
  {provider:'TPG',mode:'bus',departure:'2026-11-12T10:30:00+01:00'}
 ]);
 assert.equal(result.known,false);
 assert.equal(result.totalEUR,null);
 assert.equal(result.knownSubtotalEUR,1.7);
 assert.equal(result.unknownLegCount,1);
 assert.match(describe(result),/Sous-total vérifié/);
});

test('TAM 2026 ticket reference is sourced but not a verified journey total',()=>{
 const row={networkId:'pan-tam',line:'1',departure:'2026-11-12T09:00:00+01:00'};
 const reference=urbanReference(row);
 assert.ok(reference);
 assert.match(reference.label,/1,10 €/);
 assert.match(reference.source,/TAM-TARIFS-2026\.pdf/);
 const result=fare([{provider:'TAM',mode:'bus',departure:row.departure}]);
 assert.equal(result.totalEUR,null);
 assert.equal(result.known,false);
});

test('Jybus subscriptions and Oura support do not silently make journeys free',()=>{
 const base={provider:'J’ybus',mode:'bus',departure:'2026-11-12T08:00:00+01:00'};
 for(const passProduct of ['JYBUS','OURA','SIBRA']){
  const result=fare([{...base,passProduct,passAccepted:true}],{sibraPassActive:true});
  assert.equal(result.known,false);
  assert.equal(result.totalEUR,null);
 }
});
test('Jybus ticket media cost is not a per-leg fare',()=>{
 const result=fare([{provider:'J’ybus',mode:'bus',verifiedPriceEUR:0.20,departure:'2026-11-12T08:00:00+01:00'}]);
 assert.equal(result.known,false);
 assert.equal(result.totalEUR,null);
});

test('Ondea July 2026 ticket reference is visible without inventing a journey total',()=>{
 const row={networkId:'pan-ondea',line:'1',departure:'2026-11-12T09:00:00+01:00'};
 const reference=urbanReference(row);
 assert.ok(reference);
 assert.match(reference.label,/1,70 €/);
 assert.match(reference.source,/ondeagrandlac\.fr/);
 const result=fare([{provider:'Ondéa',mode:'bus',departure:row.departure}]);
 assert.equal(result.known,false);
 assert.equal(result.totalEUR,null);
});

test('Synchro Bus ticket reference is not an automatically verified trip price',()=>{
 const reference=urbanReference({networkId:'pan-synchro',line:'1',departure:'2026-11-12T09:00:00+01:00'});
 assert.ok(reference);
 assert.match(reference.label,/1,40 €/);
 assert.match(reference.label,/1,70 €/);
 const result=fare([{provider:'Synchro',mode:'bus',departure:'2026-11-12T09:00:00+01:00'}]);
 assert.equal(result.totalEUR,null);
});

test('Ondea plus Synchro is not double-counted as a confirmed combined ticket',()=>{
 const date='2026-11-12T10:00:00+01:00';
 const result=fare([
  {provider:'Ondéa',mode:'bus',departure:date},
  {provider:'Synchro',mode:'bus',departure:'2026-11-12T10:30:00+01:00'}
 ]);
 assert.equal(result.totalEUR,null);
 assert.equal(result.unknownLegCount,2);
 assert.match(describe(result),/Total inconnu/);
});
test('Synchro card medium cost cannot be mistaken for a verified ride',()=>{
 const result=fare([{provider:'Synchro',mode:'bus',verifiedPriceEUR:0.40,departure:'2026-11-12T10:00:00+01:00'}]);
 assert.equal(result.totalEUR,null);
});

test('TCL reference requires explicit zone category and never verifies an itinerary total',()=>{
 const fares=require('../transport-fares.js');
 const row={networkId:'tcl-lyon',line:'C3',departure:'2026-11-10T10:00:00+01:00'};
 assert.match(fares.urbanReference({...row,fareZoneGroup:'zones_1_2'}).label,/2,10 €/);
 assert.match(fares.urbanReference({...row,fareZoneGroup:'adjacent_excluding_1'}).label,/1,60 €/);
 assert.match(fares.urbanReference({...row,fareZoneGroup:'all_excluding_1'}).label,/2,50 €/);
 assert.match(fares.urbanReference({...row,fareZoneGroup:'all_zones'}).label,/3,70 €/);
 assert.equal(fares.urbanReference(row),null);
 assert.equal(fares.urbanReference({...row,fareZoneGroup:'all_zones',crossBorder:true}),null);
 assert.equal(fares.urbanReference({...row,fareZoneGroup:'all_zones',departure:'2027-01-02T10:00:00+01:00'}),null);
 assert.equal(fares.fare([{provider:'TCL',verifiedPriceEUR:2.10}]).totalEUR,null);
});

test('TCL references reject ambiguous and impossible departure timestamps',()=>{
 const row={networkId:'tcl-lyon',fareZoneGroup:'zones_1_2'};
 assert.match(urbanReference({...row,departure:'2026-11-10T10:00:00+01:00'}).label,/2,10 €/);
 for(const departure of ['2026-11-10T10:00:00','2026-02-30T10:00:00+01:00',
  '2026-11-10T25:00:00+01:00','2026-11-10T10:00:00+25:00']){
  assert.equal(urbanReference({...row,departure}),null,departure);
 }
});
