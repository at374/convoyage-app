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
