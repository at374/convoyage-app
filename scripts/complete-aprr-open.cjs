'use strict';
const fs=require('node:fs'),path=require('node:path');
const {completeOverlay}=require('../toll-aprr-open.cjs');
const file=path.join(__dirname,'../peages-overlay.json');
const {overlay,...report}=completeOverlay(JSON.parse(fs.readFileSync(file,'utf8')));
if(process.argv.includes('--write'))fs.writeFileSync(file,JSON.stringify(overlay)+'\n');
console.log(JSON.stringify({...report,written:process.argv.includes('--write')},null,2));
