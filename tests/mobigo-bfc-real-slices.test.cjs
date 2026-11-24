'use strict';
// End-to-end checks run after official Mobigo and first-ring urban BFC feeds refresh.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const loader=require('../transport-gtfs-loader.js'),indexer=require('../transport-gtfs-index.js');
const hub=require('../transport-mission-hub.js');
const feeds=[
 ['mobigo39','mobigo-39-jura.zip'],['mobigo58','mobigo-58-nievre.zip'],
 ['mobigo21','mobigo-21-cote-dor.zip'],['mobigo25','mobigo-25-doubs.zip'],
 ['mobigo89','mobigo-89-yonne.zip'],['mobigo70','mobigo-70-haute-saone.zip'],
 ['mobigo71','mobigo-71-saone-et-loire.zip'],
 ['divia','divia-dijon.zip'],['ginko','ginko-besancon.zip'],
 ['evolity','evolity-montbeliard.zip'],
 ['zoom','zoom-chalon.zip'],['monrezo','monrezo-creusot-montceau.zip'],
 ['leo','leo-auxerre.zip'],['taneo','taneo-nevers.zip'],
 ['intercom','intercom-sens.zip'],['grandole','grandole-dole.zip'],
 ['cote_bus','cote-bus-beaune.zip'],['moova','moova-vesoul.zip'],
 ['ca_roule','ca-roule-autun.zip'],['papillon','papillon-cosne.zip'],
 ['ecla','ecla-lons.zip']
];
const bounds={
 mobigo39:[46.25,5.2,47.0,6.25],mobigo58:[46.55,2.75,47.75,4.35],
 mobigo21:[46.65,3.95,48.0,5.65],mobigo25:[46.6,5.55,47.75,7.15],
 mobigo89:[47.2,2.75,48.45,4.5],mobigo70:[47.15,5.25,48.05,7.15],
 mobigo71:[46.1,3.55,47.05,5.55],
 divia:[47.24,4.96,47.39,5.12],ginko:[47.15,5.90,47.32,6.10],
 evolity:[47.40,6.70,47.60,6.95],zoom:[46.74,4.78,46.86,4.92],
 monrezo:[46.61,4.30,46.85,4.49],leo:[47.76,3.48,47.88,3.64],
 taneo:[46.96,3.07,47.06,3.20],intercom:[48.16,3.23,48.23,3.34],
 grandole:[47.02,5.42,47.12,5.53],cote_bus:[46.98,4.78,47.08,4.90],
 moova:[47.59,6.10,47.68,6.19],ca_roule:[46.90,4.24,47.02,4.39],
 papillon:[47.36,2.85,47.46,3.00],ecla:[46.63,5.48,46.72,5.64]
};
const requireArchives=process.env.REQUIRE_REAL_GTFS==='1';

for(const [id,file] of feeds){
 test(`${id}: un horaire GTFS réel est proposé par le fournisseur de mission`,
  {skip:!requireArchives&&!fs.existsSync(path.join(__dirname,'..','data','gtfs',file))},async()=>{
   const archive=fs.readFileSync(path.join(__dirname,'..','data','gtfs',file));
   // The loader caps indexed service dates at seven; test the next service week.
   const dates=Array.from({length:7},(_,offset)=>{
    const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
   });
   const feed=await loader.loadResource({format:'GTFS',url:'https://example.org/'+file},
    {fetcher:async()=>new Response(archive),indexServiceDates:dates,retainSourceTables:true});
   let sample=null;
   for(const date of dates){
    const trips=indexer.scheduledTrips(feed.files,feed.index,date);
    for(const trip of trips){
     const stops=trip.stops.map(s=>{const stop=feed.index.stopById.get(s.stopId);return {...s,lat:Number(stop?.stop_lat),lon:Number(stop?.stop_lon)};})
      .filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon));
     for(let i=0;i<stops.length&&!sample;i++)for(let j=i+1;j<stops.length;j++){
      if(stops[i].stopId===stops[j].stopId)continue;
      const b=bounds[id],inside=s=>s.lat>=b[0]&&s.lat<=b[2]&&s.lon>=b[1]&&s.lon<=b[3];
      if(!inside(stops[i])||!inside(stops[j]))continue;
      const journeys=indexer.nearbyDirectTrips(feed.files,feed.index,date,
       {lat:stops[i].lat,lon:stops[i].lon},{lat:stops[j].lat,lon:stops[j].lon},100);
      if(journeys.length){sample={date,from:stops[i],to:stops[j],row:journeys[0]};break;}
     }
     if(sample)break;
    }
    if(sample)break;
   }
   assert.ok(sample,`${id}: aucun trajet actif et indexable trouvé dans les 7 prochains jours`);
   const providers=hub.makeProviders({CPGTFSLoader:loader,CPGTFSIndex:indexer},{
    fetcher:async()=>new Response(archive,{headers:{'content-type':'application/zip'}})
   });
   const provider=providers['local_'+id];
   assert.ok(provider,`${id}: fournisseur non raccordé à makeProviders()`);
   const task={
    from:{lat:sample.from.lat,lon:sample.from.lon},to:{lat:sample.to.lat,lon:sample.to.lon},
    earliestDeparture:sample.date+'T00:00:00Z'
   };
   assert.equal(provider.enabled(task),true,`${id}: paire de test hors de l'emprise activée`);
   const results=await provider.run(task);
   const expectedNetwork=provider.name.replace(/ GTFS$/,'');
   const deadline=sample.date+'T22:00:00Z';
   const arrivalTask={from:task.from,to:task.to,latestArrival:deadline,marginMinutes:0};
   assert.equal(provider.enabled(arrivalTask),true);
   const arrivals=await provider.run(arrivalTask);
   assert.ok(arrivals.length>0, id+': aucun résultat arriver avant');
   for(const journey of arrivals){
    assert.ok(Date.parse(journey.legs.at(-1).arrival)<=Date.parse(deadline),
     id+': arrivée après échéance');
   }
   assert.ok(results.some(j=>j.legs?.some(l=>l.provider===expectedNetwork)),`${id}: trajet non proposé à la fiche mission`);
  });
}
