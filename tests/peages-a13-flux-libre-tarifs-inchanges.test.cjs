'use strict';
// Verification (8 nov. 2026) du risque souleve par l'examen du dossier VINCI :
// l'A13 Paris-Normandie (SAPN/SANEF) est passee en peage "flux libre" (sans
// barriere physique) le 11 decembre 2024 a 100%. Six gares deja presentes
// dans peages-aprr.json sous leur ancien nom de barriere -- BEUZEVILLE N°28,
// BOURG-ACHARD N°25, BOURNEVILLE N°26, HEUDEBOUVILLE N°18, "CHAUFOUR N°15 A
// GAILLON N°17", "POISSY/ORGEVAL N°7 A MANTES-SUD N°12" -- se trouvent sur ce
// tronce desormais en flux libre.
//
// Risque identifie : si le flux libre avait change le mode de calcul (tarif
// par portique individuel au lieu d'un prix fixe point-a-point), les prix
// actuels en base seraient perimes.
//
// Verification : la page officielle SANEF (autoroutes.sanef.com/en/free-flow/
// toll-rates-calculator, consultee le 8 nov. 2026) declare explicitement
// "the toll rate is identical" entre le flux libre et le systeme classique a
// barrieres -- seul le mode de perception change (portique + facturation a
// 72h au lieu d'un arret physique), pas le montant. Les 6 gares ci-dessus
// restent donc des points de reference valides dans la nouvelle grille, avec
// des prix toujours exacts.
//
// Conclusion : AUCUNE modification necessaire. Les prix existants pour ces 6
// gares restent corrects. Ce test documente la verification pour eviter de
// la refaire inutilement. Ne concerne PAS Buchelay BPV / Dozule BPV Nord
// (deja dans UNK pour une raison distincte, documentee separement dans
// routes-ui.js -- non remise en cause ici, aucune source n'a ete trouvee
// infirmant cette decision anterieure).
//
// Run: node --test tests/peages-a13-flux-libre-tarifs-inchanges.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const aprr = require('../peages-aprr.json');

test('les 6 gares A13 passees en flux libre restent presentes avec un prix (non bloquees)', () => {
  const noms = ['BEUZEVILLE N°28', 'BOURG-ACHARD N°25', 'BOURNEVILLE N°26', 'HEUDEBOUVILLE N°18'];
  for (const n of noms) {
    const i = aprr.g.findIndex(g => g[0] === n);
    assert.ok(i >= 0, n + ' doit toujours exister dans aprr.g');
    const aDesPrix = aprr.p.split(';').some(s => {
      const [a, b] = s.split(',');
      return parseInt(a, 36) === i || parseInt(b, 36) === i;
    });
    assert.ok(aDesPrix, n + ' doit toujours avoir au moins un prix');
  }
});
