const test=require('node:test');
const assert=require('node:assert/strict');
const {fare,describe,urbanReference}=require('../transport-fares.js');
const networks=['pan-ondea','pan-tam','pan-synchro','pan-jybus','oura-haute-savoie','oura-ain','oura-express'];
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
