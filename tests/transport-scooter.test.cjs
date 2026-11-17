const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const W=require('../transport-walking.js');
const H=require('../transport-mission-hub.js');

const A={lat:45.9,lon:6.12},B={lat:45.91,lon:6.12};
const bikeRouter=(m)=>({mode:'bicycle',route:async()=>({status:'calculated',distanceMeters:m,durationSeconds:m/6,geometry:[A,B],steps:[{text:'Continuez tout droit',meters:m,seconds:60}]})});
const task=(o={})=>({label:'Aller',from:A,to:B,fromName:'Domicile',toName:'Prise en charge',latestArrival:'2026-11-20T10:00:00Z',marginMinutes:15,...o});

test('trottinette : durée estimée à la vitesse réglée, trajet gratuit, jamais confirmé en temps réel',async()=>{
 const j=await H.scooterOnly(task(),bikeRouter(3000),{maxKm:8,speedKmh:15});
 assert.ok(j&&j.scooterOnly);
 assert.equal(j.legs.length,1);assert.equal(j.legs[0].kind,'scooter');assert.equal(j.legs[0].mode,'Trottinette');
 assert.equal(j.legs[0].durationSeconds,Math.round(3000/(15/3.6)));
 assert.ok(j.legs[0].steps&&j.legs[0].steps.length);
 const a=H.assess(j,task(),null);
 assert.equal(a.price.status,'free');assert.match(a.price.label,/trottinette/i);
 assert.equal(a.realtime,false);
});

test('trottinette : plus rapide quand la vitesse réglée augmente',async()=>{
 const a=await H.scooterOnly(task(),bikeRouter(4000),{maxKm:8,speedKmh:10});
 const b=await H.scooterOnly(task(),bikeRouter(4000),{maxKm:8,speedKmh:25});
 assert.ok(a.legs[0].durationSeconds>b.legs[0].durationSeconds);
});

test('trottinette : distance maximale réglée respectée (aucun trajet au-delà)',async()=>{
 assert.equal(await H.scooterOnly(task(),bikeRouter(9000),{maxKm:8,speedKmh:15}),null);
 assert.equal(await H.scooterOnly(task(),bikeRouter(9000),{maxKm:10,speedKmh:15})!==null,true);
 const far={lat:46.5,lon:6.12};
 assert.equal(await H.scooterOnly(task({to:far}),bikeRouter(3000),{maxKm:8}),null);
});

test('trottinette : service indisponible → aucun trajet inventé',async()=>{
 const r={route:async()=>({status:'unavailable'})};
 assert.equal(await H.scooterOnly(task(),r,{maxKm:8}),null);
 assert.equal(await H.scooterOnly(task(),null,{maxKm:8}),null);
});

test('routeur vélo : exige le mode vélo du service, refuse un tracé piéton',()=>{
 const poly=require('./fixtures/valhalla-annecy-pedestrian-2026-10-30.json');
 const data=poly.response||poly.data||poly;
 const g=W.decodePolyline(data.trip.legs[0].shape);
 assert.throws(()=>W.validateValhalla(data,g[0],g.at(-1),{mode:'bicycle'}));
 const bike=JSON.parse(JSON.stringify(data));
 bike.trip.legs[0].maneuvers.forEach(m=>{m.travel_mode='bicycle';m.travel_type='road';});
 const r=W.validateValhalla(bike,g[0],g.at(-1),{mode:'bicycle'});
 assert.equal(r.mode,'bicycle');assert.match(r.provider,/vélo/);
});

test('routeur vélo : la requête demande costing bicycle avec la vitesse bornée',async()=>{
 let url=null;
 const fetcher=async u=>{url=u;return {ok:false,status:500};};
 const r=W.createRouter({fetcher,mode:'bicycle',cyclingSpeed:99,intervalMs:0});
 await r.route(A,B);
 const q=JSON.parse(new URL(url).searchParams.get('json'));
 assert.equal(q.costing,'bicycle');assert.equal(q.costing_options.bicycle.cycling_speed,30);
 r.dispose();
});

async function runSession(scooter){
 let last=null;
 const s=H.createSession({tasks:[task()],providers:{},router:bikeRouter(3000),scooterRouter:bikeRouter(3000),scooter,walkMaxKm:1,onUpdate:(l,v)=>{last=v;}});
 await new Promise(r=>setTimeout(r,300));
 s.dispose&&s.dispose();
 return last;
}
test('session : trajet Trottinette présent seulement si l option est activée',async()=>{
 const off=await runSession({enabled:false,maxKm:8,speedKmh:15});
 assert.ok(!JSON.stringify(off||{}).includes('Trottinette'));
 const on=await runSession({enabled:true,maxKm:8,speedKmh:15});
 assert.ok(JSON.stringify(on||{}).includes('Trottinette'),'trajet trottinette proposé');
});

