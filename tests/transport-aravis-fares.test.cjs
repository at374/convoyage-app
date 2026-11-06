const {test}=require('node:test');
const assert=require('node:assert/strict');
const data=require('../data/transport/aravis-fare-reference-2026.json');
const {createCalculator}=require('../transport-aravis-fares.js');
const calculator=createCalculator(data);
test('visually checked endpoint cells produce distinct official area references',()=>{
 for(const line of ['Y62','Y63']){
  const ref=calculator.reference({line,fromArea:'Annecy',toArea:'La Clusaz'});
  assert.equal(ref.zone,'4');assert.equal(ref.amount,8.9);
  assert.equal(calculator.reference({line,fromArea:'Annecy',toArea:'Thônes'}).amount,4);
  assert.equal(calculator.reference({line,fromArea:'La Clusaz',toArea:'Le Grand-Bornand'}).amount,1.7);
  assert.equal(ref.fareVerified,false);assert.equal(ref.stopMappingVerified,false);
  assert.equal(ref.serviceConfirmed,false);assert.equal(ref.travelDateValidityKnown,false);
 }
});
test('both extracted matrices are symmetric and use only known legend entries',()=>{
 for(const {matrix} of Object.values(data.lines))for(let i=0;i<15;i++)for(let j=0;j<15;j++){
  assert.equal(matrix[i][j],matrix[j][i]);
  assert.ok(['1','2','3','4','SIBRA','UNSPECIFIED'].includes(matrix[i][j]));
 }
});
test('Sibra, unspecified cells and unmapped stop names never receive an invented fare',()=>{
 for(const [fromArea,toArea] of [['Annecy','Annecy Albigny'],['Veyrier-du-Lac Chavoires','Annecy-le-Vieux'],['Gare Routière','La Clusaz']])
  assert.equal(calculator.reference({line:'Y62',fromArea,toArea}),null);
 assert.equal(calculator.reference({line:'Y51',fromArea:'Annecy',toArea:'La Clusaz'}),null);
});
test('Declic uses the published rounded amount and requires eligible age',()=>{
 const q={line:'Y62',fromArea:'Annecy',toArea:'La Clusaz',profile:'declic'};
 assert.equal(calculator.reference({...q,age:25}).amount,4.4);
 for(const age of [undefined,26,5,'25'])assert.equal(calculator.reference({...q,age}),null);
 assert.equal(calculator.reference({...q,profile:'senior',age:70}),null);
});
test('before-effective and invalid dates are rejected while future validity stays unknown',()=>{
 const q={line:'Y63',fromArea:'Annecy',toArea:'Thônes'};
 for(const travelDate of ['2026-02-28','2026-02-30','2026-03-99','tomorrow'])assert.equal(calculator.reference({...q,travelDate}),null);
 assert.equal(calculator.reference({...q,travelDate:'2026-11-06'}).travelDateValidityKnown,false);
});
