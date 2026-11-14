const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../transport-mission-hub.js');
const T=require('../transport-tripgo.js');
const R=require('../regional-routing.js');
const W=require('../transport-walking.js');
const tripgoFixture=require('./fixtures/tripgo-annecy-grenoble-2026-10-31.json');
const mFixture=require('./fixtures/mobilites-m-grenoble-crolles-2026-10-30.json');
const valhallaFixture=require('./fixtures/valhalla-annecy-pedestrian-2026-10-30.json');

// Routeur piéton de test : chemin = 1,3 × distance, 1,2 m/s. Ne remplace jamais Valhalla en production.
function fakeRouter({factor=1.3,fail=false}={}){
 const calls=[];
 return {calls,route:async(a,b)=>{calls.push([a,b]);if(fail)return {status:'unavailable'};
  const d=H.meters(a,b)*factor;return {status:'calculated',distanceMeters:d,durationSeconds:Math.round(d/1.2),geometry:[a,b],from:a,to:b,endpointsMatched:true};}};
}
const at=(h,m,day='2026-11-16')=>new Date(day+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00+01:00').toISOString();
function bus(dep,arr,from,to,extra={}){return {kind:'transit',mode:'Bus',line:extra.line||'1',provider:extra.provider||'Réseau test',from:extra.fromName||'A',to:extra.toName||'B',
 fromPoint:from,toPoint:to,departure:dep,arrival:arr,fare:extra.fare||null};}
const HOME={lat:45.9000,lon:6.1200},STOP1={lat:45.9020,lon:6.1200},STOP2={lat:45.9900,lon:6.1200},MISSION={lat:45.9920,lon:6.1200};

test('TripGo réel (fixture 31/10) : marches fournies, cars FlixBus/BlaBlaCar, points conservés',()=>{
 const when=new Date(1793610000*1000).toISOString();
 const parsed=T.parse(tripgoFixture.response,{from:{lat:45.9019,lon:6.1218},to:{lat:45.1914,lon:5.7143},when});
 const js=H.fromTripGo(parsed);
 assert.equal(js.length,2);
 for(const j of js){
  assert.equal(j.legs[0].kind,'walk');assert.equal(j.legs.at(-1).kind,'walk');
  assert.equal(j.legs[1].mode,'Car');assert.ok(j.legs.every(l=>l.fromPoint&&l.toPoint));
 }
 assert.match(js[1].legs[1].line,/FlixBus 1789/);
});

test('Mobilités M réel (fixture 30/10) : réseau M Réso, arrêts géolocalisés',()=>{
 const its=mFixture.response.plan.itineraries.map(it=>R.parseItinerary({...it,numberOfTransfers:it.transfers,legs:it.legs.map(l=>({...l,route:{shortName:l.routeShortName||''}}))}));
 const js=H.fromRegional(its);
 assert.ok(js.length>=3);
 const ride=js[0].legs.find(l=>l.kind!=='walk');
 assert.equal(ride.provider,'M Réso - Métropole Grenobloise');assert.ok(ride.fromPoint&&ride.toPoint);assert.equal(ride.line,'C1');
});

test('Valhalla réel (fixture 30/10) accepté comme marche calculée',async()=>{
 const [a,b]=valhallaFixture.request.locations;
 const route=W.validateValhalla(valhallaFixture.response,a,b);
 const j={source:'x',sources:['x'],legs:[{...bus(at(8,0),at(8,30),{lat:b.lat,lon:b.lon},STOP2),kind:'transit'}].map(l=>({...l,fromPoint:{lat:b.lat,lon:b.lon}}))};
 const router={route:async()=>route};
 const done=await H.completeWalks(j,{from:a,to:STOP2},router);
 assert.equal(done.legs[0].kind,'walk');assert.equal(done.legs[0].walkSource,'valhalla');assert.equal(done.legs[0].distanceMeters,260);
});

test('Suisse : sections walk retirées, bateaux exclus, retards conservés',()=>{
 const js=H.fromSwiss([
  {sections:[{mode:'WALK',from:'x',to:'Annemasse',walkSeconds:null},{mode:'S',category:'S',line:'2',from:'Annemasse',to:'Genève',fromPoint:{lat:46.199,lon:6.236},toPoint:{lat:46.210,lon:6.142},departure:'2026-11-16T07:40:00+0100',arrival:'2026-11-16T07:55:00+0100',delay:3,operator:'SBB'}]},
  {sections:[{mode:'BAT',from:'Genève',to:'Nyon',departure:'2026-11-16T08:00:00+0100',arrival:'2026-11-16T08:50:00+0100'}]}
 ]);
 assert.equal(js.length,1);assert.equal(js[0].legs.length,1);
 assert.equal(js[0].legs[0].mode,'Train');assert.equal(js[0].legs[0].delayMinutes,3);
 assert.equal(js[0].legs[0].departure,'2026-11-16T06:40:00.000Z');
});

test('marches d’approche et finale ajoutées ; Réalisable avec 15 min de marge',async()=>{
 const task={label:'Aller',from:HOME,to:MISSION,latestArrival:at(9,0)};
 const j={source:'GTFS',sources:['GTFS'],legs:[bus(at(8,0),at(8,30),STOP1,STOP2)]};
 const x=H.assess(await H.completeWalks(j,task,fakeRouter()),task);
 assert.equal(x.legs.length,3);assert.equal(x.legs[0].kind,'walk');assert.equal(x.legs[2].kind,'walk');
 assert.ok(x.slackMinutes>=15,'avance '+x.slackMinutes);assert.equal(x.feasible,true);assert.equal(x.status,'Réalisable');
});

test('marge insuffisante ou marche impossible => Transport non confirmé avec raison',async()=>{
 const task={label:'Aller',from:HOME,to:MISSION,latestArrival:at(8,40)};
 const j={source:'GTFS',sources:['GTFS'],legs:[bus(at(8,0),at(8,30),STOP1,STOP2)]};
 const x=H.assess(await H.completeWalks(j,task,fakeRouter()),task);
 assert.equal(x.feasible,false);assert.match(x.statusDetail,/marge insuffisante/);
 const y=H.assess(await H.completeWalks(j,{...task,latestArrival:at(10,0)},fakeRouter({fail:true})),task);
 assert.equal(y.feasible,false);assert.match(y.statusDetail,/non calculée/);
});

test('marge réduite à 5 min seulement si GPS exact confirmé et autorisé',()=>{
 assert.equal(H.marginFor({}),15);
 assert.equal(H.marginFor({exactTarget:true}),15);
 assert.equal(H.marginFor({exactTarget:true,allowShortMargin:true}),5);
 assert.equal(H.marginFor({marginMinutes:30}),30);
});

test('correspondance : marche réelle recalculée, trop courte signalée',async()=>{
 const S3={lat:45.9500,lon:6.1200},S4={lat:45.9540,lon:6.1200};// ~445 m
 const task={label:'Jonction',from:STOP1,to:MISSION,earliestDeparture:at(7,50),latestArrival:at(10,0)};
 const j={source:'t',sources:['t'],legs:[bus(at(8,0),at(8,20),STOP1,S3,{toName:'Gare'}),bus(at(8,22),at(8,40),S4,STOP2,{fromName:'Gare routière'})]};
 const x=H.assess(await H.completeWalks(j,task,fakeRouter()),task);
 assert.equal(x.feasible,false);assert.match(x.statusDetail,/correspondance trop courte/);
 assert.ok(x.legs.some(l=>l.kind==='walk'&&l.from==='Gare'));
});

test('trajet à pied : proposé ≤ 3 km de marche réelle, refusé si le chemin réel dépasse le seuil',async()=>{
 const near={lat:45.9200,lon:6.1200};// 2,2 km à vol d’oiseau
 const task={label:'Aller',from:HOME,to:near,latestArrival:at(9,0)};
 const ok=await H.walkOnly(task,fakeRouter({factor:1.2}),3);
 assert.ok(ok&&ok.walkOnly);const x=H.assess(ok,task);assert.equal(x.feasible,true);assert.equal(x.price.label,'Gratuit (à pied)');
 assert.equal(await H.walkOnly(task,fakeRouter({factor:1.5}),3),null,'3,3 km réels > 3 km');
 assert.equal(await H.walkOnly(task,fakeRouter(),2),null,'seuil configurable');
 const far=fakeRouter();assert.equal(await H.walkOnly({...task,to:STOP2},far,3),null);assert.equal(far.calls.length,0,'pas de requête inutile');
});

test('tarifs : EUR et CHF séparés, jamais convertis ; tarif manquant => Prix à confirmer + source',()=>{
 const mk=legs=>({legs});
 const p=H.priceOf(mk([{kind:'transit',provider:'TPG',fare:{amount:3,currency:'CHF',source:'tpg.ch'}},{kind:'transit',provider:'TAC',fare:{amount:1.6,currency:'EUR',source:'tac'}}]));
 assert.equal(p.status,'verified');assert.equal(p.label,'1,60 € + 3,00 CHF');
 const q=H.priceOf(mk([{kind:'transit',provider:'SNCF',line:'TER'}]));
 assert.equal(q.status,'unknown');assert.equal(q.label,'Prix à confirmer');assert.deepEqual(q.missingSources,['SNCF TER']);
 const r=H.priceOf(mk([{kind:'transit',provider:'X',fare:{amount:2,currency:'USD',source:'?'}}]));assert.equal(r.status,'unknown');
});

test('classement : moins cher / compromis / plus rapide, fusion des doublons entre moteurs',()=>{
 const base=(dep,arr,fare,src)=>H.assess({source:src,sources:[src],legs:[bus(dep,arr,STOP1,STOP2,{line:'X',fare})],missing:[]},{latestArrival:at(12,0)});
 const cheap=base(at(8,0),at(9,30),{amount:2,currency:'EUR',source:'grille'},'GTFS');
 const fast=base(at(8,0),at(8,30),null,'TripGo');
 const dupFast=base(at(8,0),at(8,30),null,'Suisse');
 const r=H.rank([cheap,fast,dupFast]);
 assert.equal(r.total,2);
 const labels=Object.fromEntries(r.picks.flatMap(p=>p.labels.map(l=>[l,p.journey])));
 assert.equal(labels['Moins cher'].price.label,'2,00 €');
 assert.equal(labels['Plus rapide'].durationMinutes,30);
 assert.deepEqual(labels['Plus rapide'].sources.sort(),['Suisse','TripGo']);
 assert.ok(labels['Meilleur compromis']);
});

test('session : moteurs en parallèle, ingestion GTFS, erreurs et moteurs ignorés visibles',async()=>{
 const updates=[];
 const providers={
  ok:{name:'Moteur A',enabled:()=>true,run:async()=>[{source:'A',sources:['A'],legs:[bus(at(8,0),at(8,30),STOP1,STOP2)]}]},
  ko:{name:'Moteur B',enabled:()=>true,run:async()=>{throw new Error('HTTP 503');}},
  off:{name:'TripGo',enabled:()=>false,disabledReason:'clé TripGo absente'}
 };
 const s=H.createSession({tasks:[{label:'Aller',from:HOME,to:MISSION,latestArrival:at(9,30)}],providers,router:fakeRouter(),onUpdate:(l,v)=>updates.push(v)});
 await s.ingest('Aller','GTFS',H.fromGTFS([{network:'Sibra',line:'5',departure:at(8,5),arrival:at(8,35),originStop:{name:'A',...STOP1},destinationStop:{name:'B',...STOP2}}]));
 await new Promise(r=>setTimeout(r,20));
 const v=s.view('Aller');
 assert.equal(v.done,true);assert.equal(v.total,2);
 assert.equal(v.errors['Moteur B'],'HTTP 503');assert.equal(v.skipped.TripGo,'clé TripGo absente');
 assert.ok(v.picks.length>=1&&v.picks.every(p=>p.journey.feasible));
 s.dispose();
});

test('fenêtres de requête : aller en heure d’arrivée (limite − marge), retour en heure de départ',()=>{
 assert.deepEqual(H.queryWindow({latestArrival:at(9,0)}),{when:at(8,45),arriveBy:true});
 assert.deepEqual(H.queryWindow({earliestDeparture:at(17,0),latestArrival:at(19,0)}),{when:at(17,0),arriveBy:false});
 assert.equal(H.inSwissArea({lat:46.19,lon:6.23}),true,'Annemasse');
 assert.equal(H.inSwissArea({lat:45.76,lon:4.84}),false,'Lyon');
 assert.equal(H.inSwissArea({lat:45.90,lon:6.12}),false,'Annecy');
});

test('moteur trop lent : délai borné, les autres résultats restent affichés ; courses annulées écartées',async()=>{
 const providers={
  slow:{name:'Lent',enabled:()=>true,run:()=>new Promise(()=>{})},
  ok:{name:'Rapide',enabled:()=>true,run:async()=>[
   {source:'R',sources:['R'],legs:[bus(at(8,0),at(8,30),STOP1,STOP2)]},
   {source:'R',sources:['R'],legs:[{...bus(at(8,10),at(8,40),STOP1,STOP2,{line:'Z'}),cancelled:true}]}]}
 };
 const s=H.createSession({tasks:[{label:'Aller',from:HOME,to:MISSION,latestArrival:at(9,30)}],providers,router:fakeRouter(),timeoutMs:50});
 await new Promise(r=>setTimeout(r,120));
 const v=s.view('Aller');
 assert.equal(v.done,true);assert.match(v.errors.Lent,/délai fournisseur dépassé/);
 assert.equal(v.total,1);s.dispose();
});

test('tarif Y51 officiel appliqué via la grille du dépôt (zones prouvées) ; autre ligne => Prix à confirmer',()=>{
 globalThis.CPTY51Fares=require('../transport-y51-fares.js');
 const Grids=require('../transport-fare-grids.js');
 const data=require('./fixtures/y51-tariff-reference-2026-10-31.json');
 const pin=name=>{const s=data.stops.find(x=>x[4]===name);return {stopId:s[0],lat:s[1],lon:s[2],name:s[4]};};
 const a=pin('Gare Routiere'),b=pin('Ecole Saint-François');
 const raw={networkId:'oura-haute-savoie',line:'Y51',tripId:'t1',from:a.stopId,to:b.stopId,departure:'2026-11-16T10:00:00+01:00',arrival:'2026-11-16T11:30:00+01:00'};
 raw.fareScopePath={...raw,stops:[a,b]};
 const [j]=H.fromGTFS([{...raw,network:'Cars Région 74',originStop:{...a},destinationStop:{...b}}]);
 const p=H.priceOf(j,Grids.fareFor);
 assert.equal(p.status,'verified');assert.equal(p.amounts.EUR,8.9);assert.match(p.sources[0],/grille officielle AURA/);
 const [k]=H.fromGTFS([{...raw,line:'Y62',fareScopePath:{...raw.fareScopePath,line:'Y62'},originStop:{...a},destinationStop:{...b}}]);
 assert.equal(H.priceOf(k,Grids.fareFor).status,'unknown');
 delete globalThis.CPTY51Fares;
});

test('Sibra : 2,00 € officiel (CGV 01/07/2026), correspondance dans l’heure non repayée, hors période => à confirmer',()=>{
 const Grids=require('../transport-fare-grids.js');
 const sib=(dep,arr,line)=>({kind:'transit',mode:'Bus',provider:'Sibra',line,departure:dep,arrival:arr});
 const one=H.priceOf({legs:[sib(at(8,0),at(8,20),'1'),sib(at(8,30),at(8,50),'6')]},Grids.fareFor);
 assert.equal(one.status,'verified');assert.equal(one.label,'2,00 €');
 const two=H.priceOf({legs:[sib(at(8,0),at(8,50),'1'),sib(at(9,5),at(9,20),'6')]},Grids.fareFor);
 assert.equal(two.label,'4,00 €','nouvelle montée après 1 h');
 const old=H.priceOf({legs:[sib('2026-06-15T08:00:00.000Z','2026-06-15T08:20:00.000Z','1')]},Grids.fareFor);
 assert.equal(old.status,'unknown','avant le 01/07/2026 : pas de prix');
 assert.equal(H.priceOf({legs:[{...sib(at(8,0),at(8,20),'1'),provider:'Sibra Express Lyon'}]},Grids.fareFor).status,'unknown','nom exact requis');
 assert.equal(H.priceOf({legs:[{...sib(at(8,0),at(8,20),'1'),mode:'Train'}]},Grids.fareFor).status,'unknown','mode incompatible');
});

test('chaîne Suisse complète : plan() au format documenté (x = lat, y = lon, +0100) → hub → marches → Réalisable',async()=>{
 const S=require('../swiss-transport-api.js');
 const st=(name,lat,lon)=>({name,coordinate:{type:'WGS84',x:lat,y:lon}});
 const body={connections:[{from:{departure:'2026-11-16T07:40:00+0100',station:st('Annemasse',46.1993,6.2366)},to:{arrival:'2026-11-16T07:55:00+0100',station:st('Genève-Eaux-Vives',46.2003,6.1662)},
  sections:[{walk:{duration:null},departure:{station:null,location:{coordinate:{x:46.1980,y:6.2390}}},arrival:{station:st('Annemasse',46.1993,6.2366)}},
   {journey:{category:'SL',number:'2',operator:'SNCF'},departure:{station:st('Annemasse',46.1993,6.2366),departure:'2026-11-16T07:40:00+0100',delay:2},arrival:{station:st('Genève-Eaux-Vives',46.2003,6.1662),arrival:'2026-11-16T07:55:00+0100'}}]}]};
 let url='';const res=await S.plan({from:{lat:46.1980,lon:6.2390},to:{lat:46.2010,lon:6.1640},when:'2026-11-16T07:30:00+01:00',fetcher:async u=>{url=u;return {ok:true,json:async()=>body};}});
 assert.match(url,/from=46\.198%2C6\.239/);
 const [j]=H.fromSwiss(res);
 assert.equal(j.legs.length,1);assert.deepEqual(j.legs[0].fromPoint,{lat:46.1993,lon:6.2366});assert.equal(j.legs[0].delayMinutes,2);
 assert.equal(j.legs[0].line,'SL 2');
 const task={label:'Aller',from:{lat:46.1980,lon:6.2390},to:{lat:46.2010,lon:6.1640},latestArrival:at(8,30)};
 const x=H.assess(await H.completeWalks(j,task,fakeRouter()),task);
 assert.equal(x.legs[0].kind,'walk');assert.equal(x.legs.at(-1).kind,'walk');
 assert.equal(x.feasible,true,x.statusDetail);assert.equal(x.price.status,'unknown');assert.match(x.price.missingSources[0],/SNCF/);
});

test('M réso : 2,00 € officiel au 01/09/2026, une seule fois dans l’heure, sur les vrais noms Mobilités M et GTFS',()=>{
 const Grids=require('../transport-fare-grids.js');
 const its=mFixture.response.plan.itineraries.map(it=>R.parseItinerary({...it,numberOfTransfers:it.transfers,legs:it.legs.map(l=>({...l,route:{shortName:l.routeShortName||''}}))}));
 // La réponse réelle date du 30/10/2026 : après le 01/09/2026, donc prix applicable.
 const js=H.fromRegional(its);
 const p=H.priceOf(js[0],Grids.fareFor);
 assert.equal(js[0].legs.filter(l=>l.kind!=='walk').length,2,'C1 puis 80');
 assert.equal(p.status,'verified');assert.equal(p.label,'2,00 €','correspondance C1 → 80 dans l’heure : un seul titre');
 for(const name of ['M Réso — Métropole grenobloise','M Réso — Grésivaudan','M réso'])
  assert.equal(Grids.fareFor({kind:'transit',mode:'Bus',provider:name,departure:'2026-11-16T08:00:00.000Z'}).amount,2);
 assert.equal(Grids.fareFor({kind:'transit',mode:'Bus',provider:'M Réso — Métropole grenobloise',departure:'2026-08-15T08:00:00.000Z'}),null,'avant la grille');
 assert.equal(Grids.fareFor({kind:'transit',mode:'Train',provider:'M réso',departure:'2026-11-16T08:00:00.000Z'}),null,'TER exclu');
});

test('Ondéa : 1,70 € au 01/07/2026 sur les lignes régulières, lignes de car ≥ 100 exclues',()=>{
 const Grids=require('../transport-fare-grids.js');
 const leg=(line,day='2026-11-16')=>({kind:'transit',mode:'Bus',provider:'Ondéa Aix-les-Bains',line,departure:day+'T08:00:00.000Z'});
 assert.equal(Grids.fareFor(leg('2')).amount,1.7);
 assert.equal(Grids.fareFor(leg('DIM')).amount,1.7);
 assert.equal(Grids.fareFor(leg('104')),null,'ligne de proximité exclue');
 assert.equal(Grids.fareFor(leg('205')),null);
 assert.equal(Grids.fareFor(leg('2','2026-06-15')),null,'avant la grille 2026');
});

test('performance : doublons entre moteurs et trajets hors délai sans calcul de marche ; quota compté en couples d’arrêts ; affichage progressif',async()=>{
 const router=fakeRouter();const updates=[];
 const mk=(h,m,line='X')=>({source:'A',sources:['A'],legs:[bus(at(h,m),at(h,m+20),STOP1,STOP2,{line})]});
 const many=[];for(let i=0;i<12;i++)many.push(mk(7,i*2,'L'+i));// 12 trajets distincts, tous à l'heure
 const late=mk(9,10,'TARD');// arrive 9:30 > 9:30-15
 const providers={
  a:{name:'A',enabled:()=>true,run:async()=>[...many,late]},
  b:{name:'B',enabled:()=>true,run:async()=>new Promise(r=>setTimeout(()=>r([{...mk(7,0,'L0'),source:'B',sources:['B']}]),30))}
 };
 const s=H.createSession({tasks:[{label:'Aller',from:HOME,to:MISSION,latestArrival:at(9,30)}],providers,router:H.cachedRouter(router),onUpdate:(l,v)=>updates.push(v.total)});
 await new Promise(r=>setTimeout(r,150));
 const v=s.view('Aller');
 assert.equal(v.done,true);assert.equal(v.total,13,'12 + tardif (doublon B fusionné ; trop loin pour la marche seule)');
 // Arrêts identiques : avec le cache de marches (comme dans l'application), 12 trajets ne coûtent que 2 requêtes réelles.
 assert.ok(router.calls.length<=3,'appels marche réels : '+router.calls.length);
 const all=[...v.picks.map(p=>p.journey),...v.others];
 assert.ok(all.some(j=>j.sources.includes('A')&&j.sources.includes('B')),'doublon fusionné avec les deux sources');
 // 14/11/2026 : les 12 trajets partagent les deux mêmes arrêts → tous reçoivent leurs marches (2 couples de points).
 assert.ok(!all.some(j=>/quota/.test(j.statusDetail)),'mêmes arrêts : aucun trajet laissé sans marche');
 assert.ok(all.some(j=>j.legs[0].line==='TARD'&&/marge insuffisante|arrivée après/.test(j.statusDetail)));
 assert.ok(updates.length>=4,'mises à jour progressives : '+updates.length);
 s.dispose();
});

test('détour manifestement excessif écarté ; détour ferroviaire normal et GPS absent conservés',()=>{
 const task={from:{lat:45.9017,lon:6.1219},to:{lat:46.2102,lon:6.1424}}; // Annecy → Genève, 35 km directs
 const leg=(a,b)=>({mode:'Car',fromPoint:a,toPoint:b});
 const ANNECY={lat:45.9017,lon:6.1219},GENEVE={lat:46.2102,lon:6.1424},STE={lat:45.4434,lon:4.3997},ROCHE={lat:46.0667,lon:6.3117};
 assert.equal(H.excessiveDetour({legs:[leg(ANNECY,STE),leg(STE,GENEVE)]},task),true,'Annecy → Saint-Étienne → Genève');
 assert.equal(H.excessiveDetour({legs:[leg(ANNECY,ROCHE),leg(ROCHE,GENEVE)]},task),false,'par La Roche-sur-Foron');
 assert.equal(H.excessiveDetour({legs:[leg(ANNECY,GENEVE)]},task),false);
 assert.equal(H.excessiveDetour({legs:[{mode:'Car'}]},task),false,'sans GPS : conservé');
});

test('trois niveaux : horaire GTFS complet = « Horaire programmé », jamais « Réalisable » ni confondu avec un trajet incomplet',()=>{
 const task={from:STOP1,to:STOP2,latestArrival:at(9,30)};
 const ok={source:'A',sources:['A'],legs:[bus(at(7,0),at(7,20),STOP1,STOP2,{line:'L'})]};
 const sched=H.assess({...ok,missing:['horaire GTFS local non confirmé en temps réel']},task,null);
 assert.equal(sched.feasible,false);assert.equal(sched.scheduled,true);assert.match(sched.status,/Horaire programmé/);assert.doesNotMatch(sched.status,/Réalisable/);
 const national=H.assess({...ok,missing:['horaire GTFS non confirmé en temps réel','prix commercial et disponibilité non vérifiés']},task,null);
 assert.equal(national.scheduled,true);
 const broken=H.assess({...ok,missing:['horaire GTFS local non confirmé en temps réel','marche jusqu’à l’adresse exacte d’arrivée non calculée']},task,null);
 assert.equal(broken.scheduled,false);assert.equal(broken.status,'Transport non confirmé');
 const late=H.assess({...ok,legs:[bus(at(9,10),at(9,25),STOP1,STOP2,{line:'L'})],missing:['horaire GTFS local non confirmé en temps réel']},task,null);
 assert.equal(late.scheduled,false,'marge insuffisante : non confirmé');
 const full=H.assess({...ok,missing:[]},task,null);assert.equal(full.feasible,true);assert.equal(full.scheduled,false);
 const r=H.rank([broken,sched,full]);assert.equal(r.picks[0].journey.feasible,true);
 const r2=H.rank([broken,sched]);assert.equal(r2.picks.find(p=>p.labels.includes('Plus rapide')).journey.scheduled,true,'programmé classé avant non confirmé');
});

test('correspondance GTFS : ≥ 10 min programmées = réserve à confirmer ; plus courte = bloquante',()=>{
 const A={stop_name:'A',lat:45.90,lon:6.12},T={stop_name:'T',lat:45.80,lon:6.00},B={stop_name:'B',lat:45.76,lon:4.86};
 const row=(arr1,dep2)=>({operator:'sncf',date:'2026-11-16',originStop:A,destinationStop:B,transferStop:T,departure:'08:00',arrival:'10:00',
  legs:[{line:'K1',departure:'08:00',arrival:arr1},{line:'K2',departure:dep2,arrival:'10:00'}]});
 const long=H.fromNationalGTFS([row('08:40','08:55')],'sncf')[0],short=H.fromNationalGTFS([row('08:40','08:44')],'sncf')[0];
 assert.ok(long.missing.includes('correspondance programmée non confirmée en temps réel'));
 assert.ok(short.missing.includes('correspondance GTFS non confirmée'));
 const task={from:{lat:A.lat,lon:A.lon},to:{lat:B.lat,lon:B.lon},earliestDeparture:'2026-11-16T06:00:00Z'};
 assert.equal(H.assess(long,task,null).scheduled,true);assert.equal(H.assess(short,task,null).scheduled,false);
});

test('classement : un horaire programmé plus rapide passe devant un réalisable plus lent ; à égalité le réalisable gagne',()=>{
 const task={from:STOP1,to:STOP2,latestArrival:at(9,30)};
 const slow=H.assess({source:'A',sources:['A'],legs:[bus(at(7,0),at(7,40),STOP1,STOP2,{line:'LENT'})],missing:[]},task,null);
 const fast=H.assess({source:'B',sources:['B'],legs:[bus(at(7,5),at(7,17),STOP1,STOP2,{line:'RAPIDE'})],missing:['horaire GTFS local non confirmé en temps réel']},task,null);
 const same=H.assess({source:'C',sources:['C'],legs:[bus(at(7,10),at(7,50),STOP1,STOP2,{line:'EGAL'})],missing:['horaire GTFS local non confirmé en temps réel']},task,null);
 const broken=H.assess({source:'D',sources:['D'],legs:[bus(at(7,0),at(7,5),STOP1,STOP2,{line:'KO'})],missing:['marche jusqu’à l’adresse exacte d’arrivée non calculée']},task,null);
 assert.equal(slow.feasible,true);assert.equal(fast.scheduled,true);
 const pick=(list,label)=>H.rank(list).picks.find(p=>p.labels.includes(label)).journey.legs[0].line;
 assert.equal(pick([slow,fast,broken],'Plus rapide'),'RAPIDE');
 assert.equal(pick([slow,same,broken],'Plus rapide'),'LENT','durée égale : le réalisable passe devant');
 assert.equal(pick([broken,same],'Plus rapide'),'EGAL','un trajet incomplet ne passe jamais devant');
});

test('quota de marches : au-delà de 16 couples d’arrêts distincts, le trajet est signalé, jamais inventé',async()=>{
 const router={calls:0,route:async()=>{router.calls++;return {status:'unavailable'};}}; // rien de réalisable → recherche complémentaire incluse
 const js=[];for(let i=0;i<12;i++)js.push({source:'A',sources:['A'],legs:[bus(at(7,i*2),at(7,i*2+20),{lat:STOP1.lat+i*0.001,lon:STOP1.lon},{lat:STOP2.lat+i*0.001,lon:STOP2.lon},{line:'D'+i})]});
 const s=H.createSession({tasks:[{label:'Aller',from:HOME,to:MISSION,latestArrival:at(9,30)}],providers:{a:{name:'A',enabled:()=>true,run:async()=>js}},router});
 await new Promise(r=>setTimeout(r,100));
 const v=s.view('Aller'),all=[...v.picks.map(p=>p.journey),...v.others];
 assert.equal(all.filter(j=>/quota/.test(j.statusDetail)).length,4,'8 trajets (16 couples) évalués, 4 signalés');
 assert.ok(router.calls<=17,'appels marche : '+router.calls);
 s.dispose();
});

test('recherche complémentaire : si les 8 premiers ne sont pas réalisables, 8 de plus sont complétés ; aucune carte ne reste « en cours »',async()=>{
 // Les 8 premiers ont une marche impossible (arrêt inaccessible) ; les suivants sont réalisables.
 const BAD={lat:45.9500,lon:6.1300};
 const router={calls:0,route:async(a,b)=>{router.calls++;if(Math.abs(a.lat-BAD.lat)<1e-6||Math.abs(b.lat-BAD.lat)<1e-6)return {status:'unavailable'};
  const d=H.meters(a,b)*1.3;return {status:'calculated',distanceMeters:d,durationSeconds:Math.round(d/1.2),geometry:[a,b]};}};
 const js=[];for(let i=0;i<8;i++)js.push({source:'A',sources:['A'],legs:[bus(at(7,i),at(7,i+20),BAD,STOP2,{line:'K'+i})]});
 for(let i=0;i<6;i++)js.push({source:'A',sources:['A'],legs:[bus(at(7,30+i),at(7,50+i),STOP1,STOP2,{line:'G'+i})]});
 const s=H.createSession({tasks:[{label:'Aller',from:HOME,to:MISSION,latestArrival:at(9,30)}],providers:{a:{name:'A',enabled:()=>true,run:async()=>js}},router});
 await new Promise(r=>setTimeout(r,100));
 const v=s.view('Aller'),all=[...v.picks.map(p=>p.journey),...v.others];
 assert.ok(all.some(j=>j.feasible),'une solution réalisable trouvée par la recherche complémentaire');
 assert.ok(!all.some(j=>j.computing&&/en cours/.test(j.statusDetail)),'aucune carte bloquée « en cours »');
 s.dispose();
});

test('cache des marches : partagé et persistant (stockage du téléphone), clés arrondies à ~10 m',async()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 const base=fakeRouter();const r1=H.cachedRouter(base,{storage});
 await r1.route(STOP1,STOP2);await r1.route({lat:STOP1.lat+0.00002,lon:STOP1.lon},STOP2);// même point à 2 m près
 assert.equal(base.calls.length,1,'un seul appel Valhalla');
 const base2=fakeRouter();const r2=H.cachedRouter(base2,{storage});// nouvelle fiche
 const x=await r2.route(STOP1,STOP2);
 assert.equal(base2.calls.length,0,'réutilisé depuis le stockage');assert.equal(x.status,'calculated');assert.equal(x.cached,true);
 const failing={route:async()=>({status:'unavailable'})};const r3=H.cachedRouter(failing,{storage:null});
 await r3.route(HOME,MISSION);assert.equal((await r3.route(HOME,MISSION)).status,'unavailable','un échec n’est pas mis en cache définitif');
});

