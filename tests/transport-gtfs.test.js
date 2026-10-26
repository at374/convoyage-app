// Tests autonomes Node.js : node tests/transport-gtfs.test.js
// Données entièrement fictives : aucun horaire réel n'est affirmé.
'use strict';
const assert=require('node:assert/strict');
const gtfs=require('../transport-gtfs-validation.js');
const fichiers={
  'stops.txt':'stop_id,stop_name\nA,Départ\nB,Correspondance\nC,Arrivée\n',
  'routes.txt':'route_id,route_short_name\nR1,1\n',
  'trips.txt':'route_id,service_id,trip_id\nR1,SEMAINE,T1\nR1,SEMAINE,T2\n',
  'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,A,1\nT1,08:20:00,08:20:00,B,2\nT1,08:40:00,08:40:00,C,3\nT2,24:10:00,24:10:00,A,1\nT2,24:30:00,24:30:00,C,2\n',
  'calendar.txt':'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nSEMAINE,1,1,1,1,1,0,0,20261001,20261031\n',
  'calendar_dates.txt':'service_id,date,exception_type\nSEMAINE,20261026,2\nSEMAINE,20261031,1\n'
};
assert.equal(gtfs.dateGTFS('20260229'),false);
assert.equal(gtfs.dateGTFS('20281026'),true);
assert.equal(gtfs.heureGTFS('25:15:00'),90900);
assert.equal(gtfs.heureGTFS('48:00:00'),null);
assert.equal(gtfs.circule(fichiers,'SEMAINE','20261027'),true);
assert.equal(gtfs.circule(fichiers,'SEMAINE','20261026'),false);
assert.equal(gtfs.circule(fichiers,'SEMAINE','20261031'),true);
assert.equal(gtfs.coursesDuJour(fichiers,'20261026').length,0);
assert.equal(gtfs.coursesDuJour(fichiers,'20261027').length,2);
const directs=gtfs.trajetsDirects(fichiers,'20261027','A','C');
assert.equal(directs.length,2);
assert.equal(directs[0].departSecondes,28800);
assert.equal(directs[1].departSecondes,87000);
assert.deepEqual(gtfs.datePassageGTFS('20261027',90900),{
  date:'20261028',heure:'01:15:00',jourSupplementaire:1
});
const sansService={...fichiers,'calendar_dates.txt':'service_id,date,exception_type\n'};
assert.equal(gtfs.circule(sansService,'SEMAINE','20261031'),false);
const frequences={...fichiers,'frequencies.txt':'trip_id,start_time,end_time,headway_secs\nT1,08:00:00,09:00:00,600\n'};
assert.equal(gtfs.coursesDuJour(frequences,'20261027').length,1);
assert.equal(gtfs.analyser(fichiers).valide,true);
// Cas limites : CSV avec virgules, correspondances impossibles et services absents.
assert.equal(gtfs.csv('id,name\n1,"Gare, centre"\n')[0].name,'Gare, centre');
assert.equal(gtfs.trajetsDirects(fichiers,'20261027','C','A').length,0);
assert.equal(gtfs.trajetsDirects(fichiers,'20261027','A','C',{departApresSecondes:90000}).length,0);
assert.equal(gtfs.trajetsDirects(fichiers,'20261027','A','C',{arriveeAvantSecondes:30000}).length,0);
assert.equal(gtfs.circule(fichiers,'INCONNU','20261027'),false);
const contradictoires={...fichiers,'calendar_dates.txt':
  fichiers['calendar_dates.txt']+'SEMAINE,20261026,1\n'};
assert.throws(()=>gtfs.circule(contradictoires,'SEMAINE','20261026'));
console.log('Tests GTFS réussis');
