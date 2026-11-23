// 23/11/2026 (Laurent : un devis Hiflow envoyé, « en attente », n'apparaissait nulle part dans
// Convoyage Ultra) : le parseur devisHiflow (net-core.js) et l'application du devis sur une ligne
// (sync-core.js) existaient déjà, mais hiflow-sync.cjs ne branchait jamais le premier sur le second —
// cp95_devis restait un objet vide codé en dur. Ce test couvre la chaîne complète : une réponse JSON
// « Mes devis » de Hiflow (getConveyorJourneyQuotation) doit faire apparaître fees.devis_numero sur la
// mission « disponible » correspondante une fois passée par buildRows.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const CPNet = require('../server/hiflow-sync-deploy/hiflow-vendor/net-core.js');
const CPSync = require('../server/hiflow-sync-deploy/hiflow-vendor/sync-core.js');

const reponseDevis = (statut) => ({
  response: {
    total_quotations: 1,
    quotations: [{
      id_quotation: 1290066,
      status: statut,
      dates: { created: '20/11/2026 10:00', updated: '20/11/2026 10:00' },
      journey: { id_journey: 1290066 },
      pricing: { conveyor_remuneration: 82.6, gas_fee: 0, toll_fee: 0, taxi_fee: 0, extra_transport_fee: 0, accommodation_fee: 0, exceptional_fee: 0, total_conveyor_fee: 82.6 },
    }],
  },
});

test('devisHiflow : reconnaît une réponse « Mes devis » et ne la confond avec aucun autre parseur', () => {
  const json = reponseDevis('en attente');
  const devis = CPNet.devisHiflow(json);
  assert.ok(Array.isArray(devis) && devis.length === 1);
  assert.equal(devis[0].id_quotation, '1290066');
  assert.equal(devis[0].id_journey, '1290066');
  assert.equal(devis[0].prestation, 82.6);
  assert.equal(CPNet.trajetsHiflow(json), null);
  assert.equal(CPNet.reservationsHiflow(json), null);
  assert.equal(CPNet.facturesHiflow(json), null);
});

test('buildRows : une mission disponible avec un devis « en attente » (non refusé) reçoit fees.devis_numero', () => {
  const devisBucket = {}; for (const q of CPNet.devisHiflow(reponseDevis('en attente'))) devisBucket[q.id_quotation] = q;
  const store = {
    cp50_hiflow_missions: { 1290066: { external_id: '1290066', from: 'Chambéry', to: 'Albertville', status: 'available', fee: 69, last_seen_at: '2026-11-23T06:00:00Z' } },
    cp72_acceptees: { Hiflow: {} }, cp70_missions_autres: {}, cp96_factures: {}, cp95_devis: devisBucket, cp98_attente: {},
  };
  const rows = CPSync.buildRows(store, 'user-1', { plateformes: ['Hiflow'] });
  const mission = rows.find(r => r.platform === 'Hiflow' && r.kind === 'disponible' && r.external_id === '1290066');
  assert.ok(mission, 'la mission doit être présente parmi les lignes construites');
  assert.equal(mission.fees && mission.fees.devis_numero, 1290066);
  assert.equal(mission.fees.devis_total, 82.6);
  assert.equal(mission.fees.devis_accepte, 0);
  assert.equal(mission.fee, 82.6, 'le montant du DEVIS fait foi, pas le tarif affiché par Hiflow');
});

test('buildRows : un devis refusé/supprimé ne doit PAS être appliqué à la mission disponible', () => {
  const devisBucket = {}; for (const q of CPNet.devisHiflow(reponseDevis('rejected'))) devisBucket[q.id_quotation] = q;
  const store = {
    cp50_hiflow_missions: { 1290066: { external_id: '1290066', from: 'Chambéry', to: 'Albertville', status: 'available', fee: 69, last_seen_at: '2026-11-23T06:00:00Z' } },
    cp72_acceptees: { Hiflow: {} }, cp70_missions_autres: {}, cp96_factures: {}, cp95_devis: devisBucket, cp98_attente: {},
  };
  const rows = CPSync.buildRows(store, 'user-1', { plateformes: ['Hiflow'] });
  const mission = rows.find(r => r.platform === 'Hiflow' && r.kind === 'disponible' && r.external_id === '1290066');
  assert.ok(mission);
  assert.equal(mission.fees, null, 'aucun devis_numero : la mission refusée/supprimée reste comme avant');
  assert.equal(mission.fee, 69);
});

test('buildRows : une mission de l\'Agenda (acceptée) reçoit fees.devis_accepte = 1 une fois le devis accepté', () => {
  const devisBucket = {}; for (const q of CPNet.devisHiflow(reponseDevis('accepted'))) devisBucket[q.id_quotation] = q;
  const store = {
    cp50_hiflow_missions: {}, cp70_missions_autres: {}, cp96_factures: {}, cp95_devis: devisBucket, cp98_attente: {},
    cp72_acceptees: { Hiflow: { 5551: { external_id: '5551', ids: { bookingId: '5551', id_journey: '1290066' }, from: 'Chambéry', to: 'Albertville', status: 'acceptee', fee: 69, last_seen_at: '2026-11-23T06:00:00Z' } } },
  };
  const rows = CPSync.buildRows(store, 'user-1', { plateformes: ['Hiflow'] });
  const mission = rows.find(r => r.platform === 'Hiflow' && r.kind === 'acceptee' && r.external_id === '5551');
  assert.ok(mission, 'la mission acceptée doit être présente parmi les lignes construites');
  assert.equal(mission.fees && mission.fees.devis_numero, 1290066);
  assert.equal(mission.fees.devis_accepte, 1);
  assert.equal(mission.fee, 82.6, 'le montant du DEVIS accepté fait foi pour la mission de l\'Agenda');
});

test('hiflow-sync.cjs : « Mes devis » est bien lu à chaque synchro et branché dans armerCapture/store', () => {
  const src = fs.readFileSync(require.resolve('../server/hiflow-sync-deploy/hiflow-sync.cjs'), 'utf8');
  assert.match(src, /async function lireMesDevis\(page\)/);
  assert.match(src, /#quotations/);
  assert.match(src, /CPNet\.devisHiflow\(json\)/);
  assert.match(src, /cp95_devis:\s*devisBucket/);
  assert.doesNotMatch(src, /cp95_devis:\s*\{\}/, 'régression : cp95_devis ne doit plus jamais rester vide en dur');
});
