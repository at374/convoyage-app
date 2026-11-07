// Audit du réseau ALIS (A28, Normandie), à partir de la grille 2026 officielle
// (Légifrance, arrêté classes 1/2, source : LEGIARTI000053422450, applicable au 01/02/2026).
//
// Méthodologie :
// - 6 gares citées dans l'arrêté : Alençon, Sées, Gacé, Broglie, Bernay, Brionne (+ raccord A13).
// - Sées, Gacé, Bernay, Brionne existent déjà dans la base avec un GPS connu.
// - « Broglie » n'existe pas sous ce nom, mais le référentiel OSM identifie une barrière
//   « Broglie-Orbec » (opérateur ALIS) à 27 m de la gare déjà présente « Orbec » dans la base :
//   même point physique, nom différent -> utilisé « Orbec » plutôt que créer un doublon.
// - 10 relations du graphe complet Sées/Gacé/Orbec/Bernay/Brionne étaient absentes et ont été
//   ajoutées (contrôle de plausibilité géographique : distances haversine croissantes et
//   cohérentes avec les tarifs croissants, aucune anomalie).
// - « Alençon » de l'arrêté : la base contient deux gares distinctes « Alencon Nord » et
//   « Alencon Sud ». Vérification : les 5 relations Alençon->Sées/Gacé/Orbec/Bernay/Brionne
//   correspondent EXACTEMENT (à 0,05€ près) à « Alencon Nord », et PAS à « Alencon Sud »
//   (qui a des montants légèrement différents, ex. Sées : 7,00/11,80€ au lieu de 6,40/10,70€)
//   -- elles existaient déjà toutes les 5, correctement rattachées à Alencon Nord.
// - EXCLUSION VOLONTAIRE : la relation Alençon->A13 n'est pas vérifiable : « A13 » n'est pas
//   une gare mais une jonction de réseau, non représentable dans le modèle gare-à-gare.
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

test('ALIS/A28 : Sées, Gacé, Orbec, Bernay, Brionne existent', () => {
  for (const n of ['Sees', 'Gace', 'Orbec', 'Bernay', 'Brionne']) assert.ok(idx(n) >= 0, n);
});

test('ALIS/A28 : les 10 relations du graphe complet Sées/Gacé/Orbec/Bernay/Brionne ont le tarif officiel', () => {
  const prix = prixMap();
  const attendu = [
    ['Sees', 'Gace', 2.80, 4.80],
    ['Sees', 'Orbec', 5.80, 10.70],
    ['Gace', 'Orbec', 3.20, 6.10],
    ['Sees', 'Bernay', 9.40, 15.80],
    ['Gace', 'Bernay', 5.20, 9.80],
    ['Orbec', 'Bernay', 1.80, 3.20],
    ['Sees', 'Brionne', 13.70, 23.00],
    ['Gace', 'Brionne', 9.40, 16.30],
    ['Orbec', 'Brionne', 5.30, 9.50],
    ['Bernay', 'Brionne', 3.10, 6.00],
  ];
  assert.strictEqual(attendu.length, 10);
  for (const [nomA, nomB, c1, c2] of attendu) {
    const a = idx(nomA), b = idx(nomB);
    const v = prix.get(Math.min(a, b) * 1000 + Math.max(a, b));
    assert.ok(v, `${nomA} <-> ${nomB} doit avoir un prix`);
    assert.ok(Math.abs(v[0] - c1) < 0.05, `${nomA}/${nomB} classe1 attendu ${c1} obtenu ${v[0]}`);
    assert.ok(Math.abs(v[1] - c2) < 0.05, `${nomA}/${nomB} classe2 attendu ${c2} obtenu ${v[1]}`);
  }
});

test('ALIS/A28 : "Alençon" de l\'arrêté désigne Alencon Nord (pas Alencon Sud) et était déjà tarifé', () => {
  const prix = prixMap();
  const alenconNord = idx('Alencon Nord'), alenconSud = idx('Alencon Sud');
  assert.ok(alenconNord >= 0 && alenconSud >= 0);
  const attendu = [
    ['Sees', 6.40, 10.70], ['Gace', 10.40, 17.10], ['Orbec', 15.40, 25.40],
    ['Bernay', 19.80, 32.00], ['Brionne', 25.40, 41.30],
  ];
  for (const [dest, c1, c2] of attendu) {
    const d = idx(dest);
    const v = prix.get(Math.min(alenconNord, d) * 1000 + Math.max(alenconNord, d));
    assert.ok(v, `Alencon Nord <-> ${dest} doit avoir un prix`);
    assert.ok(Math.abs(v[0] - c1) < 0.05 && Math.abs(v[1] - c2) < 0.05, `Alencon Nord/${dest} : ${v} != ${[c1, c2]}`);
    const vSud = prix.get(Math.min(alenconSud, d) * 1000 + Math.max(alenconSud, d));
    assert.ok(vSud && (Math.abs(vSud[0] - c1) > 0.05 || Math.abs(vSud[1] - c2) > 0.05), `Alencon Sud/${dest} doit différer d'Alencon Nord (gares distinctes)`);
  }
});

test('ALIS/A28 : le réseau ARCOUR (A19, Piffonds/Savigny/Saint-Hilaire/Fontenay/Gondreville/Auxy/Escrennes) était déjà complet', () => {
  // Vérification croisée (grille officielle Légifrance LEGISCTA000053422427) : les gares
  // Savigny-sur-Clairis, Saint-Hilaire-les-Andrésis, Fontenay-sur-Loing, Gondreville-la-Franche
  // existaient déjà sous des noms abrégés (SAVIGNY /CLAIRIS, ST HILAIRE, FONTENAY /LOING,
  // GONDREVILLE A77/N), toutes à moins de 35 m du GPS officiel -- même point physique.
  // Les 15 relations du graphe (hors Piffonds et Chevilly, gares sans GPS vérifiable trouvé)
  // concordaient déjà exactement : rien à ajouter ici.
  const prix = prixMap();
  const noms = ['SAVIGNY /CLAIRIS', 'ST HILAIRE', 'FONTENAY /LOING', 'GONDREVILLE A77/N', 'AUXY', 'ESCRENNES'];
  for (const n of noms) assert.ok(idx(n) >= 0, n);
  let compte = 0;
  for (let i = 0; i < noms.length; i++) for (let j = i + 1; j < noms.length; j++) {
    const a = idx(noms[i]), b = idx(noms[j]);
    if (prix.get(Math.min(a, b) * 1000 + Math.max(a, b))) compte++;
  }
  assert.strictEqual(compte, 15, 'les 15 relations du graphe complet doivent déjà exister');
});
