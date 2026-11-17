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
 assert.match(html,/style\.css\?v=transport-cards-20261116/);
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
 assert.match(hub,/for\(const \[i,p\] of v\.picks\.entries\(\)\)addCard\(host,p\.journey,p\.labels,i===0\)/);
 assert.match(hub,/Cartes des trajets piétons/);
});
