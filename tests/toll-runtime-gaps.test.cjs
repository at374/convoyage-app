const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {audit,resolver}=require('../scripts/audit-toll-runtime-gaps.cjs');
test('gap audit separates unbound tariff labels, valid zero amounts and conditional fixed prices',()=>{
 const base={g:[['Known',[[46,6]]],['Gate A7',[]],['Gate-A7',[]]]};
 const overlay={gares:[],paires:[['Known','Other',1,2,4],['Other','Third',0,0,2],['Known','Known',null,2,2],['Gate A7','Known',0,0,1]],u:['https://official.example'],barrieres:[{id:'conditional'},{id:'free'}],tarifs:[{b:'conditional',c:1,a:1,s:'PROUVE',f:'2026-01-01',k:{hour:'unknown'},u:0},... [1,2].map(c=>({b:'free',c,a:0,s:'PROUVE',f:'2026-01-01',u:0}))]};
 const r=audit(base,overlay,'2026-11-01');assert.equal(r.counts.unboundEndpointLabels,2);assert.equal(r.counts.rowsWithUnboundEndpoints,2);assert.equal(r.counts.rowsWithInvalidClass1Or2Amounts,1);
 assert.deepEqual(r.fixedClassGaps,[{barrierId:'conditional',missingClasses:[1,2]}]);assert.equal(r.missingPhysicalTolls,null);assert.equal(r.missingNationalTariffs,null);
 assert.equal(resolver(base.g)('gate a7'),-1);assert.equal(resolver(base.g)('Gate A7'),1);
});
test('audit resolver agrees with the actual route calculator for every stored endpoint',()=>{
 const source=fs.readFileSync(require.resolve('../routes-ui.js'),'utf8');
 const start=source.indexOf('  const indexGares = '),end=source.indexOf('\n  // Only explicitly linked gates',start);assert.ok(start>=0&&end>start);
 const actual=vm.runInNewContext(source.slice(start,end)+';indexGares;');
 const base=require('../peages-aprr.json'),o=require('../peages-overlay.json'),gares=base.g.concat(o.gares.filter(n=>!base.g.some(g=>g[0]===n.nom)).map(n=>[n.nom,n.points]));
 const a=actual(gares),b=resolver(gares);for(const n of new Set(o.paires.flatMap(r=>r.slice(0,2))))assert.equal(a(n),b(n),n);
 const r=audit(base,o,'2026-11-01');assert.equal(r.counts.boundEndpointRowsNotRouteCertified+r.counts.rowsWithUnboundEndpoints,o.paires.length);
 assert.deepEqual(r.priorityA79.unboundLabels,['LE MONTET','LE MONTET EST','LE MONTET OUEST','MOLINET','MOLINET EST','MOLINET OUEST','MONTBEUGNY','MONTBEUGNY EST','MONTBEUGNY OUEST']);
});
