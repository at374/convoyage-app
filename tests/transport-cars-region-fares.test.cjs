const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../transport-cars-region-fares');
const ain={networkId:'reseau-interurbain-cars-region-ain-01',line:'A33',tripId:'recorded-service-id',departure:'2026-11-06T10:00:00+01:00'};
const hs={...ain,networkId:'oura-haute-savoie',line:'Y81'};
test('published unit fares require an identified service and the correct network',()=>{
 assert.equal(api.reference(ain).portions[0].amountEUR,2.3);
 assert.equal(api.reference(hs).portions[0].amountEUR,1.7);
 for(const changed of [{networkId:'other'},{tripId:''},{departure:'invalid'},{departure:'2026-02-28T10:00:00+01:00'}])assert.equal(api.reference({...ain,...changed}),null);
});
test('Express, zoned and cross-border lines never inherit a generic fare',()=>{
 for(const line of ['X33','A1','A330'])assert.equal(api.reference({...ain,line}),null);
 for(const line of ['Y02','Y21','Y22','Y51','Y62','Y63','272','274'])assert.equal(api.reference({...hs,line}),null);
});
test('two portions never imply two tickets or a complete total',()=>{
 const ref=api.reference({legs:[ain,hs]});
 assert.equal(ref.portions.length,2);assert.equal(ref.totalEUR,null);assert.equal(ref.fareVerified,false);
 assert.match(api.describe(ref),/Abonnements et correspondances à vérifier/);
 assert.match(api.describe(ref),/total non calculé/);
});
test('unknown portions and walking are preserved as unknown rather than zero',()=>{
 const ref=api.reference({legs:[ain,{mode:'wa_wal'}, {...hs,line:'Y62'}]});
 assert.deepEqual(ref.portions.slice(1),[null,null]);assert.equal(ref.totalEUR,null);
 assert.equal(api.reference({legs:[]}),null);
});

test('reference survives actual GTFS adaptation and ranking without certifying the total',()=>{
 const adapters=require('../transport-adapters');const ranking=require('../transport-ranking');
 const raw={...ain,arrival:'2026-11-06T11:00:00+01:00',from:'A',to:'B'};
 const normalized=adapters.adaptGTFS([{...raw,legs:[raw]}],'Réseau local');
 normalized[0].carsRegionReference=api.reference(raw);
 const result=ranking.rank(normalized,{includeAlternatives:true});
 assert.equal(result[0].journey.carsRegionReference.portions[0].amountEUR,2.3);
 assert.equal(result[0].journey.priceEUR,null);assert.equal(result[0].journey.feasible,false);
 assert.equal(api.reference({...ain,departure:'2026-02-30T10:00:00+01:00'}),null);
});
