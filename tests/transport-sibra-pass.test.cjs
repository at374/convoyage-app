const {test}=require('node:test'),assert=require('node:assert/strict');
const pass=require('../transport-sibra-pass.js');
const subscription={active:true,from:'2026-10-01',through:'2026-11-02'};
const leg={networkId:pass.DATASET,line:'4',departure:'2026-11-02T18:00:00+01:00'};
test('SIBRA pass requires explicit calendar dates and ownership declaration',()=>{
 for(const value of [null,{}, {...subscription,active:false},{...subscription,from:'2026-02-30'},{...subscription,through:'2026-09-30'},{...subscription,from:1}])assert.equal(pass.normalize(value),null);
 assert.deepEqual(pass.normalize(subscription),subscription);
 assert.equal(pass.assess(leg,null).coveredLegs,0);
});
test('only known SIBRA dataset and explicit fixed routes are included conditionally',()=>{
 const result=pass.assess(leg,subscription);
 assert.equal(result.coveredLegs,1);assert.equal(result.additionalEUR,0);
 assert.equal(result.conditional,true);assert.equal(result.transportConfirmed,false);
 assert.equal(result.breakdown[0].source,pass.SOURCE);
 for(const update of [{networkId:'other',network:'Sibra'},{networkId:null},{line:'Y51'},{line:'272'},{line:'S4'},{line:'4 Express'},{line:'29'},{line:null}])assert.equal(pass.assess({...leg,...update},subscription).additionalEUR,null);
 assert.equal(pass.assess({...leg,line:'40b'},subscription).coveredLegs,1);
});
test('validity follows Europe/Paris boarding day, including midnight and DST',()=>{
 assert.equal(pass.assess({...leg,departure:'2026-11-02T22:59:59Z'},subscription).coveredLegs,1);
 assert.equal(pass.assess({...leg,departure:'2026-11-02T23:00:00Z'},subscription).coveredLegs,0);
 const lastSummerDay={active:true,from:'2026-10-24',through:'2026-10-24'};
 assert.equal(pass.assess({...leg,departure:'2026-10-24T21:59:59Z'},lastSummerDay).coveredLegs,1);
 assert.equal(pass.assess({...leg,departure:'2026-10-24T22:00:00Z'},lastSummerDay).coveredLegs,0);
 for(const departure of [undefined,'','bad','2026-02-30T10:00:00Z','2026-11-02T24:00:00Z','2026-11-02T10:00:00'])assert.equal(pass.assess({...leg,departure},subscription).coveredLegs,0);
 assert.equal(pass.assess({...leg,departure:'2026-06-30T10:00:00Z'},{active:true,from:'2026-01-01',through:'2026-12-31'}).coveredLegs,0);
});
test('mixed and overnight journeys keep unknown totals and account for each portion',()=>{
 const mixed=pass.assess({legs:[leg,{...leg,networkId:'oura-haute-savoie',line:'Y51'}]},subscription);
 assert.equal(mixed.coveredLegs,1);assert.equal(mixed.additionalEUR,null);
 assert.match(pass.describe(mixed),/portion 1 \(4\) : incluse/);assert.match(pass.describe(mixed),/portion 2 \(Y51\) : prix inconnu/);assert.match(pass.describe(mixed),/total du trajet inconnu/);
 const overnight=pass.assess({departure:leg.departure,legs:[leg,{...leg,departure:'2026-11-03T00:05:00+01:00'}]},subscription);
 assert.equal(overnight.coveredLegs,1);assert.equal(overnight.additionalEUR,null);
 assert.equal(pass.assess({legs:[leg,leg]},subscription).additionalEUR,0);
 assert.equal(pass.assess(null,subscription).additionalEUR,null);
 assert.equal(pass.describe(pass.assess(leg,null)),'');
});
