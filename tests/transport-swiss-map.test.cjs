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
test('empty coordinate search falls back to nearby stops, preserving unconfirmed access and fare',async()=>{
 const from={lat:46.368608,lon:6.479809},to={lat:46.201862,lon:6.152813},calls=[];
 const station=(id,point)=>({id,coordinate:{type:'WGS84',x:point.lat,y:point.lon}});
 const connection={from:{departure:'2026-11-09T08:25:00+0100'},to:{arrival:'2026-11-09T09:25:00+0100'},sections:[{journey:{category:'B',number:'271'},departure:{station:{name:'Thonon-les-Bains, Les Arts',...station('1402653',from)}},arrival:{station:{name:'Genève, Rive',...station('8587061',to)}}}]};
 const fetcher=async input=>{const u=new URL(input);calls.push(u);
  if(u.pathname.endsWith('/locations')){const at=Number(u.searchParams.get('x'));return {ok:true,json:async()=>({stations:[at>46.3?station('1402653',from):station('8587061',to)]})};}
  return {ok:true,json:async()=>({connections:u.searchParams.get('from')==='1402653'?[connection]:[]})};
 };
 const result=await swiss.plan({from,to,when:'2026-11-09T08:00:00+01:00',fetcher});
 assert.equal(calls.length,4);assert.equal(result.length,1);assert.equal(result[0].sections[0].line,'271');assert.equal(result[0].nearestStopFallback,true);
 const [choice]=rank(adaptSwiss(result),{includeAlternatives:true});assert.equal(choice.journey.feasible,false);assert.equal(choice.journey.priceEUR,null);
});
test('nearby stop fallback rejects distant stations and keeps empty results',async()=>{
 const point={lat:46.3686,lon:6.4798};let calls=0;
 const result=await swiss.plan({from:point,to:{lat:46.2018,lon:6.1528},when:'2026-11-09T08:00:00+01:00',fetcher:async input=>{
  calls++;return {ok:true,json:async()=>new URL(input).pathname.endsWith('/locations')?{stations:[{id:'123',coordinate:{type:'WGS84',x:45,y:5}}]}:{connections:[]}};
 }});
 assert.equal(result.length,0);assert.equal(calls,3);assert.equal(result.diagnostic.nearestStopFallback,undefined);
});
