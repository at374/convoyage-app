// Audit du réseau ALIAE (A79, Route Centre-Europe Atlantique) — barrière "DEUX CHAISES".
//
// Méthodologie :
// 1. Extraction de TARIFS_ALIAE-2026.pdf (-> aliae.txt, pdftotext -layout) : table
//    "Gare d'entrée | DEUX CHAISES | Distance tarifaire (km) | Classe 1 € | Classe 2 € | ...".
// 2. Cross-validation automatique de chaque relation lisible contre aprr.p existant :
//    126 relations déjà présentes, 0 écart (classes 1 et 2) -> le réseau ALIAE était déjà
//    largement couvert par une intégration antérieure.
// 3. 33 relations manquantes identifiées (gare déjà existante dans aprr.g, mais sans prix
//    vers DEUX CHAISES). Un contrôle géographique (ratio distance-tarifaire / distance
//    haversine depuis DEUX CHAISES) a été appliqué à ces 33 : elles forment deux grappes
//    cohérentes (Corrèze/Puy-de-Dôme ratio ~1.28-1.34 ; Reims/Marne/Meuse ratio ~1.73-2.28),
//    sans aucun écart isolé -> aucun indice de collision de nom (contrairement au cas
//    Viry/Éloise/Bellegarde ci-dessous). Les 33 relations ont donc été ajoutées, avec pour
//    champ "d" la distance tarifaire officielle ALIAE (mesure réelle, non une approximation).
// 4. EXCLUSION VOLONTAIRE : VIRY, ÉLOISE, BELLEGARDE présents dans le tarif ALIAE ont été
//    laissés de côté. Ces noms existent déjà dans aprr.g suite à l'ajout ATMB (barrières
//    Haute-Savoie, Autoroute Blanche A40) de cette même session. Le test de ratio
//    distance-tarifaire/haversine a montré un écart (~3.3x) incompatible avec les deux
//    grappes homogènes ci-dessus, et il n'a pas été possible de confirmer si le "Viry" /
//    "Éloise" / "Bellegarde" d'ALIAE désigne les mêmes points géographiques que ceux de
//    l'ATMB, ou des lieux homonymes situés ailleurs sur le réseau A79. Conformément à la
//    règle "aucune approximation", ces 3 relations ALIAE restent NON intégrées en attendant
//    confirmation.
//
// Rappel : classes de péage 1 et 2 uniquement (véhicules légers / véhicules intermédiaires).

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

const deuxChaisesIdx = idx('DEUX CHAISES');

test('ALIAE : la barrière DEUX CHAISES existe', () => {
  assert.ok(deuxChaisesIdx >= 0);
});

