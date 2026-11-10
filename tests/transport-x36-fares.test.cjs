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

test('X36 stop reference requires explicit audited GTFS stop pins and exact network',()=>{
 const {stopReference}=require('../transport-x36-fares.js');
 const fromStop={id:'official-stop-a',lat:46.10,lon:5.80};
 const toStop={id:'official-stop-b',lat:46.11,lon:5.81};
 // Synthetic fixtures only: these are NOT actual audited X36 GTFS stop IDs.
 const auditedPins=[
  {...fromStop,name:base.fromStopName},
  {...toStop,name:base.toStopName}
 ];
 const input={networkId:'oura-ain',line:'X36',fromStop,toStop,
  travelDate:base.travelDate,auditedPins,
  auditEvidence:{networkId:'oura-ain',line:'X36',sourceType:'official_gtfs',
   sourceUrl:'https://example.org/official-gtfs-fixture',checkedOn:'2026-11-10'}};
 const result=stopReference(input);
 assert.equal(result.amount,1.2);
 assert.equal(result.stopMappingVerified,true);
 assert.equal(result.fareVerified,false);
 assert.equal(result.serviceConfirmed,false);
 for(const update of [
  {auditedPins:[]},{networkId:'oura-haute-savoie'},
  {auditEvidence:null},
  {auditEvidence:{...input.auditEvidence,sourceType:'manual_guess'}},
  {auditEvidence:{...input.auditEvidence,line:'X37'}},
  {fromStop:{...fromStop,id:'unknown'}},
  {toStop:{...toStop,lat:46.2}},
  {auditedPins:[...auditedPins,auditedPins[0]]},
  {fromStop:{...fromStop,lat:'46.10'}}
 ])assert.equal(stopReference({...input,...update}),null);
});
