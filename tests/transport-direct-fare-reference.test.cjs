const {test}=require('node:test'),assert=require('node:assert/strict');
const api=require('../transport-direct-fare-reference.js');
const row={networkId:'oura-haute-savoie',line:'Y02',departure:'2026-11-09T11:00:00+01:00',
 originStop:{stopId:'FR:74012:ZE:57669:HAUTExSAVOIE',lat:46.1996235,lon:6.2381237},
 destinationStop:{stopId:'FR:74273:ZE:57641:HAUTExSAVOIE',lat:46.053759,lon:6.773773}};
test('a direct Y02 reference is available for comparison without certifying price',()=>{
 global.CPY02Fares=require('../transport-y02-fares.js');
 try{
  const ref=api.reference(row);assert.equal(ref.amount,4);assert.equal(ref.fareVerified,false);assert.equal(ref.serviceConfirmed,false);
  const adapters=require('../transport-adapters.js'),ranking=require('../transport-ranking.js');
  const [journey]=adapters.adaptGTFS([{...row,arrival:'2026-11-09T12:20:00+01:00',legs:[{line:'Y02'}]}],'Réseau local');
  journey.directFareReference=ref;
  const [choice]=ranking.rank([journey],{includeAlternatives:true});
  assert.equal(choice.journey.directFareReference.amount,4);assert.equal(choice.journey.priceEUR,null);assert.equal(choice.journey.feasible,false);
  assert.equal(api.reference({...row,legs:[{line:'Y02'},{line:'Y51'}]}),null);
  assert.equal(api.reference({...row,departure:'2026-12-07T11:00:00+01:00'}),null);
  assert.equal(api.reference({...row,destinationStop:{...row.destinationStop,lat:47}}),null);
 }finally{delete global.CPY02Fares;}
});
test('Y51 card reference requires full stop proof and preserves the local digital fare',()=>{
 const data=require('./fixtures/y51-tariff-reference-2026-10-31.json');
 const pin=i=>{const s=data.stops.find(x=>x[3]===i);return{stopId:s[0],lat:s[1],lon:s[2]};};
 const make=(a,b)=>{const start=pin(a),end=pin(b),leg={networkId:'oura-haute-savoie',line:'Y51',tripId:'fixture',from:start.stopId,to:end.stopId,departure:'2026-11-02T10:00:00+01:00',arrival:'2026-11-02T11:30:00+01:00'};return{...leg,fareScopePath:{...leg,stops:[start,end]}};};
 global.CPTY51Fares=require('../transport-y51-fares.js');
 try{
  const full=api.reference(make(0,14));assert.equal(full.amount,8.9);assert.equal(full.fareVerified,false);
  const local=api.reference(make(0,3));assert.equal(local.amount,2.5);assert.equal(local.digitalAlternativeEUR,2);
  assert.equal(api.reference({...make(0,14),fareScopePath:null}),null);
  assert.equal(api.reference({...make(0,14),legs:[{},{}]}),null);
 }finally{delete global.CPTY51Fares;}
});
