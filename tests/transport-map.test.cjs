const {test}=require('node:test');
const assert=require('node:assert/strict');
const map=require('../transport-map');
const regional=require('../regional-routing');
const adapters=require('../transport-adapters');
const fixture=require('./fixtures/mobilites-m-grenoble-crolles-2026-10-30.json');
test('decoded provider geometry preserves geographical coordinates and rejects truncated or invalid shapes',()=>{
 const points=map.decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
 assert.deepEqual(points,[{lat:38.5,lon:-120.2},{lat:40.7,lon:-120.95},{lat:43.252,lon:-126.453}]);
 assert.deepEqual(map.decode('_p~iF'),[]);assert.deepEqual(map.decode('!'),[]);
});
test('stop-only results never invent a route between endpoints',()=>{
 const result=map.model({legs:[{from:'Annecy',to:'Genève',fromPoint:{lat:45.9,lon:6.12},toPoint:{lat:46.2,lon:6.14},serviceConfirmed:true}]});
 assert.equal(result.stops.length,2);assert.deepEqual(result.shapes,[]);assert.equal(result.missingGeometry,true);
});
test('invalid stop coordinates and geometry not matching stops are excluded',()=>{
 const result=map.model({legs:[{fromPoint:{lat:NaN,lon:6},toPoint:{lat:100,lon:7}},{mode:'WALK',fromPoint:{lat:45,lon:6},toPoint:{lat:46,lon:7},geometry:[{lat:40,lon:2},{lat:41,lon:3}]}]});
 assert.equal(result.stops.length,2);assert.equal(result.shapes.length,0);
});
test('recorded regional shapes and coordinates survive the real parser and adapter',()=>{
 const parsed=fixture.response.plan.itineraries.map(regional.parseItinerary);
 const models=adapters.adaptRegional(parsed).map(map.model);
 assert.ok(models.some(x=>x.stops.length>=2));assert.ok(models.some(x=>x.shapes.length>0));
});
test('supplied walking geometry remains distinct from transit and duplicate stops do not duplicate markers',()=>{
 const a={lat:45.9,lon:6.1},b={lat:45.901,lon:6.101};
 const result=map.model({legs:[{mode:'WALK',from:'A',to:'B',fromPoint:a,toPoint:b,geometry:[a,b]},{mode:'BUS',from:'B',to:'C',fromPoint:b,toPoint:{lat:45.92,lon:6.2}}]});
 assert.equal(result.stops.length,3);assert.equal(result.shapes[0].kind,'walk');assert.equal(result.missingGeometry,true);
});
