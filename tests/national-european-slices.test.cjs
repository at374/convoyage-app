'use strict';
// Tests on the real AURA extracts of the official Eurostar and Trenitalia GTFS feeds.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const journeys=require('../transport-national-gtfs-journeys.js');
const hub=require('../transport-mission-hub.js');

async function search(operator,date,from,to){
 const zip=path.join(__dirname,'..','data','gtfs',`national-${operator}-aura.zip`);
 const result=await journeys.loadAndSearch({operator,resource:{url:`https://example.org/${operator}.zip`,format:'GTFS'},
  fetcher:async()=>new Response(fs.readFileSync(zip),{status:200,headers:{'content-type':'application/zip'}}),
  date,from,to,radiusMeters:3000,maxResults:20});
 return result.journeys;
}

test('Eurostar AURA slice returns the scheduled Chambéry → Aime winter service',async()=>{
 const rows=await search('eurostar','2026-12-19',{lat:45.5719,lon:5.9196},{lat:45.5544,lon:6.6487});
 assert.ok(rows.length>0);
 assert.equal(rows[0].departure,'10:59:00');
 assert.equal(rows[0].arrival,'12:29:00');
 assert.equal(rows[0].serviceConfirmed,false);
 assert.equal(rows[0].priceEUR,null);
 const mission=hub.fromNationalGTFS(rows,'eurostar')[0];
 assert.equal(mission.legs[0].mode,'Train');
 assert.equal(hub.ticketLinks(mission)[0].url,'https://www.eurostar.com/');
});

test('Trenitalia AURA slice returns scheduled Lyon station services with unknown fares',async()=>{
 const rows=await search('trenitalia','2026-11-25',{lat:45.76,lon:4.8597},{lat:45.7483,lon:4.8256});
 assert.ok(rows.length>0);
 assert.equal(rows[0].departure,'05:08:00');
 assert.equal(rows[0].arrival,'05:16:00');
 assert.equal(rows[0].serviceConfirmed,false);
 assert.equal(rows[0].priceEUR,null);
 const mission=hub.fromNationalGTFS(rows,'trenitalia')[0];
 assert.equal(mission.legs[0].mode,'Train');
 assert.equal(hub.ticketLinks(mission)[0].url,'https://www.trenitalia.com/');
});

test('mission hub exposes Eurostar and Trenitalia only when their feeds are supplied',()=>{
 const providers=hub.makeProviders({CPNationalGTFSJourneys:{loadAndSearch:async()=>({journeys:[]})}},
  {nationalGTFSResources:{eurostar:{url:'https://example.org/eurostar.zip'},trenitalia:{url:'https://example.org/ti.zip'}}});
 assert.equal(providers.national_eurostar.name,'Eurostar GTFS');
 assert.equal(providers.national_trenitalia.name,'Trenitalia GTFS');
 assert.equal(providers.national_sncf,undefined);
});
