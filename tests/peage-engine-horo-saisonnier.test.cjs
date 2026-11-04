'use strict';
// Extension V1.1 du moteur (4 nov. 2026, sur demande explicite de l'utilisateur :
// "Etendre le schema (recommande)") : certaines barrieres (ARCOS/Itthenheim A355,
// A86 Duplex Rueil-Velizy-Vaucresson) ont un tarif qui varie selon le jour de la
// semaine / jour ferie / heure de passage (horo-saisonnier), pas seulement selon
// une periode saisonniere "JJ/MM-JJ/MM" (qui existait deja). Regle "aucune
// approximation" : si aucune heure de passage n'est fournie et qu'une barriere a
// UNIQUEMENT des tarifs horo-dependants pour la classe/date demandee, le moteur
// ne choisit JAMAIS arbitrairement un des tarifs -> il remonte INCONNU avec une
// raison explicite. Si une heure est fournie, le bon creneau est selectionne.
// Les barrieres non horo-dependantes (toutes les donnees existantes) ne sont pas
// affectees : testé par les 329 tests pre-existants qui continuent de passer.
// Run: node --test tests/peage-engine-horo-saisonnier.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const CPPeage = require('../peage-engine.js');

function moteurTest() {
  return CPPeage.creerMoteur({
    versions: [
      // Creneau 1 : lundi-vendredi 07h-08h59, classe 1, 5.00 EUR
      { id: 'v1', barrier_station_id: 'TEST-HORO', vehicle_class: 1, amount_eur: 5.00, status: 'PROUVE',
        effective_from: '2026-01-01', effective_to: null,
        tariff_context: { horaires: [{ jours: ['lun', 'mar', 'mer', 'jeu', 'ven'], ferie: false, debut: '07:00', fin: '08:59' }] },
        source_url: 'https://example.test/grille' },
      // Creneau 2 : tous les autres jours/heures (week-end + feries + hors pointe), classe 1, 2.00 EUR
      { id: 'v2', barrier_station_id: 'TEST-HORO', vehicle_class: 1, amount_eur: 2.00, status: 'PROUVE',
        effective_from: '2026-01-01', effective_to: null,
        tariff_context: { horaires: [
          { jours: ['lun', 'mar', 'mer', 'jeu', 'ven'], ferie: false, debut: '00:00', fin: '06:59' },
          { jours: ['lun', 'mar', 'mer', 'jeu', 'ven'], ferie: false, debut: '09:00', fin: '23:59' },
          { jours: ['sam', 'dim'], ferie: true, debut: '00:00', fin: '23:59' },
        ] },
        source_url: 'https://example.test/grille' },
      // Barriere/classe non horo-dependante (comportement historique, sans tariff_context)
      { id: 'v3', barrier_station_id: 'TEST-PLAT', vehicle_class: 1, amount_eur: 3.30, status: 'PROUVE',
        effective_from: '2026-01-01', effective_to: null, tariff_context: null, source_url: 'https://example.test/plat' },
    ],
  });
}

test('heure fournie dans le creneau de pointe -> tarif de pointe selectionne', () => {
  const m = moteurTest();
  // mardi 2026-11-03 (jour ouvre, non ferie), 08h00
  const r = m.barriere('TEST-HORO', 1, '2026-11-03', '08:00');
  assert.equal(r.status, 'PROUVE');
  assert.equal(r.amount, 5.00);
});

test('heure fournie hors pointe (meme jour) -> tarif hors-pointe selectionne', () => {
  const m = moteurTest();
  const r = m.barriere('TEST-HORO', 1, '2026-11-03', '12:00');
  assert.equal(r.status, 'PROUVE');
  assert.equal(r.amount, 2.00);
});

test('heure fournie un dimanche -> tarif week-end/ferie (meme si l\'heure correspondrait a la pointe semaine)', () => {
  const m = moteurTest();
  // dimanche 2026-11-01 (Toussaint, a la fois dimanche ET jour ferie)
  const r = m.barriere('TEST-HORO', 1, '2026-11-01', '07:30');
  assert.equal(r.status, 'PROUVE');
  assert.equal(r.amount, 2.00);
});

test('jour ferie tombant un jour de semaine -> le creneau ferie prime sur le creneau du jour de semaine', () => {
  const m = moteurTest();
  // 2026-07-14 (14 juillet) est un mardi : sans la regle ferie, 08h tomberait dans le creneau de pointe mar/07h-08h59
  const jourSemaine = CPPeage.jourSemaine('2026-07-14');
  assert.equal(jourSemaine, 'mar');
  assert.ok(CPPeage.estJourFerie('2026-07-14'));
  const r = m.barriere('TEST-HORO', 1, '2026-07-14', '08:00');
  assert.equal(r.amount, 2.00, 'le 14 juillet doit utiliser le tarif ferie, pas le tarif de pointe du mardi');
});

test('aucune heure fournie, barriere uniquement horo-dependante pour cette classe -> INCONNU explicite, jamais un montant devine', () => {
  const m = moteurTest();
  const r = m.barriere('TEST-HORO', 1, '2026-11-03');
  assert.equal(r.status, 'INCONNU');
  assert.equal(r.amount, null);
  assert.match(r.reason, /heure de passage/);
});

test('barriere non horo-dependante : comportement identique avec ou sans heure (retro-compatibilite)', () => {
  const m = moteurTest();
  const sansHeure = m.barriere('TEST-PLAT', 1, '2026-11-03');
  const avecHeure = m.barriere('TEST-PLAT', 1, '2026-11-03', '08:00');
  assert.equal(sansHeure.status, 'PROUVE');
  assert.equal(sansHeure.amount, 3.30);
  assert.deepEqual(sansHeure, avecHeure);
});

test('trajet() propage l\'heure a chaque barriere traversee', () => {
  const m = moteurTest();
  const passages = [{ type: 'barriere', station: 'TEST-HORO', passage: 1 }];
  const rPointe = m.trajet(passages, 1, '2026-11-03', '08:00');
  const rHorsPointe = m.trajet(passages, 1, '2026-11-03', '12:00');
  assert.equal(rPointe.total, 5.00);
  assert.equal(rHorsPointe.total, 2.00);
  assert.equal(rPointe.status, 'PROUVE');
});

test('trajet() sans heure sur une barriere horo-dependante -> trajet global INCONNU (jamais de montant partiel devine)', () => {
  const m = moteurTest();
  const passages = [{ type: 'barriere', station: 'TEST-HORO', passage: 1 }];
  const r = m.trajet(passages, 1, '2026-11-03');
  assert.equal(r.total, null);
  assert.equal(r.complet, false);
  assert.equal(r.status, 'INCONNU');
});

test('estJourFerie() calcule correctement les jours feries mobiles (Paques 2026 = 5 avril -> lundi de Paques = 6 avril)', () => {
  assert.ok(CPPeage.estJourFerie('2026-04-06'), 'lundi de Paques 2026');
  assert.ok(!CPPeage.estJourFerie('2026-04-07'));
  // Ascension = Paques + 39 jours ; lundi de Pentecote = Paques + 50 jours
  assert.ok(CPPeage.estJourFerie('2026-05-14'), 'Ascension 2026');
  assert.ok(CPPeage.estJourFerie('2026-05-25'), 'lundi de Pentecote 2026');
});

test('estJourFerie() reconnait les feries fixes', () => {
  for (const d of ['2026-01-01', '2026-05-01', '2026-05-08', '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25']) {
    assert.ok(CPPeage.estJourFerie(d), d + ' doit etre reconnu comme ferie');
  }
  assert.ok(!CPPeage.estJourFerie('2026-11-03'));
});
