const {test}=require('node:test'),assert=require('node:assert/strict');
const api=require('../transport-271-fares.js'),swiss=require('../swiss-transport-api.js'),{adaptSwiss}=require('../transport-adapters.js'),{rank}=require('../transport-ranking.js');
const stop=(id,lat,lon)=>({id,coordinate:{type:'WGS84',x:lat,y:lon}});
const thonon=stop('1402653',46.368608,6.479809),geneva=stop('8587061',46.201862,6.152813);
const section=(a=thonon,b=geneva)=>({journey:{category:'B',number:'271'},departure:{departure:'2026-11-09T08:25:00+0100',station:a},arrival:{arrival:'2026-11-09T09:25:00+0100',station:b}});
async function itinerary(leg=section()){
 const data={connections:[{from:{departure:'2026-11-09T08:25:00+0100'},to:{arrival:'2026-11-09T09:25:00+0100'},sections:[leg]}]};
 return (await swiss.plan({from:'Thonon',to:'Genève',when:'2026-11-09T08:00:00+01:00',fetcher:async()=>({ok:true,json:async()=>data})}))[0];
}
test('271 direct Thonon–Geneva gets a sourced reference but not a verified price',async()=>{
 const row=await itinerary();assert.equal(row.sections[0].fromId,'1402653');assert.equal(row.sections[0].toId,'8587061');
 const fare=api.reference(row);assert.equal(fare.amount,10.3);assert.equal(fare.source,api.SOURCE);assert.equal(fare.fareVerified,false);
 const [journey]=adaptSwiss([row]);journey.directFareReference=fare;const [choice]=rank([journey],{includeAlternatives:true});
 assert.equal(choice.journey.priceEUR,null);assert.equal(choice.journey.feasible,false);
 assert.equal(api.reference(await itinerary(section(geneva,thonon))).amount,10.3);
});
test('271 references obey stop identity, position, mode and date',async()=>{
 const row=await itinerary();const leg=row.sections[0];
 for(const bad of [{...leg,line:'272'},{...leg,mode:'WALK'},{...leg,fromId:'missing'},{...leg,fromPoint:{lat:47,lon:6.479809}}])assert.equal(api.reference({...row,sections:[bad]}),null);
 assert.equal(api.reference({...row,sections:[leg,leg]}),null);
 assert.equal(api.reference({...row,detailsIncomplete:true}),null);
 assert.equal(api.reference({...row,sections:[{...leg,departure:'2026-12-13T08:00:00+01:00'}]}),null);
 const veigy=await itinerary(section(stop('1400014',46.283318,6.258572),geneva));assert.equal(api.reference(veigy),null);
 const douvaine=await itinerary(section(stop('1400608',46.306153,6.302499),geneva));assert.equal(api.reference(douvaine).amount,6.6);
});
