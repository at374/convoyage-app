const {test}=require('node:test'),assert=require('node:assert/strict');
const {reference}=require('../transport-x36-fares.js');
const base={line:'X36',fromStopName:'BELLEGARDE Gare',toStopName:'BELLEGARDE Lycée',travelDate:'2026-11-10'};
test('X36 exact published matrix lookup stays unverified',()=>{
 const fare=reference(base);
 assert.equal(fare.amount,1.2);
 assert.equal(fare.fareVerified,false);
 assert.equal(fare.stopMappingVerified,false);
 assert.equal(fare.serviceConfirmed,false);
 assert.equal(fare.alreadyDiscounted,true);
});
test('X36 refuses reverse inference, unknown stop, invalid date and wrong line',()=>{
 for(const update of [
  {fromStopName:base.toStopName,toStopName:base.fromStopName},
  {toStopName:'BELLEGARDE Lycée (GPS)'},
  {line:'X37'},{profile:'child'},{travelDate:'2026-02-28'},
  {travelDate:'2026-11-31'}
 ])assert.equal(reference({...base,...update}),null);
});
test('X36 refuses ambiguous matrix pairs',()=>{
 const sourceData={line:'X36',effectiveFrom:'2026-03-01',source:'official',
  pairs:[{from:base.fromStopName,to:base.toStopName,amountEUR:1.2},
         {from:base.fromStopName,to:base.toStopName,amountEUR:1.3}]};
 assert.equal(reference({...base,sourceData}),null);
});
