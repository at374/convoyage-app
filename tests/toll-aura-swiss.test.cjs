const test=require('node:test'),assert=require('node:assert/strict');
const {vignette,grandSaintBernard}=require('../toll-swiss-prices.cjs'),{audit}=require('../scripts/audit-aura-toll-coverage.cjs');
const fs=require('node:fs'),path=require('node:path');const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const when={date:'2026-11-01',asOf:'2026-11-01'};
test('Swiss vignette remains in existing toll inputs without a second charge',()=>{
 for(const input of [undefined,{}, {...when,vehicleHasValidVignette:false,trailerPresent:true}, {...when,vehiclePTACkg:7500}]){
  const r=vignette(input);assert.equal(r.amount,0);assert.equal(r.insertIntoBudget,false);assert.equal(r.status,'reference-only');assert.equal(r.currency,'CHF');assert.equal(r.referenceUnitAmount,40);assert.equal(r.entitlementVerified,false);
 }
});
test('Swiss vignette reference preserves the official edition validity without promising route eligibility',()=>{
 const r=vignette();assert.equal(r.validFrom,'2025-12-01');assert.equal(r.validThrough,'2027-01-31');assert.equal(r.routeVerified,false);assert.equal(r.accounting,'existing-toll-input');
});
test('Grand-Saint-Bernard uses native category and departure-side currency, without exchange-rate assumptions',()=>{
 const q={...when,nativeCategory:'A2',departureSide:'CH',product:'single'};
 assert.equal(grandSaintBernard(q).amount,32);assert.equal(grandSaintBernard(q).currency,'CHF');
 const italy=grandSaintBernard({...q,departureSide:'IT'});assert.equal(italy.amount,33.5);assert.equal(italy.currency,'EUR');
 const back=grandSaintBernard({...q,product:'roundTrip'});assert.equal(back.amount,51);assert.equal(back.validity.roundTripDays,30);assert.equal(back.incrementalTripCostVerified,false);
 assert.equal(grandSaintBernard({...q,nativeCategory:'B1'}).amount,50);
 assert.equal(grandSaintBernard({...q,product:'tenPass'}).amount,131);
});
test('Swiss tunnel does not guess French classes, existing-pass rights or later annual versions',()=>{
 const q={...when,nativeCategory:'A2',departureSide:'CH',product:'single'};
 for(const change of [{nativeCategory:1},{nativeCategory:'__proto__'},{departureSide:'FR'},{product:'fiftyPass'},
  {date:'2027-01-01'},{date:'2026-01-31'},{date:'2026-02-30'},{asOf:'2026-11-09'}])assert.equal(grandSaintBernard({...q,...change}).amount,null);
});
test('AURA audit distinguishes fixed prices, matching names, nearby candidates and actual unresolved identities',()=>{
 const base={g:[['Named',[[45,5]]],['Candidate',[[45.01,5]]]]};
 const overlay={gares:[],barrieres:[{id:'fixed',points:[[45.02,5]]}],u:['https://example.test/official'],tarifs:[1,2].map(c=>({id:'c'+c,b:'fixed',c,a:c,f:'2026-01-01',s:'PROUVE',u:0}))};
 const ministry={d:[['Named','38A904801CD',45,5],['Different','38A904802CD',45.01,5],['Open E','38A904803CD',45.02,5],['Missing','38A904804CD',46,5],['Outside','13A905001CD',43,5]]};
 const r=audit(base,overlay,ministry,[],'2026-11-01');assert.equal(r.regionalMinistryGroups,4);assert.equal(r.statusCounts.fixed_gate_prices_present,1);assert.equal(r.statusCounts.named_station_position_matched,1);assert.equal(r.statusCounts.nearby_identity_to_verify,1);assert.equal(r.statusCounts.unresolved,1);assert.equal(r.missingRegionalTariffs,null);
 overlay.tarifs[1].t='2026-01-31';assert.equal(audit(base,overlay,ministry,[],'2026-11-01').statusCounts.fixed_gate_price_unconfirmed,1);
});
test('AURA report is reproducible and does not treat known Cluses/Scionzier fixed gates as missing prices',()=>{
 const r=audit(read('peages-aprr.json'),read('peages-overlay.json'),read('data/gares-peage-officiel.json'),read('data/toll-station-aliases.json').aliases,'2026-11-01');
 assert.deepEqual(r,read('docs/toll-aura-coverage-2026-11-01.json'));
 for(const name of ['Cluses Amont S1','Cluses Aval S1','Scionzier Entrée','Tarare Est ouvert E','Tarare Est ouvert S'])assert.equal(r.groups.find(g=>g.name===name).status,'fixed_gate_prices_present');
 assert.equal(r.nationalCompletenessVerified,false);assert.equal(r.missingRegionalTariffs,null);
});
