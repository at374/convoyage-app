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
    pickup:{city:'Annecy',lat:45.9,lng:6.1},
    delivery:{city:'Voiron',lat:45.36,lng:5.59},
    pickup_postal_code:'74000',delivery_postal_code:'38500'
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

test('Otoqi : un origin partiel ne masque ni adresse ni GPS du pickup',()=>{
  const rows=missionRows(H,'Otoqi',{
    external_id:'otoqi-partial-origin',from:'Annecy',to:'Voiron',
    origin:{city:'Annecy'},
    pickup:{address:'12 rue Royale',city:'Annecy',postal_code:'74000',lat:45.91,lng:6.12}
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].origin.street,'12 rue Royale');
  assert.equal(rows[0].origin.postal_code,'74000');
  assert.equal(rows[0].origin.lat,45.91);
  assert.equal(rows[0].origin.lng,6.12);
});

test('DriiveMe : une destination partielle conserve le GPS du dropoff',()=>{
  const rows=missionRows(D,'DriiveMe',{
    external_id:'dm-partial-destination',from:'Annecy',to:'Voiron',
    destination:{city:'Voiron'},
    dropoff:{street:'Rue Louis Armand',city:'Voiron',postal_code:'38500',lat:45.39,lng:5.57}
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].destination.street,'Rue Louis Armand');
  assert.equal(rows[0].destination.postal_code,'38500');
  assert.equal(rows[0].destination.lat,45.39);
  assert.equal(rows[0].destination.lng,5.57);
});

test('la fiche mission lit aussi les adresses pickup et dropoff imbriquées',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const start=app.indexOf('  function adresse(m, cote) {');
  const end=app.indexOf('  // V78 : rentabilité',start);
  assert.ok(start>=0 && end>start,'fonction adresse de la fiche mission présente');
  const source=app.slice(start,end);
  assert.match(source,/lieu\.address \|\| lieu\.street/);
  assert.match(source,/m\.pickup \|\| m\.pickup_location/);
  assert.match(source,/m\.dropoff \|\| m\.delivery \|\| m\.dropoff_location/);
});
