'use strict';
// Recherche du 9 nov. 2026 : nouveau jeu de donnees data.gouv.fr "Autoroutes et
// peages en flux libre" (id 68f7f6e2cb331a47613d7778), ressource "portiques free
// flow 07-11-2026", publiee il y a 2 jours (precedente edition : 25-10-2025).
//
// 1. VALIDATION (aucun changement de donnees) : les points officiels "Le Montet
//    Ouest/Est", "Montbeugny Ouest/Est" et "Molinet Ouest/Est" (A79, Aliae)
//    correspondent a <0,01km aux gares deja resolues LE MONTET OUEST/EST et
//    MONTBEUGNY OUEST/EST en base -- confirmant leur exactitude. "MOLINET OUEST"
//    en base correspond en realite au point officiel "Molinet Est" (<0,01km) ;
//    "MOLINET EST" en base ne correspond a aucun des deux points officiels
//    (>5km) -- incoherence de nommage PREEXISTANTE, non liee a ce travail, non
//    modifiee ici (aucune preuve suffisante pour la corriger sans casser des prix
//    existants).
// 2. LE MONTET / MONTBEUGNY / MOLINET (dangling, sans suffixe) : AUCUN des 6
//    nouveaux points officiels ne correspond a ces noms sans suffixe -- ils
//    restent non resolus (les points officiels couvrent uniquement les variantes
//    OUEST/EST deja en base).
// 3. DECOUVERTE MAJEURE : l'edition du 07-11-2026 AJOUTE, pour la premiere fois,
//    4 portiques GPS officiels pour l'A69/Atosca (Verfeil, Villeneuve-les-
//    Lavaur/Maurens-Scopont, Puylaurens, Soual Est-Saint Palais) -- absents de
//    l'edition precedente du 25-10-2025 (confirme par telechargement direct et
//    comparaison des deux fichiers). C'est la toute premiere source officielle
//    GPS pour l'A69 jamais trouvee. MAIS aucune relation A69 n'existe meme a
//    l'etat dangling dans overlay.paires (reseau totalement absent de la base, a
//    la difference d'un simple nom orphelin) ET aucune grille tarifaire
//    officielle structuree n'existe encore (recherche data.gouv.fr "A69"/
//    "atosca"/"tarifs atosca" : 0 resultat ; la presse confirme des le 9 nov.
//    2026 que le tarif de l'A69 est recent, conteste et a deja varie -- aucune
//    base fiable pour integrer un prix sans approximation). L'A69 reste donc
//    HORS BASE, mais la baseline des sources officielles est mise a jour pour
//    suivre precisement ce nouveau dataset et declencher une verification
//    prioritaire de son prochain ajout tarifaire.
//
// Run: node --test tests/peages-flux-libre-a79-validation-a69-gps-decouverte.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');
const overlay = require('../peages-overlay.json');

function dist(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

test('LE MONTET OUEST/EST et MONTBEUGNY OUEST/EST (deja resolus) correspondent au portique officiel flux libre A79', () => {
  const officiel = {
    'LE MONTET OUEST': [46.3891493669593, 3.033184796389492],
    'LE MONTET EST': [46.41735692394454, 3.107230101015186],
    'MONTBEUGNY OUEST': [46.504369873389386, 3.426121557058431],
    'MONTBEUGNY EST': [46.516367174388684, 3.468908690028212],
  };
  for (const [nom, pt] of Object.entries(officiel)) {
    const g = aprr.g.find(x => x[0] === nom) || overlay.gares.find(x => x.nom === nom);
    assert.ok(g, nom + ' doit exister en base');
    const base = g[1] ? g[1][0] : g.points[0];
    assert.ok(dist(base, pt) < 0.01, nom + ' doit correspondre au point officiel a <0.01km');
  }
});

test('LE MONTET, MONTBEUGNY, MOLINET (sans suffixe) restent dangling -- aucun nouveau point officiel ne les couvre', () => {
  const resolved = new Set([...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom)]);
  for (const n of ['LE MONTET', 'MONTBEUGNY', 'MOLINET']) {
    assert.equal(resolved.has(n), false, n + ' ne doit pas avoir ete ajoute sans preuve suffisante');
  }
});

test("A69/Atosca : GPS officiel decouvert le 9 nov. 2026 mais reseau toujours absent de la base (aucun prix officiel disponible)", () => {
  const resolved = new Set([...aprr.g.map(g => g[0]), ...overlay.gares.map(g => g.nom)]);
  for (const n of ['VERFEIL', 'PUYLAURENS', 'SOUAL', 'VILLENEUVE-LES-LAVAUR']) {
    assert.equal(resolved.has(n), false, 'A69 doit rester absent (aucune grille tarifaire officielle)');
  }
  const a69InPaires = overlay.paires.some(p => /VERFEIL|PUYLAURENS|SOUAL|LAVAUR/i.test(p[0]) || /VERFEIL|PUYLAURENS|SOUAL|LAVAUR/i.test(p[1]));
  assert.equal(a69InPaires, false, "aucune relation A69, meme dangling, ne doit avoir ete inventee");
});
