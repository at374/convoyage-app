// node tests/transport-mission-horaires.test.js
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function extraire(nom,fin) {
 const start=source.indexOf('  const '+nom+' = ');
 assert.ok(start>=0,nom+' exists');
 const end=source.indexOf(fin,start);
 assert.ok(end>start,nom+' end found');
 return source.slice(start,end);
}
const bloc=extraire('dateTransportMission','  function blocRechercheTransport');
const reglages={marge_transport_minutes:0};
const fonctions=new Function('etat',bloc+'; return {dateTransportMission,heureTransportMission,trajetCompatibleMission};')({reglages});
const m={pickup_start:'2026-10-27T00:30:00+01:00',delivery_end:'2026-10-27T23:30:00+01:00'};
assert.equal(fonctions.dateTransportMission(m,false),'2026-10-27','local date before UTC midnight');
assert.equal(fonctions.heureTransportMission(m,false),'00:30','local pickup time');
assert.equal(fonctions.dateTransportMission(m,true),'2026-10-27','local delivery date');
assert.equal(fonctions.heureTransportMission(m,true),'23:30','local delivery time');
const t=(departAt,arriveeAt)=>({departAt,arriveeAt});
assert.equal(fonctions.trajetCompatibleMission(t('2026-10-26T22:00:00+01:00','2026-10-27T00:20:00+01:00'),m,false),true,'arrival before pickup accepted');
assert.equal(fonctions.trajetCompatibleMission(t('2026-10-27T00:20:00+01:00','2026-10-27T00:40:00+01:00'),m,false),false,'late arrival rejected');
assert.equal(fonctions.trajetCompatibleMission(t('2026-10-27T23:20:00+01:00','2026-10-28T00:20:00+01:00'),m,true),false,'departure before delivery rejected');
assert.equal(fonctions.trajetCompatibleMission(t('2026-10-27T23:40:00+01:00','2026-10-28T00:40:00+01:00'),m,true),true,'departure after delivery accepted');
reglages.marge_transport_minutes=15;
assert.equal(fonctions.trajetCompatibleMission(t('2026-10-26T22:00:00+01:00','2026-10-27T00:20:00+01:00'),m,false),false,'arrival within safety margin rejected');
assert.equal(fonctions.trajetCompatibleMission(t('2026-10-26T22:00:00+01:00','2026-10-27T00:10:00+01:00'),m,false),true,'arrival before margin accepted');
assert.equal(fonctions.trajetCompatibleMission(t('2026-10-27T23:40:00+01:00','2026-10-28T00:40:00+01:00'),m,true),false,'departure within margin rejected');
assert.equal(fonctions.trajetCompatibleMission(t('2026-10-27T23:45:00+01:00','2026-10-28T00:40:00+01:00'),m,true),true,'departure after margin accepted');
console.log('Transport mission horaires: 12 assertions passed');
