const {test}=require('node:test');
const assert=require('node:assert/strict');
const data=require('../data/transport/aravis-fare-reference-2026.json');
const {createCalculator}=require('../transport-aravis-fares.js');
const calculator=createCalculator(data);
test('Thuy and Villards stops use their own tariff sectors in both directions and lines',()=>{
 const fromStop={id:'FR:74280:ZE:57724:HAUTExSAVOIE',lat:45.894817,lon:6.3027046};
 const toStop={id:'FR:74302:ZE:57761:HAUTExSAVOIE',lat:45.9060553,lon:6.3622384};
 for(const line of ['Y62','Y63']){
  const q={networkId:'oura-haute-savoie',line,fromStop,toStop,travelDate:'2026-11-09'};
  const actual=calculator.stopReference(q),expected=calculator.reference({line,fromArea:'Thônes Morette / Thuy',toArea:'Les Villards-sur-Thônes',travelDate:'2026-11-09'});
  assert.equal(actual.amount,expected.amount);assert.equal(actual.stopMappingVerified,true);assert.equal(actual.fareVerified,false);
  assert.equal(calculator.stopReference({...q,fromStop:toStop,toStop:fromStop}).amount,expected.amount);
  assert.equal(calculator.stopReference({...q,fromStop:{...fromStop,lon:6.5}}),null);
 }
});
test('browser data matches the reviewed source matrix',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),context={window:{}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../transport-aravis-fare-data.js'),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.CPAravisFareData)),data);
});
test('verified Y62 terminal stops map to the published zone without confirming the fare',()=>{
 const fromStop={id:'FR:74010:ZE:57539:HAUTExSAVOIE',lat:45.9016985,lon:6.1201612};
 const toStop={id:'FR:74080:ZE:57774:HAUTExSAVOIE',lat:45.9067032,lon:6.4191339};
 const query={networkId:'oura-haute-savoie',line:'Y62',fromStop,toStop,travelDate:'2026-11-09'};
 const result=calculator.stopReference(query);
 assert.equal(result.amount,8.9);assert.equal(result.stopMappingVerified,true);
 assert.equal(result.fareVerified,false);assert.equal(result.travelDateValidityKnown,false);assert.equal(result.serviceConfirmed,false);
 assert.equal(calculator.stopReference({...query,fromStop:toStop,toStop:fromStop}).amount,8.9);
 assert.equal(calculator.stopReference({...query,line:'Y63'}).amount,8.9);
 assert.equal(calculator.stopReference({...query,line:'Y63'}).source,data.lines.Y63.source);
 for(const update of [{line:'Y51'},{networkId:'other'},{fromStop:{...fromStop,lat:46}},{toStop:{...toStop,id:'other'}},{travelDate:'2026-11-06'},{travelDate:'2026-11-31'}])assert.equal(calculator.stopReference({...query,...update}),null);
});
test('verified Y62 intermediate stops use their own sector, not the terminal fare',()=>{
 const annecy={id:'FR:74010:ZE:57539:HAUTExSAVOIE',lat:45.9016985,lon:6.1201612};
 const thones={id:'FR:74280:ZE:57726:HAUTExSAVOIE',lat:45.8829602,lon:6.3239672};
 const saintJean={id:'FR:74239:ZE:57772:HAUTExSAVOIE',lat:45.9226142,lon:6.4110797};
 const bornand={id:'FR:74136:ZE:57773:HAUTExSAVOIE',lat:45.9416443,lon:6.4287024};
 const query={networkId:'oura-haute-savoie',line:'Y62',fromStop:annecy,toStop:thones,travelDate:'2026-11-09'};
 assert.equal(calculator.stopReference(query).amount,4);
 assert.equal(calculator.stopReference({...query,toStop:saintJean}).amount,6.6);
 assert.equal(calculator.stopReference({...query,toStop:bornand}).amount,8.9);
 assert.equal(calculator.stopReference({...query,fromStop:thones,toStop:bornand}).amount,1.7);
 assert.equal(calculator.stopReference({...query,toStop:{...thones,lat:thones.lat+0.01}}),null);
});
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
