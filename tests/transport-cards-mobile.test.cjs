'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'transport-mission-hub.js'),'utf8');

test('fiche mission : moteur automatique raccordé et sans formulaire de recherche manuel',()=>{
 assert.match(html,/transport-mission-hub\.js\?v=/);
 assert.match(app,/window\.CPTransportHub/);
 assert.match(app,/Hub\.render\(host,view\)/);
 assert.match(app,/startTransportHub\(\)/);
});
test('cartes Android : styles chargés avec cache invalidé et prix mis en évidence',()=>{
 assert.match(html,/style\.css\?v=transport-cards-20261117e/);
 assert.match(css,/\.cp-hub-card \.cp-hub-price\{[^}]*font-size:1\.28em/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.cp-hub-card \.cp-hub-map\{max-width:100%/);
});
test('cartes : prix inconnu et achat officiel sans prix inventé',()=>{
 assert.match(hub,/Prix à confirmer/);
 assert.match(hub,/ticketLinks\(j\)/);
 assert.match(hub,/noopener noreferrer/);
 assert.match(hub,/const feasible=reasons\.length===0/);
});

test('diagnostic intégré : mêmes ressources nationales que les fiches missions',()=>{
 const matches=[...app.matchAll(/nationalGTFSResources:\s*window\.CP_NATIONAL_GTFS_RESOURCES\s*\|\|\s*\{\}/g)];
 assert.ok(matches.length>=2,'ressources SNCF, BlaBlaCar Bus et FlixBus pour diagnostic et fiches');
});

test('BlaBlaCar : lien Bus distinct du covoiturage',()=>{
 const H=require('../transport-mission-hub.js');
 assert.equal(H.ticketLink('BlaBlaCar Bus').url,'https://www.blablacar.fr/bus');
 assert.equal(H.ticketLink('BlaBlaCar covoiturage').url,'https://www.blablacar.fr/');
 assert.equal(H.ticketLink('FlixBus').url,'https://www.flixbus.fr/');
});

test('inventaire : ne plus annoncer Léman Pass entièrement absent',()=>{
 const coverage=require('../transport-coverage.js');
 const leman=coverage.NETWORKS.find(x=>x.id==='lemanpass');
 const lex=coverage.NETWORKS.find(x=>x.id==='lex');
 const tpg=coverage.NETWORKS.find(x=>x.id==='tpg');
 assert.equal(leman.fareOk,true);
 assert.equal(lex.fareOk,true);
 assert.equal(tpg.fareOk,true);
 assert.match(leman.fare,/partielles/);
 assert.match(coverage.DETAILS.lemanpass.blocage,/autres zones/);
 assert.equal(coverage.DETAILS.lemanpass.tarif,'partiels');
});

test('premiere proposition : carte et marches visibles sans ouverture manuelle',()=>{
 assert.match(hub,/function card\(doc,j,labels,expanded=false\)/);
 assert.match(hub,/if\(expanded\)c\.open=true/);
 assert.match(hub,/if\(c\.open\)buildBody\(\)/);
 assert.match(hub,/const openInitial=v\.picks\.length>0&&host\.dataset\.cpInitialCardOpened!=='true'/);
 assert.match(hub,/if\(openInitial\)host\.dataset\.cpInitialCardOpened='true'/);
 assert.match(hub,/for\(const \[i,p\] of v\.picks\.entries\(\)\)addCard\(host,p\.journey,p\.labels,openInitial&&i===0\)/);
 // Bouton « Voir la marche N » sous la carte de chaque marche ; plus de bloc séparé ni de « Tarif à confirmer » sur une marche.
 assert.match(hub,/'🚶 Voir la marche '\+walkNo/);
 assert.doesNotMatch(hub,/Cartes des trajets piétons/);
 assert.doesNotMatch(hub,/Voir la marche '\+\(i\+1\)\+' sur la carte OpenStreetMap/);
});

test('missions multi-jours : onglets date pickup/livraison et aucun jour inventé',()=>{
 assert.match(app,/const transportDays=\{/);
 assert.match(app,/Aller:parisServiceDay\(pickupDate\)/);
 assert.match(app,/Retour:parisServiceDay\(deliveryDate\)/);
 assert.match(app,/availableTransportDays\.length>1/);
 assert.match(app,/button\.addEventListener\('click',\(\)=>selectDay\(day\)\)/);
 assert.match(app,/section\.hidden=transportDays\[direction\]!==day/);
 assert.match(css,/\.cp-transport-direction\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.cp-transport-day-tab\[aria-pressed="true"\]/);
});

test('onglets des dates : libellés accessibles identifiant prise en charge, retour et jonction',()=>{
 assert.match(app,/const stages=Object\.entries\(transportDays\)/);
 assert.match(app,/direction\.startsWith\('Aller'\)\?'Prise en charge'/);
 assert.match(app,/direction\.startsWith\('Retour'\)\?'Retour après livraison':'Jonction'/);
 assert.match(app,/button\.setAttribute\('aria-label','Afficher les transports du '/);
});

test('jonction multi-jours : onglet calé sur la prochaine prise en charge',()=>{
 assert.match(app,/Jonction:next\?parisServiceDay\(next\.pickup_start\):null/);
 assert.doesNotMatch(app,/Jonction:next\?parisServiceDay\(deliveryDate\):null/);
});

test('cartes piétonnes : conserver les détails construits après rafraîchissement',()=>{
 assert.match(hub,/const node=card\(doc,j,labels,expandFirst\|\|\(key&&opened\.has\(key\)\)\)/);
 assert.match(hub,/if\(key\)node\.setAttribute\('data-journey-key',key\)/);
 assert.doesNotMatch(hub,/if\(opened\.has\(key\)\)node\.open=true/);
});

test('BlaBlaCar Bus et FlixBus : diagnostic uniquement si moteur consulté',()=>{
 assert.match(hub,/const coachNames=\['BlaBlaCar Bus GTFS','FlixBus GTFS'\]\.filter/);
 assert.match(hub,/Object\.prototype\.hasOwnProperty\.call\(v\.received\|\|\{\},name\)/);
 assert.match(hub,/Object\.prototype\.hasOwnProperty\.call\(v\.errors\|\|\{\},name\)/);
 assert.match(hub,/if\(coachRows\.length\)\{/);
 assert.match(hub,/entry\.name\.replace\(' GTFS',''\)/);
 assert.match(hub,/count===0\?'aucun horaire reçu'/);
 assert.match(hub,/entry\.visible\+' proposition\(s\) affichée\(s\) \/ '\+count\+' horaire\(s\) reçu\(s\)'/);
 assert.match(hub,/const visibleJourneys=/);
 assert.match(hub,/\(v\.others\|\|\[\]\)\.slice\(0,8\)/);
 assert.match(hub,/BlaBlaCar Bus GTFS/);
 assert.match(hub,/FlixBus GTFS/);
 assert.match(hub,/Moteur non interrogé/);
 assert.match(hub,/Aucun horaire reçu pour ce trajet et cette date/);
 assert.match(hub,/prix non fournis par le GTFS/);
});

test('cars : horaires reçus mais aucune proposition retenue, diagnostic explicite',()=>{
 assert.match(hub,/entry\.visible===0&&\(v\.received\?\.\[entry\.name\]\|\|0\)>0/);
 assert.match(hub,/les horaires reçus ne constituent pas un trajet validé pour cette mission/);
});

test('autres propositions : annoncer le nombre de cartes réellement rendues',()=>{
 assert.match(hub,/Math\.min\(v\.others\.length,8\)/);
 assert.match(hub,/v\.others\.length>8\?' sur '/);
 assert.match(hub,/v\.others\.slice\(0,8\)/);
});

test('mission sur plusieurs jours : un onglet par jour avec Aller et Retour cherchés ce jour-là',()=>{
 assert.match(app,/transportDays\['Aller@'\+d\]=d/);
 assert.match(app,/transportDays\['Retour@'\+d\]=d/);
  assert.match(app,/const startIso=first\?firstStart:parisIso\(d,8,0\)/);
 assert.match(app,/const parisIso=\(day,hh,mm\)=>/);
});

test('OTP2 : deuxième essai après délai dépassé et ordre des sections Aller/Jonction/Retour',()=>{
 assert.match(hub,/response=await go\(Math\.min\(60000/);
 assert.match(hub,/const limitMs=Number\.isFinite\(p\.timeoutMs\)/);
 assert.match(app,/Ordre d'affichage : Aller, Jonction, Retour/);
 assert.match(app,/window\.__cpOtpWarm/);
});

test('multi-jours : les onglets partent du début réel de la fenêtre, pas du jour planifié',()=>{
 assert.match(app,/const pPlan=parisServiceDay\(pickupDate\),dPlan=parisServiceDay\(deliveryDate\)/);
 assert.match(app,/label:d===pPlan\?'Aller':'Aller@'\+d/);
 assert.match(app,/label:d===dPlan\?'Retour':'Retour@'\+d/);
});

test('fluidité : mises à jour regroupées et sections cachées non dessinées',()=>{
 assert.match(hub,/350-\(now-\(lastEmit\[label\]\|\|0\)\)/);
 assert.match(app,/pendingViews\[label\]=view/);
 assert.match(app,/renderPending\(\);/);
});
