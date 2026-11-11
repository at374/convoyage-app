const test=require('node:test');
const assert=require('node:assert/strict');
const {assessLineCoverage}=require('../transport-line-coverage.js');
const line={id:'Y22',officialSourceVerified:true,absenceReviewApproved:true};
const providers=['TripGo','Oura'];
const observations=providers.flatMap(provider=>['2026-11-11','2026-11-12'].flatMap(date=>['outbound','inbound'].map(direction=>({lineId:'Y22',provider,date,direction,time:'10:00',status:'not_found'}))));
test('empty or failed engines never authorize manual entry',()=>{
 assert.equal(assessLineCoverage(line,[],providers).manualEligible,false);
 assert.equal(assessLineCoverage(line,[{lineId:'Y22',provider:'TripGo',status:'error'}],providers).status,'non_conclusive');
});
test('only reviewed multi-date two-way absence on all engines is eligible',()=>{
 const result=assessLineCoverage(line,observations,providers);
 assert.equal(result.status,'confirmed_absent');
 assert.equal(result.manualEligible,true);
});
test('found engine result overrides manual approval',()=>{
 const result=assessLineCoverage(line,[...observations,{lineId:'Y22',provider:'TripGo',status:'found'}],providers);
 assert.equal(result.status,'engine_found');
 assert.equal(result.manualEligible,false);
});
test('partial coverage is not a confirmed absence',()=>{
 const result=assessLineCoverage(line,[...observations,{lineId:'Y22',provider:'Oura',status:'partial'}],providers);
 assert.equal(result.status,'partial');
});
test('no official source, no approval, missing engine or error blocks manual entry',()=>{
 assert.equal(assessLineCoverage({...line,absenceReviewApproved:false},observations,providers).manualEligible,false);
 assert.equal(assessLineCoverage({...line,officialSourceVerified:false},observations,providers).manualEligible,false);
 assert.equal(assessLineCoverage(line,observations,['TripGo','Oura','TPG']).manualEligible,false);
 assert.equal(assessLineCoverage(line,[...observations,{lineId:'Y22',provider:'TripGo',status:'error'}],providers).manualEligible,false);
});
