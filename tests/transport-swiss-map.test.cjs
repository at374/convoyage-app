const {test}=require('node:test'),assert=require('node:assert/strict');
const swiss=require('../swiss-transport-api.js'),{adaptSwiss}=require('../transport-adapters.js');
const {rank}=require('../transport-ranking.js'),map=require('../transport-map.js');
test('Swiss stop coordinates reach comparison map without inventing fares or geometry',async()=>{
 const data={connections:[{from:{departure:'2026-11-07T11:10:00+01:00'},to:{arrival:'2026-11-07T12:00:00+01:00'},sections:[{
  journey:{category:'RE',number:'33'},departure:{departure:'2026-11-07T11:10:00+01:00',station:{name:'Genève',coordinate:{type:'WGS84',x:46.21,y:6.14}}},
  arrival:{arrival:'2026-11-07T12:00:00+01:00',station:{name:'Lausanne',coordinate:{type:'WGS84',x:46.52,y:6.63}}}
 }]}]};
 const raw=await swiss.plan({from:'Genève',to:'Lausanne',when:'2026-11-07T11:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>data})});
 const adapted=adaptSwiss(raw),choices=rank(adapted,{includeAlternatives:true,direction:'return',earliestDeparture:'2026-11-07T11:00:00+01:00'});
 assert.equal(choices.length,1);assert.equal(choices[0].journey.priceEUR,null);assert.equal(choices[0].journey.feasible,false);
 const display=map.model(choices[0].journey);assert.equal(display.stops.length,2);assert.equal(display.shapes.length,0);assert.equal(display.missingGeometry,true);
 assert.deepEqual(display.stops.map(s=>s.name),['Genève','Lausanne']);
});
test('unknown coordinate systems and malformed coordinates never become map points',async()=>{
 const station=coordinate=>({name:'Arrêt',coordinate});
 const result=await swiss.plan({from:'A',to:'B',when:'2026-11-07T10:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>({connections:[{from:{departure:'2026-11-07T10:01:00+01:00'},to:{arrival:'2026-11-07T10:10:00+01:00'},sections:[{departure:{station:station({type:'LV95',x:46,y:6})},arrival:{station:station({type:'WGS84',x:'',y:6})}}]}]})})});
 assert.equal(map.model(adaptSwiss(result)[0]).stops.length,0);
});
