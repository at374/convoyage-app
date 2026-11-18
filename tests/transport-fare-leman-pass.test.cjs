const {test}=require('node:test');const assert=require('node:assert/strict');
const G=require('../transport-fare-grids.js');
const leg=(from,to,day='2026-11-16',mode='Train',provider='SNCF',line='SL L1')=>({mode,provider,line,from,to,departure:day+'T08:06:00+01:00'});
test('Léman Pass 210+10 : 4,90 € / 90 min en train Annemasse <> Genève (TAC + tpg concordants)',()=>{
 const f=G.fareFor(leg('Annemasse','Genève'));
 assert.equal(f.amount,4.90);assert.equal(f.currency,'EUR');assert.equal(f.validityMinutes,90);assert.match(f.source,/tac-mobilites/);
 assert.equal(G.fareFor(leg('Genève Cornavin','Annemasse')).amount,4.90);
 assert.equal(G.fareFor(leg('Annemasse','Genève','2026-12-13')),null);
 assert.equal(G.fareFor(leg('Annemasse','La Roche-sur-Foron')),null);
});
test('TAC : 1,70 € / 60 min dans la période prouvée, rien hors période ni hors TAC',()=>{
 const f=G.fareFor(leg('Annemasse Gare','Saint-Julien','2026-11-16','Bus','TAC Annemasse','T2'));
 assert.equal(f.amount,1.70);assert.equal(f.currency,'EUR');assert.equal(f.validityMinutes,60);assert.match(f.source,/14\/12\/2025|tac-mobilites/);
 assert.equal(G.fareFor(leg('Annemasse Gare','Saint-Julien','2026-12-13','Bus','TAC Annemasse','T2')),null);
 assert.equal(G.fareFor(leg('Annemasse','Genève','2026-11-16','Tram','TPG','17')),null);
});