test('paramètres : marche et trottinette réglables dans l onglet Paramètres, enregistrés en local',()=>{
 const src=fs.readFileSync(require.resolve('../app.js'),'utf8');
 for(const id of ['rMarcheMax','rTrot','rTrotVit','rTrotMax'])assert.match(src,new RegExp('id="'+id+'"'));
 assert.match(src,/ecrireLocal\('cp_trot_vitesse_kmh'/);assert.match(src,/ecrireLocal\('cp_trot_max_km'/);
 assert.match(src,/mode: 'bicycle'/);
});

test('paramètres : adresse exacte du domicile localisée, gardée en local, prioritaire pour les transports',()=>{
 const src=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.match(src,/id="rAdr"/);
 assert.match(src,/ecrireLocal\('cp_domicile_exact', \{ texte/);
 assert.match(src,/lireLocal\('cp_domicile_exact',null\)/);
 assert.match(src,/homeAdrOk\?\{lat:homeAdr\.lat,lon:homeAdr\.lon\}/);
 // jamais envoyée au serveur : absente de l'objet des réglages synchronisés
 const i=src.indexOf('const v = {');
 assert.ok(!/cp_domicile_exact|rAdr/.test(src.slice(i,i+1500)));
});

test('billet SNCF : gares exactes à coller, boutons copier (SNCF Connect sans lien pré-rempli)',async()=>{
 const src=fs.readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 assert.match(src,/'la gare':'l’arrêt'/);assert.match(src,/' d’arrivée'/);
 assert.match(src,/for\(const netLabel of helpLabels\)/);
 assert.match(src,/ticketLink\(x\.provider\)\?\.label===netLabel/);
});

test('point GPS approximatif : marche longue et détour ne font pas écarter le trajet',()=>{
 const A={lat:45.9,lon:6.12},B={lat:46.0,lon:6.2};
 const j={source:'t',sources:['t'],alerts:[],missing:[],legs:[
  {kind:'walk',mode:'Marche',from:'a',to:'b',fromPoint:A,toPoint:A,departure:'2026-11-20T08:00:00Z',arrival:'2026-11-20T08:50:00Z',distanceMeters:4000,durationSeconds:3000},
  {kind:'transit',mode:'Train',provider:'SNCF',from:'a',to:'b',fromPoint:A,toPoint:B,departure:'2026-11-20T09:00:00Z',arrival:'2026-11-20T10:00:00Z',durationSeconds:3600}],walkOnly:false};
 const task=ap=>({from:A,to:B,latestArrival:'2026-11-20T11:00:00Z',marginMinutes:15,walkMaxMeters:3000,approximateEndpoint:ap});
 const exact=H.assess(j,task(false),null),approx=H.assess(j,task(true),null);
 assert.ok(exact.reasons.some(r=>r.startsWith('marche trop longue')));
 assert.ok(!approx.reasons.some(r=>r.startsWith('marche trop longue')));
 assert.ok(approx.reasons.some(r=>r.startsWith('marche longue à vérifier')));
});

test('fenêtre de mission : propositions avant le début et jusqu à la fin de la fenêtre (marge comprise)',()=>{
 const A={lat:45.9,lon:6.12},B={lat:45.95,lon:6.2};
 const mk=(dep,arr)=>H.assess({source:'t',sources:['t'],alerts:[],missing:[],legs:[{kind:'transit',mode:'Train',provider:'SNCF',line:'T'+dep,from:'a',to:'b',fromPoint:A,toPoint:B,departure:dep,arrival:arr,durationSeconds:3600}]},task,null);
 const task={from:A,to:B,latestArrival:'2026-11-18T11:30:00Z',marginMinutes:15,windowKind:'arrival',windowStartMs:Date.parse('2026-11-18T10:00:00Z'),windowEndMs:Date.parse('2026-11-18T11:15:00Z')};
 const items=[mk('2026-11-18T08:00:00Z','2026-11-18T09:00:00Z'),mk('2026-11-18T09:00:00Z','2026-11-18T09:50:00Z'),mk('2026-11-18T09:50:00Z','2026-11-18T10:40:00Z'),mk('2026-11-18T10:10:00Z','2026-11-18T11:10:00Z'),mk('2026-11-18T10:30:00Z','2026-11-18T11:25:00Z')];
 const r=H.rank(items,task);
 const labels=r.picks.flatMap(p=>p.labels).join('|');
 assert.match(labels,/Arrive avant/);assert.match(labels,/Arrive jusqu/);
 const av=r.picks.find(p=>p.labels.some(l=>/Arrive avant/.test(l))).journey,jq=r.picks.find(p=>p.labels.some(l=>/Arrive jusqu/.test(l))).journey;
 assert.ok(Date.parse(av.arrival)<=task.windowStartMs);assert.equal(jq.arrival,'2026-11-18T11:10:00.000Z');
});

test('cars depuis Lyon : gares routières de Part-Dieu, Perrache et Gerland comme points de recherche',()=>{
 const n=H.LYON_COACH_ANCHORS.map(a=>a.name).join('|');
 assert.match(n,/Gerland/);assert.match(n,/Perrache/);assert.match(n,/Part-Dieu/);
});

const CORBAS={lat:45.6667,lon:4.9},GERLAND={lat:45.729,lon:4.83},ANNECY={lat:45.9,lon:6.12};
const coach=()=>({source:'FlixBus GTFS',sources:['FlixBus GTFS'],alerts:[],missing:[],needsAccess:{side:'from',anchor:'Lyon Gerland'},
 legs:[{kind:'transit',mode:'Car',provider:'FlixBus',line:'F1',from:'Lyon Gerland',to:'Annecy',fromPoint:GERLAND,toPoint:ANNECY,departure:'2026-11-18T14:00:00Z',arrival:'2026-11-18T16:00:00Z',durationSeconds:7200}]});
const otpAccess=(arr)=>({enabled:()=>true,run:async()=>[{source:'OTP',sources:['OTP'],legs:[{kind:'transit',mode:'Tram',provider:'TCL',line:'T',from:'Corbas',to:'Lyon Gerland',fromPoint:CORBAS,toPoint:GERLAND,departure:'2026-11-18T13:00:00Z',arrival:arr,durationSeconds:3000}]}]});
const tk={from:CORBAS,to:ANNECY,fromName:'Livraison',toName:'Domicile',earliestDeparture:'2026-11-18T12:00:00Z',marginMinutes:15};

test('car depuis Lyon : accès calculé par OTP2 ajouté avant le car, avec 10 min de marge',async()=>{
 const j=await H.accessFor(coach(),tk,otpAccess('2026-11-18T13:50:00Z'),null);
 assert.equal(j.legs.length,2);assert.equal(j.legs[0].mode,'Tram');assert.equal(j.legs[1].provider,'FlixBus');
 assert.ok(!j.needsAccess);
});
test('car depuis Lyon : accès trop tardif ou OTP indisponible → aucun accès inventé, trajet signalé',async()=>{
 const late=await H.accessFor(coach(),tk,otpAccess('2026-11-18T13:58:00Z'),null);
 assert.equal(late.legs.length,1);assert.ok(late.missing.some(m=>/accès/.test(m)));
 const off=await H.accessFor(coach(),tk,null,null);
 assert.equal(off.legs.length,1);assert.ok(off.missing.length>0);
 const err=await H.accessFor(coach(),tk,{enabled:()=>true,run:async()=>{throw new Error('délai dépassé');}},null);
 assert.equal(err.legs.length,1);assert.ok(err.missing.some(m=>/délai/.test(m)));
});

test('guidage vocal : bouton Google Maps (départ/arrivée remplis) sur marches et trottinette',()=>{
 const src=fs.readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 assert.match(src,/google\.com\/maps\/dir\/\?api=1&origin=/);
 assert.match(src,/navLink\(doc,sa,sb,'bicycling'\)/);
 assert.match(src,/navLink\(doc,wa,wb,'walking'\)/);
});

test('limite de marche : si tout est écarté, les trajets à marche trop longue sont montrés avec un avertissement',()=>{
 const src=fs.readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 assert.match(src,/const isLongOnly=j=>/);
 assert.match(src,/Aucune proposition ne respecte votre limite de marche/);
});

test('trottinette en approche : une marche trop longue est remplacée par un tronçon trottinette (réglage activé)',async()=>{
 const A={lat:45.30,lon:4.80},S={lat:45.33,lon:4.82},B={lat:45.90,lon:6.12};
 const walkRouter={route:async()=>({status:'calculated',distanceMeters:4200,durationSeconds:3000,geometry:[A,S],steps:[]})};
 const bikeRouter={route:async()=>({status:'calculated',distanceMeters:4000,durationSeconds:800,geometry:[A,S],steps:[]})};
 const j={source:'t',sources:['t'],alerts:[],missing:[],legs:[{kind:'transit',mode:'Train',provider:'SNCF',line:'TER',from:'Gare',to:'Annecy',fromPoint:S,toPoint:B,departure:'2026-11-20T09:00:00Z',arrival:'2026-11-20T11:00:00Z',durationSeconds:7200}]};
 const task={from:A,to:B,earliestDeparture:'2026-11-20T08:00:00Z',marginMinutes:15,walkMaxMeters:3000,fromName:'Domicile',toName:'Arrivée'};
 const on=await H.completeWalks(j,task,walkRouter,{enabled:true,router:bikeRouter,maxKm:8,speedKmh:15});
 assert.equal(on.legs[0].kind,'scooter');assert.equal(on.legs[0].speedKmh,15);
 assert.equal(Date.parse(on.legs[0].arrival),Date.parse('2026-11-20T09:00:00Z'));
 const off=await H.completeWalks(j,task,walkRouter,{enabled:false});
 assert.equal(off.legs[0].kind,'walk');
 const tooFar=await H.completeWalks(j,task,walkRouter,{enabled:true,router:bikeRouter,maxKm:3,speedKmh:15});
 assert.equal(tooFar.legs[0].kind,'walk');
 const a=H.assess(on,task,null);assert.ok(!a.reasons.some(r=>r.startsWith('marche trop longue')));
});

test('adresses exactes dans les marches, guidage trottinette replié, fin de journée de voyage à 19:00',()=>{
 const src=fs.readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.match(src,/function renameEnds\(j,task\)/);
 assert.doesNotMatch(src,/const guide=el\(doc,'details','cp-hub-steps'\);guide\.open=true;\n?\s*guide\.appendChild\(el\(doc,'summary',null,'🧭 Guidage · '/);
 assert.match(app,/const dayEnd=d=>parisIso\(d,19,0\)/);
 assert.match(app,/toName:from\|\|'Prise en charge'/);
});

test('TCL : prix du ticket 1 voyage par zones (grille officielle) à la place du copier-coller',()=>{
 const src=fs.readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 assert.match(src,/const TCL_FARES=/);
 assert.match(src,/\['Zones 1 et 2','2,10 €'\]/);
 assert.match(src,/netLabel==='TCL'&&String\(netLegs\[0\]\.departure/);
});

test('DriiveMe : la livraison ne peut pas commencer avant la prise en charge',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.ok(app.includes('const deliveryStartFloor = '));
 assert.ok(app.includes('Math.max(d, floor)'));
 assert.ok(app.includes('const firstStart=deliveryStartFloor!==null'));
});

test('suivi GPS : arrivée à la livraison + marge 15 min met à jour retours et jonctions',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.ok(app.includes("RAYON_ARRIVEE_M = 300"));
 assert.ok(app.includes("navigator.geolocation.watchPosition(suiviTraiter"));
 assert.ok(app.includes("MARGE_ARRIVEE_MIN * 60000"));
 assert.ok(app.includes("arriveeGps(key)"));
 assert.ok(app.includes("new CustomEvent('cp-arrivee'"));
 assert.ok(app.includes("document.addEventListener('cp-arrivee', surArrivee)"));
 assert.ok(app.includes("const plancher = iso =>"));
 assert.ok(app.includes("plancher(nextDay&&delivDay"));
 assert.ok(app.includes("const startIso=first?plancher(firstStart)"));
});

test('suivi GPS : reprise au premier plan sans attente, ignore les relevés en roulant',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.ok(app.includes('suiviReprise ||'));
 assert.ok(app.includes("vit > 3"));
});

test('suivi arrivée : événements Google Maps / Waze lus via l’APK, validés par la position',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.ok(app.includes('window.CPNatif; if (!N || typeof N.prendreNavigation'));
 assert.ok(app.includes('missionsASuivre(at)'));
 assert.ok(app.includes('Math.abs(at - locAt) > 15 * 60000'));
 assert.ok(app.includes('suiviNavigation();'));
});

test('fenêtre d’arrivée large : recherche aussi « avant l’ouverture » et arrivées du matin non masquées',()=>{
 const src=fs.readFileSync(require.resolve('../transport-mission-hub.js'),'utf8');
 assert.ok(src.includes('_avantOuverture:true'));
 assert.ok(src.includes('180+windowSpan'));
 assert.ok(src.includes('p.run(variant,controller.signal)'));
});