test('ALIAE : les 33 nouvelles relations "Deux Chaises" ont le tarif officiel attendu', () => {
  const prix = prixMap();
  const attendu = [
    ['BEAUMONT', 82.7, 126.3],
    ['CHALONS LA VEUVE', 68.7, 104.9],
    ['CHALONS MOURMELON', 68.1, 105.2],
    ['CHARMONT (LIM.CONC)', 60.6, 93.1],
    ['CHATEAU-THIERRY', 77.6, 117.9],
    ['CLERMONT EN ARGONNE', 72, 111.6],
    ['DORMANS', 74.8, 114.3],
    ['EGLETONS', 19, 28.3],
    ['FRESNES EN WOEVRE', 77.3, 119.1],
    ['JARNY', 78.6, 122],
    ['MANZAT', 6.1, 9.1],
    ['MONT CHOISY', 66.2, 102],
    ['MONTREUIL (REIMS)', 80.2, 121.4],
    ['MONTREUIL AUX LIONS', 82.4, 124.9],
    ['REIMS EST (TAISSY)', 72.5, 110.3],
    ['REIMS NORD (ORMES)', 73.8, 111.9],
    ['REIMS OUEST (THILLOIS)', 74.2, 112.7],
    ['REIMS SUD', 72.3, 109.8],
    ['SOMMESOUS', 63.9, 98.5],
    ['ST ETIENNE AU TEMPLE', 68.1, 105.2],
    ['ST GERMAIN LES VERGNE', 24.3, 36.8],
    ['ST GIBRIEN', 67.3, 103.3],
    ['ST JULIEN SANCY', 11.1, 16.8],
    ['STE MENEHOULD', 70.4, 109],
    ['TULLE EST', 21.9, 32.9],
    ['TULLE NORD', 22.6, 34.2],
    ['USSEL EST', 13.9, 21.4],
    ['USSEL OUEST', 16, 23.4],
    ["VALLEE DE L'AUBE", 61.8, 95.2],
    ['VATRY', 64.7, 99.2],
    ['VERDUN', 77.3, 119.1],
    ['VOIE SACREE', 74.5, 115.1],
    ['VULCANIA BROMONT', 8.5, 12.5],
  ];
  assert.strictEqual(attendu.length, 33);
  for (const [nom, c1, c2] of attendu) {
    const i = idx(nom);
    assert.ok(i >= 0, `${nom} doit exister dans aprr.g`);
    const v = prix.get(Math.min(i, deuxChaisesIdx) * 1000 + Math.max(i, deuxChaisesIdx));
    assert.ok(v, `${nom} <-> DEUX CHAISES doit avoir un prix`);
    assert.ok(Math.abs(v[0] - c1) < 0.05, `${nom} classe1 attendu ${c1} obtenu ${v[0]}`);
    assert.ok(Math.abs(v[1] - c2) < 0.05, `${nom} classe2 attendu ${c2} obtenu ${v[1]}`);
  }
});

test('ALIAE : aucune des 33 nouvelles relations ne crée de doublon ou de collision d\'index', () => {
  const idxs = [
    'BEAUMONT', 'CHALONS LA VEUVE', 'CHALONS MOURMELON', 'CHARMONT (LIM.CONC)', 'CHATEAU-THIERRY',
    'CLERMONT EN ARGONNE', 'DORMANS', 'EGLETONS', 'FRESNES EN WOEVRE', 'JARNY', 'MANZAT',
    'MONT CHOISY', 'MONTREUIL (REIMS)', 'MONTREUIL AUX LIONS', 'REIMS EST (TAISSY)',
    'REIMS NORD (ORMES)', 'REIMS OUEST (THILLOIS)', 'REIMS SUD', 'SOMMESOUS', 'ST ETIENNE AU TEMPLE',
    'ST GERMAIN LES VERGNE', 'ST GIBRIEN', 'ST JULIEN SANCY', 'STE MENEHOULD', 'TULLE EST',
    'TULLE NORD', 'USSEL EST', 'USSEL OUEST', "VALLEE DE L'AUBE", 'VATRY', 'VERDUN', 'VOIE SACREE',
    'VULCANIA BROMONT',
  ].map(idx);
  const vus = new Set();
  for (const i of idxs) {
    assert.ok(i >= 0);
    assert.ok(!vus.has(i), 'index dupliqué: ' + i);
    vus.add(i);
  }
});

test('ALIAE : chantier non résolu — Viry / Éloise / Bellegarde restent exclus de DEUX CHAISES', () => {
  // Ces 3 noms existent (ajoutés pour ATMB), mais on ne peut pas confirmer qu'ils désignent
  // les mêmes points physiques que le tarif ALIAE "Viry"/"Éloise"/"Bellegarde" -> pas de prix
  // vers DEUX CHAISES tant que l'ambiguïté n'est pas levée.
  const prix = prixMap();
  for (const nom of ['VIRY', 'ELOISE', 'BELLEGARDE']) {
    const i = idx(nom);
    assert.ok(i >= 0, `${nom} doit exister (ajouté pour ATMB)`);
    const v = prix.get(Math.min(i, deuxChaisesIdx) * 1000 + Math.max(i, deuxChaisesIdx));
    assert.strictEqual(v, undefined, `${nom} <-> DEUX CHAISES ne doit PAS avoir de prix (ambiguïté non résolue)`);
  }
});
