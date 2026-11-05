'use strict';
// Recherche du 5 nov. 2026 (suite de l'audit data.gouv.fr, voir
// tests/peages-audit-officiel-data-gouv-gaps.test.cjs) : pourquoi "Buchelay BPV"
// et "Dozule BPV Nord" (A13) ne recevront PAS de prix classe1/classe2, a la
// difference des 4 autres angles morts (Audomarois B, St Michel amont, Frejus
// Est, Le Mans Ouest) qui restent de simples lacunes documentaires en attente
// d'une source officielle.
//
// Sources officielles consultees (SANEF/groupe.sanef.com, communiques de presse
// et documents "Conditions de circulation flux libre") :
//   - "CP_A13_En_Flux_Libre.pdf" / "CP A13 passe en flux libre.pdf" (groupe.sanef.com) :
//     bascule de l'autoroute A13 (et A14) en peage "flux libre" (sans arret, sans
//     barriere), nuit du 9 au 10 decembre (2024).
//   - "CP_Travaux_transformation_site_peage_Dozule.pdf" et "CP Pose portique
//     Dozule.pdf" (groupe.sanef.com / autoroutes.sanef.com) : travaux de
//     transformation du site de peage de Dozule, pose d'un portique de detection
//     flux libre (remplace la gare a barrieres).
//   - "A13_Fermeture_A13_Travaux_Dozule.pdf" et le communique "Fermeture A13
//     depose auvent Buchelay bv" (groupe.sanef.com) : depose physique de l'auvent
//     (la structure qui porte les barrieres) a Buchelay, confirmant le demontage
//     du peage classique a cet endroit.
//   - "Conditions-de-circulation-flux-libre_au_180626.pdf" (autoroutes.sanef.com,
//     verifie le 5 nov. 2026) : Dozule n'y apparait que dans des avis de fermeture
//     de bretelle (diffuseur n°30) pour travaux, PAS de grille tarifaire
//     classe1/classe2 ; Buchelay n'y est meme pas mentionne. Aucun document SANEF
//     trouve ne donne de montant fixe par classe pour ces deux points.
//
// Conclusion : en flux libre, il n'y a plus de barriere physique unique a
// franchir avec un tarif attache -- le systeme facture via des portiques de
// detection repartis le long du trajet, sur la base de l'OD (origine-destination)
// reelle du vehicule, pas d'un point de passage isole. Notre modele de donnees
// (overlay.barrieres + overlay.tarifs : un montant fixe classe1/classe2 par
// barriere unique) ne peut PAS representer cela sans risque de prix invente ou
// faux. Ajouter un "tarif barriere" a Buchelay/Dozule serait donc une
// approximation interdite par les regles du projet ("aucune approximation, 100%
// verifie, sources officielles uniquement").
//
// Decision : Buchelay BPV et Dozule BPV Nord restent dans UNK (routes-ui.js),
// qui fait correctement refuser le prix exact ("prix exact non disponible")
// plutot que de l'omettre silencieusement ou de l'inventer. Ce n'est PAS une
// lacune temporaire comme les 4 autres angles morts restants : c'est la
// representation correcte et definitive tant que l'app ne modelise pas la
// tarification multi-portique du flux libre.
//
// Run: node --test tests/peages-buchelay-dozule-flux-libre.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

function lireUNK() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes-ui.js'), 'utf8');
  const m = src.match(/const UNK = \[([\s\S]*?)\];/);
  assert.ok(m, 'UNK introuvable dans routes-ui.js');
  return JSON.parse('[' + m[1] + ']');
}

test('Buchelay BPV et Dozule BPV Nord restent dans UNK (pas de prix flux-libre modelisable)', () => {
  const UNK = lireUNK();
  const BUCHELAY = [48.98384, 1.68125];
  const DOZULE = [49.23071, -0.07124];
  function dist(a, b, c, d) {
    const R = 6371, t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t;
    const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  for (const [lat, lon] of [BUCHELAY, DOZULE]) {
    const min = Math.min(...UNK.map(([ulat, ulon]) => dist(lat, lon, ulat, ulon)));
    assert.ok(min < 0.05, 'point absent de UNK (plus proche a ' + min.toFixed(3) + 'km)');
  }
});

test('aucun tarif barriere n\'a ete invente pour Buchelay/Dozule (pas de melange flux-libre et tarif fixe)', () => {
  const overlay = require('../peages-overlay.json');
  const idsFluxLibre = overlay.barrieres.filter(b => /buchelay|dozul/i.test(b.id));
  assert.deepEqual(idsFluxLibre, [], 'aucune barriere "buchelay"/"dozule" ne doit exister (flux libre non modelisable ici)');
});

test('le commentaire routes-ui.js documente explicitement la raison structurelle (flux libre, pas une lacune provisoire)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes-ui.js'), 'utf8');
  assert.match(src, /flux libre/i);
  assert.match(src, /Buchelay/);
  assert.match(src, /Dozul/);
});
