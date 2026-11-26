const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../server/hiflow-sync-deploy/hiflow-vendor/sync-core.js');
const D=require('../server/driiveme-sync-deploy/driiveme-vendor/sync-core.js');

function missionRows(sync, platform, mission) {
  return sync.buildRows({cp70_missions_autres:{[platform]:{[mission.external_id]:mission}}},'test-user',{});
}

test('DriiveMe : pickup_address et delivery_address deviennent les adresses canoniques',()=>{
  const rows=missionRows(D,'DriiveMe',{
    external_id:'dm-1',from:'Annecy',to:'Voiron',
    pickup_address:'12 rue Royale, 74000 Annecy',
    delivery_address:'Rue Louis Armand, 38500 Voiron',
    pickup:{zip:'74000',city:'Annecy',lat:45.9,lng:6.1},
    delivery:{zip:'38500',city:'Voiron',lat:45.36,lng:5.59}
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].origin_address,'12 rue Royale, 74000 Annecy');
  assert.equal(rows[0].destination_address,'Rue Louis Armand, 38500 Voiron');
  assert.equal(rows[0].origin.postal_code,'74000');
  assert.equal(rows[0].destination.postal_code,'38500');
});

test('Otoqi : pickup et dropoff imbriqués transmettent adresse et code postal',()=>{
  const rows=missionRows(H,'Otoqi',{
    external_id:'otoqi-1',from:'Annecy',to:'Voiron',
    pickup:{address:'8 rue du Pâquier',zip:'74000',city:'Annecy'},
    dropoff:{street:'14 avenue de la Gare',postal_code:'38500',city:'Voiron'}
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].origin_address,'8 rue du Pâquier');
  assert.equal(rows[0].destination_address,'14 avenue de la Gare');
  assert.equal(rows[0].origin.postal_code,'74000');
  assert.equal(rows[0].destination.postal_code,'38500');
});

test('PopValet : les adresses canoniques restent prioritaires sur les variantes',()=>{
  const rows=missionRows(H,'PopValet',{
    external_id:'pop-1',from:'Annecy',to:'Voiron',
    origin_address:'2 rue du Lac',pickup_address:'Adresse secondaire',
    destination_address:'3 rue de la Paix',dropoff_address:'Adresse secondaire'
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].origin_address,'2 rue du Lac');
  assert.equal(rows[0].destination_address,'3 rue de la Paix');
});
