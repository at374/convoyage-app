const test=require('node:test'),assert=require('node:assert/strict');
const {readiness,dateKey}=require('../scripts/otp-gtfs-readiness.cjs');
const feed={file:'suisse.zip',sha256:'a'.repeat(64),requiredFilesMissing:[],
 hasCalendar:true,hasCalendarDates:false,serviceDateMin:'20261101',serviceDateMax:'20261231',
 agencyTimezones:['Europe/Zurich'],stops:100};
test('date cible valide, y compris année bissextile',()=>{
 assert.equal(dateKey('2028-02-29'),'20280229');
 assert.equal(dateKey('2026-02-29'),null);
 assert.equal(dateKey('2026-13-01'),null);
});
test('GTFS : accepte uniquement une vérification préalable, pas une circulation confirmée',()=>{
 const r=readiness({archives:[feed]},'2026-11-16');
 assert.equal(r.allReadyForDetailedCheck,true);
 assert.match(r.warning,/ne prouvent pas/);
});
test('GTFS : refuse archive périmée',()=>{
 const r=readiness({archives:[feed]},'2027-01-10');
 assert.equal(r.allReadyForDetailedCheck,false);
 assert.match(r.archives[0].reasons.join(','),/hors bornes/);
});
test('GTFS : refuse fichier absent et empreinte invalide',()=>{
 const r=readiness({archives:[{...feed,sha256:null,requiredFilesMissing:['trips.txt']}]},'2026-11-16');
 assert.equal(r.allReadyForDetailedCheck,false);
 assert.equal(r.archives[0].reasons.length,2);
});
test('GTFS : ne valide pas une liste vide',()=>{
 assert.equal(readiness({archives:[]},'2026-11-16').allReadyForDetailedCheck,false);
});
