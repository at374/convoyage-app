// Audit du réseau ALICORNE (A88, Normandie, Falaise <-> Sées) — réseau jusqu'ici
// totalement absent de la base (découvert par un balayage systématique des opérateurs
// de osm-peages-france.json, suite à la consigne « tout trouver à 100% en France »).
//
// Source : grille tarifaire officielle 2026 transmise par l'utilisateur
// (a88-alicorne.fr/wp-content/uploads/tarifs_2026.pdf), PDF image (non extractible en
// texte), lu visuellement à haute résolution (pdftoppm 300dpi + recadrages ciblés),
// avec double lecture indépendante (vue d'ensemble + zoom par classe) pour chaque valeur
// avant intégration, conformément à la consigne "validation poussée" de l'utilisateur.
//
// Méthodologie :
// 1. La grille 2026 liste 7 gares, dans l'ordre : Falaise Ouest, Falaise sud, Nécy,
//    Argentan ouest, Argentan sud, Mortrée, Sées (= ordre Nord -> Sud le long de l'A88,
//    confirmé par les sorties Wikipedia FR : 11, 11.1, 12, 13, 14, 15, 16).
// 2. Convention "gares jumelles" (déjà observée pour ALIAE/ATMB) : Falaise sud et
//    Argentan sud ont des tarifs identiques à Falaise Ouest et Argentan ouest
//    respectivement vers toutes les autres gares (lignes grisées dans le PDF = valeur
//    identique à la ligne jumelle).
// 3. Vérification GPS croisée (gares-peage-officiel.json, data.gouv.fr, route A0088) :
//    - "Argentan ouest"/"Argentan sud" de la grille ALICORNE correspondent EXACTEMENT
//      (13 m d'écart) à la gare déjà existante "Argentan" (idx 395, utilisée pour 29
//      relations COFIROUTE/A11) -> même barrière physique, réutilisée telle quelle,
//      aucune nouvelle gare créée pour Argentan.
//    - "Sées" de la grille ALICORNE correspond EXACTEMENT (13,5 m d'écart, source
//      data.gouv.fr "Sees Est/Sees Ouest" sur la route A0088) à la gare déjà existante
//      "Sees" (idx 419, utilisée pour les relations ALIS/A28 Sées-Gacé-Orbec-Bernay-
//      Brionne ajoutées plus tôt cette session) -> même interconnexion A88/A28, réutilisée
//      telle quelle.
//    - "Nécy" et "Mortrée" sont des gares réellement nouvelles (aucune existante à moins
//      de 7 km). GPS Nécy : source officielle data.gouv.fr (gare "Necy Est/Necy Ouest",
//      route A0088, échangeur sortie 12) -- distincte de la barrière pleine voie
//      "Ronai BPV" (même source, sortie 12 aussi mais à 1,3 km, système ouvert, PAS
//      dans la grille tarifaire ALICORNE reçue -> tarif Ronai non modélisé, chantier
//      distinct laissé ouvert, aucune donnée inventée).
//    - "Falaise Ouest"/"Falaise Sud" : aucune coordonnée officielle ou OSM trouvée pour
//      ces deux échangeurs (section récente de l'A88, absente de gares-peage-officiel.json
//      et de osm-peages-france.json). Position estimée par interpolation entre le point
//      officiel de Nécy et le centre-ville de Falaise (Wikipedia, 48°53'50"N 0°11'51"O),
//      au prorata des PK Wikipedia (sortie 12 Nécy = PK35, sortie 11.1 Falaise Sud =
//      PK40, sortie 11 Falaise Ouest = PK45). Cette position est une ESTIMATION
//      géographique (non un relevé officiel de gare), mais sans incidence sur le tarif
//      (fixe, issu à 100% de la grille officielle) : elle ne sert qu'aux contrôles
//      anti-collision, et la gare existante la plus proche est à 30 km (aucun risque de
//      confusion ou de double-charge).
// 4. Contrôle anti-collision (0,06 km jumelage / 0,3 km barrière) exécuté pour les 4
//    nouvelles gares (Nécy, Mortrée, Falaise Ouest, Falaise Sud) contre les 540 gares et
//    42 barrières existantes : la plus proche distance trouvée est 7,3 km (Mortrée/Sées)
//    -> aucune collision, aucun risque de double-charge avec peages-overlay.json (qui ne
//    contient aucune entrée ALICORNE/Ronai/Nécy/Falaise/Argentan/Sées à ce jour).
// 5. Champ "d" (distance tarifaire) : la grille ALICORNE ne publie pas de distance en km,
//    uniquement une matrice de prix fixes. Le champ "d" est donc calculé à partir des PK
//    Wikipedia (différence de point kilométrique entre les deux gares le long du
//    corridor A88, qui est une route unique sans embranchement entre ces points) --
//    jamais une valeur inventée ni un simple marqueur, car ce champ est utilisé par
//    routes-ui.js (garde-fou de plausibilité ligne ~129 : ratio distance-tarifaire /
//    distance-réelle du trajet, accepté entre 0,7 et 1,9).
// 6. Relations couvertes : les 15 relations du graphe complet à 6 noeuds distincts
//    (Falaise Ouest, Falaise Sud, Nécy, Argentan[=ouest=sud], Mortrée, Sées).
//
// Rappel : classes de péage 1 et 2 uniquement.

