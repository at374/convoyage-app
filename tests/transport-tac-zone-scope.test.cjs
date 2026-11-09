const test=require('node:test');
const assert=require('node:assert/strict');
const {urbanReference}=require('../transport-fares.js');
const base={networkId:'tac-annemasse',line:'T1',departure:'2026-11-18T12:07:00+01:00'};
test('TAC zone-210 reference remains visible when zone is not supplied',()=>{
 assert.match(urbanReference(base).label,/1,70 €/);
 assert.match(urbanReference({...base,line:'T2'}).label,/1,70 €/);
});
test('TAC known non-210 or cross-border routes do not inherit the zone-210 reference',()=>{
 for(const extra of [{zone:211},{fareZone:'cross-border'},{fromZone:210,toZone:230},{crossBorder:true},{transfrontalier:true}])
  assert.equal(urbanReference({...base,...extra}),null);
 assert.match(urbanReference({...base,fromZone:210,toZone:210}).label,/1,70 €/);
});
test('TAC line 4 and multi-leg journeys remain unpriced',()=>{
 assert.equal(urbanReference({...base,line:'4'}),null);
 assert.equal(urbanReference({...base,legs:[{},{}]}),null);
});
