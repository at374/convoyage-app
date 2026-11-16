const test=require('node:test'),assert=require('node:assert/strict');
const {report}=require('../scripts/otp-pan-coverage.cjs');
test('couverture : candidats, jamais trajet confirmé',()=>{
 const x=report([{format:'GTFS',dataset:'Sibra Annecy',url:'https://example.org/gtfs.zip',license:'odbl'}]);
 assert.equal(x.httpsGtfsCandidates,1);
 assert.equal(x.axes['Annecy–Genève'].candidates.length,1);
 assert.match(x.axes['Annecy–Genève'].status,/non vérifiés/);
 assert.equal(x.axes['Ambérieu–Lyon'].candidates.length,0);
});
test('couverture : URL absente et doublons',()=>{
 const x=report([{format:'GTFS',dataset:'Sibra',url:'https://example.org/a.zip'},
 {format:'GTFS',dataset:'Sibra copie',url:'https://example.org/a.zip'},
 {format:'GTFS',dataset:'Sibra incomplet',url:null}]);
 assert.equal(x.missingUrls,1);
 assert.equal(x.duplicatedUrls.length,1);
});
test('couverture : refus d’entrée non valide',()=>assert.throws(()=>report(null),/invalide/));