const assert = require('node:assert');
const test = require('node:test');
const aprr = require('../peages-aprr.json');

function idx(n) { return aprr.g.findIndex((g) => g[0] === n); }

function prixMap() {
  const m = new Map();
  for (const l of aprr.p.split(';')) {
    const [a, b, c1, c2] = l.split(',');
    const x = parseInt(a, 36), y = parseInt(b, 36);
    m.set(Math.min(x, y) * 1000 + Math.max(x, y), [c1 / 10, c2 / 10]);
  }
  return m;
}

test('ALICORNE/A88 : les 4 nouvelles gares (Necy, Mortree, Falaise Ouest, Falaise Sud) existent', () => {
  for (const n of ['Necy', 'Mortree', 'Falaise Ouest', 'Falaise Sud']) {
    assert.ok(idx(n) >= 0, n);
  }
});

test('ALICORNE/A88 : Argentan ouest/sud et Sées réutilisent les gares existantes (même point physique)', () => {
  const argentan = idx('Argentan'), sees = idx('Sees');
  assert.ok(argentan >= 0 && sees >= 0);
  // GPS attendu (confirmé à moins de 15 m par data.gouv.fr, route A0088)
  assert.deepStrictEqual(aprr.g[argentan][1][0], [48.6328, 0.191]);
  assert.deepStrictEqual(aprr.g[sees][1][0], [48.64, 0.1789]);
});

test('ALICORNE/A88 : les 15 relations du graphe complet ont le tarif officiel 2026 (classes 1 et 2)', () => {
  const prix = prixMap();
  const fo = idx('Falaise Ouest'), fs = idx('Falaise Sud'), n = idx('Necy');
  const ao = idx('Argentan'), m = idx('Mortree'), s = idx('Sees');
  const attendu = [
    [fo, fs, 0.00, 0.00],
    [fo, n, 1.80, 3.70],
    [fo, ao, 4.60, 7.90],
    [fo, m, 4.60, 7.90],
    [fo, s, 8.70, 15.60],
    [fs, n, 1.80, 3.70],
    [fs, ao, 4.60, 7.90],
    [fs, m, 4.60, 7.90],
    [fs, s, 8.70, 15.60],
    [n, ao, 4.60, 7.90],
    [n, m, 4.60, 7.90],
    [n, s, 8.70, 15.60],
    [ao, m, 0.00, 0.00],
    [ao, s, 4.10, 7.70],
    [m, s, 4.10, 7.70],
  ];
  assert.strictEqual(attendu.length, 15);
  for (const [a, b, c1, c2] of attendu) {
    const v = prix.get(Math.min(a, b) * 1000 + Math.max(a, b));
    assert.ok(v, `relation ${a}<->${b} doit avoir un prix`);
    assert.ok(Math.abs(v[0] - c1) < 0.05, `classe1 attendu ${c1} obtenu ${v[0]}`);
    assert.ok(Math.abs(v[1] - c2) < 0.05, `classe2 attendu ${c2} obtenu ${v[1]}`);
  }
});

test('ALICORNE/A88 : aucune collision GPS (0,06 km jumelage) entre les 4 nouvelles gares et les gares existantes', () => {
  function dist(lat1, lon1, lat2, lon2) {
    return 111 * Math.sqrt((lat1 - lat2) ** 2 + ((lon1 - lon2) * Math.cos((lat1 * Math.PI) / 180)) ** 2);
  }
  const nouvelles = ['Necy', 'Mortree', 'Falaise Ouest', 'Falaise Sud'].map(idx);
  for (const i of nouvelles) {
    const [lat, lon] = aprr.g[i][1][0];
    for (let j = 0; j < aprr.g.length; j++) {
      if (nouvelles.includes(j)) continue;
      for (const p of aprr.g[j][1]) {
        const d = dist(lat, lon, p[0], p[1]);
        assert.ok(d > 0.06, `${aprr.g[i][0]} trop proche de ${aprr.g[j][0]} (${d.toFixed(3)}km)`);
      }
    }
  }
});

test('ALICORNE/A88 : chantier non résolu — la barrière Ronai (système ouvert, sortie 12) reste non modélisée', () => {
  // Rônai (barrière pleine voie) existe (Wikipedia FR, A0088/gares-peage-officiel.json),
  // mais la grille tarifaire ALICORNE reçue cette session ne la mentionne pas : aucun
  // tarif inventé, cette gare n'est pas (encore) ajoutée à aprr.g.
  assert.strictEqual(idx('Ronai'), -1);
  assert.strictEqual(idx('Ronai BPV'), -1);
});