test('Synchro : 1,40 € / 60 min dans la période prouvée (délib. 080-25 C, 7/07/2025)',()=>{
 const legS=(day='2026-11-16')=>({mode:'Bus',provider:'Synchro Bus',line:'4',from:'Chambéry gare',to:'Technolac',departure:day+'T08:06:00+01:00'});
 const f=G.fareFor(legS());assert.equal(f.amount,1.40);assert.equal(f.currency,'EUR');assert.equal(f.validityMinutes,60);
 assert.match(f.source,/Acte16655|grandchambery/);
 assert.equal(G.fareFor(legS('2027-01-01')),null); // hors période prouvée (recherche à refaire)
});
test('Sibra Annecy : le prix du ticket (2,00 €, 1 h) est connu pour le réseau « Sibra Annecy » (plus de copier-coller)',()=>{
 for(const p of ['Sibra Annecy','SIBRA','Sibra']){
  const f=G.fareFor(leg('HOPITAL','ARCAL\'OZ','2026-11-19','Bus',p,'2'));
  assert.equal(f.amount,2);assert.equal(f.validityMinutes,60);assert.match(f.source,/sibra\.fr/);
 }
 assert.equal(G.fareFor(leg('HOPITAL','ARCAL\'OZ','2026-11-19','Bus','Sibra Annecyx','2')),null);
});
test('RTM Marseille : ticket Solo 2,00 € (grille RTM du 01/11/2026), rien avant la date ni pour un car',()=>{
 for(const m of ['Bus','Tram','Métro']){const f=G.fareFor(leg('Vieux-Port','Castellane','2026-11-19',m,'RTM (Marseille)','M1'));
  assert.equal(f.amount,2);assert.equal(f.validityMinutes,60);assert.match(f.source,/DOPEX 11\/26/);}
 assert.equal(G.fareFor(leg('Vieux-Port','Castellane','2026-10-30','Bus','RTM (Marseille)','21')),null);
 assert.equal(G.fareFor(leg('Marseille','Aix','2026-11-19','Car','RTM (Marseille)','50')),null);
});
test("Lignes d'Azur Nice : Solo 1,70 € / 74 min (guide octobre 2026), rien avant la date",()=>{
 for(const m of ['Bus','Tram']){const f=G.fareFor(leg('Jean Médecin','Gare Thiers','2026-11-19',m,"Lignes d'Azur (Nice)",'T1'));
  assert.equal(f.amount,1.7);assert.equal(f.validityMinutes,74);assert.match(f.source,/lignesdazur\.com/);}
 assert.equal(G.fareFor(leg('Jean Médecin','Gare Thiers','2026-09-20','Tram',"Lignes d'Azur (Nice)",'T1')),null);
});
test('Tisséo Toulouse : 1 déplacement 1,90 € / 60 min (e-boutique Tisséo)',()=>{
 for(const m of ['Bus','Tram','Métro']){const f=G.fareFor(leg('Capitole','Jean Jaurès','2026-11-19',m,'Tisséo (Toulouse)','A'));
  assert.equal(f.amount,1.9);assert.equal(f.validityMinutes,60);assert.match(f.source,/eboutique\.tisseo\.fr/);}
});
test('TaM Montpellier : Ticket 1h30 2,10 €',()=>{
 for(const m of ['Bus','Tram']){const f=G.fareFor(leg('Odysseum','Comédie','2026-11-19',m,'TaM (Montpellier, urbain et suburbain)','1'));
  assert.equal(f.amount,2.1);assert.equal(f.validityMinutes,90);assert.match(f.source,/tam-voyages/);}
});
test('Tango Nîmes : Pass Unité 1,40 € / 60 min',()=>{
 for(const m of ['Bus','Tram']){const f=G.fareFor(leg('Esplanade','Gare','2026-11-19',m,'Tango (Nîmes Métropole)','T1'));
  assert.equal(f.amount,1.4);assert.equal(f.validityMinutes,60);assert.match(f.source,/tangobus/);}
});
test('Mistral Toulon : 1 voyage terrestre 1,40 €, sans durée de validité annoncée',()=>{
 const f=G.fareFor(leg('Toulon gare','Mourillon','2026-11-19','Bus','Réseau Mistral (Toulon)','3'));
 assert.equal(f.amount,1.4);assert.equal(f.validityMinutes,null);assert.match(f.source,/reseaumistral\.com/);
});
test('Aix en Bus : 1 voyage 1,40 € (niveau 2, 01/11/2026)',()=>{
 const f=G.fareFor(leg('Rotonde','Gare routière','2026-11-19','Bus','Aix en Bus','3'));
 assert.equal(f.amount,1.4);assert.equal(f.validityMinutes,60);assert.match(f.source,/lametropolemobilite/);
 assert.equal(G.fareFor(leg('Rotonde','Gare routière','2026-10-30','Bus','Aix en Bus','3')),null);
});
test('Palm Bus Cannes : ticket 1 voyage 1,80 € / 59 min',()=>{
 const f=G.fareFor(leg('Gare de Cannes','Hôtel de Ville','2026-11-19','Bus','Palmbus (Cannes Pays de Lérins)','1'));
 assert.equal(f.amount,1.8);assert.equal(f.validityMinutes,59);assert.match(f.source,/palmbus/);
});
test("Ales'y Alès : zone 1 = 1,10 €, zone 2 ou entre zones = 1,80 € (zones du GTFS)",()=>{
 const A="Ales'y (Alès)";
 const f1=G.fareFor(leg('Huit Mai','Mons','2026-11-19','Bus',A,'1'));assert.equal(f1.amount,1.1);assert.equal(f1.validityMinutes,60);
 const f2=G.fareFor(leg('Euzet','Euzet','2026-11-19','Bus',A,'410'));assert.equal(f2.amount,1.8);assert.equal(f2.validityMinutes,90);
 const f3=G.fareFor(leg('Mons','Euzet','2026-11-19','Bus',A,'1'));assert.equal(f3.amount,1.8);
 assert.equal(G.fareFor(leg('Inconnu','Mons','2026-11-19','Bus',A,'1')),null);
 assert.equal(G.fareFor(leg('Huit Mai','Mons','2026-11-17','Bus',A,'1')),null);
});
