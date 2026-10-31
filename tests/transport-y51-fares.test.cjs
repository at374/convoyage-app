const {test}=require('node:test'),assert=require('node:assert/strict');
const fares=require('../transport-y51-fares.js'),data=require('./fixtures/y51-tariff-reference-2026-10-31.json');
function pin(area,second=false){const rows=data.stops.filter(s=>s[3]===area);const s=rows[second?1:0];return {stopId:s[0],lat:s[1],lon:s[2],name:s[4]};}
function leg(from,to){const start=pin(from),end=pin(to,from===to);const item={networkId:'oura-haute-savoie',line:'Y51',tripId:'synthetic-tariff-example',from:start.stopId,to:end.stopId,departure:'2026-11-02T10:00:00+01:00',arrival:'2026-11-02T11:30:00+01:00'};item.fareScopePath={...item,stops:[start,end]};return item;}
test('official reference examples distinguish regional, Arly and SIBRA fares',()=>{
 for(const [a,b,amount,zone] of [[0,14,8.9,'4'],[0,9,4,'2'],[3,4,1.7,'1'],[8,14,4,'2'],[12,14,1.4,'A'],[0,3,2.5,'S']]){
  const quote=fares.reference(leg(a,b)).portions[0];assert.equal(quote.amountEUR,amount);assert.equal(quote.zone,zone);
  assert.equal(quote.confirmedCurrentFare,false);assert.equal(quote.source,data.source);
 }
 const local=fares.reference(leg(0,3)).portions[0];assert.equal(local.digitalAlternativeEUR,2);
 assert.match(fares.describe(fares.reference(leg(0,14))),/8,90 €.*plein tarif.*hors abonnement/);
 assert.match(fares.describe(fares.reference(leg(0,14))),/à revérifier avant achat/);
});
test('all 225 published cells match the audited fixture and both directions',()=>{
 assert.equal(data.stops.length,91);
 for(let a=0;a<15;a++)for(let b=0;b<15;b++){
  const quote=fares.reference(leg(a,b)).portions[0];
  assert.equal(quote.zone,data.matrix[a][b]);assert.equal(quote.amountEUR,data.singleFullFareEUR[data.matrix[a][b]]);
  assert.equal(data.matrix[a][b],data.matrix[b][a]);
 }
});
test('malformed, stale-year, displaced and foreign scope never becomes a fare',()=>{
 for(const mutate of [x=>x.networkId='another',x=>x.line='Y62',x=>x.fareScopePath=null,
  x=>x.fareScopePath.tripId='other-trip',x=>x.fareScopePath.stops[0].lon+=0.01,
  x=>x.fareScopePath.stops[0].stopId='unknown',x=>x.fareScopePath.stops=[],
  x=>x.departure='2026-02-30T10:00:00Z',x=>x.departure='2026-11-02T24:00:00Z',
  x=>{x.departure='2027-01-02T10:00:00Z';x.fareScopePath.departure=x.departure;},
  x=>{x.departure='2026-02-01T10:00:00Z';x.fareScopePath.departure=x.departure;}]){
  const row=leg(0,14);mutate(row);assert.equal(fares.reference(row).portions[0],null);
 }
 assert.equal(fares.describe(fares.reference(null)),'');
});
test('outside detours cannot use a cheaper endpoint cell and transfers are not totalled',()=>{
 const detour=leg(0,3);detour.fareScopePath.stops.splice(1,0,pin(14));assert.equal(fares.reference(detour).portions[0],null);
 const mixed=fares.reference({legs:[leg(0,14),{networkId:'rail',line:'TER'}]});
 assert.equal(mixed.portions[0].amountEUR,8.9);assert.equal(mixed.portions[1],null);
 assert.match(fares.describe(mixed),/prix inconnu.*Total du trajet non calculé/);
 assert.equal(mixed.confirmedCurrentFare,false);
});
