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
 const second={...leg('RAIL'),startTime:1794831600000,endTime:1794835000000,from:to};
 const out=parse({plan:{itineraries:[{legs:[first,second]}]}});
 assert.equal(out.length,1);assert.equal(out[0].legs.length,2);
});

test('OTP2 : refuse une téléportation entre deux segments',()=>{
 const first={...leg('WALK'),endTime:1794831000000};
 const second={...leg('RAIL'),startTime:1794831600000,endTime:1794835000000,from:{name:'Autre arrêt',lat:45.9,lon:6.12}};
 assert.deepEqual(parse({plan:{itineraries:[{legs:[first,second]}]}}),[]);
});
test('OTP2 : accepte deux segments avec un arrêt commun',()=>{
 const first={...leg('WALK'),endTime:1794831000000};
 const second={...leg('RAIL'),startTime:1794831600000,endTime:1794835000000,from:to};
 const out=parse({plan:{itineraries:[{legs:[first,second]}]}});
 assert.equal(out.length,1);
});

test('OTP2 : refuse les coordonnées manquantes ou vides',()=>{
 const cases=[
  {...leg(),from:{name:'Sans latitude',lon:6.14}},
  {...leg(),to:{name:'Latitude vide',lat:'',lon:6.14}},
  {...leg(),from:{name:'Longitude nulle',lat:45.9,lon:null}},
  {...leg(),to:{name:'Longitude vide',lat:46.2,lon:''}}
 ];
 for(const item of cases)assert.deepEqual(parse({plan:{itineraries:[{legs:[item]}]}}),[]);
});

test('OTP2 : refuse les marches sans distance ou durée exploitable',()=>{
 const cases=[
  {...leg('WALK'),distance:null},
  {...leg('WALK'),duration:null},
  {...leg('WALK'),distance:-2},
  {...leg('WALK'),duration:-1}
 ];
 for(const item of cases)assert.deepEqual(parse({plan:{itineraries:[{legs:[item]}]}}),[]);
});

test('OTP2 : le contrôle hors réseau produit un rapport et conserve le statut non confirmé',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {spawnSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'otp-smoke-'));
 try{
  const file=path.join(dir,'response.json');
  fs.writeFileSync(file,JSON.stringify({plan:{itineraries:[{legs:[leg()]}]}}));
  const p=spawnSync(process.execPath,[path.join(__dirname,'../scripts/otp-smoke.cjs'),file],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  const report=JSON.parse(p.stdout);
  assert.equal(report.itineraries,1);
  assert.equal(report.confirmedRealtime,0);
  assert.equal(report.faresVerified,0);
  assert.match(report.journeys[0].status,/Transport non confirmé/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('OTP2 : une réponse partiellement corrompue ne fait pas planter les autres trajets',()=>{
 const response={plan:{itineraries:[null,{legs:[null]},{legs:[leg()]}, {legs:[false]}]}};
 const out=parse(response);
 assert.equal(out.length,1);
 assert.equal(out[0].legs[0].mode,'Train');
});

test('OTP2 : accepte planConnection edges node et horaires imbriqués programmés',()=>{
 const modern={...leg()};
 delete modern.startTime;delete modern.endTime;
 modern.departure={scheduledTime:'2026-11-16T12:00:00+01:00'};
 modern.arrival={scheduledTime:'2026-11-16T13:00:00+01:00'};
 const out=parse({data:{planConnection:{edges:[{node:{legs:[modern]}},null,{node:null}]}}});
 assert.equal(out.length,1);
 assert.equal(out[0].legs[0].departure,'2026-11-16T11:00:00.000Z');
 assert.equal(out[0].legs[0].fare,null);
 assert.equal(out[0].legs[0].realtime,false);
});
test('OTP2 : accepte start/end scheduledTime et rejette un horaire manquant',()=>{
 const nested={...leg(),startTime:null,endTime:null,
  start:{scheduledTime:'2026-11-16T12:00:00+01:00'},
  end:{scheduledTime:'2026-11-16T13:00:00+01:00'}};
 assert.equal(parse({planConnection:{edges:[{node:{legs:[nested]}}]}}).length,1);
 assert.deepEqual(parse({planConnection:{edges:[{node:{legs:[{...nested,end:null}]}}]}}),[]);
});

test('OTP2 : tracé piéton décodé seulement s’il est valide et collé aux extrémités',()=>{
 const {parse,decodePolyline}=require('../transport-otp-adapter.js');
 // Exemple de référence de l'algorithme : (38.5,-120.2) (40.7,-120.95) (43.252,-126.453).
 const ref=decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
 assert.deepEqual(ref,[{lat:38.5,lon:-120.2},{lat:40.7,lon:-120.95},{lat:43.252,lon:-126.453}]);
 assert.equal(decodePolyline('_p~iF'),null);
 assert.equal(decodePolyline('\u0001\u0002'),null);
 assert.equal(decodePolyline(''),null);
 const walk=points=>({data:{planConnection:{edges:[{node:{legs:[{mode:'WALK',distance:300,duration:240,
  start:{scheduledTime:'2026-11-24T08:00:00+01:00'},end:{scheduledTime:'2026-11-24T08:04:00+01:00'},
  from:{name:'A',lat:38.5,lon:-120.2},to:{name:'B',lat:43.252,lon:-126.453},legGeometry:{points}}]}}]}}});
 const ok=parse(walk('_p~iF~ps|U_ulLnnqC_mqNvxq`@'))[0].legs[0];
 assert.equal(ok.geometry.length,3);assert.equal(ok.walkSource,'provider');
 const bad=parse(walk('_p~iF~ps|U_ulLnnqC'))[0].legs[0]; // se termine loin du point d'arrivée
 assert.equal(bad.geometry,null);assert.equal(bad.walkSource,null);
});
