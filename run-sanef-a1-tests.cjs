'use strict';
/* Run the published SANEF A1 tests without installing packages.
 * Does not deploy, alter toll data, or call any paid service.
 */
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const suites=[
 'test-sanef-a1-regles-officielles-2026.cjs',
 'test-sanef-a1-official-selector.cjs',
 'test-sanef-a1-published-data.cjs',
 'test-sanef-a1-overlay-consistency.cjs',
 'test-sanef-a1-preview-panel.cjs',
 'test-sanef-a1-browser-preview.cjs',
 'test-sanef-a1-preview-lab.cjs',
 'test-sanef-a1-dataset-audit.cjs',
 'test-sanef-a1-end-to-end.cjs',
 'test-sanef-a1-certification-ledger.cjs',
 'test-sanef-a1-no-activation.cjs',
 'test-sanef-a1-alias-audit.cjs'
];
let passed=0;
for(const file of suites){
 const result=spawnSync(process.execPath,[path.join(__dirname,file)],{encoding:'utf8',timeout:30000});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr);
 if(result.error||result.status!==0){
  console.error('FAILED '+file+(result.error?' '+result.error.message:' exit '+result.status));
  process.exitCode=1;
  break;
 }
 console.log('OK '+file);
 passed++;
}
console.log('SANEF A1 suites passed: '+passed+'/'+suites.length);
