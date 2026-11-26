'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const journeys=require('../transport-national-gtfs-journeys.js');
const corridors=[
 ['lyon-dijon',[45.7606,4.8593],[47.323,5.027]],
 ['bourg-besancon',[46.205,5.216],[47.247,6.021]],
 ['grenoble-gap',[45.1914,5.7143],[44.565,6.079]],
 ['clermont-bourges',[45.779,3.101],[47.094,2.394]],
 ['clermont-millau',[45.779,3.101],[44.101,3.078]]
];
for(const [slug,a,b] of corridors)test(slug+' actual GTFS journey search',async()=>{
 let count=0;
 for(const operator of ['sncf','flixbus','blablacarBus']){
  const file='national-'+operator+'-'+slug+'.zip';
  const bytes=fs.readFileSync(path.join(__dirname,'..','data','gtfs',file));
  const resource={url:'https://example.org/'+file,format:'GTFS'};
  for(const [from,to] of [[a,b],[b,a]]){
   const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
   const result=await journeys.loadAndSearch({operator,resource,fetcher:async()=>new Response(bytes),date,from:{lat:from[0],lon:from[1]},to:{lat:to[0],lon:to[1]},radiusMeters:5000,maxResults:20,includeTransfers:true});
   assert.ok(Array.isArray(result.journeys));
   count+=result.journeys.length;
  }
 }
 assert.ok(count>0,'No actual journeys on test date for '+slug);
});
