'use strict';
/* Static integration guard for the isolated SANEF A1 manual lab.
 * Prevents accidental introduction of billing calls or automatic preview.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'sanef-a1-preview-lab.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const routes=fs.readFileSync(path.join(__dirname,'routes-ui.js'),'utf8');
const scripts=['sanef-a1-regles-officielles-2026.js','sanef-a1-official-selector.js','sanef-a1-browser-preview.js','sanef-a1-preview-panel.js'];
let count=0;
for(const name of scripts){
 assert.equal(html.split('src="'+name+'"').length-1,1,'lab missing/duplicate '+name);count++;
 assert.equal(app.split('src="'+name+'"').length-1,1,'app missing/duplicate '+name);count++;
 assert.ok(fs.existsSync(path.join(__dirname,name)));count++;
}
for(const name of ['sanef-a1-modulation-2026.json','sanef-a1-gare-alias-2026.json']){
 assert.ok(fs.existsSync(path.join(__dirname,name)));count++;
}
const scriptOrder=scripts.map(x=>html.indexOf('src="'+x+'"'));
assert.deepEqual([...scriptOrder].sort((a,b)=>a-b),scriptOrder);count++;
assert.match(html,/addEventListener\('click'/);count++;
assert.match(html,/passageGareConfirme/);count++;
assert.match(html,/<select id="direction">/);count++;
assert.match(html,/direction:document\.getElementById\('direction'\)\.value/);count++;
assert.doesNotMatch(html,/direction:'VERS_PARIS'/);count++;
assert.doesNotMatch(html,/names\[29\]/);count++;
assert.doesNotMatch(html,/value="2026-11-08T17:00:00"/);count++;
assert.match(html,/select\.selectedIndex=-1/);count++;
assert.match(html,/Tarif normal classe 1 déjà vérifié/);count++;
assert.doesNotMatch(html,/(?:fetch|XMLHttpRequest)\s*\(\s*['"`][^'"`]*(?:api\/routes|supabase)/i);count++;
assert.doesNotMatch(html,/\b(?:submitMission|saveMission|facturer|updatePeage)\s*\(/);count++;
const labLink='href="sanef-a1-preview-lab.html" target="_blank" rel="noopener noreferrer"';
assert.equal(routes.split(labLink).length-1,1,'manual preview must be linked once from route results');count++;
assert.ok(routes.indexOf(labLink)>routes.indexOf('const render = (target, r, mode) =>'));count++;
assert.ok(routes.indexOf(labLink)<routes.indexOf('const PEAGE_MEMO = new Map()'));count++;
assert.match(html,/Laboratoire expérimental/);count++;
console.log('PASS '+count+' SANEF A1 manual lab integration assertions');
