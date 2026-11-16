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
 assert.match(hub,/j\.feasible\?'Réalisable'/);
});
