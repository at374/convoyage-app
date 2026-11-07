const {test}=require('node:test');
const assert=require('node:assert/strict');
const fares=require('../transport-aura-urban-fares.js');
test('AURA urban unit references stay informational and network-scoped',()=>{
 const row={legs:[
  {networkId:'5bae8c2806e3e75b699dc606',line:'A',departure:'2026-11-07T10:00:00+01:00'},
  {networkId:'5c34c93f8b4c4104b817fb3a',line:'M1',departure:'2026-11-07T11:00:00+01:00'},
  {networkId:'6397c0fb7612df845fc8cd1f',line:'A',departure:'2026-11-07T12:00:00+01:00'}
 ]};
 const result=fares.reference(row);assert.equal(result.totalEUR,null);assert.equal(result.fareVerified,false);
 assert.deepEqual(result.portions.filter(Boolean).map(x=>x.amountEUR),[1.4,1.6,1.6]);
 assert.ok(result.portions.filter(Boolean).every(x=>x.fareVerified===false&&x.transferEligibilityVerified===false));
 assert.match(fares.describe(result),/Total non calculé/);
 assert.match(fares.describe(result),/carte bancaire \(tram et lignes Métropoles/);
 assert.match(fares.describe(result),/support éventuel en supplément/);
});
test('Unknown or malformed legs never create a fare reference',()=>{
 assert.equal(fares.reference({networkId:'5bae8c2806e3e75b699dc606',departure:'bad'}),null);
 assert.equal(fares.reference({networkId:'unknown',departure:'2026-11-07T10:00:00+01:00'}),null);
});
