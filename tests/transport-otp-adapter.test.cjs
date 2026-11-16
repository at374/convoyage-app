const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('../transport-otp-adapter.js');
const from={name:'Annecy',lat:45.9,lon:6.12},to={name:'Genève',lat:46.2,lon:6.14};
const leg=(mode='RAIL')=>({mode,from,to,startTime:1794830400000,endTime:1794834000000,
 duration:3600,distance:42000,route:{shortName:'L2',agency:{name:'TER'}}});
test('OTP2 : normalise un trajet programmé sans inventer un prix ni du temps réel',()=>{
 const out=parse({data:{plan:{itineraries:[{legs:[leg()]}]}}});
 assert.equal(out.length,1);assert.equal(out[0].legs[0].mode,'Train');
 assert.equal(out[0].legs[0].fare,null);assert.equal(out[0].realtime,false);
 assert.equal(out[0].legs[0].walkSource,null);
});
test('OTP2 : accepte les trajets à pied sans les présenter comme validés GPS',()=>{
 const out=parse({plan:{itineraries:[{legs:[leg('WALK')]}]}});
 assert.equal(out[0].legs[0].kind,'walk');assert.equal(out[0].legs[0].walkSource,null);
});
test('OTP2 : refuse bateau, mode inconnu, coordonnées invalides et horaires incomplets',()=>{
 const bad=[leg('FERRY'),leg('HELICOPTER'),{...leg(),from:{lat:95,lon:6}}, {...leg(),endTime:null}];
 assert.equal(parse({plan:{itineraries:bad.map(x=>({legs:[x]}))}}).length,0);
});
test('OTP2 : refuse les itinéraires sans segments ou sans plan',()=>{
 assert.deepEqual(parse({}),[]);
 assert.deepEqual(parse({plan:{itineraries:[{legs:[]}]}}),[]);
});

test('OTP2 : ignore les dates numériques hors plage sans faire planter la recherche',()=>{
 const broken={...leg(),startTime:9e18};
 assert.deepEqual(parse({plan:{itineraries:[{legs:[broken]}]}}),[]);
});
test('OTP2 : refuse une arrivée avant le départ',()=>{
 const broken={...leg(),endTime:1794820000000};
 assert.deepEqual(parse({plan:{itineraries:[{legs:[broken]}]}}),[]);
});

test('OTP2 : rejette les segments qui se chevauchent',()=>{
 const first=leg('WALK');
 const second={...leg('RAIL'),startTime:1794832000000,endTime:1794835000000};
 assert.deepEqual(parse({plan:{itineraries:[{legs:[first,second]}]}}),[]);
});
test('OTP2 : accepte une correspondance chronologiquement possible',()=>{
 const first={...leg('WALK'),endTime:1794831000000};
 const second={...leg('RAIL'),startTime:1794831600000,endTime:1794835000000};
 const out=parse({plan:{itineraries:[{legs:[first,second]}]}});
 assert.equal(out.length,1);assert.equal(out[0].legs.length,2);
});