test('TripGo : billet par portion repris comme prix fournisseur ; moneyCost global ignoré',()=>{
 const when=new Date(1793610000*1000).toISOString();
 const resp=JSON.parse(JSON.stringify(tripgoFixture.response));
 for(const g of resp.groups)for(const t of g.trips){t.moneyCost=99;for(const sg of t.segments)if(sg.ticketWebsiteURL)sg.ticket={name:'Billet simple',cost:12.99,currency:'EUR'};}
 const parsed=T.parse(resp,{from:{lat:45.9019,lon:6.1218},to:{lat:45.1914,lon:5.7143},when});
 const [j]=H.fromTripGo(parsed);
 const p=H.priceOf(j);
 assert.equal(p.status,'verified');assert.equal(p.label,'12,99 €');assert.match(p.sources[0],/transmis par TripGo/);
 const plain=H.priceOf(H.fromTripGo(T.parse(tripgoFixture.response,{from:{lat:45.9019,lon:6.1218},to:{lat:45.1914,lon:5.7143},when}))[0]);
 assert.equal(plain.status,'unknown','sans billet : Prix à confirmer');
});

test('transport à la demande : information affichée seulement dans le secteur concerné',()=>{
 assert.deepEqual(H.tadFor({from:{lat:45.5711,lon:5.9196},to:{lat:45.60,lon:5.95}}).map(t=>t.name),['Flexi (Synchro mobilités, Grand Chambéry)']);
 assert.deepEqual(H.tadFor({from:{lat:45.688,lon:5.909},to:{lat:45.70,lon:5.92}}).map(t=>t.name),['Mobéa (Ondéa Grand Lac)']);
 assert.equal(H.tadFor({from:HOME,to:MISSION}).length,0,'Annecy : aucun');
});
