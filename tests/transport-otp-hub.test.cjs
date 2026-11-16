'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeProviders}=require('../transport-mission-hub.js');
const task={from:{lat:45.9,lon:6.12},to:{lat:46.2,lon:6.14},earliestDeparture:'2026-11-17T09:00:00+01:00'};
test('Hub : OTP2 désactivé par défaut sans réseau',()=>{
 const p=makeProviders({CPOTPClient:{search:async()=>{throw Error('unexpected')}}});
 assert.equal(p.otp.enabled(task),false);
});
test('Hub : OTP2 exige une requête configurée',()=>{
 const p=makeProviders({CPOTPClient:{search:async()=>{throw Error('unexpected')}}},{allowOTP:true,otpEndpoint:'https://otp.example.org/graphql'});
 assert.equal(p.otp.enabled(task),false);
});
test('Hub : OTP2 activé transmet les paramètres et renvoie les trajets',async()=>{
 let calls=0;
 const expected=[{source:'OpenTripPlanner (GTFS)',legs:[]}];
 const p=makeProviders({CPOTPClient:{search:async c=>{calls++;assert.equal(c.enabled,true);assert.equal(c.endpoint,'https://otp.example.org/graphql');assert.equal(c.variables.fromLat,45.9);return {journeys:expected};}}},
 {allowOTP:true,otpEndpoint:'https://otp.example.org/graphql',otpQuery:t=>({query:'query Demo { plan { itineraries { legs { mode } } } }',variables:{fromLat:t.from.lat}})});
 assert.equal(p.otp.enabled(task),true);
 assert.equal(await p.otp.run(task),expected);
 assert.equal(calls,1);
});
