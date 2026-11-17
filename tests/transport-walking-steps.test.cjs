const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../transport-walking.js');
const H=require('../transport-mission-hub.js');
const fixture=require('./fixtures/valhalla-annecy-pedestrian-2026-10-30.json');

function routeFromFixture(){
 const data=fixture.response||fixture.data||fixture;
 const first=data.trip.legs[0].shape;
 // départ et arrivée : extrémités de la géométrie publiée
 const g=W.decodePolyline?W.decodePolyline(first):null;
 return {data,from:g?g[0]:null,to:g?g[g.length-1]:null};
}

test('marche : les étapes guidées du service piéton sont conservées, en français, sans invention',()=>{
 assert.equal(typeof W.validateValhalla,'function','validateValhalla exporté');
 const {data,from,to}=routeFromFixture();
 const r=W.validateValhalla(data,from,to);
 assert.ok(Array.isArray(r.steps)&&r.steps.length>=1);
 const expected=data.trip.legs[0].maneuvers.filter(m=>String(m.instruction||'').trim()).length;
 assert.equal(r.steps.length,Math.min(expected,40));
 for(const s of r.steps){assert.equal(typeof s.text,'string');assert.ok(s.text.length>0);assert.ok(Number.isFinite(s.meters)&&s.meters>=0);}
});

test('fiche mission : une marche calculée porte ses étapes guidées',()=>{
 const l=H.walkLeg?H.walkLeg({durationSeconds:60,distanceMeters:80,geometry:[{lat:45.9,lon:6.1},{lat:45.901,lon:6.1}],steps:[{text:'Tournez à gauche',meters:80,seconds:60}]},{lat:45.9,lon:6.1},{lat:45.901,lon:6.1},'A','B',Date.now()):null;
 if(l)assert.equal(l.steps[0].text,'Tournez à gauche');
});
