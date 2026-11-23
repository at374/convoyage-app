'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeProviders}=require('../transport-mission-hub.js');
const task={from:{lat:45.9,lon:6.12},to:{lat:46.2,lon:6.14},earliestDeparture:'2026-11-23T09:00:00+01:00'};
const opts={allowOTP:true,otpEndpoint:'https://otp.example.org/graphql',
 otpQuery:t=>({query:'query Demo { plan { itineraries { legs { mode } } } }',variables:{fromLat:t.from.lat}})};
// CPGTFSLoader/CPGTFSIndex (même minimalement présents, jamais vraiment appelés ici) sont nécessaires pour que
// makeProviders construise localNetworks — utilisé par l'enrichissement des étapes OTP2 testé ci-dessous.
const r={CPOTPClient:{search:async()=>({journeys:currentJourneys})},
 CPGTFSLoader:{loadResource:async()=>({files:{}})},CPGTFSIndex:{nearbyDirectTrips:()=>[]}};
let currentJourneys=[];
const providersWith=journeys=>{currentJourneys=journeys;return makeProviders(r,opts);};

// 23/11/2026 (Laurent : bouton « Tous les horaires » absent sur une étape OTP2, ex. Bus 10 SIBRA) :
// p.otp.run() doit relier les identifiants GTFS bruts posés par l'adaptateur OTP2 (otpRouteGtfsId,
// otpFromStopGtfsId, otpToStopGtfsId, otpServiceDate) à l'un de nos réseaux locaux connus (localNetworks),
// pour poser les mêmes métadonnées (networkUrls/routeId/from/to/serviceDate) que fromGTFS().

test('Hub OTP2 : une étape Sibra reliée pose networkUrls/routeId/from/to/serviceDate (gtfsRaw)',async()=>{
 const journeys=[{legs:[{kind:'transit',mode:'Bus',line:'10',
  otpRouteGtfsId:'SIBRA:10',otpFromStopGtfsId:'SIBRA:1234',otpToStopGtfsId:'SIBRA:5678',otpServiceDate:'20261123'}]}];
 const p=providersWith(journeys);
 const out=await p.otp.run(task);
 const l=out[0].legs[0];
 assert.ok(l.gtfsRaw,'gtfsRaw devrait être posé');
 assert.equal(l.gtfsRaw.routeId,'10');
 assert.equal(l.gtfsRaw.from,'1234');
 assert.equal(l.gtfsRaw.to,'5678');
 assert.equal(l.gtfsRaw.serviceDate,'2026-11-23');
 assert.ok(Array.isArray(l.gtfsRaw.networkUrls)&&l.gtfsRaw.networkUrls.length>0);
 assert.ok(l.gtfsRaw.networkUrls.some(u=>u.includes('sibra-annecy.zip')));
});

test('Hub OTP2 : un idFlux inconnu (aucun réseau local correspondant) ne pose jamais gtfsRaw',async()=>{
 const journeys=[{legs:[{kind:'transit',mode:'Bus',line:'X',
  otpRouteGtfsId:'RESEAUINCONNU:1',otpFromStopGtfsId:'RESEAUINCONNU:2',otpToStopGtfsId:'RESEAUINCONNU:3',otpServiceDate:'20261123'}]}];
 const p=providersWith(journeys);
 const out=await p.otp.run(task);
 assert.equal(out[0].legs[0].gtfsRaw,undefined);
});

test('Hub OTP2 : une marche n est jamais enrichie, même avec des identifiants qui traînent',async()=>{
 const journeys=[{legs:[{kind:'walk',mode:'Marche',
  otpRouteGtfsId:'SIBRA:10',otpFromStopGtfsId:'SIBRA:1',otpToStopGtfsId:'SIBRA:2',otpServiceDate:'20261123'}]}];
 const p=providersWith(journeys);
 const out=await p.otp.run(task);
 assert.equal(out[0].legs[0].gtfsRaw,undefined);
});

test('Hub OTP2 : un identifiant manquant (ex. arrêt d arrivée) ne pose pas gtfsRaw, rien n est à moitié inventé',async()=>{
 const journeys=[{legs:[{kind:'transit',mode:'Bus',line:'10',
  otpRouteGtfsId:'SIBRA:10',otpFromStopGtfsId:'SIBRA:1234',otpToStopGtfsId:null,otpServiceDate:'20261123'}]}];
 const p=providersWith(journeys);
 const out=await p.otp.run(task);
 assert.equal(out[0].legs[0].gtfsRaw,undefined);
});

test('Hub OTP2 : correspondance insensible à la casse et aux tirets bas (ex. Start Thonon)',async()=>{
 const journeys=[{legs:[{kind:'transit',mode:'Bus',line:'C',
  otpRouteGtfsId:'START_THONON:C',otpFromStopGtfsId:'START_THONON:A1',otpToStopGtfsId:'START_THONON:A2',otpServiceDate:'20261123'}]}];
 const p=providersWith(journeys);
 const out=await p.otp.run(task);
 const l=out[0].legs[0];
 assert.ok(l.gtfsRaw);
 assert.equal(l.gtfsRaw.routeId,'C');
 assert.ok(l.gtfsRaw.networkUrls.some(u=>u.includes('start-thonon.zip')));
});
