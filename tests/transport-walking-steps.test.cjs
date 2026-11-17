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

test('rendu : une marche n affiche jamais de tarif, et son bouton est sous sa carte',()=>{
 const fs=require('node:fs');
 const src=fs.readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 const i=src.indexOf("if(l.kind==='walk'){\n   li.appendChild(el(doc,'small'");
 const j=src.indexOf("else{const f=j.price.legFares?.[legIndex]",i);
 assert.ok(i>=0&&j>i,'le tarif de segment appartient au « sinon » des marches');
 const bloc=src.slice(i,j);
 assert.ok(bloc.indexOf('mapSvg(doc,{legs:[l]})')<bloc.indexOf('Voir la marche'),'bouton après la carte');
 assert.doesNotMatch(bloc,/Tarif/);
});

test('marche maximale : une marche plus longue que la limite écarte le trajet, une marche non calculée non',()=>{
 const at=(h,m)=>new Date('2026-11-16T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00+01:00').toISOString();
 const A={lat:45.9,lon:6.1},B={lat:45.95,lon:6.1};
 const walk=(d)=>({kind:'walk',mode:'Marche',from:'Gare',to:'Prise en charge',fromPoint:A,toPoint:B,departure:at(8,0),arrival:at(8,44),distanceMeters:d,durationSeconds:d==null?null:2640});
 const task={latestArrival:at(9,0),walkMaxMeters:3000};
 const long=H.assess({source:'S',sources:['S'],legs:[walk(3280)],missing:[]},task);
 assert.ok(long.reasons.some(r=>r.startsWith('marche trop longue')),'3 280 m > 3 km');
 const ok=H.assess({source:'S',sources:['S'],legs:[walk(2900)],missing:[]},task);
 assert.ok(!ok.reasons.some(r=>r.startsWith('marche trop longue')),'2 900 m ≤ 3 km');
 const sans=H.assess({source:'S',sources:['S'],legs:[walk(3280)],missing:[]},{latestArrival:at(9,0)});
 assert.ok(!sans.reasons.some(r=>r.startsWith('marche trop longue')),'sans limite : aucune exclusion');
 // Le classement ne propose jamais un trajet à marche trop longue.
 const r=H.rank([long,ok],task);
 assert.equal(r.total,1);
});

test('session : la limite de marche du réglage est transmise à chaque recherche',()=>{
 const src=require('node:fs').readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 assert.match(src,/walkMaxMeters:Number\.isFinite\(t\.walkMaxMeters\)\?t\.walkMaxMeters:/);
});
